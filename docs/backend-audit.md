# FixNow — Auditoria do backend (pré-migração para Supabase próprio)

Data: 2026-08-10. **Nenhuma alteração foi feita no backend nem no frontend nesta etapa.**
Backup completo dos dados exportado em CSV (fora do Git): `/mnt/documents/fixnow-backup-20260810/`.

## 1. Inventário do backend ATUAL (Lovable Cloud, projeto gerenciado)

### Extensões
`pgcrypto`, `uuid-ossp`, `pg_stat_statements`, `supabase_vault`, `plpgsql`.

### Enums (schema `public`)
- `app_role`: `client, provider, admin`
- `request_status`: `sent, analyzing, confirmed, on_the_way, in_progress, completed, rated, cancelled`

### Tabelas (13, todas com RLS habilitada)
`addresses, categories, favorites, messages, notifications, profiles, provider_services, providers, quotes, reviews, service_requests, services, user_roles`

### Chaves / constraints
- PK `id uuid` em todas (exceto `profiles.id` = FK para `auth.users`).
- FKs: `addresses/favorites/messages.sender_id/notifications/profiles/reviews.client_id/service_requests.client_id/user_roles → auth.users`;
  `favorites/provider_services/quotes/reviews/service_requests.provider_id → providers`;
  `providers.category_id, services.category_id, service_requests.category_id → categories`;
  `provider_services.service_id, service_requests.service_id → services`;
  `messages.request_id, quotes.request_id, reviews.request_id → service_requests`.
  Regras `ON DELETE` misturam CASCADE e SET NULL (preservar exatamente).
- UNIQUE: `categories.slug`, `services.slug`, `favorites(user_id, provider_id)`, `provider_services(provider_id, service_id)`, `user_roles(user_id, role)`.
- CHECK: `reviews.rating/punctuality/quality/service BETWEEN 1 AND 5`.

### Indexes
Apenas os índices implícitos de PK/UNIQUE listados acima. **Não há índices secundários** (ex.: `service_requests(client_id)`, `messages(request_id)`), o que é aceitável no volume atual mas é uma pendência de performance.

### Funções (6)
`has_role(_user_id uuid, _role app_role)`, `handle_new_user()`, `set_updated_at()`, `notify_on_request()`, `notify_on_message()`, `notify_on_quote()`.

### Triggers (6)
`auth.users → on_auth_user_created (handle_new_user)`; `addresses_updated_at`, `quotes_updated_at` (set_updated_at); `service_requests_notify` (INSERT/UPDATE), `messages_notify`, `quotes_notify`.

### RLS / Policies
32 policies em `public` (ownership por `auth.uid()`, leitura pública em `categories/services/providers/provider_services/reviews`, acesso admin via `has_role`). Lista completa preservada nas migrations versionadas.

### Storage
**Zero buckets e zero objetos no backend atual.** As policies de storage do repositório nunca foram aplicadas.

### Realtime
Nenhuma tabela de `public` está na publicação `supabase_realtime`. O chat usa polling (`refetchInterval: 8000` em `src/lib/collab.ts`). Ou seja: **Realtime não é usado hoje**.

### Edge Functions
Nenhuma. A stack é TanStack Start; a lógica de servidor usa `createServerFn`/rotas `src/routes/api`.

### Auth
Email/senha + Google OAuth via broker gerenciado do Lovable (`@lovable.dev/cloud-auth-js`, `src/integrations/lovable/index.ts`). Roles em `user_roles`, perfil criado por trigger.

### Variáveis de ambiente (hoje, geradas pelo Cloud)
`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID` (cliente) e `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (servidor). Nenhuma chave privada está no código.

### Volume de dados atual
categories 12 · services 24 · providers 12 · provider_services 22 · reviews 30 · profiles 3 · user_roles 3 · service_requests 1 · quotes 3 · messages 4 · notifications 9 · favorites 0 · addresses 0 · storage.objects 0.

---

## 2. DIVERGÊNCIA CRÍTICA: código ≠ backend atual

8 migrations existem em `supabase/migrations/` mas **NÃO estão aplicadas** no backend do Lovable Cloud:

| Migration | O que deveria existir | Existe no Cloud? |
|---|---|---|
| `20260809180000_security_hardening.sql` | `protect_profile_moderation_fields()`, `protect_provider_moderation_fields()`, `validate_service_request_update()` + triggers; policies `Users can view own role` / `Admins manage roles` | ❌ |
| `20260809180100_secure_quote_and_price_updates.sql` | `validate_service_request_price()`, `validate_quote_update()` + triggers | ❌ |
| `20260809180200_security_hardening_inserts.sql` | reescrita das funções acima cobrindo INSERT | ❌ |
| `20260809180300_fix_quote_insert_trigger.sql` | correção de `OLD` em INSERT | ❌ |
| `20260809190000_photo_storage.sql` | bucket **privado** `service-request-photos` + 3 policies | ❌ (bucket inexistente) |
| `20260809193000_provider_photo_storage.sql` | buckets `avatars` e `provider-work-photos` + policies | ❌ (buckets inexistentes) |
| `20260809230000_secure_service_request_scheduling.sql` | `validate_service_request_scheduling()` + trigger (validação de agendamento no banco) | ❌ |
| `20260810100000` + `20260810113000_harden_request_lifecycle.sql` | ownership de orçamento e máquina de estados do pedido no banco | ❌ |

**Consequência prática hoje:** upload de fotos, validação de agendamento no servidor, máquina de estados do pedido e proteção de campos de moderação (`blocked`, `approved`, `verified`) **não estão sendo aplicados pelo banco** — a segurança dessas regras depende só do frontend. Isso é um risco atual, independente da migração.

---

## 3. O que precisa ser migrado

Reproduzível 100% por migrations versionadas (nada precisa ser criado do zero):
schema + enums + constraints + FKs + índices + 6 funções + 6 triggers + 32 policies + 3 buckets + policies de storage.

Precisa de decisão manual / ação sua:
1. **Aplicar ou não as 8 migrations pendentes** no novo projeto (recomendo sim — é o estado esperado pelo código).
2. **Trigger em `auth.users`** (`on_auth_user_created`): só pode ser criado por um papel com acesso ao schema `auth` — via CLI/SQL editor do seu projeto, não pela API.
3. **Dados de `auth.users`** (3 usuários): não exportáveis daqui (schema `auth` sem permissão). Ou os usuários recadastram, ou você faz o export via CLI/Admin API do projeto de origem. Como todas as FKs apontam para `auth.users`, os dados de `profiles`, `service_requests`, etc. só podem ser reimportados **depois** dos usuários, mantendo os mesmos UUIDs.
4. **Google OAuth**: hoje usa o broker gerenciado do Lovable. No seu Supabase será preciso criar credenciais OAuth próprias no Google Cloud e trocar `lovable.auth.signInWithOAuth` por `supabase.auth.signInWithOAuth`.
5. **Desconectar o Lovable Cloud não é possível neste projeto**; conectar um Supabase próprio exige a integração oficial de Supabase feita por você na UI do Lovable — eu não posso reescrever `.env`/`src/integrations/supabase/client.ts` (arquivos gerados).

## 4. Riscos identificados
- Reimportar dados sem os mesmos UUIDs de `auth.users` quebra todas as FKs.
- Buckets ausentes: nenhum arquivo a migrar (bom), mas o fluxo de fotos nunca foi exercitado de ponta a ponta.
- Concorrência de agendamento: **não há constraint/trigger ativo** hoje; a migration `20260809230000` cobre a validação, mas não há unique constraint impedindo dois pedidos no mesmo horário do mesmo prestador. Documentado, não alterado.

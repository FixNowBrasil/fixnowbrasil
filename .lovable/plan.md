# Auditoria das migrations do FixNow (pré-aplicação no Supabase novo)

Análise apenas de leitura dos 14 arquivos em `supabase/migrations`. Nada foi executado.

## 1. Migration que cria o schema inicial

`20260808183239_02fcf781-....sql` (263 linhas) — cria os 2 enums, 8 tabelas iniciais, GRANTs, RLS, 2 funções, o trigger em `auth.users` e o seed demonstrativo.

## 2. Ordem de aplicação

Ordem alfabética/cronológica do nome do arquivo (é a ordem correta e a que o runner usa):

```text
1  20260808183239_...  schema base + seed
2  20260808183301_...  has_role vira SECURITY INVOKER + revokes
3  20260809160359_...  quotes, messages, notifications, addresses, admin, set_updated_at
4  20260809160433_...  funções + triggers de notificação
5  20260809160452_...  revokes das funções de trigger
6  20260809180000_security_hardening.sql
7  20260809180100_secure_quote_and_price_updates.sql
8  20260809180200_security_hardening_inserts.sql
9  20260809180300_fix_quote_insert_trigger.sql
10 20260809190000_photo_storage.sql
11 20260809193000_provider_photo_storage.sql
12 20260809230000_secure_service_request_scheduling.sql
13 20260810100000_secure_provider_quote_insert.sql
14 20260810113000_harden_request_lifecycle.sql
```

Há dependências reais de ordem: 3 depende de 1; 4 depende de 3; 7/8/9/13 redefinem funções de orçamento na sequência (a última versão vence); 10/11 dependem de `service_requests`/`providers`.

## 3. Tabelas criadas (13)

`profiles`, `user_roles`, `categories`, `services`, `providers`, `provider_services`, `service_requests`, `reviews`, `favorites` (migration 1) e `quotes`, `messages`, `notifications`, `addresses` (migration 3). A migration 3 também adiciona `profiles.blocked`.

## 4. Enums (2)

`app_role` (client, provider, admin) e `request_status` (sent, analyzing, confirmed, on_the_way, in_progress, completed, rated, cancelled).

## 5. Functions

Base: `has_role(_user_id, _role)`, `handle_new_user()`, `set_updated_at()`, `notify_on_request()`, `notify_on_message()`, `notify_on_quote()`.

Hardening: `has_role(_role, _user_id)` (sobrecarga nova, argumentos invertidos), `protect_profile_moderation_fields()`, `protect_provider_moderation_fields()`, `validate_service_request_update()`, `validate_service_request_price()`, `validate_quote_update()`, `validate_service_request_scheduling()`, `validate_service_request_status_update()`.

Total final: 13 funções (a `has_role` existe em duas assinaturas).

## 6. Triggers

`auth.users → on_auth_user_created`; `quotes_updated_at`, `addresses_updated_at`; `service_requests_notify` (INSERT/UPDATE), `messages_notify`, `quotes_notify`; e os de hardening: `protect_profile_moderation_fields`, `protect_provider_moderation_fields`, `validate_service_request_update`, `validate_service_request_price`, `validate_quote_update`, `validate_service_request_scheduling`, `trg_validate_service_request_status`.

Também 2 índices únicos: `service_requests_provider_scheduled_at_active_idx` (impede duas reservas ativas no mesmo horário do prestador) e `quotes_one_accepted_per_request`.

## 7. RLS / Policies

RLS habilitada nas 13 tabelas, com GRANTs explícitos para `anon`/`authenticated`/`service_role` em cada `CREATE TABLE`. Cerca de 32 policies em `public`: leitura pública em `categories`, `services`, `providers`, `provider_services`, `reviews`; ownership por `auth.uid()` em `profiles`, `favorites`, `addresses`, `notifications`, `service_requests`, `messages`, `quotes`; e policies de admin via `has_role`. A migration 6 recria as policies de `user_roles` (`Users can view own role`, `Admins manage roles`).

## 8. Storage

- Migration 10: bucket **privado** `service-request-photos` + 3 policies (upload/leitura por participantes/exclusão).
- Migration 11: buckets **públicos** `avatars` e `provider-work-photos` + 6 policies (upload/update/delete do próprio prestador).

Ambas usam `on conflict (id) do update`, então são reexecutáveis.

## 9. Migrations puramente incrementais

2, 5, 9 e 13 são só ajustes (revokes e correções de função). 4, 6, 7, 8, 12 e 14 adicionam comportamento novo sem criar tabela. 10 e 11 são só Storage. Apenas 1 e 3 criam tabelas.

## 10. Dependência dos 3 usuários de teste

Nenhuma. Nenhuma migration insere ou referencia UUIDs de usuários. O seed de `providers` cria os 10 prestadores demo com `user_id` nulo, e `reviews` demo não têm `client_id`. Aplicar tudo em banco vazio funciona sem nenhum usuário existente.

## 11. Instruções destrutivas

Não há `TRUNCATE`, `DELETE FROM` nem `DROP TABLE/COLUMN/TYPE`. Os únicos `DROP` são `drop trigger if exists` e `drop policy if exists` imediatamente seguidos da recriação — padrão idempotente, sem perda de dados. Existem `REVOKE` intencionais de EXECUTE em funções internas.

Ponto de atenção: as migrations 1 e 3 **não** são idempotentes (`CREATE TABLE` / `CREATE POLICY` sem `IF NOT EXISTS`). Em banco vazio isso é irrelevante; se rodadas duas vezes, falham com erro — sem destruir nada.

## 12. As migrations reproduzem o backend atual?

Reproduzem o backend **esperado pelo código** — na verdade um superconjunto do que está hoje no Lovable Cloud, porque as 8 migrations de hardening/storage nunca foram aplicadas lá. Diferenças em relação ao ambiente atual:

- Storage: hoje há zero buckets; as migrations criam os 3 buckets que o código de upload já usa.
- Validações de ciclo de vida, agendamento, preço e moderação passam a ser aplicadas no banco (hoje só no frontend).
- Dados: as migrations trazem só o seed demo (12 categorias, 24 serviços, 10 prestadores, 30 avaliações). O Cloud hoje tem 12 prestadores (2 criados por usuários reais), 1 pedido, 3 orçamentos, 4 mensagens, 9 notificações e 3 perfis — nada disso está nas migrations.

## Sobre o `01_schema.sql`, `02/03` e `LEIA-ME`

Aqueles arquivos foram gerados em `/mnt/documents/fixnow-migracao-supabase/`, que é a área de artefatos do sandbox e **não faz parte da árvore do projeto** nem do Git — por isso não aparecem no explorador. Eram um pacote consolidado (schema unificado + dados exportados do Cloud) para colar no SQL Editor. Como você optou por não migrar os usuários/dados de teste, esse pacote deixa de ser necessário: as migrations versionadas em `supabase/migrations` bastam.

## Conclusão: é seguro aplicar?

Sim, é seguro aplicar as 14 migrations, na ordem acima, no projeto vazio. Nada apaga dados, nada depende de usuários preexistentes.

Duas ressalvas antes de rodar:

1. O trigger `on_auth_user_created` é criado no schema `auth` — precisa ser executado no SQL Editor do seu projeto (role com acesso a `auth`), não pela API.
2. Ao final o banco terá apenas os dados demo do seed; pedidos, orçamentos, mensagens e perfis atuais não serão levados.

## Próximo passo proposto

Se você aprovar, eu:

1. Aplico as 14 migrations no projeto novo, na ordem, verificando o resultado de cada etapa.
2. Confiro tabelas, enums, funções, triggers, policies e buckets criados.
3. Rodo o linter de segurança e o build, e valido os fluxos públicos no preview.

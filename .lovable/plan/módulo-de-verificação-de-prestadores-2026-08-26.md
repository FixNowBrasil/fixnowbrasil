# Módulo de Verificação de Prestadores

## O que já existe (análise)

- Tabela `providers` com `approved`, `verified`, `user_id`, fotos de trabalho, cidade, raio, etc. Perfil do prestador é criado/editado em `/painel`.
- Autenticação: Supabase Auth + `user_roles` (`client`/`provider`/`admin`), `has_role()`, rotas protegidas em `_authenticated/`.
- Storage: 3 buckets privados (`avatars`, `provider-work-photos`, `service-request-photos`) com URLs assinadas.
- RLS: prestador edita o próprio registro; campos de moderação (`approved`, `verified`, `rating`) bloqueados por trigger e só liberados para admin.
- Matching: RPC `create_request_with_matching` filtra `providers.approved = true`; listagem pública (`providersQuery`) idem.
- Admin: `/admin` aprova/suspende prestadores com um clique, sem documentos nem histórico.

Ou seja, hoje a "aprovação" é um botão sem processo. O módulo novo passa a ser a fonte da verdade e mantém `providers.approved` sincronizado, para não quebrar nada existente.

## O que será construído

### Banco

- Enums `verification_status` (draft, pending, under_review, approved, rejected, suspended) e `verification_step`.
- Tabela `provider_verifications` (1 por prestador) com todos os campos pedidos: dados pessoais, documento, selfie + `liveness_status`, endereço, dados profissionais, verificação de contato, campos Stripe, campos de análise (`reviewed_by`, `reviewed_at`, `rejection_reason`) e aceite de termos (`terms_accepted_at`, `privacy_accepted_at`).
- Tabela `verification_audit_logs` (verification_id, actor, ação, status anterior/novo, motivo, data).
- Trigger que impede o prestador de alterar `status`, `current_step=review` fora do envio, `reviewed_by/at`, `rejection_reason`, `stripe_verification_status`, `liveness_status`.
- RPCs `SECURITY DEFINER`:
  - `submit_verification()` — valida obrigatórios + aceite dos termos, muda para `under_review`, grava log.
  - `review_verification(id, ação, motivo)` — só admin; aprovar/rejeitar/suspender, exige motivo na rejeição, grava log e sincroniza `providers.approved` e `providers.verified`.
- Matching e listagem passam a exigir verificação aprovada no próprio banco (RPC + policy de leitura pública de `providers`), além de `approved`.

### Storage

- Bucket privado novo `verification-documents`, limite de 10 MB, caminhos `{provider_id}/identity/front|back`, `{provider_id}/selfie`, `{provider_id}/address`.
- Policies: prestador só grava/lê a própria pasta; admin lê tudo; ninguém mais tem acesso. Documentos sempre via URL assinada de curta duração (5 min) gerada no servidor.

### Frontend do prestador

- Rota `/provider/verification` (dentro da área autenticada) com barra de progresso e 7 etapas: Dados pessoais, Identidade, Selfie, Endereço, Profissional, Financeiro, Análise.
- Salvamento parcial a cada etapa (`draft` → `pending`), validação com Zod (CPF com dígito verificador, telefone BR, e-mail, data de nascimento maior de 18).
- Upload com validação de tipo/tamanho e pré-visualização por URL assinada.
- Etapa profissional reaproveita categorias/serviços e o uploader de fotos de trabalho já existentes.
- Etapa financeira: verificação de telefone/e-mail e bloco de Stripe Connect marcado como "em breve" até a conta de plataforma existir.
- Tela de revisão final com aceite dos Termos e da Política de Privacidade (obrigatório) e tela "Cadastro em análise" com motivo de rejeição quando houver.
- `/painel` ganha um aviso de status e link para completar a verificação; nada é removido.

### Painel administrativo

- Nova aba em `/admin`: lista de verificações (nome, status, data de envio) com filtros por status.
- Tela de detalhe com todos os dados, documentos exibidos por URL assinada temporária, status Stripe, e ações aprovar / rejeitar (motivo obrigatório) / suspender.
- Toda ação registrada em `verification_audit_logs`.

### Perfil público

- Prestador aprovado exibe "✓ Identidade verificada" e "✓ Cadastro profissional verificado". Nenhum dado sensível é exposto.

## Segurança e LGPD

- RLS em todas as tabelas novas; prestador só enxerga a própria verificação, admin enxerga todas.
- Campos de moderação controlados exclusivamente por RPC de admin.
- CPF nunca aparece em logs; no admin é exibido mascarado com opção de revelar.
- Documentos nunca públicos; acesso apenas por URL assinada curta.
- Finalidade, retenção e exclusão dos documentos descritas na tela de consentimento; exclusão dos arquivos ao rejeitar definitivamente fica disponível como ação de admin.

## Pontos que dependem de integração externa

- **Liveness detection**: apenas estrutura (`liveness_status`) e upload de selfie; a checagem automática exige provedor externo.
- **Stripe Connect**: campos e UI preparados; a criação de contas conectadas exige habilitar Connect na conta Stripe.
- **Verificação de telefone (SMS)**: precisa de provedor de SMS; nesta entrega a verificação de e-mail usa a sessão atual e o telefone fica marcado como pendente.

## Entrega em duas partes

1. Migration (tabelas, enums, triggers, RPCs, policies) + bucket.
2. Frontend do prestador, painel admin, selos no perfil público e integração no matching.

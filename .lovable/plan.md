# Conectar o FixNow ao Supabase próprio (FixNowBrasil)

## Objetivo
Trocar o backend do FixNow do Lovable Cloud para o projeto Supabase externo `FixNowBrasil` (South America / São Paulo), sem perder dados nem funcionalidades.

## O que já está pronto
- Pacote de migração versionado em `/mnt/documents/fixnow-migracao-supabase/`:
  - `01_schema.sql` — schema completo (13 tabelas, enums, RLS/GRANTs, funções, triggers, 3 buckets de Storage).
  - `02_dados_publicos.sql` — categorias, serviços, prestadores e avaliações.
  - `03_dados_usuarios.sql` — perfis, pedidos, mensagens e notificações.
  - `00_LEIA-ME.md` — guia com os UUIDs dos usuários que precisam ser recriados.

## Etapas do plano

### 1. Conectar o projeto na UI do Lovable (ação manual do usuário)
A troca de Supabase só pode ser feita pelo usuário no editor; o agente não consegue ativar o connector.

1. No editor do Lovable, abrir **Connectors** na barra lateral → **Supabase**.
2. Conectar/autorizar a conta Supabase.
3. Escolher o projeto **FixNowBrasil** (`alskvtcmsrofmabtjjbo`, South America / São Paulo).
4. Confirmar a conexão — o Lovable reescreve automaticamente `src/integrations/supabase/client.ts` e as variáveis `VITE_SUPABASE_*` / `SUPABASE_*`.

### 2. Aplicar o schema e os dados no Supabase externo
No SQL Editor do projeto FixNowBrasil, executar na ordem:

1. `01_schema.sql`
2. `02_dados_publicos.sql`
3. `03_dados_usuarios.sql`

Os scripts usam `ON CONFLICT DO NOTHING` e desabilitam triggers temporariamente, então podem ser reexecutados se necessário.

### 3. Recriar os usuários com os mesmos UUIDs
Os 3 usuários do backup precisam ser recriados manualmente com os UUIDs listados em `00_LEIA-ME.md`. Senhas podem ser novas, mas os UUIDs devem ser preservados para manter as chaves estrangeiras (perfis, pedidos, mensagens, etc.).

### 4. Validar o app contra o novo backend
Após o usuário confirmar que a conexão está feita e os scripts foram executados, o agente irá:

1. Verificar se as variáveis de ambiente foram atualizadas corretamente.
2. Rodar o build do projeto para garantir que não há erros de compilação.
3. Testar fluxos críticos no preview:
   - Login/autenticação.
   - Busca de prestadores e categorias.
   - Solicitação de orçamento.
   - Chat e painel de orçamentos.
   - Upload de fotos (Storage).
   - Painel administrativo.
4. Corrigir qualquer problema de integração encontrado.

## Decisões manuais pendentes
- Confirmar se o usuário deseja manter o Lovable Cloud desativado após a migração (recomendado, para evitar dados duplicados).
- Definir se haverá um período de transição ou corte imediato.

## Critérios de conclusão
- [ ] Connector Supabase apontando para FixNowBrasil.
- [ ] Schema e dados aplicados no novo projeto.
- [ ] Usuários recriados com UUIDs originais.
- [ ] Build passando sem erros.
- [ ] Fluxos críticos validados no preview.

# Auditoria técnica do FixNow (somente leitura)

Nenhum arquivo do projeto foi alterado. Abaixo, o estado real do código e do banco hoje conectado, as divergências e as prioridades.

## Achado nº 1 (bloqueante): o backend conectado NÃO é o FixNowBrasil

O ambiente do projeto ainda aponta para o Supabase antigo do Lovable Cloud (`...mbibutmwqedakdaqcjla.supabase.co`), e não para `alskvtcmsrofmabtjjbo` (FixNowBrasil). Toda a auditoria de banco abaixo reflete o backend que o app usa de fato hoje. Enquanto a troca não for feita na interface (Connectors → Supabase), qualquer conclusão sobre "o novo banco" é teórica.

## Divergências entre código e banco conectado

1. **Storage inexistente.** O banco conectado não tem nenhum bucket. O código usa três: `service-request-photos` (privado, com signed URL), `avatars` e `provider-work-photos` (públicos). Todo upload de fotos de pedido, avatar e portfólio falha em produção.
2. **Migrations de hardening não aplicadas.** Existem 14 arquivos em `supabase/migrations`, mas o banco conectado só reflete as primeiras. Faltam: validação de transição de status de pedidos, hardening de agendamento, hardening de inserção de orçamento e as políticas/buckets de Storage. Hoje a máquina de estados só existe no cliente (`src/lib/request-lifecycle.ts`) — o banco aceita qualquer salto de status vindo de quem tem permissão de update.
3. **`provider_services` sem escrita.** A tabela só tem policy de leitura pública; `INSERT`/`UPDATE`/`DELETE` estão negados. O painel do prestador (`painel.tsx`) tenta inserir, atualizar preço e excluir serviços — todas essas ações falham por RLS.
4. **`providers.availability` com dois formatos.** A coluna é texto com default `"Seg a Sáb, 8h às 18h"`, mas `ProviderSchedule` grava JSON (`JSON.stringify(schedule)`) e o perfil público exibe o valor cru. Perfis com agenda configurada mostram JSON ao usuário.
5. **Reputação não recalculada.** `providers.rating`, `reviews_count` e `jobs_done` são colunas estáticas; não há trigger no banco conectado que as atualize quando uma avaliação é criada ou removida. As notas exibidas (inclusive no JSON-LD de SEO) são as de seed.
6. **`user_roles` sem policy de escrita.** Correto do ponto de vista de segurança, mas significa que só o trigger `handle_new_user` define papéis; não há caminho de admin para promover/rebaixar alguém, embora o painel admin sugira gestão de usuários.
7. **`has_role` não é SECURITY DEFINER.** Funciona para checar o próprio papel, mas quebra em qualquer uso futuro que verifique o papel de terceiros sob RLS.

## Arquitetura e frontend

- Estrutura TanStack Start correta: rotas em `src/routes`, subárvore protegida por `_authenticated/route.tsx` com `ssr: false`, `start.ts` registrando CSRF e o attacher de bearer.
- **Não existe nenhuma server function.** Todo acesso a dados é feito no browser com a chave publicável, direto do cliente Supabase. Isso é viável porque a RLS cobre os casos, mas concentra a segurança inteira nas policies — que, como visto acima, estão incompletas no banco conectado.
- Leitura de dados é feita com `useQuery` dentro dos componentes em vez de `loader` + `ensureQueryData`, exceto no perfil do prestador. Consequência: mais spinners, sem SSR de conteúdo e prefetch limitado.
- Consultas amplas sem paginação (`providers`, `service_requests`, `reviews`, listas de admin) — degrada com volume.
- Alguns `as unknown as` para contornar tipos gerados (pedido, status), o que apaga erros de tipo reais.

## Autenticação e OAuth

- Google via broker do Lovable, com `redirect_uri` público — correto.
- E-mail/senha com confirmação e tratamento de sessão nula no signup — correto.
- `useAuth` usa `getSession` para estado de UI (aceitável) e busca papéis em `user_roles`; o gate de rota usa `getUser` (correto).
- Papel escolhido no cadastro (`client`/`provider`) vai em `raw_user_meta_data` e é consumido pelo trigger. Metadados são controlados pelo usuário: hoje ninguém consegue virar `admin` por aí (o trigger só aceita o enum e o default), mas o caminho merece um bloqueio explícito de `admin`.
- Não há página `/reset-password`, então recuperação de senha não existe.

## Fluxos de cliente, prestador e admin

- Cliente: busca → categoria → perfil → solicitação em etapas → acompanhamento com timeline → avaliação. Fluxo completo e coerente.
- Prestador: painel cria/edita perfil, gerencia serviços (quebrado por RLS) e avança status dos pedidos.
- Admin: aprovar/verificar prestador, bloquear perfil, remover avaliação, criar categoria. `profiles.blocked` é gravado mas nada no banco impede o usuário bloqueado de continuar operando — é um rótulo, não um bloqueio.
- Avaliação: o cliente insere a review e depois faz update do status para `rated` em duas chamadas separadas, sem transação; falha na segunda deixa review sem status atualizado.

## Chat, notificações e orçamentos

- Chat e notificações funcionam por polling (8s e 20s) em vez de Realtime — custo e latência maiores que o necessário.
- Mensagens não são marcadas como lidas apesar de existir `read_at` e policy para isso.
- Triggers de notificação existem e cobrem novo pedido, mudança de status, nova mensagem e novo orçamento.
- Orçamento aceito não trava valor nem status no banco conectado (a migration que faz isso não está aplicada).

## Performance e riscos operacionais

- Uploads recarregam a página inteira (`window.location.reload()`) em vez de invalidar a query.
- Sem índices declarados além de PK/FK: consultas por `request_id`, `provider_id` e `user_id` farão scan conforme os dados crescerem.
- Sem tratamento de concorrência em agendamento: dois clientes podem reservar o mesmo horário.
- Sem `errorComponent`/`notFoundComponent` por rota com loader.

## Prioridades

**P0 — impede operação real**
1. Concluir a troca de backend para o FixNowBrasil e aplicar o schema consolidado (com as 14 migrations, incluindo Storage e hardening).
2. Criar os três buckets e suas policies; sem isso, todo upload está quebrado.
3. Aplicar validação de transição de status, hardening de agendamento e de orçamento no banco.
4. Liberar escrita em `provider_services` para o prestador dono (e admin).

**P1 — correção funcional e de segurança**
5. Tornar `profiles.blocked` efetivo nas policies de escrita.
6. Recalcular `rating`/`reviews_count` por trigger.
7. Unificar o formato de `availability` (JSON estruturado) e ajustar a exibição.
8. Tornar `has_role` SECURITY DEFINER e barrar `admin` vindo de metadados de cadastro.
9. Adicionar `/reset-password`.

**P2 — qualidade e performance**
10. Realtime no lugar de polling em mensagens e notificações; marcar mensagens como lidas.
11. Migrar leituras públicas para `loader` + `ensureQueryData`; paginar listas.
12. Índices nas colunas de junção mais usadas.
13. Substituir `window.location.reload()` por invalidação de query e remover os `as unknown as`.

## Observação

Esta auditoria é somente leitura: nada foi corrigido. Aprovar este documento significa apenas confirmar o diagnóstico; posso então propor um plano de execução por prioridade.

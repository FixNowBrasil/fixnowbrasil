# Auditoria do fluxo completo do cliente — FixNow

Resultado curto: **não está pronto para uso real**. O fluxo trava em dois pontos verificados no banco conectado.

## O que funciona (verificado)

- Catálogo: 12 categorias, 24 serviços, 12 prestadores aprovados — busca, categoria e perfil do prestador leem dados reais.
- Solicitação em 5 passos cria o pedido com status `sent`.
- Prestador vê o pedido no painel e move `sent → analyzing`; envia orçamento (regras de posse validadas por trigger).
- Chat, notificações, agendamento e rastreamento ao vivo (`on_the_way`) estão implementados.
- Buckets de storage existem e são privados (`avatars`, `provider-work-photos`, `service-request-photos`).
- Painel de pagamento existe e a função `create_payment_for_quote` / `confirm_payment` está no banco.

## Bloqueadores encontrados

1. **Aceitar orçamento não funciona.** A tela chama a função de banco `accept_quote`, que **não existe** no banco conectado. O cliente clica em "Aceitar orçamento" e recebe erro; o pedido nunca chega a `confirmed`, então não há pagamento, nem "a caminho", nem execução.
2. **Enviar avaliação não funciona.** A tela chama `submit_review`, que também **não existe** no banco. Além disso, nada leva o pedido de `completed` para `rated`.
3. **Pagamento é opcional no fluxo.** O prestador pode marcar "Estou a caminho" e concluir sem que exista pagamento `paid`. O dinheiro só é liberado se houver pagamento, mas nada impede o serviço sem ele.
4. **Sem pedido de teste ponta a ponta:** existe 1 solicitação, 3 orçamentos e 0 pagamentos no banco — o caminho completo nunca foi concluído.

## Correções propostas

### 1. Recriar a função `accept_quote` (banco)
Função `security definer` que, em uma transação: valida que quem chama é o cliente do pedido, que o orçamento pertence ao prestador do pedido e está `sent`, marca esse orçamento como `accepted`, recusa os demais do mesmo pedido e move o pedido de `analyzing` para `confirmed`. Mantém o índice único de "um orçamento aceito por pedido".

### 2. Recriar a função `submit_review` (banco)
Função `security definer` que valida cliente + pedido `completed` + ausência de avaliação anterior, insere a avaliação (nota geral, pontualidade, qualidade, atendimento, comentário) e move o pedido para `rated`. A reputação do prestador já é recalculada por trigger existente.

### 3. Exigir pagamento antes da execução
No trigger de status: só permitir `confirmed → on_the_way` quando existir pagamento com status `paid` (ou `released`) para o pedido. Na UI do painel do prestador, mostrar "Aguardando pagamento do cliente" em vez do botão, enquanto não houver pagamento.

### 4. Deixar o próximo passo óbvio para o cliente
Na tela do pedido: após o aceite, destacar o painel de pagamento como ação principal; após `completed`, destacar o bloco de avaliação. Sem redesenho, apenas ordem/destaque e textos de estado.

### 5. Validação ponta a ponta
Executar o caminho completo em navegador: solicitar → analisar → orçar → aceitar → pagar → a caminho → iniciar → concluir → avaliar, confirmando cada transição no banco.

## Detalhes técnicos

- Migrações novas em `supabase/migrations/` com `accept_quote`, `submit_review` e ajuste em `validate_service_request_status_update`; `GRANT EXECUTE ... TO authenticated` em ambas as funções.
- Frontend afetado: `src/components/request-extras.tsx` (mensagens de erro), `src/components/PaymentPanel.tsx`, `src/routes/_authenticated/pedidos.$id.tsx`, `src/routes/_authenticated/painel.tsx`.
- Nenhuma tabela nova; nenhuma alteração em RLS além da regra de pagamento no trigger.

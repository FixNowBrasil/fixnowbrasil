# Rastreamento ao vivo do prestador ("a caminho")

Quando o prestador tocar em **Estou a caminho**, o app passa a compartilhar a posição dele em tempo real e o cliente vê um mapa com dois pinos (prestador e endereço do serviço), distância e tempo estimado de chegada — no estilo Uber.

## Como vai funcionar

Prestador (tela do painel / pedido):
- Ao mudar o status para "a caminho", o navegador pede permissão de localização.
- Enquanto o pedido estiver "a caminho", a posição é enviada a cada ~10 segundos (ou a cada movimento relevante).
- Um aviso mostra que a localização está sendo compartilhada; ao iniciar o serviço, cancelar ou sair, o compartilhamento para.
- Se a permissão for negada, o status continua mudando normalmente e uma mensagem explica que o cliente não verá o mapa.

Cliente (tela de acompanhamento do pedido):
- Assim que o status vira "a caminho", aparece um mapa acima da timeline.
- Pino do prestador se move em tempo real; pino do destino no endereço do pedido.
- Mostra distância aproximada e tempo estimado de chegada, além de "atualizado há X s".
- Se ainda não houver posição, mostra "Aguardando a localização do prestador...".
- O mapa some quando o serviço começa (in_progress) ou o pedido termina.

## Banco de dados

Nova tabela `request_locations` (uma linha por pedido, atualizada continuamente):
- pedido, prestador, latitude, longitude, precisão, atualizado em.
- Regras de acesso: só o prestador daquele pedido pode gravar/atualizar; só o cliente e o prestador daquele pedido podem ler; admin lê tudo.
- Ativada para atualizações em tempo real (Realtime), para o cliente receber sem ficar recarregando.

Também guardamos latitude/longitude do destino em `service_requests` (preenchidos por geocodificação do endereço na primeira vez que o mapa é aberto).

## Mapa

Uso do conector Google Maps gerenciado pelo Lovable:
- Mapa no navegador via Maps JavaScript API com a chave pública do conector.
- Geocodificação do endereço do pedido feita no servidor (server function), pelo gateway do conector.
- Distância/ETA calculados a partir da distância em linha reta com velocidade média urbana (sem custo extra de rotas). Se preferir rota real desenhada depois, dá para evoluir.

## Detalhes técnicos

- Nova migração: tabela `request_locations` com GRANTs, RLS (prestador escreve, partes leem), trigger de `updated_at`, publicação no `supabase_realtime`; colunas `dest_lat`/`dest_lng` em `service_requests`.
- `src/lib/tracking.ts`: tipos, query da posição e mutation de upsert.
- `src/hooks/useShareLocation.ts`: `navigator.geolocation.watchPosition` + throttle de 10s, ativo só enquanto o pedido do prestador estiver `on_the_way`; limpeza no unmount.
- `src/components/LiveTrackingMap.tsx`: componente carregado só no cliente (`ClientOnly` + `React.lazy`), carrega o script do Maps com `loading=async` e `callback`, usa `google.maps.Marker` (sem `mapId`), ajusta os limites para caber os dois pinos.
- `src/lib/geocode.functions.ts`: server function que geocodifica o endereço via gateway do conector e grava `dest_lat`/`dest_lng`.
- Assinatura Realtime em `pedidos.$id.tsx` para o canal do pedido, com `removeChannel` no unmount.
- Sem alteração nas regras de transição de status existentes.

## Pré-requisito

Preciso conectar o Google Maps (conector gerenciado pelo Lovable) — abro o cartão de conexão durante a implementação.

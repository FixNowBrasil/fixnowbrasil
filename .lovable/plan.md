# Home mais direta: "Preciso de um profissional" em destaque

## Objetivo
Transformar a tela inicial para clientes numa porta de entrada clara: em vez de começar pela busca, o cliente vê um botão grande que leva direto ao fluxo de solicitação (`/solicitar`), onde ele descreve o problema em texto livre ou escolhe categoria/serviço.

## Nova estrutura da home

```text
┌──────────────────────────────────────────┐
│ HERO                                     │
│  "Precisou? FixNow."                     │
│  H1: O que você precisa resolver hoje?   │
│  [ ⚡ Preciso de um profissional  → ]    │  <- botão primário grande
│  "Descreva o problema em 1 minuto e      │
│   receba orçamentos de até 5 pros."      │
│  [ Prefiro buscar por serviço ]          │  <- link/botão secundário
│  ✓ verificados · ✓ avaliações · ✓ hoje   │
├──────────────────────────────────────────┤
│ COMO FUNCIONA (3 passos)                 │
│  1 Conte o problema  2 Receba orçamentos │
│  3 Escolha e acompanhe                   │
├──────────────────────────────────────────┤
│ CATEGORIAS (atalho rápido)               │
│  grid existente — cada tile já leva ao   │
│  fluxo por categoria                     │
├──────────────────────────────────────────┤
│ BUSCA (recolhida)                        │
│  campo de busca aparece só ao clicar em  │
│  "Prefiro buscar por serviço" ou nesta   │
│  seção mais abaixo                       │
├──────────────────────────────────────────┤
│ SERVIÇOS POPULARES (mantido)             │
│ PROFISSIONAIS PERTO DE VOCÊ (mantido)    │
└──────────────────────────────────────────┘
```

Detalhes:
- Botão principal: "Preciso de um profissional" com ícone, altura confortável no mobile (largura total), levando a `/solicitar`.
- Botão secundário/discreto: "Prefiro buscar por serviço" — revela o campo de busca no próprio hero (sem mudar de página) e mantém o envio para `/buscar?q=`.
- Bloco "Como funciona" com 3 cartões curtos, reforçando confiança e reduzindo dúvida sobre o que acontece depois.
- Categorias sobem para logo abaixo do hero, pois são o segundo caminho mais rápido.
- Nada de busca some: ela continua acessível no hero (expandível), no menu "Buscar" e na navegação inferior mobile.

## Escopo técnico
- Arquivo alterado: `src/routes/index.tsx` (layout, textos, estado local para expandir a busca).
- Sem mudanças de banco, rotas novas, RLS ou lógica de negócio.
- Reaproveita componentes existentes (`CategoryTile`, `ServiceCard`, `ProviderCard`, `Button`) e tokens do design system (laranja/azul-noite), sem cores fixas.
- Metadados/SEO da home mantidos, com ajuste do H1 apenas se o texto do hero mudar.

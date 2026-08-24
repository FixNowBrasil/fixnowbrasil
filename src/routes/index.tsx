import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Search, ShieldCheck, Zap, Star, ArrowRight, MessageSquareText, ClipboardCheck, Wrench } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { CardSkeleton, CategoryTile, ProviderCard, ServiceCard } from "@/components/fixnow-ui";
import { Button } from "@/components/ui/button";
import { categoriesQuery, popularServicesQuery, providersQuery } from "@/lib/fixnow";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FixNow — Precisou? FixNow." },
      {
        name: "description",
        content:
          "Eletricista, encanador, montador, ar-condicionado e mais. Encontre profissionais avaliados perto de você e contrate em poucos passos.",
      },
      { property: "og:title", content: "FixNow — Precisou? FixNow." },
      {
        property: "og:description",
        content: "Encontre e contrate profissionais de confiança para resolver o que você precisa hoje.",
      },
      { property: "og:url", content: "https://fixnowbrasil.lovable.app/" },
      { property: "og:image", content: "https://fixnowbrasil.lovable.app/og-fixnow.jpg" },
      { name: "twitter:image", content: "https://fixnowbrasil.lovable.app/og-fixnow.jpg" },
    ],
    links: [{ rel: "canonical", href: "https://fixnowbrasil.lovable.app/" }],
  }),
  component: Home,
});

const STEPS = [
  {
    icon: MessageSquareText,
    title: "Conte o problema",
    text: "Descreva com suas palavras ou escolha uma categoria. Pode enviar fotos.",
  },
  {
    icon: ClipboardCheck,
    title: "Receba orçamentos",
    text: "Enviamos sua solicitação para até 5 profissionais compatíveis perto de você.",
  },
  {
    icon: Wrench,
    title: "Escolha e acompanhe",
    text: "Compare preços e avaliações, escolha um profissional e acompanhe até o fim.",
  },
] as const;

function Home() {
  const navigate = useNavigate();
  const [term, setTerm] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const categories = useQuery(categoriesQuery);
  const services = useQuery(popularServicesQuery);
  const providers = useQuery(providersQuery());

  const catById = new Map((categories.data ?? []).map((c) => [c.id, c]));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    navigate({ to: "/buscar", search: { q: term || undefined } });
  }

  return (
    <AppShell>
      <section className="hero-mesh border-b border-border">
        <div className="mx-auto w-full max-w-6xl px-4 py-10 md:py-16">
          <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-card px-3 py-1 text-xs font-bold text-primary shadow-[var(--shadow-card)]">
            <Zap className="h-3.5 w-3.5" /> Precisou? FixNow.
          </p>
          <h1 className="max-w-2xl text-3xl font-extrabold leading-tight md:text-5xl">
            O que você precisa resolver hoje?
          </h1>
          <p className="mt-3 max-w-xl text-sm text-muted-foreground md:text-base">
            Descreva o problema em 1 minuto e receba orçamentos de até 5 profissionais avaliados perto de você.
          </p>

          <div className="mt-6 flex max-w-2xl flex-col gap-3">
            <Link to="/solicitar" className="w-full sm:w-auto">
              <Button
                size="lg"
                className="h-16 w-full rounded-2xl px-8 text-base font-extrabold shadow-[var(--shadow-glow)] sm:w-auto md:text-lg"
              >
                <Zap className="h-5 w-5" />
                Preciso de um profissional
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>

            {showSearch ? (
              <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={term}
                    autoFocus
                    onChange={(e) => setTerm(e.target.value)}
                    placeholder="Digite um serviço ou problema..."
                    aria-label="Buscar serviço"
                    className="h-14 w-full rounded-2xl border border-border bg-card pl-12 pr-4 text-base font-medium shadow-[var(--shadow-card)] outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15"
                  />
                </div>
                <Button type="submit" size="lg" variant="outline" className="h-14 rounded-2xl px-8 text-base font-extrabold">
                  Buscar
                </Button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setShowSearch(true)}
                className="inline-flex w-fit items-center gap-2 text-sm font-bold text-muted-foreground underline-offset-4 transition-colors hover:text-primary hover:underline"
              >
                <Search className="h-4 w-4" />
                Prefiro buscar por serviço
              </button>
            )}
          </div>

          <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-primary" /> Profissionais verificados
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Star className="h-4 w-4 text-primary" /> Avaliações reais
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Zap className="h-4 w-4 text-primary" /> Atendimento no mesmo dia
            </span>
          </div>
        </div>
      </section>

      <div className="mx-auto w-full max-w-6xl space-y-10 px-4 py-8">
        <section>
          <h2 className="mb-4 font-display text-lg font-bold">Como funciona</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={step.title} className="surface-card flex flex-col gap-2 p-4">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-accent-foreground">
                    <Icon className="h-5 w-5" />
                  </span>
                  <p className="text-sm font-extrabold">
                    <span className="text-primary">{i + 1}.</span> {step.title}
                  </p>
                  <p className="text-xs text-muted-foreground">{step.text}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section>
          <h2 className="mb-4 font-display text-lg font-bold">Categorias</h2>
          {categories.isLoading ? (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
              {(categories.data ?? []).map((c) => (
                <CategoryTile key={c.id} category={c} />
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg font-bold">Serviços populares</h2>
            <Link to="/buscar" className="text-sm font-bold text-primary hover:underline">
              Ver todos
            </Link>
          </div>
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2">
            {(services.data ?? []).map((s) => (
              <ServiceCard key={s.id} service={s} category={catById.get(s.category_id)} />
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-4 font-display text-lg font-bold">Profissionais perto de você</h2>
          {providers.isLoading ? (
            <CardSkeleton count={4} />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {(providers.data ?? []).slice(0, 6).map((p) => (
                <ProviderCard
                  key={p.id}
                  provider={p}
                  categoryName={p.category_id ? catById.get(p.category_id)?.name : undefined}
                />
              ))}
            </div>
          )}
        </section>

        <section className="surface-card flex flex-col items-start gap-3 p-6 text-left sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-lg font-bold">Ainda com o problema?</h2>
            <p className="text-sm text-muted-foreground">Conte o que aconteceu e deixe que a gente encontra quem resolve.</p>
          </div>
          <Link to="/solicitar" className="w-full sm:w-auto">
            <Button size="lg" className="w-full rounded-2xl font-extrabold sm:w-auto">
              Preciso de um profissional
              <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
        </section>
      </div>
    </AppShell>
  );
}


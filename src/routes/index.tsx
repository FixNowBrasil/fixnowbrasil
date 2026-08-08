import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Search, ShieldCheck, Zap, Star } from "lucide-react";
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
    ],
  }),
  component: Home,
});

function Home() {
  const navigate = useNavigate();
  const [term, setTerm] = useState("");
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
            Olá! O que você precisa resolver hoje?
          </h1>
          <p className="mt-3 max-w-xl text-sm text-muted-foreground md:text-base">
            Encontre profissionais avaliados perto de você e contrate em poucos passos.
          </p>

          <form onSubmit={submit} className="mt-6 flex max-w-2xl flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Digite um serviço ou problema..."
                aria-label="Buscar serviço"
                className="h-14 w-full rounded-2xl border border-border bg-card pl-12 pr-4 text-base font-medium shadow-[var(--shadow-card)] outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15"
              />
            </div>
            <Button type="submit" size="lg" className="h-14 rounded-2xl px-8 text-base font-extrabold">
              Buscar
            </Button>
          </form>

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
      </div>
    </AppShell>
  );
}

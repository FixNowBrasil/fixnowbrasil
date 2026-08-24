import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Search } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { CardSkeleton, CategoryTile, EmptyState, ProviderCard, ServiceCard } from "@/components/fixnow-ui";
import { allServicesQuery, categoriesQuery, providersQuery } from "@/lib/fixnow";

type SearchParams = { q?: string | undefined };

export const Route = createFileRoute("/buscar")({
  validateSearch: (search: Record<string, unknown>): SearchParams => ({
    q: typeof search['q'] === "string" && search['q'] ? String(search['q']) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Buscar serviços e profissionais — FixNow" },
      {
        name: "description",
        content: "Pesquise por serviço ou problema e encontre profissionais disponíveis perto de você.",
      },
      { property: "og:title", content: "Buscar serviços e profissionais — FixNow" },
      { property: "og:description", content: "Pesquise serviços e encontre profissionais avaliados." },
      { property: "og:url", content: "https://fixnowbrasil.lovable.app/buscar" },
    ],
    links: [{ rel: "canonical", href: "https://fixnowbrasil.lovable.app/buscar" }],
  }),
  component: BuscarPage,
});

function BuscarPage() {
  const { q } = Route.useSearch();
  const navigate = useNavigate();
  const [term, setTerm] = useState(q ?? "");

  const categories = useQuery(categoriesQuery);
  const services = useQuery(allServicesQuery);
  const providers = useQuery(providersQuery());

  const catById = new Map((categories.data ?? []).map((c) => [c.id, c]));
  const needle = (q ?? "").toLowerCase().trim();

  const matchedServices = (services.data ?? []).filter(
    (s) =>
      !needle ||
      s.name.toLowerCase().includes(needle) ||
      (s.description ?? "").toLowerCase().includes(needle),
  );
  const matchedProviders = (providers.data ?? []).filter(
    (p) =>
      !needle ||
      p.name.toLowerCase().includes(needle) ||
      (p.headline ?? "").toLowerCase().includes(needle) ||
      (p.category_id ? (catById.get(p.category_id)?.name ?? "").toLowerCase().includes(needle) : false),
  );

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-6xl space-y-8 px-4 py-6">
        <h1 className="font-display text-2xl font-extrabold">Buscar serviços e profissionais</h1>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            navigate({ to: "/buscar", search: { q: term || undefined } });
          }}
          className="relative"
        >
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Digite um serviço ou problema..."
            aria-label="Buscar"
            className="h-14 w-full rounded-2xl border border-border bg-card pl-12 pr-4 text-base font-medium shadow-[var(--shadow-card)] outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15"
          />
        </form>

        {!needle && (
          <section>
            <h2 className="mb-4 font-display text-lg font-bold">Navegue por categoria</h2>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
              {(categories.data ?? []).map((c) => (
                <CategoryTile key={c.id} category={c} />
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="mb-4 font-display text-lg font-bold">
            {needle ? `Serviços para "${q}"` : "Todos os serviços"}
          </h2>
          {services.isLoading ? (
            <CardSkeleton count={4} />
          ) : matchedServices.length === 0 ? (
            <EmptyState
              title="Nenhum serviço encontrado"
              description="Tente outra palavra, como “vazamento”, “TV” ou “ar-condicionado”."
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {matchedServices.map((s) => (
                <ServiceCard key={s.id} service={s} category={catById.get(s.category_id)} />
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-4 font-display text-lg font-bold">Profissionais</h2>
          {providers.isLoading ? (
            <CardSkeleton count={4} />
          ) : matchedProviders.length === 0 ? (
            <EmptyState
              title="Nenhum profissional encontrado"
              description="Ajuste sua busca ou navegue pelas categorias."
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {matchedProviders.map((p) => (
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

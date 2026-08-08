import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { CardSkeleton, EmptyState, ProviderCard, ServiceCard } from "@/components/fixnow-ui";
import { allServicesQuery, categoriesQuery, providersQuery } from "@/lib/fixnow";

export const Route = createFileRoute("/categoria/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `Serviços de ${params.slug.replace(/-/g, " ")} — FixNow` },
      {
        name: "description",
        content: `Profissionais e serviços da categoria ${params.slug.replace(/-/g, " ")} disponíveis perto de você no FixNow.`,
      },
      { property: "og:title", content: `Categoria ${params.slug.replace(/-/g, " ")} — FixNow` },
      { property: "og:description", content: "Veja profissionais avaliados e solicite seu serviço." },
    ],
  }),
  component: CategoriaPage,
});

function CategoriaPage() {
  const { slug } = Route.useParams();
  const categories = useQuery(categoriesQuery);
  const category = (categories.data ?? []).find((c) => c.slug === slug);
  const services = useQuery(allServicesQuery);
  const providers = useQuery(providersQuery(category?.id));

  const categoryServices = (services.data ?? []).filter((s) => s.category_id === category?.id);

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-6xl space-y-8 px-4 py-6">
        <Link to="/buscar" className="inline-flex items-center gap-1 text-sm font-bold text-muted-foreground">
          <ChevronLeft className="h-4 w-4" /> Todas as categorias
        </Link>

        {categories.isLoading ? (
          <div className="h-16 animate-pulse rounded-2xl bg-muted" />
        ) : !category ? (
          <EmptyState title="Categoria não encontrada" description="Volte e escolha outra categoria." />
        ) : (
          <>
            <header className="flex items-center gap-4">
              <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-accent text-3xl">
                {category.emoji}
              </span>
              <div className="min-w-0">
                <h1 className="truncate text-2xl font-extrabold">{category.name}</h1>
                <p className="text-sm text-muted-foreground">{category.description}</p>
              </div>
            </header>

            <section>
              <h2 className="mb-4 font-display text-lg font-bold">Serviços dessa categoria</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {categoryServices.map((s) => (
                  <ServiceCard key={s.id} service={s} category={category} />
                ))}
              </div>
            </section>

            <section>
              <h2 className="mb-4 font-display text-lg font-bold">Profissionais disponíveis</h2>
              {providers.isLoading ? (
                <CardSkeleton count={4} />
              ) : (providers.data ?? []).length === 0 ? (
                <EmptyState
                  title="Ainda não há profissionais aqui"
                  description="Estamos ampliando a rede FixNow na sua região."
                />
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {(providers.data ?? []).map((p) => (
                    <ProviderCard key={p.id} provider={p} categoryName={category.name} />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}

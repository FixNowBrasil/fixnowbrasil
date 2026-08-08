import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, ChevronLeft, Clock, Heart, MapPin, MessageCircle, Star } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { EmptyState, Stars } from "@/components/fixnow-ui";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  brl,
  categoriesQuery,
  providerQuery,
  providerReviewsQuery,
  providerServicesQuery,
} from "@/lib/fixnow";

export const Route = createFileRoute("/prestador/$id")({
  head: () => ({
    meta: [
      { title: "Perfil do profissional — FixNow" },
      {
        name: "description",
        content: "Veja avaliações, serviços, preços e região de atendimento do profissional no FixNow.",
      },
      { property: "og:title", content: "Perfil do profissional — FixNow" },
      { property: "og:description", content: "Avaliações reais, preços e disponibilidade." },
    ],
  }),
  component: ProviderPage,
});

function ProviderPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const provider = useQuery(providerQuery(id));
  const reviews = useQuery(providerReviewsQuery(id));
  const services = useQuery(providerServicesQuery(id));
  const categories = useQuery(categoriesQuery);

  const favorite = useQuery({
    queryKey: ["favorite", id, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("favorites").select("id").eq("provider_id", id).maybeSingle();
      return data;
    },
  });

  async function toggleFavorite() {
    if (!user) {
      toast.info("Entre na sua conta para salvar favoritos.");
      navigate({ to: "/auth" });
      return;
    }
    if (favorite.data) {
      await supabase.from("favorites").delete().eq("id", favorite.data.id);
      toast.success("Removido dos favoritos.");
    } else {
      await supabase.from("favorites").insert({ user_id: user.id, provider_id: id });
      toast.success("Salvo nos favoritos!");
    }
    queryClient.invalidateQueries({ queryKey: ["favorite", id] });
    queryClient.invalidateQueries({ queryKey: ["favorites"] });
  }


  if (provider.isLoading) {
    return (
      <AppShell>
        <div className="mx-auto max-w-4xl px-4 py-8">
          <div className="h-64 animate-pulse rounded-2xl bg-muted" />
        </div>
      </AppShell>
    );
  }

  const p = provider.data;
  if (!p) {
    return (
      <AppShell>
        <div className="mx-auto max-w-4xl px-4 py-10">
          <EmptyState title="Profissional não encontrado" description="Esse perfil não está mais disponível." />
        </div>
      </AppShell>
    );
  }

  const categoryName = (categories.data ?? []).find((c) => c.id === p.category_id)?.name;

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6">
        <button
          onClick={() => window.history.back()}
          className="inline-flex items-center gap-1 text-sm font-bold text-muted-foreground"
        >
          <ChevronLeft className="h-4 w-4" /> Voltar
        </button>

        <header className="surface-card p-5">
          <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-4">
            <img
              src={p.avatar_url ?? ""}
              alt={`Foto de ${p.name}`}
              className="h-20 w-20 shrink-0 rounded-2xl object-cover sm:h-24 sm:w-24"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-xl font-extrabold sm:text-2xl">{p.name}</h1>
                {p.verified && <BadgeCheck className="h-5 w-5 shrink-0 text-primary" />}
              </div>
              <p className="text-sm font-semibold text-muted-foreground">
                {categoryName} · {p.headline}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span className="inline-flex items-center gap-1 font-bold">
                  <Star className="h-4 w-4 fill-warning text-warning" />
                  {Number(p.rating).toFixed(1)}
                  <span className="font-medium text-muted-foreground">({p.reviews_count} avaliações)</span>
                </span>
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <MapPin className="h-4 w-4" /> {p.neighborhood}, {p.city} ·{" "}
                  {Number(p.distance_km).toFixed(1).replace(".", ",")} km
                </span>
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <Clock className="h-4 w-4" /> {p.years_experience} anos de experiência
                </span>
              </div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl bg-muted/60 p-3">
              <p className="text-lg font-extrabold text-primary">{brl(Number(p.price_from))}</p>
              <p className="text-[11px] font-semibold text-muted-foreground">a partir de</p>
            </div>
            <div className="rounded-xl bg-muted/60 p-3">
              <p className="text-lg font-extrabold">{p.jobs_done}</p>
              <p className="text-[11px] font-semibold text-muted-foreground">serviços feitos</p>
            </div>
            <div className="rounded-xl bg-muted/60 p-3">
              <p className="text-lg font-extrabold">{p.radius_km} km</p>
              <p className="text-[11px] font-semibold text-muted-foreground">raio de atendimento</p>
            </div>
          </div>

          <div className="mt-5 grid gap-2 sm:grid-cols-[2fr_1fr]">
            <Button
              size="lg"
              className="font-extrabold"
              onClick={() => navigate({ to: "/solicitar", search: { provider: p.id } })}
            >
              Solicitar serviço
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="font-bold"
              onClick={() => toast.info("O chat abre assim que o profissional aceitar sua solicitação.")}
            >
              <MessageCircle className="h-4 w-4" />
              Enviar mensagem
            </Button>
          </div>
        </header>

        <section className="surface-card p-5">
          <h2 className="mb-2 font-display text-base font-bold">Sobre</h2>
          <p className="text-sm text-muted-foreground">{p.bio}</p>
          <p className="mt-3 text-sm">
            <span className="font-bold">Horários:</span>{" "}
            <span className="text-muted-foreground">{p.availability}</span>
          </p>
        </section>

        <section className="surface-card p-5">
          <h2 className="mb-3 font-display text-base font-bold">Serviços e preços</h2>
          <ul className="divide-y divide-border">
            {(services.data ?? []).map((row) => {
              const s = row.services as unknown as { id: string; name: string; description: string | null };
              return (
                <li key={s.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{s.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{s.description}</p>
                  </div>
                  <span className="shrink-0 text-sm font-extrabold text-primary">
                    {brl(Number(row.price_from))}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="surface-card p-5">
          <h2 className="mb-3 font-display text-base font-bold">Avaliações dos clientes</h2>
          {(reviews.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Este profissional ainda não recebeu avaliações.</p>
          ) : (
            <ul className="space-y-4">
              {(reviews.data ?? []).map((r) => (
                <li key={r.id} className="rounded-xl bg-muted/50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-bold">{r.author_name}</p>
                    <Stars value={r.rating} />
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{r.comment}</p>
                  <p className="mt-2 text-[11px] font-semibold text-muted-foreground">
                    Pontualidade {r.punctuality} · Qualidade {r.quality} · Atendimento {r.service}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="pb-4 text-center text-xs text-muted-foreground">
          Não é esse profissional?{" "}
          <Link to="/buscar" className="font-bold text-primary hover:underline">
            Ver outros
          </Link>
        </p>
      </div>
    </AppShell>
  );
}

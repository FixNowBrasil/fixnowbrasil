import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { CardSkeleton, EmptyState, ProviderCard } from "@/components/fixnow-ui";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  NEEDS_BY_CATEGORY,
  WHEN_OPTIONS,
  allServicesQuery,
  categoriesQuery,
  providersQuery,
} from "@/lib/fixnow";

type SearchParams = { service?: string | undefined; provider?: string | undefined };

export const Route = createFileRoute("/solicitar")({
  validateSearch: (search: Record<string, unknown>): SearchParams => ({
    service: typeof search['service'] === "string" ? search['service'] : undefined,
    provider: typeof search['provider'] === "string" ? search['provider'] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Solicitar serviço — FixNow" },
      {
        name: "description",
        content: "Conte o que você precisa, escolha data e endereço e encontre profissionais disponíveis.",
      },
      { property: "og:title", content: "Solicitar serviço — FixNow" },
      { property: "og:description", content: "Contrate um profissional em poucos passos." },
    ],
  }),
  component: SolicitarPage,
});

const STEPS = ["Necessidade", "Detalhes", "Quando", "Endereço", "Profissionais"];

function SolicitarPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { user } = useAuth();

  const categories = useQuery(categoriesQuery);
  const services = useQuery(allServicesQuery);
  const allProviders = useQuery(providersQuery());

  const service = (services.data ?? []).find((s) => s.slug === search.service);
  const preselected = (allProviders.data ?? []).find((p) => p.id === search.provider);
  const category = (categories.data ?? []).find(
    (c) => c.id === (service?.category_id ?? preselected?.category_id),
  );

  const [step, setStep] = useState(0);
  const [need, setNeed] = useState("");
  const [description, setDescription] = useState("");
  const [when, setWhen] = useState("now");
  const [date, setDate] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);

  const needs = NEEDS_BY_CATEGORY[category?.slug ?? "outros"] ?? NEEDS_BY_CATEGORY['outros']!;

  const matches = useMemo(() => {
    const list = allProviders.data ?? [];
    if (preselected) return [preselected];
    if (category) return list.filter((p) => p.category_id === category.id);
    return list;
  }, [allProviders.data, category, preselected]);

  async function createRequest(providerId: string) {
    if (!user) {
      toast.info("Entre na sua conta para concluir a solicitação.");
      navigate({ to: "/auth" });
      return;
    }
    setSaving(true);
    const { data, error } = await supabase
      .from("service_requests")
      .insert({
        client_id: user.id,
        provider_id: providerId,
        service_id: service?.id ?? null,
        category_id: category?.id ?? null,
        need: need || null,
        description,
        when_option: when,
        scheduled_at: when === "date" && date ? new Date(date).toISOString() : null,
        address,
        status: "sent",
      })
      .select("id")
      .single();
    setSaving(false);
    if (error) {
      toast.error("Não foi possível enviar a solicitação. Tente novamente.");
      return;
    }
    toast.success("Solicitação enviada! Acompanhe o status.");
    navigate({ to: "/pedidos/$id", params: { id: data.id } });
  }

  const canAdvance =
    (step === 0 && !!need) ||
    (step === 1 && description.trim().length >= 5) ||
    (step === 2 && (when !== "date" || !!date)) ||
    (step === 3 && address.trim().length >= 5);

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-2xl space-y-6 px-4 py-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-primary">
            {category?.emoji} {service?.name ?? category?.name ?? "Nova solicitação"}
          </p>
          <div className="mt-3 flex gap-1.5">
            {STEPS.map((s, i) => (
              <div
                key={s}
                className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-primary" : "bg-border"}`}
                aria-label={s}
              />
            ))}
          </div>
          <p className="mt-2 text-xs font-semibold text-muted-foreground">
            Passo {step + 1} de {STEPS.length} — {STEPS[step]}
          </p>
        </div>

        {step === 0 && (
          <section className="surface-card space-y-3 p-5">
            <h1 className="font-display text-xl font-bold">O que você precisa?</h1>
            <div className="grid gap-2">
              {needs.map((n) => (
                <button
                  key={n}
                  onClick={() => setNeed(n)}
                  className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left text-sm font-semibold transition ${
                    need === n
                      ? "border-primary bg-accent text-accent-foreground"
                      : "border-border bg-card hover:bg-muted"
                  }`}
                >
                  {n}
                  {need === n && <Check className="h-4 w-4" />}
                </button>
              ))}
            </div>
          </section>
        )}

        {step === 1 && (
          <section className="surface-card space-y-3 p-5">
            <h1 className="font-display text-xl font-bold">Conte um pouco mais sobre o serviço</h1>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={1000}
              rows={6}
              placeholder="Ex.: TV de 55 polegadas, parede de drywall, já tenho o suporte."
              className="rounded-xl text-base"
            />
            <p className="text-xs text-muted-foreground">
              Quanto mais detalhes, mais preciso será o orçamento do profissional.
            </p>
          </section>
        )}

        {step === 2 && (
          <section className="surface-card space-y-3 p-5">
            <h1 className="font-display text-xl font-bold">Quando você precisa?</h1>
            <div className="grid grid-cols-2 gap-2">
              {WHEN_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  onClick={() => setWhen(o.value)}
                  className={`rounded-xl border px-4 py-3 text-sm font-bold transition ${
                    when === o.value
                      ? "border-primary bg-accent text-accent-foreground"
                      : "border-border bg-card hover:bg-muted"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
            {when === "date" && (
              <Input
                type="datetime-local"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="rounded-xl"
                aria-label="Data e hora do serviço"
              />
            )}
          </section>
        )}

        {step === 3 && (
          <section className="surface-card space-y-3 p-5">
            <h1 className="font-display text-xl font-bold">Qual é o endereço?</h1>
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              maxLength={200}
              placeholder="Rua, número, bairro e cidade"
              className="h-12 rounded-xl text-base"
              aria-label="Endereço do serviço"
            />
            <p className="text-xs text-muted-foreground">
              O endereço completo só é compartilhado depois que o profissional aceita.
            </p>
          </section>
        )}

        {step === 4 && (
          <section className="space-y-4">
            <h1 className="font-display text-xl font-bold">Profissionais compatíveis</h1>
            {allProviders.isLoading ? (
              <CardSkeleton count={2} />
            ) : matches.length === 0 ? (
              <EmptyState
                title="Nenhum profissional disponível"
                description="Tente outra categoria ou volte mais tarde."
              />
            ) : (
              <div className="space-y-4">
                {matches.map((p) => (
                  <div key={p.id} className="space-y-2">
                    <ProviderCard provider={p} categoryName={category?.name} />
                    <Button
                      className="w-full font-extrabold"
                      disabled={saving}
                      onClick={() => createRequest(p.id)}
                    >
                      {saving ? "Enviando..." : `Solicitar com ${p.name.split(" ")[0]}`}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        <div className="flex items-center justify-between gap-3">
          <Button
            variant="ghost"
            className="font-bold"
            onClick={() => (step === 0 ? navigate({ to: "/" }) : setStep(step - 1))}
          >
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Button>
          {step < 4 && (
            <Button
              size="lg"
              className="font-extrabold"
              disabled={!canAdvance}
              onClick={() => setStep(step + 1)}
            >
              {step === 3 ? "Encontrar profissionais" : "Continuar"}
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </AppShell>
  );
}

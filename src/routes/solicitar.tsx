import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { CardSkeleton, EmptyState, ProviderCard } from "@/components/fixnow-ui";
import { AddressStep } from "@/components/request-flow/AddressStep";
import { ProblemStep } from "@/components/request-flow/ProblemStep";
import { WhenStep } from "@/components/request-flow/WhenStep";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { allServicesQuery, categoriesQuery, providersQuery } from "@/lib/fixnow";
import { draftScheduledAt, useRequestDraft } from "@/lib/request-draft";

type SearchParams = { service?: string | undefined; provider?: string | undefined };

export const Route = createFileRoute("/solicitar")({
  validateSearch: (search: Record<string, unknown>): SearchParams => ({
    service: typeof search["service"] === "string" ? search["service"] : undefined,
    provider: typeof search["provider"] === "string" ? search["provider"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Solicitar serviço — FixNow" },
      {
        name: "description",
        content:
          "Conte o que você precisa, escolha data e endereço e encontre profissionais disponíveis.",
      },
      { property: "og:title", content: "Solicitar serviço — FixNow" },
      { property: "og:description", content: "Contrate um profissional em poucos passos." },
    ],
  }),
  component: SolicitarPage,
});

const STEPS = ["O problema", "Endereço", "Quando", "Profissionais"];

function SolicitarPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { user } = useAuth();

  const categories = useQuery(categoriesQuery);
  const services = useQuery(allServicesQuery);
  const allProviders = useQuery(providersQuery());

  const { draft, update, problemError, whenError } = useRequestDraft();
  const [step, setStep] = useState(0);
  const [showProblemError, setShowProblemError] = useState(false);
  const [showAddressError, setShowAddressError] = useState(false);
  const [showWhenError, setShowWhenError] = useState(false);
  const [saving, setSaving] = useState(false);
  const prefilled = useRef(false);

  const preselected = (allProviders.data ?? []).find((p) => p.id === search.provider);

  // Pré-seleção vinda de /categoria ou /prestador (uma única vez).
  useEffect(() => {
    if (prefilled.current) return;
    const service = (services.data ?? []).find((s) => s.slug === search.service);
    const categoryId = service?.category_id ?? preselected?.category_id ?? null;
    if (!service && !categoryId) return;
    prefilled.current = true;
    update({
      mode: "choose",
      categoryId,
      serviceId: service?.id ?? null,
      need: service?.name ?? null,
    });
  }, [services.data, preselected, search.service, update]);

  const category = (categories.data ?? []).find((c) => c.id === draft.categoryId);

  const matches = useMemo(() => {
    const list = allProviders.data ?? [];
    if (preselected) return [preselected];
    if (draft.categoryId) return list.filter((p) => p.category_id === draft.categoryId);
    return list;
  }, [allProviders.data, draft.categoryId, preselected]);

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
        id: draft.draftId,
        client_id: user.id,
        provider_id: providerId,
        service_id: draft.serviceId,
        category_id: draft.categoryId,
        need: draft.need,
        description: draft.description.trim() || draft.need || "Serviço solicitado pelo app",
        photos: draft.photos,
        when_option: draft.when,
        scheduled_at: draftScheduledAt(draft)?.toISOString() ?? null,
        address: draft.address,
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
    (step === 0 && !problemError) ||
    (step === 1 && draft.address.trim().length >= 5) ||
    (step === 2 && !whenError);

  function handleContinue() {
    if (step === 0 && problemError) {
      setShowProblemError(true);
      toast.error(problemError);
      return;
    }
    if (step === 1 && !draft.address.trim()) {
      setShowAddressError(true);
      toast.error("Escolha ou cadastre um endereço para continuar.");
      return;
    }
    if (step === 2 && whenError) {
      setShowWhenError(true);
      toast.error(whenError);
      return;
    }
    setStep(step + 1);
  }

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-2xl space-y-6 px-4 py-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-primary">
            {category?.emoji} {category?.name ?? "Nova solicitação"}
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
          <ProblemStep
            draft={draft}
            update={update}
            error={problemError}
            showError={showProblemError}
          />
        )}

        {step === 1 && <AddressStep draft={draft} update={update} showError={showAddressError} />}

        {step === 2 && (
          <WhenStep draft={draft} update={update} error={whenError} showError={showWhenError} />
        )}

        {step === 3 && <MatchingStep draft={draft} onRetry={() => setStep(0)} />}

        <div className="flex items-center justify-between gap-3">
          <Button
            variant="ghost"
            className="font-bold"
            onClick={() => (step === 0 ? navigate({ to: "/" }) : setStep(step - 1))}
          >
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Button>
          {step < 3 && (
            <Button
              size="lg"
              className="font-extrabold"
              disabled={step > 0 && !canAdvance}
              onClick={handleContinue}
            >
              {step === 2 ? "Encontrar profissionais" : "Continuar"}
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </AppShell>
  );
}

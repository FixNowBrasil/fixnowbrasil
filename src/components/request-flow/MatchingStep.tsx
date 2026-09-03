import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { BellRing, CalendarCheck, Check, Clock3, Loader2, SearchX, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { draftScheduledAt, type RequestDraft } from "@/lib/request-draft";

type MatchResult = { request_id: string | null; invited: number };

const PROGRESS = [
  "Analisando seu serviço",
  "Verificando profissionais na região",
  "Conferindo disponibilidade",
  "Encontrando as melhores opções",
];

/**
 * PARTE 5: cria a solicitação e convida até 5 profissionais compatíveis.
 * Todo o matching e a criação acontecem na função `create_request_with_matching`
 * (SECURITY DEFINER, valida `auth.uid()`): o frontend não escolhe profissionais.
 */
export function MatchingStep({ draft, onRetry }: { draft: RequestDraft; onRetry: () => void }) {
  const [state, setState] = useState<"loading" | "done" | "error">("loading");
  const [result, setResult] = useState<MatchResult | null>(null);
  const [progress, setProgress] = useState(0);
  const started = useRef(false);

  // Animação de progresso: avança até a última etapa enquanto o matching roda.
  useEffect(() => {
    if (state !== "loading") return;
    const timer = setInterval(
      () => setProgress((current) => Math.min(current + 1, PROGRESS.length - 1)),
      900,
    );
    return () => clearInterval(timer);
  }, [state]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      const scheduledAt = draftScheduledAt(draft)?.toISOString();
      const city = draft.addressParts?.city;
      const { data, error } = await supabase.rpc("create_request_with_matching", {
        p_request_id: draft.draftId,
        p_description: draft.description.trim() || draft.need || "Serviço solicitado pelo app",
        p_when_option: draft.when,
        p_address: draft.address,
        p_photos: draft.photos,
        ...(draft.serviceId ? { p_service_id: draft.serviceId } : {}),
        ...(draft.categoryId ? { p_category_id: draft.categoryId } : {}),
        ...(draft.need ? { p_need: draft.need } : {}),
        ...(scheduledAt ? { p_scheduled_at: scheduledAt } : {}),
        ...(city ? { p_city: city } : {}),
      });
      if (error) {
        setState("error");
        return;
      }
      setResult(data as unknown as MatchResult);
      setProgress(PROGRESS.length);
      setState("done");
    })();
  }, [draft]);

  if (state === "loading") {
    return (
      <section className="surface-card space-y-4 p-8 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
        <h1 className="font-display text-xl font-bold">🔎 Procurando profissionais...</h1>
        <ul className="mx-auto max-w-sm space-y-2 text-left">
          {PROGRESS.map((label, i) => {
            const done = i < progress;
            return (
              <li
                key={label}
                className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                  done ? "bg-muted" : "opacity-60"
                }`}
              >
                {done ? (
                  <Check className="h-4 w-4 text-primary" />
                ) : (
                  <Clock3 className="h-4 w-4 animate-pulse text-muted-foreground" />
                )}
                {label}
              </li>
            );
          })}
        </ul>
      </section>
    );
  }

  if (state === "error") {
    return (
      <section className="surface-card space-y-3 p-6 text-center">
        <h1 className="font-display text-xl font-bold">Não foi possível enviar a solicitação</h1>
        <p className="text-sm text-muted-foreground">
          Tente novamente ou revise os detalhes da solicitação.
        </p>
        <Button className="w-full font-extrabold" onClick={onRetry}>
          Revisar detalhes
        </Button>
      </section>
    );
  }

  if (!result?.request_id || result.invited === 0) {
    return (
      <section className="surface-card space-y-3 p-6 text-center">
        <SearchX className="mx-auto h-8 w-8 text-muted-foreground" />
        <h1 className="font-display text-xl font-bold">
          Não encontramos profissionais disponíveis no momento.
        </h1>
        <p className="text-sm text-muted-foreground">
          Você pode tentar novamente ou alterar os detalhes da solicitação.
        </p>
        <Button className="w-full font-extrabold" onClick={onRetry}>
          Alterar detalhes
        </Button>
      </section>
    );
  }

  return (
    <section className="surface-card space-y-4 p-6 text-center">
      <p className="text-4xl" aria-hidden>
        🎉
      </p>
      <h1 className="font-display text-xl font-bold">Solicitação enviada!</h1>
      <p className="text-sm font-semibold">
        {result.invited}{" "}
        {result.invited === 1
          ? "profissional compatível foi encontrado"
          : "profissionais compatíveis foram encontrados"}
        .
      </p>

      <ul className="mx-auto max-w-sm space-y-2 text-left">
        <Item icon={<Wallet className="h-4 w-4" />} label="Orçamento" />
        <Item icon={<Clock3 className="h-4 w-4" />} label="Prazo estimado" />
        <Item icon={<CalendarCheck className="h-4 w-4" />} label="Disponibilidade" />
      </ul>

      <p className="flex items-center justify-center gap-2 rounded-xl bg-muted px-4 py-3 text-sm font-semibold">
        <BellRing className="h-4 w-4 text-primary" />
        Você não precisa fazer mais nada agora — avisaremos quando chegar um orçamento.
      </p>

      <Button asChild className="w-full font-extrabold">
        <Link to="/pedidos/$id" params={{ id: result.request_id }}>
          Ver minha solicitação
        </Link>
      </Button>
    </section>
  );
}

function Item({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <li className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-semibold">
      <span className="text-primary">{icon}</span>
      {label}
    </li>
  );
}

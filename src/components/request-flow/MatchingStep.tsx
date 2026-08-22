import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Loader2, SearchX, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { draftScheduledAt, type RequestDraft } from "@/lib/request-draft";

type MatchResult = { request_id: string | null; invited: number };

/**
 * PARTE 4: cria a solicitação e convida até 5 profissionais compatíveis.
 * Todo o matching e a criação acontecem na função `create_request_with_matching`
 * (SECURITY DEFINER, valida `auth.uid()`): o frontend não escolhe profissionais.
 */
export function MatchingStep({ draft, onRetry }: { draft: RequestDraft; onRetry: () => void }) {
  const [state, setState] = useState<"loading" | "done" | "error">("loading");
  const [result, setResult] = useState<MatchResult | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      const { data, error } = await supabase.rpc("create_request_with_matching", {
        p_request_id: draft.draftId,
        p_service_id: draft.serviceId,
        p_category_id: draft.categoryId,
        p_need: draft.need,
        p_description: draft.description.trim() || draft.need || "Serviço solicitado pelo app",
        p_photos: draft.photos,
        p_when_option: draft.when,
        p_scheduled_at: draftScheduledAt(draft)?.toISOString() ?? null,
        p_address: draft.address,
        p_city: draft.addressParts?.city ?? null,
      });
      if (error) {
        setState("error");
        return;
      }
      setResult(data as unknown as MatchResult);
      setState("done");
    })();
  }, [draft]);

  if (state === "loading") {
    return (
      <section className="surface-card flex flex-col items-center gap-3 p-8 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <h1 className="font-display text-xl font-bold">Encontrando profissionais para você...</h1>
        <p className="text-sm text-muted-foreground">
          Estamos procurando profissionais que atendam ao seu serviço e à sua localização.
        </p>
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
    <section className="surface-card space-y-3 p-6 text-center">
      <Users className="mx-auto h-8 w-8 text-primary" />
      <h1 className="font-display text-xl font-bold">Encontramos profissionais para você!</h1>
      <p className="text-sm font-semibold">
        Encontramos {result.invited}{" "}
        {result.invited === 1 ? "profissional compatível" : "profissionais compatíveis"}.
      </p>
      <p className="text-sm text-muted-foreground">
        Eles já receberam sua solicitação e podem enviar um orçamento.
      </p>
      <Button asChild className="w-full font-extrabold">
        <Link to="/pedidos/$id" params={{ id: result.request_id }}>
          Acompanhar solicitação
        </Link>
      </Button>
    </section>
  );
}

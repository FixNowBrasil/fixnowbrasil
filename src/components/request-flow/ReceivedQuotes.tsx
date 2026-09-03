import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { BadgeCheck, Check, Clock, MapPin, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { Stars } from "@/components/fixnow-ui";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { brl } from "@/lib/fixnow";
import { quotesWithProvidersQuery, type QuoteWithProvider } from "@/lib/collab";

/** Converte "1h30", "2 horas", "45 min" em minutos para comparar prazos. */
function estimatedMinutes(text: string | null): number | null {
  if (!text) return null;
  const value = text.toLowerCase();
  const hours = value.match(/(\d+)\s*h/);
  const minutes = value.match(/(\d+)\s*m/);
  if (!hours && !minutes) {
    const days = value.match(/(\d+)\s*dia/);
    return days?.[1] ? Number(days[1]) * 24 * 60 : null;
  }
  return (hours?.[1] ? Number(hours[1]) * 60 : 0) + (minutes?.[1] ? Number(minutes[1]) : 0);
}

export function ReceivedQuotes({
  requestId,
  chosenProviderId,
}: {
  requestId: string;
  chosenProviderId: string | null;
}) {
  const queryClient = useQueryClient();
  const quotes = useQuery(quotesWithProvidersQuery(requestId));
  const [selected, setSelected] = useState<QuoteWithProvider | null>(null);

  const list = quotes.data ?? [];
  const accepted = list.find((q) => q.status === "accepted") ?? null;
  const pending = useMemo(
    () => list.filter((q) => q.status === "sent" || q.status === "pending"),
    [list],
  );

  /** Destaques: menor preço, melhor avaliação e prazo mais curto. */
  const highlights = useMemo(() => {
    if (pending.length < 2) return {} as Record<string, string[]>;
    const map: Record<string, string[]> = {};
    const add = (id: string | undefined, label: string) => {
      if (!id) return;
      map[id] = [...(map[id] ?? []), label];
    };
    const cheapest = [...pending].sort((a, b) => Number(a.amount) - Number(b.amount))[0];
    add(cheapest?.id, "💰 Menor preço");
    const best = [...pending].sort(
      (a, b) => Number(b.providers?.rating ?? 0) - Number(a.providers?.rating ?? 0),
    )[0];
    add(best?.id, "🏆 Melhor avaliação");
    const withTime = pending
      .map((q) => ({ q, minutes: estimatedMinutes(q.estimated_time) }))
      .filter((item): item is { q: QuoteWithProvider; minutes: number } => item.minutes !== null)
      .sort((a, b) => a.minutes - b.minutes);
    add(withTime[0]?.q.id, "⚡ Mais rápido");
    return map;
  }, [pending]);

  const choose = useMutation({
    mutationFn: async (quoteId: string) => {
      const { error } = await supabase.rpc("accept_quote" as never, {
        p_quote_id: quoteId,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      setSelected(null);
      toast.success("Profissional escolhido!");
      queryClient.invalidateQueries({ queryKey: ["quotes", requestId] });
      queryClient.invalidateQueries({ queryKey: ["request", requestId] });
      queryClient.invalidateQueries({ queryKey: ["payment", requestId] });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "";
      toast.error(
        message.includes("already")
          ? "Esta solicitação já tem um profissional escolhido."
          : "Não foi possível escolher este profissional.",
      );
    },
  });

  if (accepted || chosenProviderId) {
    return (
      <section className="surface-card space-y-3 p-5 ring-2 ring-success">
        <div>
          <h2 className="font-display text-base font-bold">Profissional escolhido!</h2>
          <p className="text-sm text-muted-foreground">
            Agora vocês podem combinar os próximos detalhes do serviço.
          </p>
        </div>
        {accepted && (
          <div className="flex items-center gap-3 rounded-xl border border-border p-3">
            <Avatar quote={accepted} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-display font-extrabold">
                {accepted.providers?.name ?? "Profissional"}
              </p>
              <p className="text-sm text-muted-foreground">
                {brl(Number(accepted.amount))}
                {accepted.estimated_time ? ` · ${accepted.estimated_time}` : ""}
              </p>
            </div>
            {accepted.providers?.id && (
              <Button asChild size="sm" variant="outline" className="font-bold">
                <Link to="/prestador/$id" params={{ id: accepted.providers.id }}>
                  Ver profissional
                </Link>
              </Button>
            )}
          </div>
        )}
        <Button asChild className="w-full font-extrabold">
          <a href="#conversa">Ir para a conversa</a>
        </Button>
      </section>
    );
  }

  return (
    <section className="surface-card space-y-3 p-5">
      <div>
        <h2 className="font-display text-base font-bold">
          {pending.length > 0 ? `${pending.length} orçamentos recebidos` : "Orçamentos recebidos"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {pending.length === 0
            ? "Estamos aguardando os profissionais. Assim que chegar um orçamento, ele aparece aqui — avisaremos você."
            : "Compare e escolha quem melhor atende você. A decisão é sempre sua."}
        </p>
      </div>

      <ul className="space-y-3">
        {pending.map((q) => {
          const badges = highlights[q.id] ?? [];
          const reasons = [
            q.providers?.distance_km != null ? "Atende sua região" : null,
            q.providers?.available_now ? "Disponível no horário solicitado" : null,
            "Especialista neste serviço",
            q.providers?.verified ? "Profissional verificado" : null,
          ].filter((r): r is string => !!r);

          return (
            <li key={q.id} className="rounded-2xl border border-border p-4">
              {badges.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {badges.map((b) => (
                    <span
                      key={b}
                      className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-extrabold text-primary"
                    >
                      {b}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex items-start gap-3">
                <Avatar quote={q} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate font-display font-extrabold">
                      {q.providers?.name ?? "Profissional"}
                    </p>
                    {q.providers?.verified && (
                      <BadgeCheck
                        className="h-4 w-4 shrink-0 text-primary"
                        aria-label="Verificado"
                      />
                    )}
                  </div>
                  {q.providers && (
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Stars value={Number(q.providers.rating)} />
                        {Number(q.providers.rating).toFixed(1)}
                        {q.providers.jobs_done
                          ? ` · ${q.providers.jobs_done} serviços`
                          : ` (${q.providers.reviews_count})`}
                      </span>
                      {q.providers.distance_km != null && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {Number(q.providers.distance_km).toFixed(1)} km
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <p className="shrink-0 font-display text-lg font-extrabold text-primary">
                  {brl(Number(q.amount))}
                </p>
              </div>

              {q.estimated_time && (
                <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" /> Prazo: {q.estimated_time}
                </p>
              )}
              {q.message && (
                <p className="mt-1 flex items-start gap-1.5 text-sm">
                  <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <span>“{q.message}”</span>
                </p>
              )}

              <ul className="mt-3 grid gap-1 rounded-xl bg-muted px-3 py-2 sm:grid-cols-2">
                {reasons.map((r) => (
                  <li
                    key={r}
                    className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"
                  >
                    <Check className="h-3.5 w-3.5 text-success" /> {r}
                  </li>
                ))}
              </ul>

              <div className="mt-3 flex gap-2">
                {q.providers?.id && (
                  <Button asChild size="sm" variant="outline" className="font-bold">
                    <Link to="/prestador/$id" params={{ id: q.providers.id }}>
                      Ver detalhes
                    </Link>
                  </Button>
                )}
                <Button
                  size="sm"
                  className="flex-1 font-extrabold"
                  disabled={choose.isPending}
                  onClick={() => setSelected(q)}
                >
                  Escolher este profissional
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar escolha</DialogTitle>
            <DialogDescription>
              Você vai escolher <strong>{selected?.providers?.name ?? "este profissional"}</strong>{" "}
              pelo valor de <strong>{selected ? brl(Number(selected.amount)) : ""}</strong>
              {selected?.estimated_time ? ` (prazo: ${selected.estimated_time})` : ""}. Os demais
              orçamentos serão recusados.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" className="font-bold" onClick={() => setSelected(null)}>
              Voltar
            </Button>
            <Button
              className="font-extrabold"
              disabled={choose.isPending}
              onClick={() => selected && choose.mutate(selected.id)}
            >
              Confirmar escolha
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function Avatar({ quote }: { quote: QuoteWithProvider }) {
  const url = quote.providers?.avatar_url;
  if (!url) {
    return (
      <div
        aria-hidden
        className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-muted font-display font-extrabold text-muted-foreground"
      >
        {(quote.providers?.name ?? "?").charAt(0)}
      </div>
    );
  }
  return (
    <img
      src={url}
      alt={quote.providers?.name ?? "Profissional"}
      className="h-12 w-12 shrink-0 rounded-2xl object-cover"
    />
  );
}

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { brl } from "@/lib/fixnow";
import { messagesQuery, quotesQuery } from "@/lib/collab";
import { cn } from "@/lib/utils";

export function RequestChat({ requestId, meId }: { requestId: string; meId: string }) {
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const messages = useQuery(messagesQuery(requestId));

  const send = useMutation({
    mutationFn: async () => {
      const body = text.trim();
      if (!body) return;
      const { error } = await supabase.from("messages").insert({ request_id: requestId, sender_id: meId, body });
      if (error) throw error;
    },
    onSuccess: () => {
      setText("");
      queryClient.invalidateQueries({ queryKey: ["messages", requestId] });
    },
    onError: () => toast.error("Não foi possível enviar a mensagem."),
  });

  return (
    <section className="surface-card p-5">
      <h2 className="mb-3 font-display text-base font-bold">Conversa</h2>
      <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
        {(messages.data ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhuma mensagem ainda. Combine detalhes, acesso ao local e horários por aqui.
          </p>
        )}
        {(messages.data ?? []).map((m) => {
          const mine = m.sender_id === meId;
          return (
            <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <p
                className={cn(
                  "max-w-[80%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm",
                  mine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
                )}
              >
                {m.body}
              </p>
            </div>
          );
        })}
      </div>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send.mutate();
        }}
      >
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={800}
          placeholder="Escreva uma mensagem..."
          aria-label="Mensagem"
          className="rounded-xl"
        />
        <Button type="submit" disabled={send.isPending || !text.trim()} aria-label="Enviar mensagem">
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </section>
  );
}

export function QuotePanel({
  requestId,
  providerId,
  role,
}: {
  requestId: string;
  providerId: string | null;
  role: "client" | "provider";
}) {
  const queryClient = useQueryClient();
  const quotes = useQuery(quotesQuery(requestId));
  const [amount, setAmount] = useState("");
  const [time, setTime] = useState("");
  const [message, setMessage] = useState("");

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["quotes", requestId] });

  const create = useMutation({
    mutationFn: async () => {
      const value = Number(amount.replace(",", "."));
      if (!value || value <= 0) throw new Error("valor");
      const { error } = await supabase.from("quotes").insert({
        request_id: requestId,
        provider_id: providerId!,
        amount: value,
        estimated_time: time.trim() || null,
        message: message.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Orçamento enviado ao cliente.");
      setAmount("");
      setTime("");
      setMessage("");
      invalidate();
    },
    onError: () => toast.error("Informe um valor válido e tente novamente."),
  });

  const decide = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "accepted" | "rejected" }) => {
      if (status === "accepted") {
        const { error } = await supabase.rpc("accept_quote" as never, {
          p_quote_id: id,
        } as never);
        if (error) throw error;
        return;
      }

      const { error } = await supabase.from("quotes").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["request", requestId] });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "";
      if (message.includes("under analysis") || message.includes("análise")) {
        toast.error("O pedido precisa estar em análise antes de aceitar o orçamento.");
      } else {
        toast.error("Não foi possível atualizar o orçamento.");
      }
    },
  });

  return (
    <section className="surface-card space-y-3 p-5">
      <h2 className="font-display text-base font-bold">Orçamento</h2>

      {(quotes.data ?? []).length === 0 && (
        <p className="text-sm text-muted-foreground">
          {role === "provider"
            ? "Envie uma proposta de valor para este pedido."
            : "Aguardando a proposta do profissional."}
        </p>
      )}

      <ul className="space-y-2">
        {(quotes.data ?? []).map((q) => (
          <li key={q.id} className="rounded-xl border border-border p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="font-display text-lg font-extrabold text-primary">{brl(Number(q.amount))}</p>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[11px] font-bold",
                  q.status === "accepted" && "bg-success/15 text-success",
                  q.status === "rejected" && "bg-destructive/10 text-destructive",
                  q.status === "sent" && "bg-muted text-muted-foreground",
                )}
              >
                {q.status === "accepted" ? "Aceito" : q.status === "rejected" ? "Recusado" : "Aguardando"}
              </span>
            </div>
            {q.estimated_time && <p className="text-xs text-muted-foreground">Prazo: {q.estimated_time}</p>}
            {q.message && <p className="mt-1 text-sm">{q.message}</p>}
            {role === "client" && q.status === "sent" && (
              <div className="mt-2 flex gap-2">
                <Button
                  size="sm"
                  className="font-bold"
                  disabled={decide.isPending}
                  onClick={() => decide.mutate({ id: q.id, status: "accepted" })}
                >
                  Aceitar orçamento
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="font-bold"
                  disabled={decide.isPending}
                  onClick={() => decide.mutate({ id: q.id, status: "rejected" })}
                >
                  Recusar
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {role === "provider" && providerId && (
        <form
          className="space-y-2 border-t border-border pt-3"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <div className="flex gap-2">
            <Input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              placeholder="Valor (R$)"
              aria-label="Valor do orçamento"
              className="rounded-xl"
            />
            <Input
              value={time}
              onChange={(e) => setTime(e.target.value)}
              placeholder="Prazo (ex.: 2h)"
              aria-label="Prazo estimado"
              className="rounded-xl"
            />
          </div>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="O que está incluso no orçamento?"
            className="rounded-xl"
          />
          <Button type="submit" className="w-full font-extrabold" disabled={create.isPending}>
            Enviar orçamento
          </Button>
        </form>
      )}
    </section>
  );
}

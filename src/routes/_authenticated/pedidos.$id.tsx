import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Check, ChevronLeft, Star } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/fixnow-ui";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { REQUEST_STEPS, type ServiceRequest } from "@/lib/fixnow";
import { QuotePanel, RequestChat } from "@/components/request-extras";
import { ClientSchedulePicker } from "@/components/ClientSchedulePicker";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/pedidos/$id")({
  head: () => ({
    meta: [
      { title: "Acompanhar serviço — FixNow" },
      { name: "description", content: "Acompanhe em tempo real o status do seu serviço no FixNow." },
      { property: "og:title", content: "Acompanhar serviço — FixNow" },
      { property: "og:description", content: "Timeline do seu serviço, do pedido à avaliação." },
    ],
  }),
  component: PedidoPage,
});

const NEXT: Record<string, string> = {
  sent: "analyzing",
  analyzing: "confirmed",
  confirmed: "on_the_way",
  on_the_way: "in_progress",
  in_progress: "completed",
};

function PedidoPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [rating, setRating] = useState(5);
  const [punctuality, setPunctuality] = useState(5);
  const [quality, setQuality] = useState(5);
  const [service, setService] = useState(5);
  const [comment, setComment] = useState("");

  const request = useQuery({
    queryKey: ["request", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_requests")
        .select("*, providers(id, name, avatar_url, headline, availability), services(name)")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const myProvider = useQuery({
    queryKey: ["my-provider", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("providers")
        .select("id")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const advance = useMutation({
    mutationFn: async (status: string) => {
      const { error } = await supabase
        .from("service_requests")
        .update({ status: status as never, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["request", id] });
      queryClient.invalidateQueries({ queryKey: ["requests"] });
    },
    onError: () => toast.error("Não foi possível atualizar o status."),
  });

  const sendReview = useMutation({
    mutationFn: async () => {
      const req = request.data as unknown as ServiceRequest;
      const { error } = await supabase.from("reviews").insert({
        provider_id: req.provider_id!,
        request_id: req.id,
        client_id: user!.id,
        author_name: user!.email?.split("@")[0] ?? "Cliente FixNow",
        rating,
        punctuality,
        quality,
        service,
        comment: comment.trim() || null,
      });
      if (error) throw error;
      const { error: e2 } = await supabase
        .from("service_requests")
        .update({ status: "rated" as never })
        .eq("id", id);
      if (e2) throw e2;
    },
    onSuccess: () => {
      toast.success("Obrigado pela avaliação!");
      queryClient.invalidateQueries({ queryKey: ["request", id] });
      queryClient.invalidateQueries({ queryKey: ["reviews"] });
    },
    onError: () => toast.error("Não foi possível enviar sua avaliação."),
  });

  if (request.isLoading) {
    return (
      <AppShell>
        <div className="mx-auto max-w-2xl px-4 py-8">
          <div className="h-72 animate-pulse rounded-2xl bg-muted" />
        </div>
      </AppShell>
    );
  }

  const req = request.data as unknown as
    | (ServiceRequest & {
        providers: {
          id: string;
          name: string;
          avatar_url: string | null;
          headline: string | null;
          availability: string | null;
        } | null;
        services: { name: string } | null;
      })
    | null;

  if (!req) {
    return (
      <AppShell>
        <div className="mx-auto max-w-2xl px-4 py-10">
          <EmptyState title="Pedido não encontrado" description="Esse pedido não existe ou foi removido." />
        </div>
      </AppShell>
    );
  }

  const currentIndex = REQUEST_STEPS.findIndex((s) => s.key === req.status);
  const next = NEXT[req.status];
  const isRequestProvider = !!myProvider.data?.id && myProvider.data.id === req.provider_id;
  const isRequestClient = !!user?.id && user.id === req.client_id;
  const canSchedule = isRequestClient && !isRequestProvider && !!req.provider_id && req.status === "confirmed";

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-2xl space-y-5 px-4 py-6">
        <Link to="/pedidos" className="inline-flex items-center gap-1 text-sm font-bold text-muted-foreground">
          <ChevronLeft className="h-4 w-4" /> Meus pedidos
        </Link>

        <header className="surface-card p-5">
          <div className="flex items-center gap-3">
            <img
              src={req.providers?.avatar_url ?? ""}
              alt=""
              className="h-14 w-14 shrink-0 rounded-2xl object-cover"
            />
            <div className="min-w-0">
              <h1 className="truncate font-display text-lg font-extrabold">
                {req.services?.name ?? req.need ?? "Serviço"}
              </h1>
              <p className="truncate text-sm text-muted-foreground">{req.providers?.name}</p>
            </div>
          </div>
          <dl className="mt-4 space-y-1 text-sm">
            <div className="flex gap-2">
              <dt className="font-bold">Necessidade:</dt>
              <dd className="text-muted-foreground">{req.need ?? "—"}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-bold">Detalhes:</dt>
              <dd className="text-muted-foreground">{req.description}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-bold">Endereço:</dt>
              <dd className="text-muted-foreground">{req.address}</dd>
            </div>
          </dl>
        </header>

        <QuotePanel
          requestId={req.id}
          providerId={myProvider.data?.id ?? null}
          role={isRequestProvider ? "provider" : "client"}
        />

        {canSchedule && req.providers && user && (
          <ClientSchedulePicker
            requestId={req.id}
            providerId={req.providers.id}
            clientId={user.id}
            availability={req.providers.availability}
            currentScheduledAt={req.scheduled_at}
          />
        )}

        {user && <RequestChat requestId={req.id} meId={user.id} />}

        <section className="surface-card p-5">
          <h2 className="mb-4 font-display text-base font-bold">Acompanhamento</h2>
          <ol className="space-y-0">
            {REQUEST_STEPS.map((s, i) => {
              const done = i < currentIndex;
              const active = i === currentIndex;
              return (
                <li key={s.key} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span
                      className={cn(
                        "grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 text-[11px] font-bold",
                        done && "border-success bg-success text-success-foreground",
                        active && "border-primary bg-primary text-primary-foreground",
                        !done && !active && "border-border bg-card text-muted-foreground",
                      )}
                    >
                      {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                    </span>
                    {i < REQUEST_STEPS.length - 1 && (
                      <span className={cn("w-0.5 flex-1", done ? "bg-success" : "bg-border")} />
                    )}
                  </div>
                  <p
                    className={cn(
                      "pb-6 text-sm",
                      active ? "font-extrabold text-foreground" : "font-semibold text-muted-foreground",
                    )}
                  >
                    {s.label}
                  </p>
                </li>
              );
            })}
          </ol>
          {next && (
            <Button
              variant="outline"
              className="w-full font-bold"
              disabled={advance.isPending}
              onClick={() => advance.mutate(next)}
            >
              Simular próximo status (demo)
            </Button>
          )}
        </section>

        {req.status === "completed" && (
          <section className="surface-card space-y-4 p-5">
            <h2 className="font-display text-base font-bold">Como foi seu atendimento?</h2>
            <StarPicker label="Nota geral" value={rating} onChange={setRating} />
            <StarPicker label="Pontualidade" value={punctuality} onChange={setPunctuality} />
            <StarPicker label="Qualidade" value={quality} onChange={setQuality} />
            <StarPicker label="Atendimento" value={service} onChange={setService} />
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={500}
              rows={4}
              placeholder="Conte como foi o serviço (opcional)"
              className="rounded-xl"
            />
            <Button
              className="w-full font-extrabold"
              disabled={sendReview.isPending}
              onClick={() => sendReview.mutate()}
            >
              Enviar avaliação
            </Button>
          </section>
        )}

        {req.status === "rated" && (
          <p className="rounded-2xl bg-success/10 p-4 text-center text-sm font-bold text-success">
            Serviço concluído e avaliado. Obrigado por usar o FixNow!
          </p>
        )}
      </div>
    </AppShell>
  );
}

function StarPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm font-semibold">{label}</span>
      <span className="flex gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <button key={i} type="button" onClick={() => onChange(i)} aria-label={`${label}: ${i} estrelas`}>
            <Star className={cn("h-6 w-6", i <= value ? "fill-warning text-warning" : "text-border")} />
          </button>
        ))}
      </span>
    </div>
  );
}

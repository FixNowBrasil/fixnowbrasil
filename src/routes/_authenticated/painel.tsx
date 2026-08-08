import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/fixnow-ui";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { REQUEST_STEPS, type ServiceRequest } from "@/lib/fixnow";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({
    meta: [
      { title: "Painel do prestador — FixNow" },
      { name: "description", content: "Gerencie solicitações, agenda e avaliações como prestador FixNow." },
      { property: "og:title", content: "Painel do prestador — FixNow" },
      { property: "og:description", content: "Suas solicitações e desempenho em um só lugar." },
    ],
  }),
  component: PainelPage,
});

function PainelPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const myProvider = useQuery({
    queryKey: ["my-provider", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("providers")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const requests = useQuery({
    queryKey: ["provider-requests", myProvider.data?.id],
    enabled: !!myProvider.data?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_requests")
        .select("*, services(name)")
        .eq("provider_id", myProvider.data!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("service_requests")
        .update({ status: status as never })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["provider-requests"] }),
    onError: () => toast.error("Não foi possível atualizar."),
  });

  const p = myProvider.data;

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-4xl space-y-5 px-4 py-6">
        <h1 className="font-display text-2xl font-extrabold">Painel do prestador</h1>

        {myProvider.isLoading ? (
          <div className="h-40 animate-pulse rounded-2xl bg-muted" />
        ) : !p ? (
          <EmptyState
            title="Seu perfil profissional ainda não existe"
            description="Um perfil de prestador é criado pela equipe FixNow após a validação dos seus documentos. Enquanto isso, você pode usar o app como cliente."
          />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Nota", value: Number(p.rating).toFixed(1) },
                { label: "Avaliações", value: p.reviews_count },
                { label: "Serviços feitos", value: p.jobs_done },
                { label: "Solicitações", value: (requests.data ?? []).length },
              ].map((s) => (
                <div key={s.label} className="surface-card p-4 text-center">
                  <p className="text-xl font-extrabold text-primary">{s.value}</p>
                  <p className="text-[11px] font-semibold text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>

            <section className="surface-card p-5">
              <h2 className="mb-3 font-display text-base font-bold">Solicitações recebidas</h2>
              {(requests.data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma solicitação por enquanto.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {(requests.data ?? []).map((row) => {
                    const r = row as unknown as ServiceRequest & { services: { name: string } | null };
                    return (
                      <li key={r.id} className="flex flex-wrap items-center gap-3 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold">{r.services?.name ?? r.need}</p>
                          <p className="truncate text-xs text-muted-foreground">{r.description}</p>
                        </div>
                        <span className="rounded-full bg-accent px-2.5 py-1 text-[11px] font-bold text-accent-foreground">
                          {REQUEST_STEPS.find((s) => s.key === r.status)?.label ?? r.status}
                        </span>
                        {r.status === "sent" && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              className="font-bold"
                              onClick={() => setStatus.mutate({ id: r.id, status: "confirmed" })}
                            >
                              Aceitar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="font-bold"
                              onClick={() => setStatus.mutate({ id: r.id, status: "cancelled" })}
                            >
                              Recusar
                            </Button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}

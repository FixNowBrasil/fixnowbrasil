import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { CardSkeleton, EmptyState } from "@/components/fixnow-ui";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { REQUEST_STEPS, type ServiceRequest } from "@/lib/fixnow";

export const Route = createFileRoute("/_authenticated/pedidos/")({
  head: () => ({
    meta: [
      { title: "Meus pedidos — FixNow" },
      { name: "description", content: "Acompanhe o status dos seus serviços solicitados no FixNow." },
      { property: "og:title", content: "Meus pedidos — FixNow" },
      { property: "og:description", content: "Histórico e acompanhamento dos seus serviços." },
    ],
  }),
  component: PedidosPage,
});

export function statusLabel(status: string) {
  return REQUEST_STEPS.find((s) => s.key === status)?.label ?? "Cancelado";
}

function PedidosPage() {
  const { user } = useAuth();
  const requests = useQuery({
    queryKey: ["requests", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_requests")
        .select("*, providers(name, avatar_url), services(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-6">
        <h1 className="font-display text-2xl font-extrabold">Meus pedidos</h1>
        {requests.isLoading ? (
          <CardSkeleton count={3} />
        ) : (requests.data ?? []).length === 0 ? (
          <EmptyState
            title="Você ainda não tem pedidos"
            description="Escolha um serviço e encontre um profissional em poucos passos."
            action={
              <Link to="/buscar">
                <Button className="font-bold">Buscar serviços</Button>
              </Link>
            }
          />
        ) : (
          <ul className="space-y-3">
            {(requests.data ?? []).map((r) => {
              const req = r as unknown as ServiceRequest & {
                providers: { name: string; avatar_url: string | null } | null;
                services: { name: string } | null;
              };
              return (
                <li key={req.id}>
                  <Link
                    to="/pedidos/$id"
                    params={{ id: req.id }}
                    className="surface-card press flex items-center gap-3 p-4"
                  >
                    <img
                      src={req.providers?.avatar_url ?? ""}
                      alt=""
                      className="h-12 w-12 shrink-0 rounded-xl object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">
                        {req.services?.name ?? req.need ?? "Serviço"}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{req.providers?.name}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-accent px-2.5 py-1 text-[11px] font-bold text-accent-foreground">
                      {statusLabel(req.status)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </AppShell>
  );
}

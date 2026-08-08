import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Shield } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/fixnow-ui";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { categoriesQuery, providersQuery } from "@/lib/fixnow";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Painel administrativo — FixNow" },
      { name: "description", content: "Visão geral de prestadores, categorias e solicitações do FixNow." },
      { property: "og:title", content: "Painel administrativo — FixNow" },
      { property: "og:description", content: "Gestão da operação FixNow." },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { isAdmin, loading, roles } = useAuth();
  const categories = useQuery(categoriesQuery);
  const providers = useQuery(providersQuery());
  const requests = useQuery({
    queryKey: ["admin-requests"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_requests")
        .select("id, status, created_at, description")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  if (!loading && roles.length > 0 && !isAdmin) {
    return (
      <AppShell>
        <div className="mx-auto max-w-2xl px-4 py-10">
          <EmptyState
            title="Acesso restrito"
            description="Esta área é exclusiva para administradores do FixNow."
          />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-5xl space-y-5 px-4 py-6">
        <h1 className="inline-flex items-center gap-2 font-display text-2xl font-extrabold">
          <Shield className="h-6 w-6 text-primary" /> Painel administrativo
        </h1>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Categorias", value: (categories.data ?? []).length },
            { label: "Prestadores", value: (providers.data ?? []).length },
            { label: "Verificados", value: (providers.data ?? []).filter((p) => p.verified).length },
            { label: "Solicitações", value: (requests.data ?? []).length },
          ].map((s) => (
            <div key={s.label} className="surface-card p-4 text-center">
              <p className="text-2xl font-extrabold text-primary">{s.value}</p>
              <p className="text-[11px] font-semibold text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        <section className="surface-card overflow-x-auto p-5">
          <h2 className="mb-3 font-display text-base font-bold">Prestadores</h2>
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr>
                <th className="pb-2">Nome</th>
                <th className="pb-2">Nota</th>
                <th className="pb-2">Serviços</th>
                <th className="pb-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(providers.data ?? []).map((p) => (
                <tr key={p.id}>
                  <td className="py-2 font-semibold">{p.name}</td>
                  <td className="py-2">{Number(p.rating).toFixed(1)}</td>
                  <td className="py-2">{p.jobs_done}</td>
                  <td className="py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                        p.verified ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {p.verified ? "Verificado" : "Pendente"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="surface-card p-5">
          <h2 className="mb-3 font-display text-base font-bold">Últimas solicitações</h2>
          {(requests.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma solicitação registrada ainda.</p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {(requests.data ?? []).map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="truncate text-muted-foreground">{r.description}</span>
                  <span className="shrink-0 font-bold">{r.status}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}

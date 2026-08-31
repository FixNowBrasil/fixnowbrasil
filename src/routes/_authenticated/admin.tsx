import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Shield, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/fixnow-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { categoriesQuery } from "@/lib/fixnow";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Painel administrativo — FixNow" },
      { name: "description", content: "Aprove prestadores, gerencie categorias e modere avaliações do FixNow." },
      { property: "og:title", content: "Painel administrativo — FixNow" },
      { property: "og:description", content: "Gestão da operação FixNow." },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { isAdmin, loading, roles } = useAuth();
  const queryClient = useQueryClient();
  const categories = useQuery(categoriesQuery);
  const [newCategory, setNewCategory] = useState("");

  const providers = useQuery({
    queryKey: ["admin-providers"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("providers")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

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

  const reviews = useQuery({
    queryKey: ["admin-reviews"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reviews")
        .select("id, author_name, rating, comment, created_at")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  const profiles = useQuery({
    queryKey: ["admin-profiles"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, city, blocked, created_at")
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data ?? [];
    },
  });

  const updateProvider = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: { approved?: boolean; verified?: boolean } }) => {
      const { error } = await supabase.from("providers").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-providers"] });
      queryClient.invalidateQueries({ queryKey: ["providers"] });
    },
    onError: () => toast.error("Não foi possível atualizar o prestador."),
  });

  const toggleBlock = useMutation({
    mutationFn: async ({ id, blocked }: { id: string; blocked: boolean }) => {
      const { error } = await supabase.from("profiles").update({ blocked }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-profiles"] }),
    onError: () => toast.error("Não foi possível atualizar o usuário."),
  });

  const deleteReview = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("reviews").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Avaliação removida.");
      queryClient.invalidateQueries({ queryKey: ["admin-reviews"] });
    },
    onError: () => toast.error("Não foi possível remover a avaliação."),
  });

  const addCategory = useMutation({
    mutationFn: async () => {
      const name = newCategory.trim();
      if (!name) throw new Error("nome");
      const slug = name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      const { error } = await supabase.from("categories").insert({
        name,
        slug,
        sort_order: (categories.data ?? []).length + 1,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewCategory("");
      toast.success("Categoria criada.");
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
    onError: () => toast.error("Não foi possível criar a categoria."),
  });

  if (!loading && roles.length > 0 && !isAdmin) {
    return (
      <AppShell>
        <div className="mx-auto max-w-2xl px-4 py-10">
          <EmptyState title="Acesso restrito" description="Esta área é exclusiva para administradores do FixNow." />
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
            { label: "Pendentes", value: (providers.data ?? []).filter((p) => !p.approved).length },
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
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr>
                <th className="pb-2">Nome</th>
                <th className="pb-2">Nota</th>
                <th className="pb-2">Situação</th>
                <th className="pb-2">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(providers.data ?? []).map((p) => (
                <tr key={p.id}>
                  <td className="py-2 font-semibold">{p.name}</td>
                  <td className="py-2">{Number(p.rating).toFixed(1)}</td>
                  <td className="py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                        p.approved ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {p.approved ? "Aprovado" : "Pendente"}
                    </span>
                  </td>
                  <td className="flex flex-wrap gap-2 py-2">
                    <Button
                      size="sm"
                      variant={p.approved ? "outline" : "default"}
                      className="font-bold"
                      onClick={() => updateProvider.mutate({ id: p.id, patch: { approved: !p.approved } })}
                    >
                      {p.approved ? "Suspender" : "Aprovar"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="font-bold"
                      onClick={() => updateProvider.mutate({ id: p.id, patch: { verified: !p.verified } })}
                    >
                      {p.verified ? "Remover selo" : "Verificar"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <AdminVerifications enabled={isAdmin} />



        <section className="surface-card space-y-3 p-5">
          <h2 className="font-display text-base font-bold">Categorias</h2>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              addCategory.mutate();
            }}
          >
            <Input
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="Nova categoria"
              aria-label="Nome da nova categoria"
              className="rounded-xl"
            />
            <Button type="submit" className="font-bold" disabled={addCategory.isPending}>
              Criar
            </Button>
          </form>
          <div className="flex flex-wrap gap-2">
            {(categories.data ?? []).map((c) => (
              <span key={c.id} className="rounded-full bg-muted px-3 py-1 text-xs font-bold">
                {c.emoji} {c.name}
              </span>
            ))}
          </div>
        </section>

        <section className="surface-card p-5">
          <h2 className="mb-3 font-display text-base font-bold">Usuários</h2>
          <ul className="divide-y divide-border">
            {(profiles.data ?? []).map((u) => (
              <li key={u.id} className="flex items-center gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{u.full_name || "Sem nome"}</p>
                  <p className="truncate text-xs text-muted-foreground">{u.city ?? "—"}</p>
                </div>
                <Button
                  size="sm"
                  variant={u.blocked ? "default" : "outline"}
                  className="font-bold"
                  onClick={() => toggleBlock.mutate({ id: u.id, blocked: !u.blocked })}
                >
                  {u.blocked ? "Desbloquear" : "Bloquear"}
                </Button>
              </li>
            ))}
          </ul>
        </section>

        <section className="surface-card p-5">
          <h2 className="mb-3 font-display text-base font-bold">Moderação de avaliações</h2>
          <ul className="divide-y divide-border">
            {(reviews.data ?? []).map((r) => (
              <li key={r.id} className="flex items-center gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">
                    {r.author_name} — {r.rating}★
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{r.comment ?? "Sem comentário"}</p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  aria-label="Remover avaliação"
                  onClick={() => deleteReview.mutate(r.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        </section>

        <section className="surface-card p-5">
          <h2 className="mb-3 font-display text-base font-bold">Últimas solicitações</h2>
          <ul className="divide-y divide-border">
            {(requests.data ?? []).map((r) => (
              <li key={r.id} className="flex items-center gap-3 py-2">
                <p className="min-w-0 flex-1 truncate text-sm">{r.description || "Sem descrição"}</p>
                <span className="rounded-full bg-accent px-2.5 py-1 text-[11px] font-bold text-accent-foreground">
                  {r.status}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </AppShell>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { REQUEST_STEPS, categoriesQuery, type ServiceRequest } from "@/lib/fixnow";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({
    meta: [
      { title: "Painel do prestador — FixNow" },
      { name: "description", content: "Gerencie solicitações, agenda, orçamentos e seu perfil profissional." },
      { property: "og:title", content: "Painel do prestador — FixNow" },
      { property: "og:description", content: "Suas solicitações e desempenho em um só lugar." },
    ],
  }),
  component: PainelPage,
});

type Form = {
  name: string;
  headline: string;
  bio: string;
  avatar_url: string;
  category_id: string;
  city: string;
  neighborhood: string;
  radius_km: number;
  years_experience: number;
  price_from: number;
  availability: string;
  available_now: boolean;
};

const EMPTY: Form = {
  name: "",
  headline: "",
  bio: "",
  avatar_url: "",
  category_id: "",
  city: "São Paulo",
  neighborhood: "",
  radius_km: 15,
  years_experience: 1,
  price_from: 80,
  availability: "Seg a Sáb, 8h às 18h",
  available_now: true,
};

export function PainelPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const categories = useQuery(categoriesQuery);
  const [form, setForm] = useState<Form>(EMPTY);

  const myProvider = useQuery({
    queryKey: ["my-provider-full", user?.id],
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

  const p = myProvider.data;

  useEffect(() => {
    if (!p) return;
    setForm({
      name: p.name ?? "",
      headline: p.headline ?? "",
      bio: p.bio ?? "",
      avatar_url: p.avatar_url ?? "",
      category_id: p.category_id ?? "",
      city: p.city ?? "",
      neighborhood: p.neighborhood ?? "",
      radius_km: p.radius_km ?? 15,
      years_experience: p.years_experience ?? 1,
      price_from: Number(p.price_from ?? 80),
      availability: p.availability ?? "",
      available_now: p.available_now ?? true,
    });
  }, [p]);

  const requests = useQuery({
    queryKey: ["provider-requests", p?.id],
    enabled: !!p?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_requests")
        .select("*, services(name)")
        .eq("provider_id", p!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("nome");
      const payload = {
        name: form.name.trim(),
        headline: form.headline.trim() || null,
        bio: form.bio.trim() || null,
        avatar_url: form.avatar_url.trim() || null,
        category_id: form.category_id || null,
        city: form.city.trim() || "São Paulo",
        neighborhood: form.neighborhood.trim() || null,
        radius_km: Number(form.radius_km) || 1,
        years_experience: Number(form.years_experience) || 0,
        price_from: Number(form.price_from) || 0,
        availability: form.availability.trim() || "Combinar",
        available_now: form.available_now,
      };
      if (p) {
        const { error } = await supabase.from("providers").update(payload).eq("id", p.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("providers").insert({ ...payload, user_id: user!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Perfil profissional salvo.");
      queryClient.invalidateQueries({ queryKey: ["my-provider-full"] });
      queryClient.invalidateQueries({ queryKey: ["my-provider", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["providers"] });
    },
    onError: () => toast.error("Verifique os dados e tente novamente."),
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

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-4xl space-y-5 px-4 py-6">
        <h1 className="font-display text-2xl font-extrabold">Painel do prestador</h1>

        {myProvider.isLoading ? (
          <div className="h-40 animate-pulse rounded-2xl bg-muted" />
        ) : (
          <>
            {p && (
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
            )}

            <section className="surface-card space-y-4 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-base font-bold">
                    {p ? "Meu perfil profissional" : "Cadastre-se como prestador"}
                  </h2>
                  {!p && <p className="mt-1 text-sm text-muted-foreground">Crie seu perfil profissional para começar a receber solicitações de clientes.</p>}
                </div>
                {p && (
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                      p.approved ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {p.approved ? "Aprovado" : "Em análise"}
                  </span>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nome profissional" id="name">
                  <Input id="name" value={form.name} onChange={(e) => set("name", e.target.value)} maxLength={80} />
                </Field>
                <Field label="Título curto" id="headline">
                  <Input
                    id="headline"
                    value={form.headline}
                    onChange={(e) => set("headline", e.target.value)}
                    placeholder="Ex.: Eletricista residencial"
                    maxLength={80}
                  />
                </Field>
                <Field label="Foto de perfil (URL)" id="avatar">
                  <Input
                    id="avatar"
                    value={form.avatar_url}
                    onChange={(e) => set("avatar_url", e.target.value)}
                    placeholder="https://..."
                  />
                </Field>
                <Field label="Categoria principal" id="cat">
                  <select
                    id="cat"
                    value={form.category_id}
                    onChange={(e) => set("category_id", e.target.value)}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">Selecione...</option>
                    {(categories.data ?? []).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.emoji} {c.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Cidade" id="city">
                  <Input id="city" value={form.city} onChange={(e) => set("city", e.target.value)} maxLength={60} />
                </Field>
                <Field label="Bairro" id="hood">
                  <Input
                    id="hood"
                    value={form.neighborhood}
                    onChange={(e) => set("neighborhood", e.target.value)}
                    maxLength={60}
                  />
                </Field>
                <Field label="Raio de atendimento (km)" id="radius">
                  <Input
                    id="radius"
                    type="number"
                    min={1}
                    value={form.radius_km}
                    onChange={(e) => set("radius_km", Number(e.target.value))}
                  />
                </Field>
                <Field label="Anos de experiência" id="exp">
                  <Input
                    id="exp"
                    type="number"
                    min={0}
                    value={form.years_experience}
                    onChange={(e) => set("years_experience", Number(e.target.value))}
                  />
                </Field>
                <Field label="Preço inicial (R$)" id="price">
                  <Input
                    id="price"
                    type="number"
                    min={0}
                    value={form.price_from}
                    onChange={(e) => set("price_from", Number(e.target.value))}
                  />
                </Field>
                <Field label="Horários disponíveis" id="avail">
                  <Input
                    id="avail"
                    value={form.availability}
                    onChange={(e) => set("availability", e.target.value)}
                    maxLength={80}
                  />
                </Field>
              </div>

              <Field label="Descrição" id="bio">
                <Textarea
                  id="bio"
                  value={form.bio}
                  onChange={(e) => set("bio", e.target.value)}
                  rows={4}
                  maxLength={800}
                  placeholder="Conte sua experiência, especialidades e diferenciais."
                />
              </Field>

              <div className="flex items-center justify-between rounded-xl border border-border p-3">
                <div>
                  <p className="text-sm font-bold">Disponível agora</p>
                  <p className="text-xs text-muted-foreground">Aparece como online para os clientes.</p>
                </div>
                <Switch
                  checked={form.available_now}
                  onCheckedChange={(v) => set("available_now", v)}
                  aria-label="Disponível agora"
                />
              </div>

              <Button className="w-full font-extrabold" disabled={save.isPending} onClick={() => save.mutate()}>
                {save.isPending ? "Salvando..." : p ? "Salvar alterações" : "Criar perfil profissional"}
              </Button>
            </section>

            {p && (
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
                          <div className="flex gap-2">
                            {r.status === "sent" && (
                              <>
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
                              </>
                            )}
                            <Link to="/pedidos/$id" params={{ id: r.id }}>
                              <Button size="sm" variant="ghost" className="font-bold">
                                Orçamento e chat
                              </Button>
                            </Link>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

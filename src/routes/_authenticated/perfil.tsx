import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/perfil")({
  head: () => ({
    meta: [
      { title: "Meu perfil — FixNow" },
      { name: "description", content: "Atualize seus dados de contato e endereço no FixNow." },
      { property: "og:title", content: "Meu perfil — FixNow" },
      { property: "og:description", content: "Gerencie sua conta FixNow." },
    ],
  }),
  component: PerfilPage,
});

function PerfilPage() {
  const { user, roles } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ full_name: "", phone: "", city: "", address: "" });
  const [saving, setSaving] = useState(false);

  const profile = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (profile.data) {
      setForm({
        full_name: profile.data.full_name ?? "",
        phone: profile.data.phone ?? "",
        city: profile.data.city ?? "",
        address: profile.data.address ?? "",
      });
    }
  }, [profile.data]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .upsert({ id: user!.id, ...form, updated_at: new Date().toISOString() });
    setSaving(false);
    if (error) {
      toast.error("Não foi possível salvar seus dados.");
      return;
    }
    toast.success("Dados atualizados!");
    queryClient.invalidateQueries({ queryKey: ["profile"] });
  }

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-2xl space-y-5 px-4 py-6">
        <header>
          <h1 className="font-display text-2xl font-extrabold">Meu perfil</h1>
          <p className="text-sm text-muted-foreground">
            {user?.email} · {roles.includes("provider") ? "Prestador" : "Cliente"}
          </p>
        </header>

        <form onSubmit={save} className="surface-card space-y-4 p-5">
          <div className="space-y-1.5">
            <Label htmlFor="full_name">Nome completo</Label>
            <Input
              id="full_name"
              value={form.full_name}
              maxLength={100}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">Telefone</Label>
            <Input
              id="phone"
              value={form.phone}
              maxLength={20}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="city">Cidade</Label>
            <Input
              id="city"
              value={form.city}
              maxLength={80}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="address">Endereço padrão</Label>
            <Input
              id="address"
              value={form.address}
              maxLength={200}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </div>
          <Button type="submit" className="w-full font-extrabold" disabled={saving}>
            {saving ? "Salvando..." : "Salvar alterações"}
          </Button>
        </form>
      </div>
    </AppShell>
  );
}

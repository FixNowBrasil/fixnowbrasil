import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Home, MapPin, Plus, Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  formatAddress,
  type DraftAddress,
  type RequestDraft,
} from "@/lib/request-draft";

type AddressRow = {
  id: string;
  label: string;
  street: string;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string;
  state: string | null;
  zip: string | null;
  is_default: boolean;
};

const emptyForm = {
  label: "Casa",
  zip: "",
  street: "",
  number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
  is_default: false,
};

export function AddressStep({
  draft,
  update,
  showError,
}: {
  draft: RequestDraft;
  update: (patch: Partial<RequestDraft>) => void;
  showError: boolean;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);

  const addresses = useQuery({
    queryKey: ["addresses", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("addresses")
        .select("id,label,street,number,complement,neighborhood,city,state,zip,is_default")
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AddressRow[];
    },
  });

  const list = addresses.data ?? [];

  function pick(row: AddressRow) {
    const parts: DraftAddress = {
      id: row.id,
      label: row.label,
      street: row.street,
      number: row.number ?? "",
      complement: row.complement ?? "",
      neighborhood: row.neighborhood ?? "",
      city: row.city,
      state: row.state ?? "",
      zip: row.zip ?? "",
    };
    update({ addressParts: parts, address: formatAddress(parts) });
    setCreating(false);
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("auth");
      const payload = {
        user_id: user.id,
        label: form.label.trim() || "Endereço",
        street: form.street.trim(),
        number: form.number.trim() || null,
        complement: form.complement.trim() || null,
        neighborhood: form.neighborhood.trim() || null,
        city: form.city.trim(),
        state: form.state.trim() || null,
        zip: form.zip.trim() || null,
        is_default: form.is_default,
      };
      if (form.is_default) {
        await supabase.from("addresses").update({ is_default: false }).eq("user_id", user.id);
      }
      const { data, error } = await supabase
        .from("addresses")
        .insert(payload)
        .select("id,label,street,number,complement,neighborhood,city,state,zip,is_default")
        .single();
      if (error) throw error;
      return data as AddressRow;
    },
    onSuccess: (row) => {
      queryClient.invalidateQueries({ queryKey: ["addresses", user?.id] });
      pick(row);
      setForm(emptyForm);
      toast.success("Endereço salvo!");
    },
    onError: () => toast.error("Não foi possível salvar o endereço. Confira os campos."),
  });

  const formError =
    form.street.trim().length < 3
      ? "Informe a rua."
      : !form.number.trim()
        ? "Informe o número."
        : form.city.trim().length < 2
          ? "Informe a cidade."
          : null;

  return (
    <section className="surface-card space-y-4 p-5">
      <div className="space-y-1">
        <h1 className="font-display text-xl font-bold">📍 Onde será realizado o serviço?</h1>
        <p className="text-sm text-muted-foreground">
          Informe o endereço onde o profissional deverá realizar o serviço.
        </p>
      </div>

      {!user && (
        <p className="rounded-xl bg-muted px-4 py-3 text-sm">
          Entre na sua conta para usar endereços salvos — você também pode digitar um endereço agora.
        </p>
      )}

      {addresses.isLoading && <p className="text-sm text-muted-foreground">Carregando endereços...</p>}

      {list.length > 0 && !creating && (
        <div className="grid gap-2">
          {list.map((a) => {
            const active = draft.addressParts?.id === a.id;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => pick(a)}
                className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-left transition ${
                  active ? "border-primary bg-accent text-accent-foreground" : "border-border bg-card hover:bg-muted"
                }`}
              >
                <Home className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="min-w-0">
                  <span className="flex items-center gap-2 text-sm font-bold">
                    {a.label}
                    {a.is_default && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase text-primary">
                        <Star className="h-3 w-3" /> Endereço principal
                      </span>
                    )}
                  </span>
                  <span className="block text-sm text-muted-foreground">
                    {a.street}
                    {a.number ? `, ${a.number}` : ""}
                    {a.complement ? ` — ${a.complement}` : ""}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {[a.neighborhood, `${a.city}${a.state ? `/${a.state}` : ""}`].filter(Boolean).join(" - ")}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      {!creating ? (
        <Button type="button" variant="outline" className="w-full font-bold" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" /> Adicionar novo endereço
        </Button>
      ) : (
        <div className="space-y-3 rounded-xl border border-border p-4">
          <Field label="Nome do endereço">
            <Input
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              placeholder="Casa, Trabalho..."
                aria-label="Nome do endereço"
              maxLength={40}
              className="h-11 rounded-xl"
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="CEP">
              <Input
                value={form.zip}
                onChange={(e) => setForm({ ...form, zip: e.target.value })}
                placeholder="00000-000"
                aria-label="CEP"
                maxLength={9}
                inputMode="numeric"
                className="h-11 rounded-xl"
              />
            </Field>
            <Field label="Número">
              <Input
                value={form.number}
                onChange={(e) => setForm({ ...form, number: e.target.value })}
                placeholder="123"
                aria-label="Número"
                maxLength={10}
                className="h-11 rounded-xl"
              />
            </Field>
          </div>
          <Field label="Rua">
            <Input
              value={form.street}
              onChange={(e) => setForm({ ...form, street: e.target.value })}
              placeholder="Rua Exemplo"
                aria-label="Rua"
              maxLength={120}
              className="h-11 rounded-xl"
            />
          </Field>
          <Field label="Complemento (opcional)">
            <Input
              value={form.complement}
              onChange={(e) => setForm({ ...form, complement: e.target.value })}
              placeholder="Apto 21, bloco B"
                aria-label="Complemento"
              maxLength={80}
              className="h-11 rounded-xl"
            />
          </Field>
          <Field label="Bairro">
            <Input
              value={form.neighborhood}
              onChange={(e) => setForm({ ...form, neighborhood: e.target.value })}
              aria-label="Bairro"
              maxLength={80}
              className="h-11 rounded-xl"
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-[1fr_100px]">
            <Field label="Cidade">
              <Input
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                aria-label="Cidade"
                maxLength={80}
                className="h-11 rounded-xl"
              />
            </Field>
            <Field label="UF">
              <Input
                value={form.state}
                onChange={(e) => setForm({ ...form, state: e.target.value.toUpperCase() })}
                aria-label="Estado (UF)"
                maxLength={2}
                className="h-11 rounded-xl"
              />
            </Field>
          </div>

          {user && (
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={form.is_default}
                onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
                className="h-4 w-4 accent-[hsl(var(--primary))]"
              />
              Definir como endereço principal
            </label>
          )}

          {formError && <p className="text-sm text-muted-foreground">{formError}</p>}

          <div className="flex gap-2">
            {list.length > 0 && (
              <Button type="button" variant="ghost" className="font-bold" onClick={() => setCreating(false)}>
                Cancelar
              </Button>
            )}
            <Button
              type="button"
              className="flex-1 font-extrabold"
              disabled={!!formError || save.isPending}
              onClick={() => {
                if (!user) {
                  const parts: DraftAddress = {
                    id: null,
                    label: form.label,
                    street: form.street,
                    number: form.number,
                    complement: form.complement,
                    neighborhood: form.neighborhood,
                    city: form.city,
                    state: form.state,
                    zip: form.zip,
                  };
                  update({ addressParts: parts, address: formatAddress(parts) });
                  setCreating(false);
                  return;
                }
                save.mutate();
              }}
            >
              {save.isPending ? "Salvando..." : "Usar este endereço"}
            </Button>
          </div>
        </div>
      )}

      {draft.address && (
        <p className="flex items-start gap-2 rounded-xl bg-muted px-4 py-3 text-sm font-semibold">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          {draft.address}
        </p>
      )}

      {showError && !draft.address && (
        <p className="text-sm font-semibold text-destructive">Escolha ou cadastre um endereço para continuar.</p>
      )}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Briefcase, Crosshair, Home, Loader2, MapPin, Plus, Search, Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { reverseGeocode, searchAddress, type GeocodedAddress } from "@/lib/geocode.functions";
import { formatAddress, type DraftAddress, type RequestDraft } from "@/lib/request-draft";

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

const LABELS = [
  { value: "Casa", icon: <Home className="h-4 w-4" /> },
  { value: "Trabalho", icon: <Briefcase className="h-4 w-4" /> },
  { value: "Outro", icon: <MapPin className="h-4 w-4" /> },
];

/**
 * PARTE 2 — o endereço com o mínimo de digitação:
 * localização do celular ou busca por texto preenchem bairro, cidade, UF e CEP.
 * O usuário só confirma o número e o complemento.
 */
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
  const search = useServerFn(searchAddress);
  const reverse = useServerFn(reverseGeocode);

  const [form, setForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<GeocodedAddress[] | null>(null);
  const [locating, setLocating] = useState(false);
  const [searching, setSearching] = useState(false);

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
    setResults(null);
  }

  function applyGeocoded(found: GeocodedAddress) {
    setForm((current) => ({
      ...current,
      street: found.street || current.street,
      number: found.number || current.number,
      neighborhood: found.neighborhood,
      city: found.city,
      state: found.state,
      zip: found.zip,
    }));
    setResults(null);
    setCreating(true);
  }

  async function useMyLocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      toast.error("Seu navegador não permite usar a localização.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const found = await reverse({
            data: { lat: position.coords.latitude, lng: position.coords.longitude },
          });
          if (!found) {
            toast.error("Não conseguimos identificar o endereço. Digite abaixo.");
            setCreating(true);
            return;
          }
          applyGeocoded(found);
          toast.success("Encontramos seu endereço — confira o número.");
        } catch {
          toast.error("Não conseguimos usar sua localização agora.");
          setCreating(true);
        } finally {
          setLocating(false);
        }
      },
      () => {
        setLocating(false);
        toast.error("Permita o acesso à localização ou digite o endereço.");
        setCreating(true);
      },
      { enableHighAccuracy: true, timeout: 12000 },
    );
  }

  async function runSearch() {
    const query = term.trim();
    if (query.length < 4) {
      toast.info("Digite a rua e o número.");
      return;
    }
    setSearching(true);
    try {
      const found = await search({ data: { query } });
      setResults(found);
      if (found.length === 0) toast.info("Nenhum endereço encontrado. Você pode digitar manualmente.");
    } catch {
      toast.error("Busca indisponível agora. Você pode digitar manualmente.");
      setCreating(true);
    } finally {
      setSearching(false);
    }
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
        <h1 className="font-display text-xl font-bold">📍 Onde será o serviço?</h1>
        <p className="text-sm text-muted-foreground">
          Use sua localização ou busque o endereço — a gente completa o resto.
        </p>
      </div>

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
                  active
                    ? "border-primary bg-accent text-accent-foreground"
                    : "border-border bg-card hover:bg-muted"
                }`}
              >
                {a.label.toLowerCase().includes("trabalho") ? (
                  <Briefcase className="mt-0.5 h-4 w-4 shrink-0" />
                ) : (
                  <Home className="mt-0.5 h-4 w-4 shrink-0" />
                )}
                <span className="min-w-0">
                  <span className="flex items-center gap-2 text-sm font-bold">
                    {a.label}
                    {a.is_default && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase text-primary">
                        <Star className="h-3 w-3" /> Principal
                      </span>
                    )}
                  </span>
                  <span className="block text-sm text-muted-foreground">
                    {a.street}
                    {a.number ? `, ${a.number}` : ""}
                    {a.complement ? ` — ${a.complement}` : ""}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {[a.neighborhood, `${a.city}${a.state ? `/${a.state}` : ""}`]
                      .filter(Boolean)
                      .join(" - ")}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      {!creating && (
        <div className="space-y-3">
          <Button
            type="button"
            className="h-12 w-full font-extrabold"
            disabled={locating}
            onClick={() => void useMyLocation()}
          >
            {locating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Crosshair className="h-4 w-4" />
            )}
            Usar minha localização
          </Button>

          <div className="flex items-center gap-3 text-xs font-bold uppercase text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> ou <span className="h-px flex-1 bg-border" />
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void runSearch();
                }}
                placeholder="Rua e número"
                aria-label="Buscar endereço"
                className="h-12 rounded-xl pl-9 text-base"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              className="h-12 font-bold"
              disabled={searching}
              onClick={() => void runSearch()}
            >
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buscar"}
            </Button>
          </div>

          {results && results.length > 0 && (
            <div className="grid gap-2">
              {results.map((r, i) => (
                <button
                  key={`${r.formatted}-${i}`}
                  type="button"
                  onClick={() => applyGeocoded(r)}
                  className="flex items-start gap-2 rounded-xl border border-border bg-card px-4 py-3 text-left text-sm font-semibold transition hover:bg-muted"
                >
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  {r.formatted}
                </button>
              ))}
            </div>
          )}

          <Button
            type="button"
            variant="ghost"
            className="w-full font-bold"
            onClick={() => setCreating(true)}
          >
            <Plus className="h-4 w-4" /> Digitar endereço manualmente
          </Button>
        </div>
      )}

      {creating && (
        <div className="space-y-3 rounded-xl border border-border p-4">
          <div className="flex flex-wrap gap-2">
            {LABELS.map((l) => (
              <button
                key={l.value}
                type="button"
                onClick={() => setForm({ ...form, label: l.value })}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                  form.label === l.value
                    ? "border-primary bg-accent text-accent-foreground"
                    : "border-border bg-card hover:bg-muted"
                }`}
              >
                {l.icon}
                {l.value}
              </button>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
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

          <p className="rounded-xl bg-muted px-4 py-3 text-xs font-semibold text-muted-foreground">
            {[form.neighborhood, [form.city, form.state].filter(Boolean).join("/"), form.zip]
              .filter(Boolean)
              .join(" · ") || "Bairro, cidade e CEP serão preenchidos automaticamente."}
          </p>

          <details className="text-xs">
            <summary className="cursor-pointer font-bold text-muted-foreground">
              Corrigir bairro, cidade, UF ou CEP
            </summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="Bairro">
                <Input
                  value={form.neighborhood}
                  onChange={(e) => setForm({ ...form, neighborhood: e.target.value })}
                  aria-label="Bairro"
                  maxLength={80}
                  className="h-11 rounded-xl"
                />
              </Field>
              <Field label="CEP">
                <Input
                  value={form.zip}
                  onChange={(e) => setForm({ ...form, zip: e.target.value })}
                  aria-label="CEP"
                  maxLength={9}
                  inputMode="numeric"
                  className="h-11 rounded-xl"
                />
              </Field>
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
          </details>

          {user && (
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={form.is_default}
                onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
                className="h-4 w-4 accent-[hsl(var(--primary))]"
              />
              Usar como endereço principal
            </label>
          )}

          {formError && <p className="text-sm text-muted-foreground">{formError}</p>}

          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              className="font-bold"
              onClick={() => setCreating(false)}
            >
              Voltar
            </Button>
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
              {save.isPending ? "Salvando..." : "Confirmar endereço"}
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
        <p className="text-sm font-semibold text-destructive">
          Escolha ou cadastre um endereço para continuar.
        </p>
      )}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

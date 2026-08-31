import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, FileText, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import {
  STATUS_CLASS,
  STATUS_LABEL,
  formatCpf,
  formatPhone,
  maskCpf,
  signedDocumentUrl,
  type VerificationRow,
  type VerificationStatus,
} from "@/lib/verification";

const FILTERS: (VerificationStatus | "all")[] = [
  "all",
  "pending",
  "under_review",
  "approved",
  "rejected",
  "suspended",
];

type Row = VerificationRow & { providers: { name: string } | null };

export function AdminVerifications({ enabled }: { enabled: boolean }) {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<VerificationStatus | "all">("under_review");
  const [selected, setSelected] = useState<Row | null>(null);

  const list = useQuery({
    queryKey: ["admin-verifications", filter],
    enabled,
    queryFn: async (): Promise<Row[]> => {
      let q = supabase
        .from("provider_verifications")
        .select("*, providers(name)")
        .order("submitted_at", { ascending: false, nullsFirst: false });
      if (filter !== "all") q = q.eq("status", filter);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const review = useMutation({
    mutationFn: async ({ id, action, reason }: { id: string; action: string; reason?: string }) => {
      const { error } = await supabase.rpc("review_verification", {
        p_verification_id: id,
        p_action: action,
        p_reason: reason ?? "",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Análise registrada.");
      setSelected(null);
      queryClient.invalidateQueries({ queryKey: ["admin-verifications"] });
      queryClient.invalidateQueries({ queryKey: ["admin-providers"] });
      queryClient.invalidateQueries({ queryKey: ["providers"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível concluir a análise."),
  });

  if (selected) {
    return (
      <VerificationDetail
        row={selected}
        onBack={() => setSelected(null)}
        pending={review.isPending}
        onReview={(action, reason) => review.mutate({ id: selected.id, action, ...(reason ? { reason } : {}) })}
      />
    );
  }

  return (
    <section className="surface-card space-y-3 p-5">
      <h2 className="inline-flex items-center gap-2 font-display text-base font-bold">
        <ShieldCheck className="h-4 w-4 text-primary" aria-hidden /> Verificação de prestadores
      </h2>
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-xs font-bold ${
              filter === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            {f === "all" ? "Todos" : STATUS_LABEL[f]}
          </button>
        ))}
      </div>
      <ul className="divide-y divide-border">
        {(list.data ?? []).map((v) => (
          <li key={v.id} className="flex items-center gap-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{v.full_name || v.providers?.name || "Sem nome"}</p>
              <p className="text-xs text-muted-foreground">
                {v.submitted_at ? `Enviado em ${new Date(v.submitted_at).toLocaleDateString("pt-BR")}` : "Não enviado"}
              </p>
            </div>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_CLASS[v.status]}`}>
              {STATUS_LABEL[v.status]}
            </span>
            <Button size="sm" variant="outline" className="font-bold" onClick={() => setSelected(v)}>
              Analisar
            </Button>
          </li>
        ))}
        {!list.isLoading && !(list.data ?? []).length ? (
          <li className="py-4 text-sm text-muted-foreground">Nenhuma verificação nesse filtro.</li>
        ) : null}
      </ul>
    </section>
  );
}

function VerificationDetail({
  row,
  onBack,
  onReview,
  pending,
}: {
  row: Row;
  onBack: () => void;
  onReview: (action: string, reason?: string) => void;
  pending: boolean;
}) {
  const [reason, setReason] = useState("");
  const [showCpf, setShowCpf] = useState(false);

  const logs = useQuery({
    queryKey: ["verification-logs", row.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("verification_audit_logs")
        .select("*")
        .eq("verification_id", row.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <section className="surface-card space-y-4 p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-base font-bold">{row.full_name || row.providers?.name}</h2>
        <Button size="sm" variant="ghost" onClick={onBack}>
          Voltar
        </Button>
      </div>

      <div className="grid gap-2 text-sm sm:grid-cols-2">
        <Info label="Status" value={STATUS_LABEL[row.status]} />
        <Info label="Nascimento" value={row.birth_date ?? "—"} />
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">CPF:</span>
          <span className="font-medium">{showCpf ? formatCpf(row.cpf ?? "") : maskCpf(row.cpf)}</span>
          <button type="button" onClick={() => setShowCpf((s) => !s)} aria-label="Alternar exibição do CPF">
            {showCpf ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
          </button>
        </div>
        <Info label="Telefone" value={formatPhone(row.phone ?? "")} />
        <Info label="E-mail" value={row.email ?? "—"} />
        <Info label="Documento" value={(row.identity_document_type ?? "—").toUpperCase()} />
        <Info
          label="Endereço"
          value={[row.address, row.address_number, row.neighborhood, row.city, row.state, row.zip_code]
            .filter(Boolean)
            .join(", ")}
        />
        <Info label="Região" value={row.service_region ?? "—"} />
        <Info label="Experiência" value={`${row.experience_years} ano(s)`} />
        <Info label="Raio" value={`${row.service_radius} km`} />
        <Info label="Stripe" value={row.stripe_verification_status ?? "Não configurado"} />
      </div>

      <p className="text-sm">{row.professional_description}</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <DocLink label="Documento (frente)" path={row.identity_document_front_path} />
        <DocLink label="Documento (verso)" path={row.identity_document_back_path} />
        <DocLink label="Selfie" path={row.selfie_path} />
        <DocLink label="Comprovante de endereço" path={row.address_proof_path} />
      </div>

      <div className="space-y-2">
        <Textarea
          rows={3}
          placeholder="Motivo (obrigatório para recusar ou suspender)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <Button disabled={pending} className="font-bold" onClick={() => onReview("approve")}>
            Aprovar
          </Button>
          <Button
            disabled={pending}
            variant="outline"
            className="font-bold"
            onClick={() => {
              if (!reason.trim()) {
                toast.error("Informe o motivo da recusa.");
                return;
              }
              onReview("reject", reason.trim());
            }}
          >
            Recusar
          </Button>
          <Button
            disabled={pending}
            variant="ghost"
            className="font-bold text-destructive"
            onClick={() => {
              if (!reason.trim()) {
                toast.error("Informe o motivo da suspensão.");
                return;
              }
              onReview("suspend", reason.trim());
            }}
          >
            Suspender
          </Button>
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-bold">Histórico</h3>
        <ul className="space-y-1 text-xs text-muted-foreground">
          {(logs.data ?? []).map((l) => (
            <li key={l.id}>
              {new Date(l.created_at).toLocaleString("pt-BR")} — {l.action}
              {l.reason ? ` (${l.reason})` : ""}
            </li>
          ))}
          {!(logs.data ?? []).length ? <li>Sem registros.</li> : null}
        </ul>
      </div>
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <p>
      <span className="text-muted-foreground">{label}:</span> <span className="font-medium">{value}</span>
    </p>
  );
}

function DocLink({ label, path }: { label: string; path: string | null }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!path) return;
    signedDocumentUrl(path, 300)
      .then((u) => active && setUrl(u))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [path]);

  if (!path) {
    return (
      <div className="rounded-xl border border-border p-3 text-sm text-muted-foreground">{label}: não enviado</div>
    );
  }

  const isPdf = path.toLowerCase().endsWith(".pdf");

  return (
    <a
      href={url ?? "#"}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-3 rounded-xl border border-border p-3 text-sm hover:border-primary"
    >
      <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-lg bg-muted">
        {url && !isPdf ? (
          <img src={url} alt={label} className="h-full w-full object-cover" />
        ) : (
          <FileText className="h-5 w-5 text-muted-foreground" aria-hidden />
        )}
      </div>
      <span className="font-medium">{label}</span>
    </a>
  );
}

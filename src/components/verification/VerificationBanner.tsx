import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { STATUS_CLASS, STATUS_LABEL, myVerificationQuery } from "@/lib/verification";

export function VerificationBanner({ providerId }: { providerId: string }) {
  const verification = useQuery(myVerificationQuery(providerId));
  const row = verification.data;
  const status = row?.status ?? "draft";

  if (status === "approved") {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-success/30 bg-success/10 p-4 text-sm">
        <ShieldCheck className="h-5 w-5 shrink-0 text-success" aria-hidden />
        <p className="flex-1 font-semibold text-success">Cadastro verificado — você aparece para os clientes.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-4 text-sm">
      <ShieldAlert className="h-5 w-5 shrink-0 text-primary" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">
          {status === "under_review"
            ? "Seu cadastro está em análise"
            : status === "rejected"
              ? "Cadastro recusado — corrija e reenvie"
              : status === "suspended"
                ? "Cadastro suspenso"
                : "Complete sua verificação para receber solicitações"}
        </p>
        <p className="text-xs text-muted-foreground">
          {row?.rejection_reason ||
            "Somente prestadores verificados aparecem no marketplace e recebem pedidos de clientes."}
        </p>
      </div>
      <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${STATUS_CLASS[status]}`}>
        {STATUS_LABEL[status]}
      </span>
      <Button asChild size="sm" className="font-bold">
        <Link to="/provider/verification">
          {status === "under_review" ? "Acompanhar" : "Continuar verificação"}
        </Link>
      </Button>
    </div>
  );
}

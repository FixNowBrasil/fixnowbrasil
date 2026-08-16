import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CreditCard, QrCode, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { brl } from "@/lib/fixnow";
import { quotesQuery } from "@/lib/collab";
import {
  PAYMENT_STATUS_LABEL,
  confirmPayment,
  createPaymentForQuote,
  paymentQuery,
  type PaymentMethod,
} from "@/lib/payments";
import { cn } from "@/lib/utils";

export function PaymentPanel({
  requestId,
  role,
  providerName,
  serviceName,
}: {
  requestId: string;
  role: "client" | "provider";
  providerName: string | null;
  serviceName: string | null;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>("pix");

  const quotes = useQuery(quotesQuery(requestId));
  const payment = useQuery(paymentQuery(requestId));

  const accepted = (quotes.data ?? []).find((q) => q.status === "accepted");
  const pay = payment.data ?? null;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["payment", requestId] });
    queryClient.invalidateQueries({ queryKey: ["request", requestId] });
  };

  const doPay = useMutation({
    mutationFn: async () => {
      if (!accepted) throw new Error("Nenhum orçamento aceito.");
      const created = await createPaymentForQuote(accepted.id, method);
      await confirmPayment(created.id);
    },
    onSuccess: () => {
      toast.success("Pagamento confirmado. O prestador já pode executar o serviço.");
      setOpen(false);
      refresh();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Falha no pagamento."),
  });

  if (!accepted && !pay) return null;

  const amount = Number(pay?.amount ?? accepted?.amount ?? 0);

  const awaitingClientPayment =
    role === "client" && (!pay || pay.status === "pending" || pay.status === "failed");

  return (
    <section
      className={cn(
        "surface-card space-y-3 p-5",
        awaitingClientPayment && "ring-2 ring-primary",
      )}
    >

      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-base font-bold">Pagamento</h2>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[11px] font-bold",
            (!pay || pay.status === "pending") && "bg-muted text-muted-foreground",
            pay?.status === "paid" && "bg-primary/15 text-primary",
            pay?.status === "released" && "bg-success/15 text-success",
            (pay?.status === "failed" || pay?.status === "refunded") &&
              "bg-destructive/10 text-destructive",
          )}
        >
          {PAYMENT_STATUS_LABEL[pay?.status ?? "pending"]}
        </span>
      </div>

      <dl className="space-y-1 text-sm">
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Valor</dt>
          <dd className="font-display text-lg font-extrabold text-primary">{brl(amount)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Prestador</dt>
          <dd className="font-semibold">{providerName ?? "—"}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Serviço</dt>
          <dd className="font-semibold">{serviceName ?? "—"}</dd>
        </div>
      </dl>

      {role === "client" && (!pay || pay.status === "pending" || pay.status === "failed") && (
        <Button className="w-full font-extrabold" onClick={() => setOpen(true)}>
          Pagar {brl(amount)}
        </Button>
      )}

      {role === "provider" && (
        <p className="text-sm text-muted-foreground">
          {pay?.status === "released"
            ? "Pagamento liberado para você após a conclusão do serviço."
            : pay?.status === "paid"
              ? "O cliente já pagou. O valor é liberado quando o serviço for concluído."
              : "Aguardando o pagamento do cliente."}
        </p>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Pagar serviço</DialogTitle>
            <DialogDescription>
              {serviceName ?? "Serviço"} com {providerName ?? "prestador"} — {brl(amount)}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { value: "pix", label: "PIX", icon: QrCode },
                { value: "card", label: "Cartão", icon: CreditCard },
              ] as const
            ).map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setMethod(option.value)}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-xl border-2 p-3 text-sm font-bold",
                  method === option.value ? "border-primary text-primary" : "border-border",
                )}
              >
                <option.icon className="h-5 w-5" />
                {option.label}
              </button>
            ))}
          </div>

          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 shrink-0" />
            Pagamento retido pelo FixNow e liberado ao prestador após a conclusão do serviço.
          </p>

          <Button
            className="w-full font-extrabold"
            disabled={doPay.isPending}
            onClick={() => doPay.mutate()}
          >
            Confirmar pagamento
          </Button>
        </DialogContent>
      </Dialog>
    </section>
  );
}

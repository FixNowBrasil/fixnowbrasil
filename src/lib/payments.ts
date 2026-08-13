import { supabase } from "@/integrations/supabase/client";

export type PaymentStatus = "pending" | "paid" | "released" | "refunded" | "failed";

export type PaymentMethod = "pix" | "card";

export type Payment = {
  id: string;
  request_id: string;
  quote_id: string;
  client_id: string;
  provider_id: string;
  amount: number;
  method: PaymentMethod | null;
  status: PaymentStatus;
  external_reference: string | null;
  failure_reason: string | null;
  paid_at: string | null;
  released_at: string | null;
  refunded_at: string | null;
  created_at: string;
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  pending: "Aguardando pagamento",
  paid: "Pago",
  released: "Liberado ao prestador",
  refunded: "Reembolsado",
  failed: "Falhou",
};

export const paymentQuery = (requestId: string) => ({
  queryKey: ["payment", requestId],
  queryFn: async (): Promise<Payment | null> => {
    const { data, error } = await supabase
      .from("payments" as never)
      .select("*")
      .eq("request_id", requestId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return (data ?? null) as Payment | null;
  },
});

/**
 * MVP: no real gateway yet. The database creates the payment record from an
 * accepted quote and the client confirms it. A future PIX/card integration
 * only needs to replace the confirmation step with the gateway callback,
 * storing its id in `external_reference`.
 */
export async function createPaymentForQuote(quoteId: string, method: PaymentMethod) {
  const { data, error } = await supabase.rpc("create_payment_for_quote" as never, {
    p_quote_id: quoteId,
    p_method: method,
  } as never);
  if (error) throw error;
  return data as unknown as Payment;
}

export async function confirmPayment(paymentId: string) {
  const { data, error } = await supabase.rpc("confirm_payment" as never, {
    p_payment_id: paymentId,
    p_external_reference: null,
  } as never);
  if (error) throw error;
  return data as unknown as Payment;
}

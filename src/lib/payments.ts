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
 * O pagamento é criado no servidor junto com a sessão de checkout e só é
 * marcado como pago pela confirmação automática do provedor (webhook).
 */


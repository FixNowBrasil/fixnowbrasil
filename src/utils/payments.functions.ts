import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { type StripeEnv, createStripeClient, getStripeErrorMessage } from "@/lib/stripe.server";

type CheckoutResult = { clientSecret: string; paymentId: string } | { error: string };

/**
 * Creates (or reuses) the pending payment row for an accepted quote and opens
 * a Stripe Checkout session for the exact amount stored in the database.
 * The amount is never taken from the client.
 */
export const createQuoteCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { quoteId: string; returnUrl: string; environment: StripeEnv }) => {
    if (!/^[0-9a-fA-F-]{36}$/.test(data.quoteId)) throw new Error("Orçamento inválido");
    return data;
  })
  .handler(async ({ data, context }): Promise<CheckoutResult> => {
    const { supabase, userId } = context;

    const { data: payment, error: paymentError } = await supabase.rpc(
      "create_payment_for_quote" as never,
      { p_quote_id: data.quoteId, p_method: "card" } as never,
    );
    if (paymentError || !payment) {
      return { error: paymentError?.message ?? "Não foi possível iniciar o pagamento." };
    }

    const row = payment as unknown as {
      id: string;
      amount: number | string;
      status: string;
      request_id: string;
    };

    if (row.status === "paid" || row.status === "released") {
      return { error: "Este serviço já foi pago." };
    }

    const amountInCents = Math.round(Number(row.amount) * 100);
    if (!Number.isFinite(amountInCents) || amountInCents < 50) {
      return { error: "Valor do orçamento inválido para cobrança." };
    }

    const { data: authUser } = await supabase.auth.getUser();
    const email = authUser.user?.email ?? undefined;

    try {
      const stripe = createStripeClient(data.environment);

      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
            price_data: {
              currency: "brl",
              product_data: { name: "Serviço FixNow" },
              unit_amount: amountInCents,
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        ui_mode: "embedded_page",
        return_url: data.returnUrl,
        ...(email && { customer_email: email }),
        payment_intent_data: { description: "Serviço FixNow" },
        metadata: {
          userId,
          paymentId: row.id,
          requestId: row.request_id,
        },
      });

      return { clientSecret: session.client_secret ?? "", paymentId: row.id };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

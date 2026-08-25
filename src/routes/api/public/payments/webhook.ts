import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { type StripeEnv, verifyWebhook } from "@/lib/stripe.server";

let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      process.env["SUPABASE_URL"]!,
      process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
    );
  }
  return _supabase;
}

async function markPaid(session: any) {
  const paymentId = session?.metadata?.paymentId as string | undefined;
  if (!paymentId) {
    console.error("Checkout session without paymentId metadata");
    return;
  }

  const supabase = getSupabase();
  const { data: payment, error } = await supabase
    .from("payments")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      failure_reason: null,
      external_reference: session.id ?? null,
    })
    .eq("id", paymentId)
    .in("status", ["pending", "failed"])
    .select("request_id, provider_id")
    .maybeSingle();

  if (error) {
    console.error("Failed to mark payment as paid", error);
    return;
  }
  if (!payment) return;

  const { data: provider } = await supabase
    .from("providers")
    .select("user_id")
    .eq("id", payment["provider_id"] as string)
    .maybeSingle();

  const providerUserId = provider?.["user_id"] as string | null | undefined;
  if (providerUserId) {
    await supabase.from("notifications").insert({
      user_id: providerUserId,
      title: "Pagamento confirmado",
      body: "O cliente efetuou o pagamento do serviço.",
      link: `/pedidos/${payment["request_id"]}`,
    });
  }
}

async function markFailed(session: any) {
  const paymentId = session?.metadata?.paymentId as string | undefined;
  if (!paymentId) return;
  await getSupabase()
    .from("payments")
    .update({ status: "failed", failure_reason: "Pagamento não concluído" })
    .eq("id", paymentId)
    .eq("status", "pending");
}

async function handleWebhook(req: Request, env: StripeEnv) {
  const event = await verifyWebhook(req, env);

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      if (session.payment_status !== "unpaid") await markPaid(session);
      break;
    }
    case "checkout.session.async_payment_succeeded":
      await markPaid(event.data.object);
      break;
    case "checkout.session.async_payment_failed":
      await markFailed(event.data.object);
      break;
    default:
      console.log("Unhandled event:", event.type);
  }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") {
          console.error("Webhook with invalid env:", rawEnv);
          return Response.json({ received: true, ignored: "invalid env" });
        }
        try {
          await handleWebhook(request, rawEnv as StripeEnv);
          return Response.json({ received: true });
        } catch (e) {
          console.error("Webhook error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});

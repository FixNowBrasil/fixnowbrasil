const clientToken = import.meta.env["VITE_PAYMENTS_CLIENT_TOKEN"] as string | undefined;

export function PaymentTestModeBanner() {
  if (!clientToken) {
    return (
      <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-center text-xs font-semibold text-destructive">
        Os pagamentos ainda não estão ativos para cobranças reais. Conclua a ativação na aba de
        pagamentos.
      </div>
    );
  }
  if (clientToken.startsWith("pk_test_")) {
    return (
      <div className="rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-center text-xs font-semibold text-warning-foreground">
        Modo de teste: nenhum valor real é cobrado. Use o cartão 4242 4242 4242 4242.
      </div>
    );
  }
  return null;
}

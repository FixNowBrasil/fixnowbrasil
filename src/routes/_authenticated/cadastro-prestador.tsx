import { createFileRoute } from "@tanstack/react-router";
import { PainelPage } from "@/routes/_authenticated/painel";

export const Route = createFileRoute("/_authenticated/cadastro-prestador")({
  head: () => ({
    meta: [
      { title: "Cadastro de prestador — FixNow" },
      { name: "description", content: "Cadastre seu perfil profissional para prestar serviços no FixNow." },
    ],
  }),
  component: PainelPage,
});

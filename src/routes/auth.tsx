import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { FixNowLogo } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar ou criar conta — FixNow" },
      { name: "description", content: "Acesse sua conta FixNow para solicitar e acompanhar serviços." },
      { property: "og:title", content: "Entrar ou criar conta — FixNow" },
      { property: "og:description", content: "Sua conta FixNow para contratar profissionais." },
    ],
  }),
  component: AuthPage,
});

const schema = z.object({
  email: z.string().trim().email("Informe um e-mail válido").max(255),
  password: z.string().min(6, "A senha deve ter ao menos 6 caracteres").max(72),
  fullName: z.string().trim().max(100).optional(),
  phone: z.string().trim().max(20).optional(),
});

function AuthPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [role, setRole] = useState<"client" | "provider">("client");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/", replace: true });
  }, [loading, user, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password, fullName, phone });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Verifique os dados");
      return;
    }
    setBusy(true);
    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error) return toast.error("E-mail ou senha inválidos.");
      toast.success("Bem-vindo de volta!");
      navigate({ to: "/" });
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: { full_name: fullName, phone, role },
        },
      });
      setBusy(false);
      if (error) return toast.error(error.message);
      if (!data.session) {
        toast.success("Conta criada! Confirme seu e-mail para entrar.");
        setMode("login");
      } else {
        toast.success("Conta criada com sucesso!");
        navigate({ to: "/" });
      }
    }
  }

  async function google() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Não foi possível entrar com o Google.");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/" });
  }

  return (
    <div className="hero-mesh flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <FixNowLogo className="mb-6" />
      <div className="surface-card w-full max-w-md p-6">
        <h1 className="font-display text-2xl font-extrabold">
          {mode === "login" ? "Entrar no FixNow" : "Criar sua conta"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === "login"
            ? "Acompanhe seus pedidos e favoritos."
            : "Leva menos de um minuto. Precisou? FixNow."}
        </p>

        <Button variant="outline" className="mt-5 h-12 w-full font-bold" onClick={google}>
          Continuar com Google
        </Button>

        <div className="my-5 flex items-center gap-3 text-xs font-semibold text-muted-foreground">
          <span className="h-px flex-1 bg-border" /> ou <span className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={submit} className="space-y-4">
          {mode === "signup" && (
            <>
              <div className="grid grid-cols-2 gap-2">
                {(["client", "provider"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={`rounded-xl border px-3 py-2.5 text-sm font-bold transition ${
                      role === r ? "border-primary bg-accent text-accent-foreground" : "border-border"
                    }`}
                  >
                    {r === "client" ? "Sou cliente" : "Sou prestador"}
                  </button>
                ))}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="name">Nome completo</Label>
                <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={100} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(11) 90000-0000"
                  maxLength={20}
                />
              </div>
            </>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              maxLength={255}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              maxLength={72}
            />
          </div>
          <Button type="submit" size="lg" className="w-full font-extrabold" disabled={busy}>
            {busy ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          {mode === "login" ? "Ainda não tem conta?" : "Já tem conta?"}{" "}
          <button
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
            className="font-bold text-primary hover:underline"
          >
            {mode === "login" ? "Criar agora" : "Entrar"}
          </button>
        </p>
      </div>
    </div>
  );
}

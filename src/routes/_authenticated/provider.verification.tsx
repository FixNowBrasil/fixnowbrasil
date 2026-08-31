import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { DocumentUpload } from "@/components/verification/DocumentUpload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { allServicesQuery, categoriesQuery } from "@/lib/fixnow";
import {
  STATUS_CLASS,
  STATUS_LABEL,
  VERIFICATION_STEPS,
  ensureVerification,
  formatCpf,
  formatPhone,
  formatZip,
  isAdult,
  isValidCpf,
  isValidEmail,
  isValidPhone,
  myVerificationQuery,
  onlyDigits,
  type VerificationRow,
  type VerificationStep,
} from "@/lib/verification";

export const Route = createFileRoute("/_authenticated/provider/verification")({
  head: () => ({
    meta: [
      { title: "Verificação de prestador — FixNow" },
      {
        name: "description",
        content: "Complete a verificação de identidade e cadastro profissional para atender no FixNow.",
      },
      { property: "og:title", content: "Verificação de prestador — FixNow" },
      { property: "og:description", content: "Onboarding seguro em 7 etapas para prestadores FixNow." },
    ],
  }),
  component: VerificationPage,
});

type Draft = Partial<VerificationRow>;

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function VerificationPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const categories = useQuery(categoriesQuery);
  const services = useQuery(allServicesQuery);

  const myProvider = useQuery({
    queryKey: ["my-provider-verification", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("providers")
        .select("id, name, city, work_photos")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const providerId = myProvider.data?.id;

  const verification = useQuery(myVerificationQuery(providerId));
  const row = verification.data ?? null;

  const [draft, setDraft] = useState<Draft>({});
  const [step, setStep] = useState<VerificationStep>("personal");
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);

  useEffect(() => {
    if (!row) return;
    setDraft(row);
    setStep(row.current_step);
    setTerms(!!row.terms_accepted_at);
    setPrivacy(!!row.privacy_accepted_at);
  }, [row]);

  const createRow = useMutation({
    mutationFn: () => ensureVerification(providerId!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["provider-verification", providerId] }),
  });

  useEffect(() => {
    if (providerId && verification.isFetched && !verification.data && !createRow.isPending) {
      createRow.mutate();
    }
  }, [providerId, verification.isFetched, verification.data, createRow]);

  const save = useMutation({
    mutationFn: async (patch: Draft & { current_step?: VerificationStep }) => {
      if (!row) throw new Error("Verificação não encontrada");
      // Envia apenas campos editáveis pelo prestador; status e campos de análise são do backend.
      const editable: (keyof VerificationRow)[] = [
        "current_step",
        "full_name",
        "cpf",
        "birth_date",
        "phone",
        "email",
        "identity_document_type",
        "identity_document_front_path",
        "identity_document_back_path",
        "selfie_path",
        "address",
        "address_number",
        "address_complement",
        "neighborhood",
        "city",
        "state",
        "zip_code",
        "address_proof_path",
        "professional_category",
        "services",
        "experience_years",
        "professional_description",
        "service_region",
        "service_radius",
        "availability",
        "verification_email",
        "terms_accepted_at",
        "privacy_accepted_at",
      ];
      const payload: Record<string, unknown> = {};
      for (const key of editable) {
        if (key in patch) payload[key] = (patch as Record<string, unknown>)[key];
      }
      const { error } = await supabase
        .from("provider_verifications")
        .update(payload as never)
        .eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["provider-verification", providerId] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível salvar."),
  });


  const submit = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("submit_verification");
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cadastro enviado para análise.");
      queryClient.invalidateQueries({ queryKey: ["provider-verification", providerId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível enviar."),
  });

  const locked = row?.status === "under_review" || row?.status === "approved" || row?.status === "suspended";

  const stepIndex = VERIFICATION_STEPS.findIndex((s) => s.key === step);
  const progress = Math.round(((stepIndex + 1) / VERIFICATION_STEPS.length) * 100);

  const set = (patch: Draft) => setDraft((d) => ({ ...d, ...patch }));

  const categoryServices = useMemo(
    () => (services.data ?? []).filter((s) => s.category_id === draft.professional_category),
    [services.data, draft.professional_category],
  );

  const goTo = async (next: VerificationStep, patch: Draft = {}) => {
    await save.mutateAsync({ ...draft, ...patch, current_step: next });
    setStep(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const validatePersonal = () => {
    if (!draft.full_name || draft.full_name.trim().length < 5) return "Informe seu nome completo.";
    if (!isValidCpf(draft.cpf ?? "")) return "CPF inválido.";
    if (!isAdult(draft.birth_date ?? "")) return "É necessário ter 18 anos ou mais.";
    if (!isValidPhone(draft.phone ?? "")) return "Telefone inválido.";
    if (!isValidEmail(draft.email ?? "")) return "E-mail inválido.";
    return null;
  };

  if (myProvider.isLoading || (!!providerId && verification.isLoading)) {
    return (
      <AppShell>
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
        </div>
      </AppShell>
    );
  }

  if (!providerId) {
    return (
      <AppShell>
        <div className="mx-auto max-w-lg space-y-4 py-16 text-center">
          <h1 className="text-2xl font-bold">Crie seu perfil profissional</h1>
          <p className="text-muted-foreground">
            Antes de iniciar a verificação, cadastre seu perfil de prestador no painel.
          </p>
          <Button asChild>
            <Link to="/painel">Ir para o painel</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  if (row && (row.status === "under_review" || row.status === "approved" || row.status === "suspended")) {
    return (
      <AppShell>
        <section className="mx-auto max-w-xl space-y-5 py-14 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            {row.status === "approved" ? (
              <ShieldCheck className="h-8 w-8 text-success" aria-hidden />
            ) : (
              <Clock className="h-8 w-8 text-primary" aria-hidden />
            )}
          </div>
          <h1 className="text-2xl font-bold">
            {row.status === "approved"
              ? "Cadastro aprovado"
              : row.status === "suspended"
                ? "Cadastro suspenso"
                : "Cadastro em análise"}
          </h1>
          <p className="text-muted-foreground">
            {row.status === "approved"
              ? "Você já aparece no marketplace e pode receber solicitações."
              : row.status === "suspended"
                ? row.rejection_reason || "Entre em contato com o suporte."
                : "Nossa equipe está conferindo seus documentos. Você será avisado por notificação assim que a análise terminar."}
          </p>
          <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${STATUS_CLASS[row.status]}`}>
            {STATUS_LABEL[row.status]}
          </span>
          <div>
            <Button asChild variant="outline">
              <Link to="/painel">Voltar ao painel</Link>
            </Button>
          </div>
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <section className="mx-auto max-w-2xl space-y-6 py-6">
        <header className="space-y-3">
          <h1 className="text-2xl font-bold">Verificação de prestador</h1>
          <p className="text-sm text-muted-foreground">
            Seus documentos são armazenados de forma privada e usados apenas para confirmar sua identidade.
          </p>
          {row?.status === "rejected" && row.rejection_reason ? (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <strong>Cadastro recusado:</strong> {row.rejection_reason}
            </div>
          ) : null}
          <Progress value={progress} className="h-2" />
          <ol className="flex flex-wrap gap-2 text-xs">
            {VERIFICATION_STEPS.map((s, i) => (
              <li
                key={s.key}
                className={`rounded-full px-2.5 py-1 ${
                  i < stepIndex
                    ? "bg-success/15 text-success"
                    : i === stepIndex
                      ? "bg-primary/15 font-semibold text-primary"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {i < stepIndex ? "✓ " : ""}
                {s.label}
              </li>
            ))}
          </ol>
        </header>

        {step === "personal" ? (
          <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
            <h2 className="font-semibold">Dados pessoais</h2>
            <div className="space-y-2">
              <Label htmlFor="full_name">Nome completo</Label>
              <Input
                id="full_name"
                value={draft.full_name ?? ""}
                onChange={(e) => set({ full_name: e.target.value })}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cpf">CPF</Label>
                <Input
                  id="cpf"
                  inputMode="numeric"
                  value={formatCpf(draft.cpf ?? "")}
                  onChange={(e) => set({ cpf: onlyDigits(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="birth">Data de nascimento</Label>
                <Input
                  id="birth"
                  type="date"
                  value={draft.birth_date ?? ""}
                  onChange={(e) => set({ birth_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  inputMode="tel"
                  value={formatPhone(draft.phone ?? "")}
                  onChange={(e) => set({ phone: onlyDigits(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={draft.email ?? user?.email ?? ""}
                  onChange={(e) => set({ email: e.target.value })}
                />
              </div>
            </div>
            <Button
              onClick={() => {
                const err = validatePersonal();
                if (err) { toast.error(err); return; }
                void goTo("identity");
              }}
            >
              Continuar
            </Button>
          </div>
        ) : null}

        {step === "identity" ? (
          <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
            <h2 className="font-semibold">Documento de identidade</h2>
            <div className="space-y-2">
              <Label htmlFor="doctype">Tipo de documento</Label>
              <select
                id="doctype"
                className={selectClass}
                value={draft.identity_document_type ?? ""}
                onChange={(e) => set({ identity_document_type: e.target.value })}
              >
                <option value="">Selecione</option>
                <option value="rg">RG</option>
                <option value="cnh">CNH</option>
              </select>
            </div>
            <DocumentUpload
              label="Frente do documento"
              providerId={providerId}
              slot="identity/front"
              path={draft.identity_document_front_path ?? null}
              disabled={locked}
              onChange={(p) => set({ identity_document_front_path: p })}
            />
            <DocumentUpload
              label="Verso do documento"
              providerId={providerId}
              slot="identity/back"
              path={draft.identity_document_back_path ?? null}
              disabled={locked}
              onChange={(p) => set({ identity_document_back_path: p })}
            />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => void goTo("personal")}>
                Voltar
              </Button>
              <Button
                onClick={() => {
                  if (!draft.identity_document_type) { toast.error("Escolha o tipo de documento."); return; }
                  if (!draft.identity_document_front_path || !draft.identity_document_back_path)
                    { toast.error("Envie a frente e o verso."); return; }
                  void goTo("selfie");
                }}
              >
                Continuar
              </Button>
            </div>
          </div>
        ) : null}

        {step === "selfie" ? (
          <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
            <h2 className="font-semibold">Selfie com o documento</h2>
            <p className="text-sm text-muted-foreground">
              Tire uma foto do seu rosto segurando o documento enviado. O rosto e o documento precisam estar legíveis.
            </p>
            <DocumentUpload
              label="Selfie"
              hint="A prova de vida automática será ativada em breve; por enquanto a conferência é feita pela nossa equipe."
              providerId={providerId}
              slot="selfie"
              path={draft.selfie_path ?? null}
              disabled={locked}
              capture
              onChange={(p) => set({ selfie_path: p })}
            />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => void goTo("identity")}>
                Voltar
              </Button>
              <Button
                onClick={() => {
                  if (!draft.selfie_path) { toast.error("Envie a selfie."); return; }
                  void goTo("address");
                }}
              >
                Continuar
              </Button>
            </div>
          </div>
        ) : null}

        {step === "address" ? (
          <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
            <h2 className="font-semibold">Endereço residencial</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="street">Rua</Label>
                <Input id="street" value={draft.address ?? ""} onChange={(e) => set({ address: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="number">Número</Label>
                <Input
                  id="number"
                  value={draft.address_number ?? ""}
                  onChange={(e) => set({ address_number: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="complement">Complemento</Label>
                <Input
                  id="complement"
                  value={draft.address_complement ?? ""}
                  onChange={(e) => set({ address_complement: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="neighborhood">Bairro</Label>
                <Input
                  id="neighborhood"
                  value={draft.neighborhood ?? ""}
                  onChange={(e) => set({ neighborhood: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">Cidade</Label>
                <Input id="city" value={draft.city ?? ""} onChange={(e) => set({ city: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">Estado (UF)</Label>
                <Input
                  id="state"
                  maxLength={2}
                  value={draft.state ?? ""}
                  onChange={(e) => set({ state: e.target.value.toUpperCase() })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="zip">CEP</Label>
                <Input
                  id="zip"
                  inputMode="numeric"
                  value={formatZip(draft.zip_code ?? "")}
                  onChange={(e) => set({ zip_code: onlyDigits(e.target.value) })}
                />
              </div>
            </div>
            <DocumentUpload
              label="Comprovante de endereço"
              hint="Conta de luz, água, internet ou telefone dos últimos 3 meses."
              providerId={providerId}
              slot="address"
              path={draft.address_proof_path ?? null}
              disabled={locked}
              onChange={(p) => set({ address_proof_path: p })}
            />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => void goTo("selfie")}>
                Voltar
              </Button>
              <Button
                onClick={() => {
                  if (!draft.address || !draft.city || onlyDigits(draft.zip_code ?? "").length !== 8)
                    { toast.error("Preencha rua, cidade e CEP."); return; }
                  if (!draft.address_proof_path) { toast.error("Envie o comprovante de endereço."); return; }
                  void goTo("professional");
                }}
              >
                Continuar
              </Button>
            </div>
          </div>
        ) : null}

        {step === "professional" ? (
          <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
            <h2 className="font-semibold">Dados profissionais</h2>
            <div className="space-y-2">
              <Label htmlFor="cat">Categoria profissional</Label>
              <select
                id="cat"
                className={selectClass}
                value={draft.professional_category ?? ""}
                onChange={(e) => set({ professional_category: e.target.value, services: [] })}
              >
                <option value="">Selecione</option>
                {(categories.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.emoji} {c.name}
                  </option>
                ))}
              </select>
            </div>
            {categoryServices.length ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">Serviços que você realiza</p>
                <div className="flex flex-wrap gap-2">
                  {categoryServices.map((s) => {
                    const selected = (draft.services ?? []).includes(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() =>
                          set({
                            services: selected
                              ? (draft.services ?? []).filter((x) => x !== s.id)
                              : [...(draft.services ?? []), s.id],
                          })
                        }
                        className={`rounded-full border px-3 py-1.5 text-sm ${
                          selected ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
                        }`}
                      >
                        {s.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="exp">Anos de experiência</Label>
                <Input
                  id="exp"
                  type="number"
                  min={0}
                  max={70}
                  value={draft.experience_years ?? 0}
                  onChange={(e) => set({ experience_years: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="radius">Raio de atendimento (km)</Label>
                <Input
                  id="radius"
                  type="number"
                  min={1}
                  max={200}
                  value={draft.service_radius ?? 10}
                  onChange={(e) => set({ service_radius: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="region">Região onde atende</Label>
                <Input
                  id="region"
                  placeholder="Ex.: Zona Sul de São Paulo"
                  value={draft.service_region ?? ""}
                  onChange={(e) => set({ service_region: e.target.value })}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="avail">Disponibilidade</Label>
                <Input
                  id="avail"
                  placeholder="Seg a Sáb, 8h às 18h"
                  value={draft.availability ?? ""}
                  onChange={(e) => set({ availability: e.target.value })}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="desc">Descrição profissional</Label>
                <Textarea
                  id="desc"
                  rows={4}
                  value={draft.professional_description ?? ""}
                  onChange={(e) => set({ professional_description: e.target.value })}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              As fotos de trabalhos anteriores continuam sendo gerenciadas na página de fotos do prestador.
            </p>
            <Button asChild variant="outline" size="sm">
              <Link to="/fotos-prestador">Gerenciar fotos de trabalhos</Link>
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => void goTo("address")}>
                Voltar
              </Button>
              <Button
                onClick={() => {
                  if (!draft.professional_category) { toast.error("Escolha a categoria."); return; }
                  if (!draft.service_region) { toast.error("Informe a região de atendimento."); return; }
                  if ((draft.professional_description ?? "").trim().length < 30)
                    { toast.error("Descreva seu trabalho com pelo menos 30 caracteres."); return; }
                  void goTo("financial");
                }}
              >
                Continuar
              </Button>
            </div>
          </div>
        ) : null}

        {step === "financial" ? (
          <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
            <h2 className="font-semibold">Segurança e pagamentos</h2>
            <div className="space-y-3 rounded-xl border border-border p-4 text-sm">
              <div className="flex items-center justify-between">
                <span>E-mail verificado</span>
                <span className={user?.email_confirmed_at ? "text-success" : "text-muted-foreground"}>
                  {user?.email_confirmed_at ? "✓ Verificado" : "Pendente"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Telefone verificado</span>
                <span className="text-muted-foreground">Em breve (SMS)</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Conta de recebimento (Stripe Connect)</span>
                <span className="text-muted-foreground">
                  {draft.stripe_verification_status ?? "Disponível após aprovação"}
                </span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Os repasses são liberados após a conclusão de cada serviço. A conta de recebimento é configurada quando
              seu cadastro for aprovado.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => void goTo("professional")}>
                Voltar
              </Button>
              <Button
                onClick={() =>
                  void goTo("financial", {
                    verification_email: !!user?.email_confirmed_at,
                  }).then(() => setStep("review"))
                }
              >
                Revisar cadastro
              </Button>
            </div>
          </div>
        ) : null}

        {step === "review" ? (
          <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
            <h2 className="font-semibold">Revise e envie</h2>
            <dl className="space-y-2 text-sm">
              <Row label="Nome" value={draft.full_name} />
              <Row label="CPF" value={formatCpf(draft.cpf ?? "")} />
              <Row label="Nascimento" value={draft.birth_date} />
              <Row label="Telefone" value={formatPhone(draft.phone ?? "")} />
              <Row label="E-mail" value={draft.email} />
              <Row label="Documento" value={draft.identity_document_type?.toUpperCase()} />
              <Row label="Selfie" value={draft.selfie_path ? "Enviada" : "Pendente"} />
              <Row
                label="Endereço"
                value={[draft.address, draft.address_number, draft.neighborhood, draft.city, draft.state]
                  .filter(Boolean)
                  .join(", ")}
              />
              <Row label="Comprovante" value={draft.address_proof_path ? "Enviado" : "Pendente"} />
              <Row label="Região" value={draft.service_region} />
              <Row label="Experiência" value={`${draft.experience_years ?? 0} ano(s)`} />
            </dl>

            <label className="flex items-start gap-3 text-sm">
              <Checkbox checked={terms} onCheckedChange={(v) => setTerms(v === true)} />
              <span>Li e aceito os Termos de Uso do FixNow.</span>
            </label>
            <label className="flex items-start gap-3 text-sm">
              <Checkbox checked={privacy} onCheckedChange={(v) => setPrivacy(v === true)} />
              <span>
                Autorizo o tratamento dos meus documentos exclusivamente para verificação de identidade, conforme a
                Política de Privacidade. Os arquivos ficam privados e podem ser excluídos a qualquer momento mediante
                solicitação.
              </span>
            </label>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("financial")}>
                Voltar
              </Button>
              <Button
                disabled={!terms || !privacy || submit.isPending}
                onClick={async () => {
                  const now = new Date().toISOString();
                  await save.mutateAsync({
                    ...draft,
                    terms_accepted_at: now,
                    privacy_accepted_at: now,
                  });
                  submit.mutate();
                }}
              >
                {submit.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                Enviar para análise
              </Button>
            </div>
          </div>
        ) : null}
      </section>
    </AppShell>
  );
}

function Row({ label, value }: { label: string; value?: string | null | undefined }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border/60 pb-1">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value || "—"}</dd>
    </div>
  );
}

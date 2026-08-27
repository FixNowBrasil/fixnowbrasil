import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type VerificationRow = Database["public"]["Tables"]["provider_verifications"]["Row"];
export type VerificationStatus = Database["public"]["Enums"]["verification_status"];
export type VerificationStep = Database["public"]["Enums"]["verification_step"];

export const VERIFICATION_BUCKET = "verification-documents";

export const VERIFICATION_STEPS: { key: VerificationStep; label: string }[] = [
  { key: "personal", label: "Dados pessoais" },
  { key: "identity", label: "Identidade" },
  { key: "selfie", label: "Selfie" },
  { key: "address", label: "Endereço" },
  { key: "professional", label: "Profissional" },
  { key: "financial", label: "Financeiro" },
  { key: "review", label: "Análise" },
];

export const STATUS_LABEL: Record<VerificationStatus, string> = {
  draft: "Rascunho",
  pending: "Em preenchimento",
  under_review: "Em análise",
  approved: "Aprovado",
  rejected: "Recusado",
  suspended: "Suspenso",
};

export const STATUS_CLASS: Record<VerificationStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  pending: "bg-muted text-muted-foreground",
  under_review: "bg-primary/15 text-primary",
  approved: "bg-success/15 text-success",
  rejected: "bg-destructive/15 text-destructive",
  suspended: "bg-destructive/15 text-destructive",
};

/* ------------- validações ------------- */

export function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

export function formatCpf(value: string) {
  const d = onlyDigits(value).slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
}

export function formatPhone(value: string) {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length <= 10) return d.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d{1,4})$/, "$1-$2");
  return d.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d{1,4})$/, "$1-$2");
}

export function formatZip(value: string) {
  const d = onlyDigits(value).slice(0, 8);
  return d.replace(/^(\d{5})(\d)/, "$1-$2");
}

export function isValidCpf(value: string) {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const digit = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i += 1) sum += Number(cpf[i]) * (len + 1 - i);
    const mod = (sum * 10) % 11;
    return mod === 10 ? 0 : mod;
  };
  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10]);
}

export function isValidPhone(value: string) {
  const d = onlyDigits(value);
  return d.length === 10 || d.length === 11;
}

export function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

export function isAdult(birthDate: string) {
  if (!birthDate) return false;
  const d = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return false;
  const limit = new Date();
  limit.setFullYear(limit.getFullYear() - 18);
  return d <= limit;
}

export function maskCpf(value: string | null) {
  const d = onlyDigits(value ?? "");
  if (d.length !== 11) return "—";
  return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
}

/* ------------- storage ------------- */

export type DocumentSlot = "identity/front" | "identity/back" | "selfie" | "address";

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];

export async function uploadVerificationFile(file: File, providerId: string, slot: DocumentSlot) {
  if (!ALLOWED.includes(file.type)) throw new Error("Envie uma imagem (JPG, PNG, WEBP) ou PDF.");
  if (file.size > MAX_BYTES) throw new Error("O arquivo deve ter no máximo 8 MB.");
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${providerId}/${slot}-${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(VERIFICATION_BUCKET)
    .upload(path, file, { cacheControl: "0", upsert: false, contentType: file.type });
  if (error) throw error;
  return path;
}

export async function signedDocumentUrl(path: string, expiresIn = 300) {
  const { data, error } = await supabase.storage.from(VERIFICATION_BUCKET).createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}

export async function removeVerificationFile(path: string) {
  await supabase.storage.from(VERIFICATION_BUCKET).remove([path]);
}

/* ------------- queries ------------- */

export const myVerificationQuery = (providerId: string | undefined) => ({
  queryKey: ["provider-verification", providerId ?? "none"],
  enabled: !!providerId,
  queryFn: async (): Promise<VerificationRow | null> => {
    const { data, error } = await supabase
      .from("provider_verifications")
      .select("*")
      .eq("provider_id", providerId!)
      .maybeSingle();
    if (error) throw error;
    return data;
  },
});

export async function ensureVerification(providerId: string): Promise<VerificationRow> {
  const { data } = await supabase
    .from("provider_verifications")
    .select("*")
    .eq("provider_id", providerId)
    .maybeSingle();
  if (data) return data;
  const { data: created, error } = await supabase
    .from("provider_verifications")
    .insert({ provider_id: providerId })
    .select("*")
    .single();
  if (error) throw error;
  return created;
}

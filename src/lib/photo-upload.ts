import { supabase } from "@/integrations/supabase/client";

export type PhotoBucket = "service-request-photos";

export async function uploadPhoto(file: File, userId: string, requestId: string) {
  if (!file.type.startsWith("image/")) throw new Error("Selecione uma imagem válida.");
  if (file.size > 5 * 1024 * 1024) throw new Error("A imagem deve ter no máximo 5 MB.");
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${userId}/${requestId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("service-request-photos").upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
  if (error) throw error;
  return path;
}

export async function createPhotoUrl(path: string, expiresIn = 3600) {
  const { data, error } = await supabase.storage.from("service-request-photos").createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}

export type ProviderBucket = "avatars" | "provider-work-photos";

// Buckets são privados: gera uma URL assinada de longa duração para exibição pública.
const LONG_LIVED_SECONDS = 60 * 60 * 24 * 365 * 5;

export async function uploadProviderPhoto(file: File, bucket: ProviderBucket, userId: string, folder = "") {
  if (!file.type.startsWith("image/")) throw new Error("Selecione uma imagem válida.");
  if (file.size > 5 * 1024 * 1024) throw new Error("A imagem deve ter no máximo 5 MB.");
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${userId}/${folder ? `${folder}/` : ""}${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
  if (error) throw error;
  const { data, error: signError } = await supabase.storage.from(bucket).createSignedUrl(path, LONG_LIVED_SECONDS);
  if (signError) throw signError;
  return data.signedUrl;
}

/** Extrai o caminho do arquivo a partir de uma URL pública ou assinada do Storage. */
export function storagePathFromUrl(bucket: ProviderBucket, url: string): string | null {
  for (const marker of [`/storage/v1/object/public/${bucket}/`, `/storage/v1/object/sign/${bucket}/`]) {
    const part = url.split(marker)[1];
    if (part) return decodeURIComponent(part.split("?")[0] ?? "");
  }
  return null;
}


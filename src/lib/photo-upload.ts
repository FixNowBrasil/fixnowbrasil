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

export async function uploadProviderPhoto(file: File, bucket: "avatars" | "provider-work-photos", userId: string, folder = "") {
  if (!file.type.startsWith("image/")) throw new Error("Selecione uma imagem válida.");
  if (file.size > 5 * 1024 * 1024) throw new Error("A imagem deve ter no máximo 5 MB.");
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${userId}/${folder ? `${folder}/` : ""}${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
  if (error) throw error;
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

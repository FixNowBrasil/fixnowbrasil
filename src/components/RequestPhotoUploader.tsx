import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { uploadPhoto, createPhotoUrl } from "@/lib/photo-upload";
import { supabase } from "@/integrations/supabase/client";

export function RequestPhotoUploader({ requestId, userId, photos }: { requestId: string; userId: string; photos: string[] }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    void Promise.all(photos.map(async (path) => [path, await createPhotoUrl(path)] as const)).then((entries) => {
      if (active) setUrls(Object.fromEntries(entries));
    }).catch(() => undefined);
    return () => { active = false; };
  }, [photos]);

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    if (photos.length + files.length > 6) { toast.error("Você pode adicionar no máximo 6 fotos."); return; }
    setBusy(true);
    try {
      const next = [...photos];
      for (const file of Array.from(files)) next.push(await uploadPhoto(file, userId, requestId));
      const { error } = await supabase.from("service_requests").update({ photos: next }).eq("id", requestId).eq("client_id", userId);
      if (error) throw error;
      toast.success("Foto adicionada.");
      window.location.reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar a foto.");
    } finally { setBusy(false); }
  }

  async function removePhoto(path: string) {
    const next = photos.filter((photo) => photo !== path);
    const { error } = await supabase.from("service_requests").update({ photos: next }).eq("id", requestId).eq("client_id", userId);
    if (error) { toast.error("Não foi possível remover a foto."); return; }
    await supabase.storage.from("service-request-photos").remove([path]);
    window.location.reload();
  }

  return <section className="surface-card space-y-3 p-5">
    <div className="flex items-center justify-between gap-3"><div><h2 className="font-display text-base font-bold">Fotos do serviço</h2><p className="text-xs text-muted-foreground">Até 6 fotos, 5 MB cada.</p></div><Button type="button" variant="outline" disabled={busy} onClick={() => inputRef.current?.click()} className="gap-2">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />} Adicionar</Button></div>
    <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={(e) => void addFiles(e.target.files)} />
    {photos.length > 0 && <div className="grid grid-cols-3 gap-2">{photos.map((path) => <div key={path} className="group relative aspect-square overflow-hidden rounded-xl bg-muted">{urls[path] ? <img src={urls[path]} alt="Foto do serviço" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-xs text-muted-foreground">Carregando...</div>}<button type="button" onClick={() => void removePhoto(path)} className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white opacity-0 transition group-hover:opacity-100" aria-label="Remover foto"><X className="h-4 w-4" /></button></div>)}</div>}
  </section>;
}

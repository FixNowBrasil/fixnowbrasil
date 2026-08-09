import { useEffect, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { uploadPhoto } from "@/lib/photo-upload";
import { supabase } from "@/integrations/supabase/client";

export function ProviderPhotoGallery({ providerId, userId, photos }: { providerId: string; userId: string; photos: string[] }) {
  const [items, setItems] = useState(photos ?? []);
  const [busy, setBusy] = useState(false);
  useEffect(() => setItems(photos ?? []), [photos]);

  async function add(files: FileList | null) {
    if (!files?.length) return;
    if (items.length + files.length > 8) return toast.error("Você pode adicionar até 8 fotos de trabalhos.");
    setBusy(true);
    try {
      const urls: string[] = [];
      for (const file of Array.from(files)) urls.push(await uploadPhoto(file, "provider-work-photos", userId, providerId));
      const next = [...items, ...urls];
      const { error } = await supabase.from("providers").update({ work_photos: next }).eq("id", providerId).eq("user_id", userId);
      if (error) throw error;
      setItems(next);
      toast.success("Fotos adicionadas.");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível enviar as fotos."); }
    finally { setBusy(false); }
  }

  async function remove(url: string) {
    const next = items.filter((item) => item !== url);
    const { error } = await supabase.from("providers").update({ work_photos: next }).eq("id", providerId).eq("user_id", userId);
    if (error) return toast.error("Não foi possível remover a foto.");
    const marker = `/storage/v1/object/public/provider-work-photos/`;
    const path = url.split(marker)[1];
    if (path) await supabase.storage.from("provider-work-photos").remove([path]);
    setItems(next);
    toast.success("Foto removida.");
  }

  return <div className="space-y-3">
    <div className="flex items-center justify-between"><div><h3 className="font-bold">Fotos dos meus trabalhos</h3><p className="text-xs text-muted-foreground">Até 8 fotos, máximo de 5 MB cada.</p></div>
      <label className="cursor-pointer"><input className="sr-only" type="file" accept="image/*" multiple onChange={(e) => { void add(e.target.files); e.currentTarget.value = ""; }} disabled={busy || items.length >= 8} /><span className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-sm font-bold text-primary-foreground"><ImagePlus className="h-4 w-4" /> Adicionar</span></label>
    </div>
    {items.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{items.map((url) => <div key={url} className="group relative aspect-square overflow-hidden rounded-xl border bg-muted"><img src={url} alt="Trabalho realizado pelo prestador" className="h-full w-full object-cover" /><Button type="button" variant="destructive" size="icon" className="absolute right-2 top-2 opacity-0 transition group-hover:opacity-100" onClick={() => void remove(url)}><Trash2 className="h-4 w-4" /></Button></div>)}</div> : <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Nenhuma foto adicionada ainda.</div>}
  </div>;
}

import { useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { createPhotoUrl, uploadPhoto } from "@/lib/photo-upload";
import { supabase } from "@/integrations/supabase/client";
import type { RequestDraft } from "@/lib/request-draft";

const MAX_PHOTOS = 6;

export function DraftPhotoPicker({
  draft,
  update,
}: {
  draft: RequestDraft;
  update: (patch: Partial<RequestDraft>) => void;
}) {
  const { user } = useAuth();
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    void Promise.all(draft.photos.map(async (path) => [path, await createPhotoUrl(path)] as const))
      .then((entries) => {
        if (active) setUrls(Object.fromEntries(entries));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [draft.photos]);

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    if (!user) {
      toast.info("Entre na sua conta para adicionar fotos.");
      return;
    }
    if (draft.photos.length + files.length > MAX_PHOTOS) {
      toast.error(`Você pode adicionar no máximo ${MAX_PHOTOS} fotos.`);
      return;
    }
    setBusy(true);
    try {
      const next = [...draft.photos];
      for (const file of Array.from(files)) next.push(await uploadPhoto(file, user.id, draft.draftId));
      update({ photos: next });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar a foto.");
    } finally {
      setBusy(false);
    }
  }

  async function removePhoto(path: string) {
    update({ photos: draft.photos.filter((photo) => photo !== path) });
    await supabase.storage.from("service-request-photos").remove([path]);
  }

  return (
    <section className="surface-card space-y-3 p-5">
      <div>
        <h2 className="font-display text-base font-bold">Adicione uma foto do problema</h2>
        <p className="text-xs text-muted-foreground">
          Uma foto pode ajudar o profissional a entender melhor o serviço. (opcional)
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" disabled={busy} onClick={() => cameraRef.current?.click()} className="gap-2">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />} Tirar foto
        </Button>
        <Button type="button" variant="outline" disabled={busy} onClick={() => galleryRef.current?.click()} className="gap-2">
          <ImagePlus className="h-4 w-4" /> Da galeria
        </Button>
      </div>

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          void addFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          void addFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {draft.photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {draft.photos.map((path) => (
            <div key={path} className="group relative aspect-square overflow-hidden rounded-xl bg-muted">
              {urls[path] ? (
                <img src={urls[path]} alt="Foto do problema" className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full place-items-center text-xs text-muted-foreground">Carregando...</div>
              )}
              <button
                type="button"
                onClick={() => void removePhoto(path)}
                className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white"
                aria-label="Remover foto"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

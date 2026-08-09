import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { ProviderPhotoGallery } from "@/components/ProviderPhotoGallery";
import { Button } from "@/components/ui/button";
import { uploadProviderPhoto } from "@/lib/photo-upload";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/fotos-prestador")({ component: ProviderPhotosPage });

function ProviderPhotosPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const provider = useQuery({
    queryKey: ["my-provider-photos", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("providers").select("id, avatar_url, work_photos").eq("user_id", user!.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  async function changeAvatar(file: File | undefined) {
    if (!file || !provider.data || !user) return;
    setBusy(true);
    try {
      const url = await uploadProviderPhoto(file, "avatars", user.id, provider.data.id);
      const { error } = await supabase.from("providers").update({ avatar_url: url }).eq("id", provider.data.id).eq("user_id", user.id);
      if (error) throw error;
      toast.success("Foto de perfil atualizada.");
      queryClient.invalidateQueries({ queryKey: ["my-provider-photos"] });
      queryClient.invalidateQueries({ queryKey: ["my-provider-full"] });
      queryClient.invalidateQueries({ queryKey: ["provider", provider.data.id] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível enviar a foto."); }
    finally { setBusy(false); }
  }

  async function removeAvatar() {
    if (!provider.data || !user || !provider.data.avatar_url) return;
    const old = provider.data.avatar_url;
    const { error } = await supabase.from("providers").update({ avatar_url: null }).eq("id", provider.data.id).eq("user_id", user.id);
    if (error) return toast.error("Não foi possível remover a foto.");
    const marker = "/storage/v1/object/public/avatars/";
    const path = old.split(marker)[1];
    if (path) await supabase.storage.from("avatars").remove([path]);
    queryClient.invalidateQueries({ queryKey: ["my-provider-photos"] });
    queryClient.invalidateQueries({ queryKey: ["my-provider-full"] });
    toast.success("Foto de perfil removida.");
  }

  return <AppShell><div className="mx-auto w-full max-w-4xl space-y-5 px-4 py-6">
    <div><h1 className="font-display text-2xl font-extrabold">Fotos do prestador</h1><p className="mt-1 text-sm text-muted-foreground">Mostre seu trabalho e mantenha seu perfil profissional atualizado.</p></div>
    {!provider.data ? <div className="surface-card p-5 text-sm text-muted-foreground">Crie seu perfil profissional antes de adicionar fotos.</div> : <>
      <section className="surface-card space-y-4 p-5">
        <div><h2 className="font-display font-bold">Foto de perfil</h2><p className="text-xs text-muted-foreground">Use uma foto clara e profissional.</p></div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="grid h-24 w-24 place-items-center overflow-hidden rounded-full border bg-muted">{provider.data.avatar_url ? <img src={provider.data.avatar_url} alt="Foto de perfil" className="h-full w-full object-cover" /> : <Camera className="h-8 w-8 text-muted-foreground" />}</div>
          <div className="flex gap-2"><label className="cursor-pointer"><input className="sr-only" type="file" accept="image/*" onChange={(e) => { void changeAvatar(e.target.files?.[0]); e.currentTarget.value = ""; }} disabled={busy} /><span className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-bold text-primary-foreground">{busy ? "Enviando..." : "Enviar foto"}</span></label>{provider.data.avatar_url && <Button variant="outline" onClick={() => void removeAvatar()}><Trash2 className="mr-2 h-4 w-4" /> Remover</Button>}</div>
        </div>
      </section>
      <section className="surface-card p-5"><ProviderPhotoGallery providerId={provider.data.id} userId={user!.id} photos={Array.isArray(provider.data.work_photos) ? provider.data.work_photos : []} /></section>
    </>}
  </div></AppShell>;
}

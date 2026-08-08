import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { CardSkeleton, EmptyState, ProviderCard } from "@/components/fixnow-ui";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Provider } from "@/lib/fixnow";

export const Route = createFileRoute("/_authenticated/favoritos")({
  head: () => ({
    meta: [
      { title: "Favoritos — FixNow" },
      { name: "description", content: "Seus profissionais favoritos salvos no FixNow." },
      { property: "og:title", content: "Favoritos — FixNow" },
      { property: "og:description", content: "Acesse rapidamente os profissionais que você já confia." },
    ],
  }),
  component: FavoritosPage,
});

function FavoritosPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const favorites = useQuery({
    queryKey: ["favorites", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("favorites").select("id, providers(*)");
      if (error) throw error;
      return data ?? [];
    },
  });

  async function remove(favId: string) {
    await supabase.from("favorites").delete().eq("id", favId);
    queryClient.invalidateQueries({ queryKey: ["favorites"] });
  }

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-6">
        <h1 className="font-display text-2xl font-extrabold">Favoritos</h1>
        {favorites.isLoading ? (
          <CardSkeleton count={2} />
        ) : (favorites.data ?? []).length === 0 ? (
          <EmptyState
            title="Nenhum favorito ainda"
            description="Salve profissionais para contratar de novo com um toque."
            action={
              <Link to="/buscar">
                <Button className="font-bold">Descobrir profissionais</Button>
              </Link>
            }
          />
        ) : (
          <div className="space-y-4">
            {(favorites.data ?? []).map((f) => {
              const p = f.providers as unknown as Provider;
              return (
                <div key={f.id} className="space-y-2">
                  <ProviderCard provider={p} />
                  <Button variant="ghost" className="font-bold text-destructive" onClick={() => remove(f.id)}>
                    <Trash2 className="h-4 w-4" /> Remover dos favoritos
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}

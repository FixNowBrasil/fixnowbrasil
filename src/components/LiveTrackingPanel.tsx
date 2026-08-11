import { Suspense, lazy, useEffect, useMemo } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MapPin, Navigation } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { geocodeAddress } from "@/lib/geocode.functions";
import { distanceKm, etaMinutes, formatDistance, liveLocationQuery } from "@/lib/tracking";

const LiveTrackingMap = lazy(() => import("@/components/LiveTrackingMap"));

const MapSkeleton = () => <div className="h-56 w-full animate-pulse rounded-2xl bg-muted" />;

type Props = {
  requestId: string;
  address: string;
  providerName?: string | null;
};

/** Painel de acompanhamento ao vivo exibido enquanto o prestador está a caminho. */
export function LiveTrackingPanel({ requestId, address, providerName }: Props) {
  const queryClient = useQueryClient();

  const location = useQuery({
    ...liveLocationQuery(requestId),
    refetchInterval: 15_000,
  });

  const destination = useQuery({
    queryKey: ["geocode", address],
    enabled: !!address,
    staleTime: 1000 * 60 * 60 * 24,
    queryFn: () => geocodeAddress({ data: { address } }),
  });

  useEffect(() => {
    const channel = supabase
      .channel(`request-location-${requestId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "request_locations",
          filter: `request_id=eq.${requestId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["live-location", requestId] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, requestId]);

  const providerPoint = location.data ? { lat: location.data.lat, lng: location.data.lng } : null;
  const destPoint = destination.data ?? null;

  const summary = useMemo(() => {
    if (!providerPoint || !destPoint) return null;
    const km = distanceKm(providerPoint, destPoint);
    return { km, eta: etaMinutes(km) };
  }, [providerPoint, destPoint]);

  const updatedAgo = location.data
    ? Math.max(0, Math.round((Date.now() - new Date(location.data.updated_at).getTime()) / 1000))
    : null;

  return (
    <section className="surface-card space-y-3 p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-base font-bold">
          <Navigation className="h-4 w-4 text-primary" />
          {providerName ? `${providerName} está a caminho` : "Prestador a caminho"}
        </h2>
        {summary && (
          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary">
            {formatDistance(summary.km)} • ~{summary.eta} min
          </span>
        )}
      </div>

      <ClientOnly fallback={<MapSkeleton />}>
        <Suspense fallback={<MapSkeleton />}>
          <LiveTrackingMap
            provider={providerPoint}
            destination={destPoint}
            providerLabel={providerName ?? "Prestador"}
          />
        </Suspense>
      </ClientOnly>

      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <MapPin className="h-3.5 w-3.5" /> {address}
      </p>
      <p className="text-xs font-medium text-muted-foreground">
        {providerPoint
          ? `Localização atualizada há ${updatedAgo ?? 0}s`
          : "Aguardando a localização do prestador..."}
      </p>
    </section>
  );
}

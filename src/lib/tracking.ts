import { supabase } from "@/integrations/supabase/client";

export type LiveLocation = {
  request_id: string;
  provider_id: string;
  lat: number;
  lng: number;
  accuracy: number | null;
  updated_at: string;
};

export const liveLocationQuery = (requestId: string) => ({
  queryKey: ["live-location", requestId],
  queryFn: async (): Promise<LiveLocation | null> => {
    const { data, error } = await supabase
      .from("request_locations")
      .select("request_id, provider_id, lat, lng, accuracy, updated_at")
      .eq("request_id", requestId)
      .maybeSingle();
    if (error) throw error;
    return (data as LiveLocation | null) ?? null;
  },
});

export async function pushProviderLocation(input: {
  requestId: string;
  providerId: string;
  lat: number;
  lng: number;
  accuracy?: number | null;
}) {
  const { error } = await supabase.from("request_locations").upsert(
    {
      request_id: input.requestId,
      provider_id: input.providerId,
      lat: input.lat,
      lng: input.lng,
      accuracy: input.accuracy ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "request_id" },
  );
  if (error) throw error;
}

/** Distância em km entre dois pontos (Haversine). */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** ETA em minutos, considerando trajeto urbano (~22 km/h e fator de rota 1.3). */
export function etaMinutes(km: number) {
  return Math.max(1, Math.round(((km * 1.3) / 22) * 60));
}

export function formatDistance(km: number) {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps } from "@/lib/google-maps-loader";

export type MapPoint = { lat: number; lng: number };

type Props = {
  provider: MapPoint | null;
  destination: MapPoint | null;
  providerLabel?: string;
};

/** Mapa com o pino do prestador e o destino. Somente no navegador. */
export default function LiveTrackingMap({ provider, destination, providerLabel }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const providerMarker = useRef<google.maps.Marker | null>(null);
  const destMarker = useRef<google.maps.Marker | null>(null);
  const lineRef = useRef<google.maps.Polyline | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then((maps) => {
        if (cancelled || !ref.current || mapRef.current) return;
        mapRef.current = new maps.Map(ref.current, {
          center: provider ?? destination ?? { lat: -23.5505, lng: -46.6333 },
          zoom: 14,
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: "greedy",
        });
      })
      .catch(() => {
        if (!cancelled) setError("Não foi possível carregar o mapa.");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const maps = typeof window !== "undefined" ? window.google?.maps : undefined;
    if (!map || !maps) return;

    if (destination) {
      if (!destMarker.current) {
        destMarker.current = new maps.Marker({
          map,
          position: destination,
          title: "Endereço do serviço",
          icon: {
            path: maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: "#0f172a",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 3,
          },
        });
      } else {
        destMarker.current.setPosition(destination);
      }
    }

    if (provider) {
      if (!providerMarker.current) {
        providerMarker.current = new maps.Marker({
          map,
          position: provider,
          title: providerLabel ?? "Prestador",
          icon: {
            path: maps.SymbolPath.CIRCLE,
            scale: 9,
            fillColor: "#f97316",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 3,
          },
        });
      } else {
        providerMarker.current.setPosition(provider);
      }
    }

    if (provider && destination) {
      const path = [provider, destination];
      if (!lineRef.current) {
        lineRef.current = new maps.Polyline({
          map,
          path,
          strokeColor: "#f97316",
          strokeOpacity: 0.6,
          strokeWeight: 4,
        });
      } else {
        lineRef.current.setPath(path);
      }
      const bounds = new maps.LatLngBounds();
      bounds.extend(provider);
      bounds.extend(destination);
      map.fitBounds(bounds, 64);
    } else if (provider ?? destination) {
      map.setCenter((provider ?? destination)!);
    }
  }, [provider, destination, providerLabel]);

  useEffect(
    () => () => {
      providerMarker.current?.setMap(null);
      destMarker.current?.setMap(null);
      lineRef.current?.setMap(null);
    },
    [],
  );

  if (error) {
    return (
      <div className="grid h-56 place-items-center rounded-2xl bg-muted text-sm font-semibold text-muted-foreground">
        {error}
      </div>
    );
  }

  return <div ref={ref} className="h-56 w-full rounded-2xl" aria-label="Mapa de rastreamento" />;
}

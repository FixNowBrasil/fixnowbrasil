import { useEffect, useRef, useState } from "react";
import { pushProviderLocation } from "@/lib/tracking";

type Options = {
  requestId: string;
  providerId: string | null;
  enabled: boolean;
};

type State = {
  sharing: boolean;
  error: string | null;
  lastSentAt: number | null;
};

const MIN_INTERVAL_MS = 10_000;

/** Compartilha a posição do prestador enquanto o pedido estiver "a caminho". */
export function useShareLocation({ requestId, providerId, enabled }: Options): State {
  const [state, setState] = useState<State>({ sharing: false, error: null, lastSentAt: null });
  const lastSent = useRef(0);

  useEffect(() => {
    if (!enabled || !providerId) {
      setState((s) => (s.sharing ? { ...s, sharing: false } : s));
      return;
    }
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState({ sharing: false, error: "Seu dispositivo não suporta localização.", lastSentAt: null });
      return;
    }

    let cancelled = false;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (cancelled) return;
        const now = Date.now();
        if (now - lastSent.current < MIN_INTERVAL_MS) return;
        lastSent.current = now;
        void pushProviderLocation({
          requestId,
          providerId,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        })
          .then(() => {
            if (!cancelled) setState({ sharing: true, error: null, lastSentAt: now });
          })
          .catch(() => {
            if (!cancelled)
              setState((s) => ({ ...s, error: "Não foi possível enviar sua localização." }));
          });
      },
      (err) => {
        if (cancelled) return;
        setState({
          sharing: false,
          error:
            err.code === err.PERMISSION_DENIED
              ? "Permissão de localização negada — o cliente não verá o mapa."
              : "Não foi possível obter sua localização.",
          lastSentAt: null,
        });
      },
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 },
    );

    setState((s) => ({ ...s, sharing: true, error: null }));

    return () => {
      cancelled = true;
      navigator.geolocation.clearWatch(watchId);
    };
  }, [enabled, providerId, requestId]);

  return state;
}

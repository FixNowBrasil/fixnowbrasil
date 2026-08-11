/// <reference types="google.maps" />
let loader: Promise<typeof google.maps> | null = null;

declare global {
  interface Window {
    __fixnowMapsReady?: () => void;
    google: typeof globalThis.google;
  }
}

/** Carrega o Maps JavaScript API uma única vez (somente no navegador). */
export function loadGoogleMaps(): Promise<typeof google.maps> {
  if (typeof window === "undefined") return Promise.reject(new Error("browser only"));
  if (loader) return loader;

  loader = new Promise((resolve, reject) => {
    if (window.google?.maps) {
      resolve(window.google.maps);
      return;
    }
    const key = import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY"];
    const channel = import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID"] ?? "";
    if (!key) {
      reject(new Error("Chave do Google Maps ausente"));
      return;
    }
    window.__fixnowMapsReady = () => resolve(window.google.maps);
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&loading=async&callback=__fixnowMapsReady&language=pt-BR&region=BR${
      channel ? `&channel=${channel}` : ""
    }`;
    script.async = true;
    script.onerror = () => reject(new Error("Falha ao carregar o Google Maps"));
    document.head.appendChild(script);
  });

  return loader;
}

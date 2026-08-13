import { useCallback, useEffect, useState } from "react";

export type AppMode = "client" | "provider";

const KEY = "fixnow:mode";
const EVENT = "fixnow:mode-change";

function read(): AppMode {
  if (typeof window === "undefined") return "client";
  return window.localStorage.getItem(KEY) === "provider" ? "provider" : "client";
}

/**
 * Modo do app (cliente/prestador) controlado apenas pelo botão de troca.
 * Navegar entre páginas nunca altera o modo.
 */
export function useAppMode() {
  const [mode, setModeState] = useState<AppMode>("client");

  useEffect(() => {
    setModeState(read());
    const sync = () => setModeState(read());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const setMode = useCallback((next: AppMode) => {
    window.localStorage.setItem(KEY, next);
    window.dispatchEvent(new Event(EVENT));
    setModeState(next);
  }, []);

  return { mode, setMode };
}

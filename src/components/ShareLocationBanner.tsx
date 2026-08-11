import { Radio } from "lucide-react";
import { useShareLocation } from "@/hooks/useShareLocation";
import { cn } from "@/lib/utils";

type Props = {
  requestId: string;
  providerId: string | null;
  enabled: boolean;
  className?: string;
};

/** Ativa o compartilhamento de localização do prestador e mostra o estado ao usuário. */
export function ShareLocationBanner({ requestId, providerId, enabled, className }: Props) {
  const { sharing, error, lastSentAt } = useShareLocation({ requestId, providerId, enabled });

  if (!enabled) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold",
        error ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success",
        className,
      )}
    >
      <Radio className={cn("h-3.5 w-3.5", sharing && !error && "animate-pulse")} />
      {error
        ? error
        : sharing
          ? `Compartilhando sua localização com o cliente${
              lastSentAt ? ` • enviada às ${new Date(lastSentAt).toLocaleTimeString("pt-BR")}` : ""
            }`
          : "Ativando o compartilhamento de localização..."}
    </div>
  );
}

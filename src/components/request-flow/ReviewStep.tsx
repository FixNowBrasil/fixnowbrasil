import { useQuery } from "@tanstack/react-query";
import { CalendarClock, Camera, MapPin, Wrench } from "lucide-react";
import { allServicesQuery, categoriesQuery } from "@/lib/fixnow";
import { draftScheduledAt, type RequestDraft } from "@/lib/request-draft";

/** PARTE 4 — resumo curtinho antes de procurar profissionais. */
export function ReviewStep({ draft, onEdit }: { draft: RequestDraft; onEdit: (step: number) => void }) {
  const categories = useQuery(categoriesQuery);
  const services = useQuery(allServicesQuery);

  const category = (categories.data ?? []).find((c) => c.id === draft.categoryId);
  const service = (services.data ?? []).find((s) => s.id === draft.serviceId);
  const scheduledAt = draftScheduledAt(draft);

  const need =
    service?.name ??
    draft.need ??
    category?.name ??
    (draft.description.trim() ? "Serviço descrito por você" : "Serviço");

  return (
    <section className="surface-card space-y-4 p-5">
      <div className="space-y-1">
        <h1 className="font-display text-xl font-bold">Confira sua solicitação</h1>
        <p className="text-sm text-muted-foreground">Está tudo certo? É só confirmar.</p>
      </div>

      <ul className="space-y-2">
        <Row
          icon={<Wrench className="h-4 w-4" />}
          title={`${category?.emoji ? `${category.emoji} ` : ""}${need}`}
          {...(draft.description.trim() ? { detail: draft.description.trim() } : {})}
          onEdit={() => onEdit(0)}
        />
        <Row
          icon={<MapPin className="h-4 w-4" />}
          title={draft.addressParts?.label ?? "Endereço"}
          detail={draft.address}
          onEdit={() => onEdit(1)}
        />
        <Row
          icon={<CalendarClock className="h-4 w-4" />}
          title={
            scheduledAt
              ? scheduledAt.toLocaleString("pt-BR", { dateStyle: "long", timeStyle: "short" })
              : "Hoje, o mais rápido possível"
          }
          onEdit={() => onEdit(2)}
        />
        {draft.photos.length > 0 && (
          <Row
            icon={<Camera className="h-4 w-4" />}
            title={`${draft.photos.length} ${draft.photos.length === 1 ? "foto adicionada" : "fotos adicionadas"}`}
            onEdit={() => onEdit(0)}
          />
        )}
      </ul>

      <p className="rounded-xl bg-muted px-4 py-3 text-sm font-semibold">
        Vamos enviar sua solicitação para até 5 profissionais compatíveis. Você escolhe depois.
      </p>
    </section>
  );
}

function Row({
  icon,
  title,
  detail,
  onEdit,
}: {
  icon: React.ReactNode;
  title: string;
  detail?: string;
  onEdit: () => void;
}) {
  return (
    <li className="flex items-start gap-3 rounded-xl border border-border px-4 py-3">
      <span className="mt-0.5 text-primary">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold">{title}</span>
        {detail && <span className="block text-sm text-muted-foreground">{detail}</span>}
      </span>
      <button
        type="button"
        onClick={onEdit}
        className="shrink-0 text-xs font-bold uppercase tracking-wide text-primary hover:underline"
      >
        Alterar
      </button>
    </li>
  );
}

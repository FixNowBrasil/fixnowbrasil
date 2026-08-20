/**
 * Estado temporário da criação de uma solicitação (não persiste no banco).
 * PARTE 1: problema (descrição livre OU categoria/serviço) + fotos.
 * PARTE 2+: endereço, quando, profissionais — apenas estendem este rascunho.
 */
import { useCallback, useMemo, useState } from "react";

export type ProblemMode = "describe" | "choose";

/** Endereço estruturado (base futura para distância/matching por cidade, UF e CEP). */
export type DraftAddress = {
  /** id em `addresses` quando o endereço veio de um salvo. */
  id: string | null;
  label: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  zip: string;
};

export function formatAddress(a: DraftAddress): string {
  const line1 = [a.street, a.number].filter(Boolean).join(", ");
  const line2 = [a.neighborhood, [a.city, a.state].filter(Boolean).join("/")].filter(Boolean).join(" - ");
  return [line1, a.complement, line2, a.zip].filter(Boolean).join(" — ");
}

export type RequestDraft = {
  /** id gerado no cliente: usado como pasta das fotos e como id do pedido ao final. */
  draftId: string;
  mode: ProblemMode;
  description: string;
  categoryId: string | null;
  serviceId: string | null;
  need: string | null;
  photos: string[];
  /* PARTE 2 */
  address: string;
  addressParts: DraftAddress | null;
  /* PARTE 3 */
  /** `when_option` de `service_requests`: "now" (o quanto antes) ou "scheduled". */
  when: WhenOption;
  /** data local no formato YYYY-MM-DD (apenas quando `when === "scheduled"`). */
  date: string;
  /** horário local no formato HH:MM (apenas quando `when === "scheduled"`). */
  time: string;
};



export function createRequestDraft(partial: Partial<RequestDraft> = {}): RequestDraft {
  return {
    draftId: crypto.randomUUID(),
    mode: "describe",
    description: "",
    categoryId: null,
    serviceId: null,
    need: null,
    photos: [],
    address: "",
    addressParts: null,
    when: "now",
    date: "",
    ...partial,
  };
}

export const MIN_DESCRIPTION = 10;

/** Valida a PARTE 1. Retorna null quando está tudo certo. */
export function validateProblemStep(draft: RequestDraft): string | null {
  if (draft.mode === "describe") {
    if (draft.description.trim().length < MIN_DESCRIPTION) {
      return `Conte um pouco mais sobre o problema (pelo menos ${MIN_DESCRIPTION} caracteres).`;
    }
    return null;
  }
  if (!draft.categoryId) return "Escolha uma categoria para continuar.";
  return null;
}

export function useRequestDraft(initial: Partial<RequestDraft> = {}) {
  const [draft, setDraft] = useState<RequestDraft>(() => createRequestDraft(initial));
  const update = useCallback(
    (patch: Partial<RequestDraft>) => setDraft((current) => ({ ...current, ...patch })),
    [],
  );
  const problemError = useMemo(() => validateProblemStep(draft), [draft]);
  return { draft, update, problemError };
}

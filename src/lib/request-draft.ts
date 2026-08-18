/**
 * Estado temporário da criação de uma solicitação (não persiste no banco).
 * PARTE 1: problema (descrição livre OU categoria/serviço) + fotos.
 * PARTE 2+: endereço, quando, profissionais — apenas estendem este rascunho.
 */
import { useCallback, useMemo, useState } from "react";

export type ProblemMode = "describe" | "choose";

export type RequestDraft = {
  /** id gerado no cliente: usado como pasta das fotos e como id do pedido ao final. */
  draftId: string;
  mode: ProblemMode;
  description: string;
  categoryId: string | null;
  serviceId: string | null;
  need: string | null;
  photos: string[];
  /* PARTE 2/3 */
  address: string;
  when: string;
  date: string;
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

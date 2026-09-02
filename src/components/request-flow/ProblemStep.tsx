import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, MessageSquareText, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { allServicesQuery, categoriesQuery } from "@/lib/fixnow";
import { MIN_DESCRIPTION, type RequestDraft } from "@/lib/request-draft";
import { DraftPhotoPicker } from "./DraftPhotoPicker";

/**
 * PARTE 1 — uma decisão principal: dizer o que precisa.
 * Busca direta por serviço (a categoria continua sendo usada internamente no matching)
 * e, como alternativa, contar com as próprias palavras.
 */
export function ProblemStep({
  draft,
  update,
  error,
  showError,
}: {
  draft: RequestDraft;
  update: (patch: Partial<RequestDraft>) => void;
  error: string | null;
  showError: boolean;
}) {
  const categories = useQuery(categoriesQuery);
  const services = useQuery(allServicesQuery);
  const [term, setTerm] = useState("");

  const categoryById = useMemo(
    () => new Map((categories.data ?? []).map((c) => [c.id, c])),
    [categories.data],
  );

  const selectedService = (services.data ?? []).find((s) => s.id === draft.serviceId) ?? null;
  const selectedCategory = draft.categoryId ? categoryById.get(draft.categoryId) : undefined;

  /** Sem busca: serviços populares. Com busca: serviços cujo nome ou categoria combinam. */
  const suggestions = useMemo(() => {
    const all = services.data ?? [];
    const q = term.trim().toLowerCase();
    if (!q) return all.filter((s) => s.popular).slice(0, 8);
    return all
      .filter((s) => {
        const category = categoryById.get(s.category_id);
        return (
          s.name.toLowerCase().includes(q) ||
          (s.description ?? "").toLowerCase().includes(q) ||
          (category?.name.toLowerCase().includes(q) ?? false)
        );
      })
      .slice(0, 12);
  }, [services.data, categoryById, term]);

  const matchedCategories = useMemo(() => {
    const q = term.trim().toLowerCase();
    if (!q) return [];
    return (categories.data ?? []).filter((c) => c.name.toLowerCase().includes(q)).slice(0, 4);
  }, [categories.data, term]);

  function chooseService(serviceId: string, categoryId: string, name: string) {
    update({ mode: "choose", serviceId, categoryId, need: name });
    setTerm("");
  }

  function chooseCategory(categoryId: string, name: string) {
    update({ mode: "choose", serviceId: null, categoryId, need: name });
    setTerm("");
  }

  const chosen = draft.mode === "choose" && !!draft.categoryId;

  return (
    <div className="space-y-4">
      <section className="surface-card space-y-4 p-5">
        <div className="space-y-1">
          <h1 className="font-display text-xl font-bold">O que você precisa resolver?</h1>
          <p className="text-sm text-muted-foreground">
            Digite o que está acontecendo — nós encontramos o profissional certo.
          </p>
        </div>

        {chosen ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-primary bg-accent px-4 py-3 text-accent-foreground">
            <span className="min-w-0">
              <span className="block text-sm font-extrabold">
                {selectedCategory?.emoji} {selectedService?.name ?? selectedCategory?.name}
              </span>
              {selectedService && selectedCategory && (
                <span className="block text-xs opacity-80">{selectedCategory.name}</span>
              )}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="shrink-0 font-bold"
              onClick={() => update({ serviceId: null, categoryId: null, need: null })}
            >
              <X className="h-4 w-4" /> Trocar
            </Button>
          </div>
        ) : (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Ex.: eletricista, torneira, ar-condicionado..."
                className="h-12 rounded-xl pl-9 text-base"
                aria-label="Buscar serviço"
              />
            </div>

            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                {term.trim() ? "Resultados" : "Sugestões"}
              </p>

              {services.isLoading && (
                <p className="text-sm text-muted-foreground">Carregando serviços...</p>
              )}

              <div className="grid gap-2">
                {matchedCategories.map((c) => (
                  <button
                    key={`cat-${c.id}`}
                    type="button"
                    onClick={() => chooseCategory(c.id, c.name)}
                    className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left text-sm font-semibold transition hover:bg-muted"
                  >
                    <span aria-hidden>{c.emoji}</span>
                    <span className="min-w-0">
                      <span className="block">{c.name}</span>
                      <span className="block text-xs text-muted-foreground">Categoria</span>
                    </span>
                  </button>
                ))}

                {suggestions.map((s) => {
                  const category = categoryById.get(s.category_id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => chooseService(s.id, s.category_id, s.name)}
                      className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left text-sm font-semibold transition hover:bg-muted"
                    >
                      <span aria-hidden>{category?.emoji ?? "🛠️"}</span>
                      <span className="min-w-0">
                        <span className="block truncate">{s.name}</span>
                        <span className="block text-xs text-muted-foreground">
                          {category?.name}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>

              {!services.isLoading && suggestions.length === 0 && matchedCategories.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Não achamos esse serviço. Conte com suas palavras logo abaixo.
                </p>
              )}
            </div>
          </>
        )}

        <div className="space-y-2 rounded-xl border border-dashed border-border p-4">
          <div className="flex items-center gap-2 text-sm font-bold">
            <MessageSquareText className="h-4 w-4 text-primary" />
            {chosen ? "Quer acrescentar algum detalhe?" : "Ou conte o que aconteceu"}
          </div>
          <Textarea
            value={draft.description}
            onChange={(e) =>
              update({
                description: e.target.value,
                ...(chosen ? {} : { mode: "describe" as const }),
              })
            }
            maxLength={1000}
            rows={chosen ? 3 : 5}
            placeholder={
              chosen
                ? "Ex.: a torneira da cozinha pinga desde ontem. (opcional)"
                : "Ex.: minha torneira está vazando e molhando o armário..."
            }
            className="rounded-xl text-base"
            aria-label={chosen ? "Detalhes adicionais" : "Conte o que aconteceu"}
          />
          {!chosen && draft.description.trim().length > 0 && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {draft.description.trim().length >= MIN_DESCRIPTION ? (
                <>
                  <Check className="h-3.5 w-3.5 text-primary" /> Pronto, já dá para continuar.
                </>
              ) : (
                "Escreva um pouquinho mais para o profissional entender."
              )}
            </p>
          )}
        </div>

        {showError && error && <p className="text-sm font-semibold text-destructive">{error}</p>}
      </section>

      <DraftPhotoPicker draft={draft} update={update} />
    </div>
  );
}

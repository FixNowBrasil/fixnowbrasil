import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronRight, MessageSquareText, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { allServicesQuery, categoriesQuery } from "@/lib/fixnow";
import { MIN_DESCRIPTION, type RequestDraft } from "@/lib/request-draft";
import { DraftPhotoPicker } from "./DraftPhotoPicker";

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

  const category = (categories.data ?? []).find((c) => c.id === draft.categoryId);
  const categoryServices = useMemo(
    () => (services.data ?? []).filter((s) => s.category_id === draft.categoryId),
    [services.data, draft.categoryId],
  );

  const filteredCategories = useMemo(() => {
    const q = term.trim().toLowerCase();
    const list = categories.data ?? [];
    if (!q) return list;
    const serviceMatches = new Set(
      (services.data ?? []).filter((s) => s.name.toLowerCase().includes(q)).map((s) => s.category_id),
    );
    return list.filter((c) => c.name.toLowerCase().includes(q) || serviceMatches.has(c.id));
  }, [categories.data, services.data, term]);

  const filteredServices = useMemo(() => {
    const q = term.trim().toLowerCase();
    if (!q) return categoryServices;
    return categoryServices.filter((s) => s.name.toLowerCase().includes(q));
  }, [categoryServices, term]);

  return (
    <div className="space-y-4">
      <section className="surface-card space-y-3 p-5">
        <h1 className="font-display text-xl font-bold">O que você precisa resolver?</h1>
        <div className="grid gap-2 sm:grid-cols-2">
          <ModeButton
            active={draft.mode === "describe"}
            onClick={() => update({ mode: "describe" })}
            icon={<MessageSquareText className="h-4 w-4" />}
            label="Conte o que aconteceu"
          />
          <ModeButton
            active={draft.mode === "choose"}
            onClick={() => update({ mode: "choose" })}
            icon={<Check className="h-4 w-4" />}
            label="Escolha uma opção"
          />
        </div>

        {draft.mode === "describe" ? (
          <div className="space-y-2">
            <Textarea
              value={draft.description}
              onChange={(e) => update({ description: e.target.value })}
              maxLength={1000}
              rows={7}
              placeholder="Descreva seu problema..."
              className="min-h-40 rounded-xl text-base"
              aria-label="Descrição do problema"
            />
            <p className="text-xs text-muted-foreground">
              Conte com suas palavras o que aconteceu e o que você precisa.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Buscar categoria ou serviço"
                className="h-11 rounded-xl pl-9"
                aria-label="Buscar categoria ou serviço"
              />
            </div>

            {!draft.categoryId ? (
              <div className="grid gap-2">
                {categories.isLoading && <p className="text-sm text-muted-foreground">Carregando categorias...</p>}
                {filteredCategories.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      update({ categoryId: c.id, serviceId: null, need: c.name });
                      setTerm("");
                    }}
                    className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-left text-sm font-semibold transition hover:bg-muted"
                  >
                    <span>
                      {c.emoji} {c.name}
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                ))}
                {!categories.isLoading && filteredCategories.length === 0 && (
                  <p className="text-sm text-muted-foreground">Nenhuma categoria encontrada.</p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2 rounded-xl bg-muted px-4 py-2 text-sm font-bold">
                  <span>
                    {category?.emoji} {category?.name}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => update({ categoryId: null, serviceId: null, need: null })}
                  >
                    Trocar
                  </Button>
                </div>
                {filteredServices.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Sem serviços específicos nesta categoria — pode continuar assim mesmo.
                  </p>
                ) : (
                  <div className="grid gap-2">
                    {filteredServices.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() =>
                          update({
                            serviceId: draft.serviceId === s.id ? null : s.id,
                            need: draft.serviceId === s.id ? (category?.name ?? null) : s.name,
                          })
                        }
                        className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left text-sm font-semibold transition ${
                          draft.serviceId === s.id
                            ? "border-primary bg-accent text-accent-foreground"
                            : "border-border bg-card hover:bg-muted"
                        }`}
                      >
                        {s.name}
                        {draft.serviceId === s.id && <Check className="h-4 w-4" />}
                      </button>
                    ))}
                  </div>
                )}
                <Textarea
                  value={draft.description}
                  onChange={(e) => update({ description: e.target.value })}
                  maxLength={1000}
                  rows={3}
                  placeholder="Quer acrescentar algum detalhe? (opcional)"
                  className="rounded-xl text-base"
                  aria-label="Detalhes adicionais"
                />
              </div>
            )}
          </div>
        )}

        {showError && error && <p className="text-sm font-semibold text-destructive">{error}</p>}
        {draft.mode === "describe" && draft.description.trim().length > 0 && draft.description.trim().length < MIN_DESCRIPTION && (
          <p className="text-xs text-muted-foreground">Escreva um pouquinho mais para o profissional entender.</p>
        )}
      </section>

      <DraftPhotoPicker draft={draft} update={update} />
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-left text-sm font-bold transition ${
        active ? "border-primary bg-accent text-accent-foreground" : "border-border bg-card hover:bg-muted"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}



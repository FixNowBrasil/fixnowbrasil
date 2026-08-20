import { useMemo } from "react";
import { CalendarDays, Clock3, Zap } from "lucide-react";
import { Input } from "@/components/ui/input";
import { draftScheduledAt, type RequestDraft } from "@/lib/request-draft";

function localDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Horários de 30 em 30 minutos; no dia de hoje só mostra os que ainda vão acontecer. */
function buildTimes(dateKey: string) {
  const now = new Date();
  const isToday = dateKey === localDateKey(now);
  const minMinutes = isToday ? now.getHours() * 60 + now.getMinutes() : -1;
  const options: string[] = [];
  for (let m = 0; m < 24 * 60; m += 30) {
    if (m <= minMinutes) continue;
    options.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
  }
  return options;
}

export function WhenStep({
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
  const today = localDateKey(new Date());
  const times = useMemo(() => buildTimes(draft.date), [draft.date]);
  const scheduledAt = draftScheduledAt(draft);

  return (
    <section className="surface-card space-y-4 p-5">
      <div>
        <h1 className="font-display text-xl font-bold">Quando você precisa do serviço?</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Escolha quando gostaria que o profissional realizasse o serviço.
        </p>
      </div>

      <div className="grid gap-2">
        <OptionCard
          active={draft.when === "now"}
          onClick={() => update({ when: "now" })}
          icon={<Zap className="h-5 w-5" />}
          title="O mais rápido possível"
          description="Encontre alguém disponível para atender o quanto antes."
        />
        <OptionCard
          active={draft.when === "scheduled"}
          onClick={() => update({ when: "scheduled" })}
          icon={<CalendarDays className="h-5 w-5" />}
          title="Agendar"
          description="Escolha o melhor dia e horário para o serviço."
        />
      </div>

      {draft.when === "now" ? (
        <p className="rounded-xl bg-muted px-4 py-3 text-sm font-semibold">
          Vamos procurar profissionais disponíveis para atender o quanto antes.
        </p>
      ) : (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground" htmlFor="draft-date">
              Data
            </label>
            <Input
              id="draft-date"
              type="date"
              min={today}
              value={draft.date}
              onChange={(e) => update({ date: e.target.value, time: "" })}
              className="h-12 rounded-xl text-base"
              aria-label="Data do serviço"
            />
          </div>

          <div className="space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Horário</span>
            {!draft.date ? (
              <p className="text-sm text-muted-foreground">Escolha primeiro a data para ver os horários.</p>
            ) : times.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Não há mais horários hoje. Escolha outro dia.
              </p>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {times.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => update({ time: t })}
                    className={`rounded-xl border px-2 py-2 text-sm font-bold transition ${
                      draft.time === t
                        ? "border-primary bg-accent text-accent-foreground"
                        : "border-border bg-card hover:bg-muted"
                    }`}
                    aria-pressed={draft.time === t}
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>

          {scheduledAt && (
            <p className="flex items-center gap-2 rounded-xl bg-muted px-4 py-3 text-sm font-semibold">
              <Clock3 className="h-4 w-4" />
              {scheduledAt.toLocaleString("pt-BR", { dateStyle: "full", timeStyle: "short" })}
            </p>
          )}
        </div>
      )}

      {showError && error && <p className="text-sm font-semibold text-destructive">{error}</p>}
    </section>
  );
}

function OptionCard({
  active,
  onClick,
  icon,
  title,
  description,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-left transition ${
        active ? "border-primary bg-accent text-accent-foreground" : "border-border bg-card hover:bg-muted"
      }`}
    >
      <span className="mt-0.5 text-primary">{icon}</span>
      <span>
        <span className="block text-sm font-bold">{title}</span>
        <span className="block text-xs text-muted-foreground">{description}</span>
      </span>
    </button>
  );
}

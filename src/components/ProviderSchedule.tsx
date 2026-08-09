import { useEffect, useMemo, useState, type ReactNode } from "react";
import { CalendarDays, Plus, Save, Trash2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

const DAYS = [
  { key: "monday", label: "Segunda-feira" },
  { key: "tuesday", label: "Terça-feira" },
  { key: "wednesday", label: "Quarta-feira" },
  { key: "thursday", label: "Quinta-feira" },
  { key: "friday", label: "Sexta-feira" },
  { key: "saturday", label: "Sábado" },
  { key: "sunday", label: "Domingo" },
] as const;

type DayKey = (typeof DAYS)[number]["key"];
type DaySchedule = { enabled: boolean; start: string; end: string };
type ScheduleBlock = { id: string; date: string; start: string; end: string; reason: string };
type ScheduleData = { version: 1; weekly: Record<DayKey, DaySchedule>; blocks: ScheduleBlock[] };

const defaultWeekly = (): Record<DayKey, DaySchedule> =>
  Object.fromEntries(
    DAYS.map(({ key }) => [key, { enabled: key !== "sunday", start: "08:00", end: "18:00" }]),
  ) as Record<DayKey, DaySchedule>;

const emptySchedule = (): ScheduleData => ({ version: 1, weekly: defaultWeekly(), blocks: [] });

function parseSchedule(value: string | null | undefined): ScheduleData {
  if (!value) return emptySchedule();
  try {
    const parsed = JSON.parse(value) as Partial<ScheduleData>;
    if (parsed.version !== 1 || !parsed.weekly) return emptySchedule();
    return {
      version: 1,
      weekly: { ...defaultWeekly(), ...parsed.weekly },
      blocks: Array.isArray(parsed.blocks) ? parsed.blocks : [],
    };
  } catch {
    return emptySchedule();
  }
}

export function ProviderSchedule() {
  const { data: provider, isLoading } = useQuery({
    queryKey: ["my-provider-schedule"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("providers")
        .select("id, availability")
        .eq("user_id", userData.user?.id ?? "")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const queryClient = useQueryClient();
  const [schedule, setSchedule] = useState<ScheduleData>(emptySchedule());
  const [blockDate, setBlockDate] = useState("");
  const [blockStart, setBlockStart] = useState("08:00");
  const [blockEnd, setBlockEnd] = useState("18:00");
  const [blockReason, setBlockReason] = useState("");

  useEffect(() => {
    if (provider) setSchedule(parseSchedule(provider.availability));
  }, [provider]);

  const sortedBlocks = useMemo(
    () => [...schedule.blocks].sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`)),
    [schedule.blocks],
  );

  const save = useMutation({
    mutationFn: async () => {
      if (!provider?.id) throw new Error("provider");
      for (const day of DAYS) {
        const item = schedule.weekly[day.key];
        if (item.enabled && item.start >= item.end) throw new Error("horario");
      }
      const { error } = await supabase
        .from("providers")
        .update({ availability: JSON.stringify(schedule) })
        .eq("id", provider.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Agenda salva.");
      queryClient.invalidateQueries({ queryKey: ["my-provider-schedule"] });
      queryClient.invalidateQueries({ queryKey: ["my-provider-full"] });
      queryClient.invalidateQueries({ queryKey: ["provider"] });
      queryClient.invalidateQueries({ queryKey: ["providers"] });
    },
    onError: (error) => toast.error(error.message === "horario" ? "Confira os horários de cada dia." : "Não foi possível salvar a agenda."),
  });

  function updateDay(day: DayKey, patch: Partial<DaySchedule>) {
    setSchedule((current) => ({
      ...current,
      weekly: { ...current.weekly, [day]: { ...current.weekly[day], ...patch } },
    }));
  }

  function addBlock() {
    if (!blockDate || blockStart >= blockEnd) {
      toast.error("Informe uma data e um intervalo válido.");
      return;
    }
    const block: ScheduleBlock = {
      id: crypto.randomUUID(),
      date: blockDate,
      start: blockStart,
      end: blockEnd,
      reason: blockReason.trim() || "Indisponibilidade",
    };
    setSchedule((current) => ({ ...current, blocks: [...current.blocks, block] }));
    setBlockDate("");
    setBlockReason("");
  }

  if (isLoading) return <div className="h-72 animate-pulse rounded-2xl bg-muted" />;
  if (!provider) {
    return (
      <div className="surface-card p-6 text-center">
        <p className="font-bold">Crie seu perfil profissional primeiro.</p>
        <p className="mt-1 text-sm text-muted-foreground">Depois disso você poderá configurar sua agenda.</p>
      </div>
    );
  }

  return (
    <section className="space-y-5">
      <div className="surface-card space-y-4 p-5">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <CalendarDays className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-base font-bold">Disponibilidade semanal</h2>
            <p className="mt-1 text-sm text-muted-foreground">Defina quando você normalmente atende. Os horários podem ser ajustados depois na contratação.</p>
          </div>
        </div>

        <div className="space-y-2">
          {DAYS.map((day) => {
            const value = schedule.weekly[day.key];
            return (
              <div key={day.key} className="grid gap-3 rounded-xl border border-border p-3 sm:grid-cols-[1fr_120px_120px] sm:items-center">
                <label className="flex items-center gap-3 text-sm font-semibold">
                  <input
                    type="checkbox"
                    checked={value.enabled}
                    onChange={(e) => updateDay(day.key, { enabled: e.target.checked })}
                    className="h-4 w-4 rounded border-input"
                  />
                  {day.label}
                </label>
                <Field label="Início" id={`${day.key}-start`}>
                  <Input id={`${day.key}-start`} type="time" value={value.start} disabled={!value.enabled} onChange={(e) => updateDay(day.key, { start: e.target.value })} />
                </Field>
                <Field label="Fim" id={`${day.key}-end`}>
                  <Input id={`${day.key}-end`} type="time" value={value.end} disabled={!value.enabled} onChange={(e) => updateDay(day.key, { end: e.target.value })} />
                </Field>
              </div>
            );
          })}
        </div>
      </div>

      <div className="surface-card space-y-4 p-5">
        <div>
          <h2 className="font-display text-base font-bold">Bloquear horários</h2>
          <p className="mt-1 text-sm text-muted-foreground">Reserve períodos para compromissos pessoais, folgas ou qualquer outro motivo.</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_120px_120px_1fr_auto] lg:items-end">
          <Field label="Data" id="block-date">
            <Input id="block-date" type="date" value={blockDate} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setBlockDate(e.target.value)} />
          </Field>
          <Field label="Início" id="block-start">
            <Input id="block-start" type="time" value={blockStart} onChange={(e) => setBlockStart(e.target.value)} />
          </Field>
          <Field label="Fim" id="block-end">
            <Input id="block-end" type="time" value={blockEnd} onChange={(e) => setBlockEnd(e.target.value)} />
          </Field>
          <Field label="Motivo (opcional)" id="block-reason">
            <Input id="block-reason" value={blockReason} maxLength={80} placeholder="Ex.: compromisso pessoal" onChange={(e) => setBlockReason(e.target.value)} />
          </Field>
          <Button type="button" onClick={addBlock} className="font-bold">
            <Plus className="mr-2 h-4 w-4" /> Bloquear
          </Button>
        </div>

        {sortedBlocks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-5 text-center">
            <p className="text-sm font-semibold">Nenhum bloqueio cadastrado.</p>
            <p className="mt-1 text-xs text-muted-foreground">Seus horários semanais continuam disponíveis normalmente.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {sortedBlocks.map((block) => (
              <li key={block.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">{new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(new Date(`${block.date}T12:00:00`))}</p>
                  <p className="text-xs text-muted-foreground">{block.start}–{block.end} · {block.reason}</p>
                </div>
                <Button type="button" size="icon" variant="ghost" className="text-destructive hover:text-destructive" aria-label="Remover bloqueio" onClick={() => setSchedule((current) => ({ ...current, blocks: current.blocks.filter((item) => item.id !== block.id) }))}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Button className="w-full font-extrabold" disabled={save.isPending} onClick={() => save.mutate()}>
        <Save className="mr-2 h-4 w-4" />
        {save.isPending ? "Salvando..." : "Salvar agenda"}
      </Button>
    </section>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

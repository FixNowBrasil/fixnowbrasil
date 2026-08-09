import { useMemo, useState } from "react";
import { CalendarDays, Check, Clock3 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const DAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;
type DayKey = (typeof DAYS)[number];
type DaySchedule = { enabled: boolean; start: string; end: string };
type ScheduleBlock = { date: string; start: string; end: string };
type ScheduleData = { version: 1; weekly: Record<DayKey, DaySchedule>; blocks: ScheduleBlock[] };

type Props = {
  requestId: string;
  providerId: string;
  clientId: string;
  availability: string | null;
  currentScheduledAt: string | null;
};

function parseSchedule(value: string | null): ScheduleData | null {
  try {
    const parsed = JSON.parse(value ?? "") as ScheduleData;
    return parsed.version === 1 && parsed.weekly ? parsed : null;
  } catch {
    return null;
  }
}

function minutes(value: string) {
  const [hours, minutesValue] = value.split(":").map(Number);
  return hours * 60 + minutesValue;
}

function isBlocked(blocks: ScheduleBlock[], date: string, start: number, end: number) {
  return blocks.some(
    (block) => block.date === date && start < minutes(block.end) && end > minutes(block.start),
  );
}

function localDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function localDateTime(date: string, time: string) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

export function ClientSchedulePicker({
  requestId,
  providerId,
  clientId,
  availability,
  currentScheduledAt,
}: Props) {
  const schedule = useMemo(() => parseSchedule(availability), [availability]);
  const queryClient = useQueryClient();
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);

  const occupiedQuery = useQuery({
    queryKey: ["provider-scheduled-slots", providerId],
    enabled: !!providerId,
    queryFn: async () => {
      const from = new Date();
      const to = new Date(from);
      to.setDate(to.getDate() + 21);
      const { data, error } = await supabase
        .from("service_requests")
        .select("scheduled_at")
        .eq("provider_id", providerId)
        .neq("status", "cancelled")
        .gte("scheduled_at", from.toISOString())
        .lt("scheduled_at", to.toISOString());
      if (error) throw error;
      return new Set((data ?? []).map((row) => row.scheduled_at).filter(Boolean) as string[]);
    },
  });

  const dates = useMemo(() => {
    if (!schedule) return [] as Date[];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Array.from({ length: 21 }, (_, index) => {
      const current = new Date(today);
      current.setDate(today.getDate() + index);
      return current;
    }).filter((current) => schedule.weekly[DAYS[current.getDay()]]?.enabled);
  }, [schedule]);

  const slots = useMemo(() => {
    if (!date || !schedule) return [] as string[];
    const currentDate = localDateTime(date, "12:00");
    const config = schedule.weekly[DAYS[currentDate.getDay()]];
    if (!config?.enabled) return [] as string[];
    const result: string[] = [];
    const now = new Date();
    const start = minutes(config.start);
    const end = minutes(config.end);
    for (let minute = start; minute + 60 <= end; minute += 60) {
      const value = `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
      const slotDate = localDateTime(date, value);
      if (
        slotDate <= now ||
        isBlocked(schedule.blocks, date, minute, minute + 60) ||
        occupiedQuery.data?.has(slotDate.toISOString())
      ) {
        continue;
      }
      result.push(value);
    }
    return result;
  }, [date, schedule, occupiedQuery.data]);

  const save = useMutation({
    mutationFn: async () => {
      if (!date || !time) throw new Error("slot");
      const scheduledAt = localDateTime(date, time).toISOString();
      const { data, error } = await supabase
        .from("service_requests")
        .update({
          scheduled_at: scheduledAt,
          when_option: "date",
          updated_at: new Date().toISOString(),
        })
        .eq("id", requestId)
        .eq("client_id", clientId)
        .eq("provider_id", providerId)
        .eq("status", "confirmed")
        .select("id")
        .single();
      if (error) {
        if (error.code === "23505") throw new Error("occupied");
        throw error;
      }
      if (!data) throw new Error("not_found");
    },
    onSuccess: () => {
      toast.success("Horário confirmado.");
      queryClient.invalidateQueries({ queryKey: ["request", requestId] });
      queryClient.invalidateQueries({ queryKey: ["provider-scheduled-slots", providerId] });
      setTime(null);
    },
    onError: (error) => {
      toast.error(
        error.message === "occupied"
          ? "Esse horário já foi reservado. Escolha outro."
          : "Não foi possível confirmar o horário.",
      );
    },
  });

  if (!schedule) {
    return (
      <section className="surface-card p-5">
        <h2 className="font-display text-base font-bold">Agendar serviço</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Este prestador ainda não configurou uma agenda.
        </p>
      </section>
    );
  }

  if (currentScheduledAt) {
    return (
      <section className="surface-card space-y-2 p-5">
        <div className="flex items-center gap-2 font-display text-base font-bold">
          <Check className="h-5 w-5 text-success" />
          Horário agendado
        </div>
        <p className="text-sm text-muted-foreground">
          {new Intl.DateTimeFormat("pt-BR", {
            dateStyle: "full",
            timeStyle: "short",
          }).format(new Date(currentScheduledAt))}
        </p>
      </section>
    );
  }

  return (
    <section className="surface-card space-y-5 p-5">
      <div>
        <div className="flex items-center gap-2 font-display text-base font-bold">
          <CalendarDays className="h-5 w-5 text-primary" />
          Escolha data e horário
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Somente horários disponíveis na agenda deste prestador.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {dates.slice(0, 15).map((current) => {
          const value = localDateKey(current);
          const selected = value === date;
          return (
            <button
              key={value}
              type="button"
              onClick={() => {
                setDate(value);
                setTime(null);
              }}
              className={`rounded-xl border px-2 py-3 text-center text-sm font-bold ${
                selected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card hover:border-primary/50"
              }`}
            >
              {new Intl.DateTimeFormat("pt-BR", {
                weekday: "short",
                day: "2-digit",
                month: "2-digit",
              })
                .format(current)
                .replace(".", "")}
            </button>
          );
        })}
      </div>

      {date && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold">
            <Clock3 className="h-4 w-4" />
            Horários disponíveis
          </div>
          {slots.length ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {slots.map((slot) => (
                <button
                  key={slot}
                  type="button"
                  onClick={() => setTime(slot)}
                  className={`rounded-xl border px-3 py-3 text-sm font-extrabold ${
                    time === slot
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  {slot}
                </button>
              ))}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
              Não há horários disponíveis nesta data.
            </p>
          )}
          <Button
            className="w-full font-extrabold"
            disabled={!time || save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending ? "Confirmando..." : "Confirmar horário"}
          </Button>
        </div>
      )}
    </section>
  );
}

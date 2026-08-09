import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ProviderSchedule } from "@/components/ProviderSchedule";

export const Route = createFileRoute("/_authenticated/agenda")({
  head: () => ({
    meta: [
      { title: "Minha agenda — FixNow" },
      { name: "description", content: "Configure seus horários e bloqueios de disponibilidade." },
    ],
  }),
  component: AgendaPage,
});

function AgendaPage() {
  return (
    <AppShell>
      <div className="mx-auto w-full max-w-4xl space-y-5 px-4 py-6">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <CalendarDays className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-extrabold">Minha agenda</h1>
            <p className="mt-1 text-sm text-muted-foreground">Controle seus dias e horários de atendimento.</p>
          </div>
        </div>
        <ProviderSchedule />
      </div>
    </AppShell>
  );
}

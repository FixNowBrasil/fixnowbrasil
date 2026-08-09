import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { Home, Search, ClipboardList, Heart, User, Wrench, LogOut, Shield, Briefcase, ArrowLeftRight, CalendarDays, Images } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { RequestPhotoSlot } from "@/components/RequestPhotoSlot";
import { NotificationBell } from "@/components/NotificationBell";

export function FixNowLogo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-[var(--shadow-glow)]">
        <Wrench className="h-5 w-5" strokeWidth={2.5} />
      </span>
      <span className="font-display text-xl font-extrabold tracking-tight">
        Fix<span className="text-primary">Now</span>
      </span>
    </span>
  );
}

const NAV = [
  { to: "/", label: "Início", icon: Home, exact: true },
  { to: "/buscar", label: "Buscar", icon: Search, exact: false },
  { to: "/pedidos", label: "Pedidos", icon: ClipboardList, exact: false },
  { to: "/favoritos", label: "Favoritos", icon: Heart, exact: false },
  { to: "/perfil", label: "Perfil", icon: User, exact: false },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { user, isAdmin, isProvider } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const providerProfile = useQuery({
    queryKey: ["my-provider", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("providers")
        .select("id")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const hasProviderProfile = !!providerProfile.data;
  const inProviderMode = pathname.startsWith("/painel") || pathname.startsWith("/cadastro-prestador") || pathname.startsWith("/agenda") || pathname.startsWith("/fotos-prestador");
  const requestId = pathname.startsWith("/pedidos/") ? pathname.split("/")[2] : null;

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  function switchMode() {
    if (inProviderMode) {
      navigate({ to: "/" });
      return;
    }
    navigate({ to: hasProviderProfile ? "/painel" : "/cadastro-prestador" });
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-4 px-4">
          <Link to="/" className="shrink-0">
            <FixNowLogo />
          </Link>
          <nav className="ml-4 hidden items-center gap-1 md:flex">
            {NAV.slice(0, 4).map((item) => (
              <Link
                key={item.to}
                to={item.to}
                activeOptions={{ exact: item.exact }}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground data-[status=active]:bg-accent data-[status=active]:text-accent-foreground"
              >
                {item.label}
              </Link>
            ))}
            {isProvider && (
              <>
                <Link
                  to="/painel"
                  className="rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground data-[status=active]:bg-accent data-[status=active]:text-accent-foreground"
                >
                  <Briefcase className="mr-1 inline h-4 w-4" />
                  Painel
                </Link>
                <Link
                  to="/agenda"
                  className="rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground data-[status=active]:bg-accent data-[status=active]:text-accent-foreground"
                >
                  <CalendarDays className="mr-1 inline h-4 w-4" />
                  Agenda
                </Link>
                <Link
                  to="/fotos-prestador"
                  className="rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground data-[status=active]:bg-accent data-[status=active]:text-accent-foreground"
                >
                  <Images className="mr-1 inline h-4 w-4" />
                  Fotos
                </Link>
              </>
            )}
            {isAdmin && (
              <Link
                to="/admin"
                className="rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground data-[status=active]:bg-accent data-[status=active]:text-accent-foreground"
              >
                <Shield className="mr-1 inline h-4 w-4" />
                Admin
              </Link>
            )}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {user ? (
              <>
                <NotificationBell />
                <Button variant="outline" size="sm" onClick={switchMode} className="font-semibold">
                  <ArrowLeftRight className="h-4 w-4" />
                  <span className="hidden sm:inline">
                    {inProviderMode ? "Modo cliente" : hasProviderProfile ? "Modo prestador" : "Quero ser prestador"}
                  </span>
                </Button>
                <Link to="/perfil" className="hidden sm:block">
                  <Button variant="ghost" size="sm" className="font-semibold">
                    <User className="h-4 w-4" />
                    Minha conta
                  </Button>
                </Link>
                <Button variant="outline" size="sm" onClick={signOut} className="font-semibold">
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">Sair</span>
                </Button>
              </>
            ) : (
              <Link to="/auth">
                <Button size="sm" className="font-semibold">
                  Entrar
                </Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 pb-24 md:pb-10">
        {requestId && (
          <div className="mx-auto w-full max-w-2xl px-4 pt-5">
            <RequestPhotoSlot requestId={requestId} />
          </div>
        )}
        {children}
      </main>

      <footer className="hidden border-t border-border bg-muted/40 py-8 md:block">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 text-sm text-muted-foreground">
          <FixNowLogo />
          <p>Precisou? FixNow. Marketplace de serviços do dia a dia.</p>
          <p className="text-xs">Dados de demonstração — profissionais fictícios.</p>
        </div>
      </footer>

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 backdrop-blur-xl md:hidden">
        <div className="mx-auto grid max-w-md grid-cols-5">
          {NAV.map((item) => {
            const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold transition-colors",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="h-5 w-5" strokeWidth={active ? 2.6 : 2} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

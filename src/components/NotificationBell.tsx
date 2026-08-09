import { useEffect, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type Notification = { id: string; title: string; body: string | null; link: string | null; read: boolean; created_at: string };

export function NotificationBell() {
  const { user } = useAuth();
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  async function load() {
    if (!user) return;
    const { data, error } = await supabase.from("notifications").select("id,title,body,link,read,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(30);
    if (!error) setItems((data ?? []) as Notification[]);
  }

  useEffect(() => {
    void load();
    if (!user) return;
    const channel = supabase.channel(`notifications:${user.id}`).on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, () => void load()).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [user?.id]);

  const unread = items.filter((item) => !item.read).length;

  async function markRead(id: string) {
    await supabase.from("notifications").update({ read: true }).eq("id", id).eq("user_id", user!.id);
    setItems((current) => current.map((item) => item.id === id ? { ...item, read: true } : item));
  }

  async function markAllRead() {
    await supabase.from("notifications").update({ read: true }).eq("user_id", user!.id).eq("read", false);
    setItems((current) => current.map((item) => ({ ...item, read: true })));
  }

  async function openNotification(item: Notification) {
    await markRead(item.id);
    if (item.link) window.location.assign(item.link);
  }

  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild><Button variant="ghost" size="icon" className="relative" aria-label={`Notificações${unread ? `, ${unread} não lidas` : ""}`}><Bell className="h-5 w-5" />{unread > 0 && <span className="absolute right-1 top-1 min-w-4 rounded-full bg-primary px-1 text-[10px] font-bold leading-4 text-primary-foreground">{unread > 9 ? "9+" : unread}</span>}</Button></PopoverTrigger>
    <PopoverContent align="end" className="w-[min(380px,calc(100vw-2rem))] p-0">
      <div className="flex items-center justify-between border-b px-4 py-3"><div><p className="font-bold">Notificações</p><p className="text-xs text-muted-foreground">{unread ? `${unread} não lida${unread > 1 ? "s" : ""}` : "Tudo em dia"}</p></div>{unread > 0 && <Button variant="ghost" size="sm" onClick={() => void markAllRead()}><CheckCheck className="mr-1 h-4 w-4" /> Ler todas</Button>}</div>
      <div className="max-h-[420px] overflow-auto">{items.length ? items.map((item) => <button key={item.id} type="button" onClick={() => void openNotification(item)} className={cn("w-full border-b px-4 py-3 text-left transition hover:bg-muted", !item.read && "bg-primary/5")}><p className="text-sm font-semibold">{item.title}</p><p className="mt-1 text-sm text-muted-foreground">{item.body ?? ""}</p><p className="mt-1 text-[11px] text-muted-foreground">{new Date(item.created_at).toLocaleString("pt-BR")}</p></button>) : <div className="p-8 text-center text-sm text-muted-foreground">Você ainda não tem notificações.</div>}</div>
    </PopoverContent>
  </Popover>;
}

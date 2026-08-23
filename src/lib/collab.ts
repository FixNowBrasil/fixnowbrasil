import { supabase } from "@/integrations/supabase/client";

export type Quote = {
  id: string;
  request_id: string;
  provider_id: string;
  amount: number;
  estimated_time: string | null;
  message: string | null;
  status: string;
  created_at: string;
};

export type Message = {
  id: string;
  request_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

export type Notification = {
  id: string;
  user_id: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
};

export const quotesQuery = (requestId: string) => ({
  queryKey: ["quotes", requestId],
  queryFn: async (): Promise<Quote[]> => {
    const { data, error } = await supabase
      .from("quotes")
      .select("*")
      .eq("request_id", requestId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as Quote[];
  },
});

export type QuoteWithProvider = Quote & {
  providers: {
    id: string;
    name: string;
    avatar_url: string | null;
    rating: number;
    reviews_count: number;
    distance_km: number | null;
    verified: boolean;
  } | null;
};

export const quotesWithProvidersQuery = (requestId: string) => ({
  queryKey: ["quotes", requestId, "providers"],
  refetchInterval: 15000,
  queryFn: async (): Promise<QuoteWithProvider[]> => {
    const { data, error } = await supabase
      .from("quotes")
      .select(
        "*, providers(id, name, avatar_url, rating, reviews_count, distance_km, verified)",
      )
      .eq("request_id", requestId)
      .order("amount");
    if (error) throw error;
    return (data ?? []) as unknown as QuoteWithProvider[];
  },
});

export const messagesQuery = (requestId: string) => ({
  queryKey: ["messages", requestId],
  queryFn: async (): Promise<Message[]> => {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("request_id", requestId)
      .order("created_at");
    if (error) throw error;
    return (data ?? []) as Message[];
  },
  refetchInterval: 8000,
});

export const notificationsQuery = (userId: string | undefined) => ({
  queryKey: ["notifications", userId ?? "none"],
  enabled: !!userId,
  refetchInterval: 20000,
  queryFn: async (): Promise<Notification[]> => {
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw error;
    return (data ?? []) as Notification[];
  },
});

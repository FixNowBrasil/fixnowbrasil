import { supabase } from "@/integrations/supabase/client";

export type Category = {
  id: string;
  slug: string;
  name: string;
  emoji: string;
  icon: string;
  description: string | null;
  sort_order: number;
};

export type Service = {
  id: string;
  category_id: string;
  slug: string;
  name: string;
  description: string | null;
  price_from: number;
  popular: boolean;
};

export type Provider = {
  id: string;
  user_id: string | null;
  name: string;
  avatar_url: string | null;
  headline: string | null;
  bio: string | null;
  category_id: string | null;
  city: string;
  neighborhood: string | null;
  distance_km: number;
  radius_km: number;
  years_experience: number;
  price_from: number;
  rating: number;
  reviews_count: number;
  jobs_done: number;
  verified: boolean;
  available_now: boolean;
  approved: boolean;
  work_photos: string[];
  availability: string;
};

export type Review = {
  id: string;
  provider_id: string;
  author_name: string;
  rating: number;
  punctuality: number;
  quality: number;
  service: number;
  comment: string | null;
  created_at: string;
};

export const REQUEST_STEPS = [
  { key: "sent", label: "Solicitação enviada" },
  { key: "analyzing", label: "Prestador analisando" },
  { key: "confirmed", label: "Serviço confirmado" },
  { key: "on_the_way", label: "Prestador a caminho" },
  { key: "in_progress", label: "Serviço em andamento" },
  { key: "completed", label: "Serviço concluído" },
  { key: "rated", label: "Avaliação" },
] as const;

export type RequestStatus = (typeof REQUEST_STEPS)[number]["key"] | "cancelled";

export type ServiceRequest = {
  id: string;
  client_id: string;
  provider_id: string | null;
  service_id: string | null;
  category_id: string | null;
  need: string | null;
  description: string;
  photos: string[];
  when_option: string;
  scheduled_at: string | null;
  address: string;
  status: RequestStatus;
  price_estimate: number | null;
  created_at: string;
};

export const brl = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);

export const WHEN_OPTIONS = [
  { value: "now", label: "Agora" },
  { value: "today", label: "Hoje" },
  { value: "tomorrow", label: "Amanhã" },
  { value: "date", label: "Escolher data" },
];

export const NEEDS_BY_CATEGORY: Record<string, string[]> = {
  instalacoes: ["Instalar TV na parede", "Instalar suporte", "Retirar TV antiga", "Outro"],
  eletrica: ["Tomada não funciona", "Instalar ventilador", "Trocar chuveiro", "Outro"],
  hidraulica: ["Vazamento", "Entupimento", "Trocar torneira", "Outro"],
  "ar-condicionado": ["Instalar split", "Limpar aparelho", "Não está gelando", "Outro"],
  montagem: ["Montar guarda-roupa", "Montar cama", "Desmontar para mudança", "Outro"],
  limpeza: ["Faxina completa", "Limpeza pós-obra", "Limpeza semanal", "Outro"],
  jardinagem: ["Cortar grama", "Podar árvores", "Dedetização", "Outro"],
  tecnologia: ["Computador lento", "Instalar Wi-Fi", "Recuperar arquivos", "Outro"],
  chaveiro: ["Abrir porta", "Trocar segredo", "Instalar fechadura", "Outro"],
  pintura: ["Pintar um cômodo", "Pintar fachada", "Textura decorativa", "Outro"],
  reparos: ["Furar parede", "Consertar porta", "Trocar silicone", "Outro"],
  outros: ["Descrever no próximo passo"],
};

/* ---------------- queries ---------------- */

export const categoriesQuery = {
  queryKey: ["categories"],
  queryFn: async (): Promise<Category[]> => {
    const { data, error } = await supabase.from("categories").select("*").order("sort_order");
    if (error) throw error;
    return (data ?? []) as Category[];
  },
};

export const popularServicesQuery = {
  queryKey: ["services", "popular"],
  queryFn: async (): Promise<Service[]> => {
    const { data, error } = await supabase
      .from("services")
      .select("*")
      .eq("popular", true)
      .order("name");
    if (error) throw error;
    return (data ?? []) as Service[];
  },
};

export const allServicesQuery = {
  queryKey: ["services", "all"],
  queryFn: async (): Promise<Service[]> => {
    const { data, error } = await supabase.from("services").select("*").order("name");
    if (error) throw error;
    return (data ?? []) as Service[];
  },
};

export const providersQuery = (categoryId?: string) => ({
  queryKey: ["providers", categoryId ?? "all"],
  queryFn: async (): Promise<Provider[]> => {
    let q = supabase.from("providers").select("*").eq("approved", true);
    if (categoryId) q = q.eq("category_id", categoryId);
    const { data, error } = await q.order("rating", { ascending: false });
    if (error) throw error;
    return (data ?? []) as Provider[];
  },
});

export const providerQuery = (id: string) => ({
  queryKey: ["provider", id],
  queryFn: async (): Promise<Provider | null> => {
    const { data, error } = await supabase.from("providers").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data as Provider | null;
  },
});

export const providerReviewsQuery = (id: string) => ({
  queryKey: ["reviews", id],
  queryFn: async (): Promise<Review[]> => {
    const { data, error } = await supabase
      .from("reviews")
      .select("*")
      .eq("provider_id", id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as Review[];
  },
});

export const providerServicesQuery = (id: string) => ({
  queryKey: ["provider-services", id],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("provider_services")
      .select("id, service_id, price_from, services(id, name, slug, description)")
      .eq("provider_id", id);
    if (error) throw error;
    return data ?? [];
  },
});

export {
  canTransitionRequestStatus,
  getNextRequestStatuses,
  REQUEST_STATUS_TRANSITIONS,
} from "./request-lifecycle";

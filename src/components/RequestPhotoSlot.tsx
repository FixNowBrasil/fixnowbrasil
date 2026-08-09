import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { RequestPhotoUploader } from "@/components/RequestPhotoUploader";

export function RequestPhotoSlot({ requestId }: { requestId: string }) {
  const { user } = useAuth();
  const request = useQuery({
    queryKey: ["request-photos", requestId, user?.id],
    enabled: !!user && !!requestId,
    queryFn: async () => {
      const { data, error } = await supabase.from("service_requests").select("client_id, photos").eq("id", requestId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  if (!user || request.isLoading || request.data?.client_id !== user.id) return null;
  return <RequestPhotoUploader requestId={requestId} userId={user.id} photos={(request.data.photos ?? []) as string[]} />;
}

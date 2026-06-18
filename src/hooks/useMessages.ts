import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type DbMessage = Tables<"messages">;

export function useMessages(clientId?: string) {
  const query = useQuery({
    queryKey: ["messages", clientId ?? "all"],
    queryFn: async () => {
      const q = supabase.from("messages").select("*").order("created_at", { ascending: true });
      if (clientId) q.eq("client_id", clientId);
      const { data, error } = await q;
      if (error) throw error;
      return data as DbMessage[];
    },
  });

  return query;
}

export function useUnreadMessages() {
  const query = useQuery({
    queryKey: ["messages-unread"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("id, client_id")
        .eq("read", false)
        .eq("direction", "inbound");
      if (error) throw error;
      return data;
    },
  });

  return query;
}

export function useMarkConversationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (clientId: string) => {
      const { error } = await supabase
        .from("messages")
        .update({ read: true })
        .eq("client_id", clientId)
        .eq("read", false)
        .eq("direction", "inbound");
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["messages-unread"] });
    },
  });
}

export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      client_id: string;
      to: string;
      message: string;
      media_urls?: string[];
    }) => {
      const { data, error } = await supabase.functions.invoke("send-sms", {
        body: params,
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) {
        throw new Error((data as { error: string }).error);
      }
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["messages"] });
    },
  });
}

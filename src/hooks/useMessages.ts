import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type DbMessage = Tables<"messages">;

export function useMessages(clientId?: string) {
  const qc = useQueryClient();

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

  // Realtime subscription globale
  useEffect(() => {
    const channel = supabase
      .channel("messages-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        (payload) => {
          qc.invalidateQueries({ queryKey: ["messages"] });
          qc.invalidateQueries({ queryKey: ["messages-unread"] });

          // OneSignal push for new inbound (received) messages
          if (
            payload.eventType === "INSERT" &&
            (payload.new as DbMessage | undefined)?.direction === "inbound"
          ) {
            const body =
              (payload.new as DbMessage | undefined)?.body ??
              "Vous avez un nouveau message";
            const url = window.location.origin + "/messagerie";
            try {
              // SDK v16 — show a local notification if permission granted
              const OneSignal = (window as any).OneSignal;
              if (OneSignal?.Notifications?.permission) {
                if ("Notification" in window && Notification.permission === "granted") {
                  new Notification("💬 Nouveau message reçu", {
                    body,
                    icon: "/favicon.ico",
                    data: { url },
                  });
                }
              } else if ("Notification" in window && Notification.permission === "granted") {
                new Notification("💬 Nouveau message reçu", {
                  body,
                  icon: "/favicon.ico",
                  data: { url },
                });
              }
            } catch (err) {
              console.warn("OneSignal notification failed:", err);
            }
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  return query;
}

export function useUnreadMessages() {
  const qc = useQueryClient();

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

  useEffect(() => {
    const channel = supabase
      .channel("messages-unread-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        () => qc.invalidateQueries({ queryKey: ["messages-unread"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

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

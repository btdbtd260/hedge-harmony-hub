import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type DbMessage = Tables<"messages">;

export function useRealtimeSubscriptions() {
  const qc = useQueryClient();

  useEffect(() => {
    // 1) invalidate messages + unread on any messages change
    const messagesChannel = supabase
      .channel("messages-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        (payload) => {
          qc.invalidateQueries({ queryKey: ["messages"] });
          qc.invalidateQueries({ queryKey: ["messages-unread"] });

          // OneSignal push for new inbound messages
          if (
            payload.eventType === "INSERT" &&
            (payload.new as DbMessage | undefined)?.direction === "inbound"
          ) {
            const body =
              (payload.new as DbMessage | undefined)?.body ??
              "Vous avez un nouveau message";
            const url = window.location.origin + "/messagerie";
            try {
              const OneSignal = (window as any).OneSignal;
              if (OneSignal?.Notifications?.permission) {
                if ("Notification" in window && Notification.permission === "granted") {
                  new Notification("Nouveau message reçu", {
                    body,
                    icon: "/favicon.ico",
                    data: { url },
                  });
                }
              } else if ("Notification" in window && Notification.permission === "granted") {
                new Notification("Nouveau message reçu", {
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

    // 2) invalidate unread count only
    const unreadChannel = supabase
      .channel("messages-unread-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        () => qc.invalidateQueries({ queryKey: ["messages-unread"] }),
      )
      .subscribe();

    // 3) Toast for inbound SMS (only on INSERT + inbound)
    const inboundChannel = supabase
      .channel("global-inbound-messages")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: "direction=eq.inbound",
        },
        async (payload) => {
          const msg = payload.new as { client_id: string; body: string };
          let clientName = "Client";
          try {
            const { data } = await supabase
              .from("customers")
              .select("name")
              .eq("id", msg.client_id)
              .maybeSingle();
            if (data?.name) clientName = data.name;
          } catch {
            // ignore
          }
          toast(`Nouveau SMS de ${clientName}`, {
            description: msg.body?.slice(0, 80) ?? "(média uniquement)",
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(unreadChannel);
      supabase.removeChannel(inboundChannel);
    };
  }, [qc]);
}

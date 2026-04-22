import { useEffect, useRef, useState } from "react";
import { Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  useMessages,
  useSendMessage,
  useMarkConversationRead,
} from "@/hooks/useMessages";
import type { DbCustomer } from "@/hooks/useSupabaseData";
import { formatPhone } from "@/lib/phoneFormat";

interface ChatPanelProps {
  client: DbCustomer;
}

export function ChatPanel({ client }: ChatPanelProps) {
  const { data: messages = [] } = useMessages(client.id);
  const sendMutation = useSendMessage();
  const markRead = useMarkConversationRead();
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Marquer lu à l'ouverture / changement de client
  useEffect(() => {
    markRead.mutate(client.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client.id]);

  // Marquer lu quand de nouveaux messages arrivent dans la conv ouverte
  useEffect(() => {
    if (messages.some((m) => !m.read && m.direction === "inbound")) {
      markRead.mutate(client.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  // Auto-scroll en bas
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const handleSend = async () => {
    const body = text.trim();
    if (!body) return;
    try {
      await sendMutation.mutateAsync({
        client_id: client.id,
        to: client.phone,
        message: body,
      });
      setText("");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Échec envoi";
      toast.error(msg);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b bg-card">
        <div className="font-semibold">{client.name}</div>
        <div className="text-xs text-muted-foreground">{formatPhone(client.phone)}</div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1">
        <div ref={scrollRef} className="p-4 space-y-3 max-w-3xl mx-auto">
          {messages.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-12">
              Aucun message. Envoyez-en un pour commencer.
            </p>
          )}
          {messages.map((m) => {
            const mine = m.direction === "outbound";
            return (
              <div
                key={m.id}
                className={cn("flex", mine ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[70%] rounded-2xl px-3 py-2 text-sm",
                    mine
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-muted text-foreground rounded-bl-sm",
                    m.status === "failed" && "bg-destructive text-destructive-foreground",
                  )}
                >
                  {m.body && <div className="whitespace-pre-wrap break-words">{m.body}</div>}
                  {m.media_urls && m.media_urls.length > 0 && (
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {m.media_urls.map((url, i) => (
                        <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                          <img
                            src={url}
                            alt="média"
                            className="rounded-md max-h-40 object-cover"
                          />
                        </a>
                      ))}
                    </div>
                  )}
                  <div
                    className={cn(
                      "text-[10px] mt-1 opacity-70",
                      mine ? "text-right" : "text-left",
                    )}
                  >
                    {new Date(m.created_at).toLocaleString("fr-CA", {
                      hour: "2-digit",
                      minute: "2-digit",
                      day: "2-digit",
                      month: "2-digit",
                    })}
                    {m.status === "failed" && " · échec"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* Composer */}
      <div className="border-t p-3 bg-card">
        <div className="flex gap-2 max-w-3xl mx-auto">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Écrire un message..."
            className="min-h-[48px] max-h-32 resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <Button
            type="button"
            onClick={handleSend}
            disabled={!text.trim() || sendMutation.isPending}
            size="icon"
            className="h-12 w-12 shrink-0"
          >
            {sendMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

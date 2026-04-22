import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Send, Loader2, Paperclip, X, FileText, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  useMessages,
  useSendMessage,
  useMarkConversationRead,
} from "@/hooks/useMessages";
import type { DbCustomer } from "@/hooks/useSupabaseData";
import { formatPhone } from "@/lib/phoneFormat";
import { useIsBlocked } from "@/hooks/useBlockedNumbers";
import { supabase } from "@/integrations/supabase/client";

interface ChatPanelProps {
  client: DbCustomer;
}

export function ChatPanel({ client }: ChatPanelProps) {
  const { data: messages = [] } = useMessages(client.id);
  const sendMutation = useSendMessage();
  const markRead = useMarkConversationRead();
  const isBlocked = useIsBlocked(client.phone);
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Limites de sécurité
  const MAX_FILES = 5;
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 Mo (limite MMS Twilio)
  const ALLOWED_TYPES = [
    "image/jpeg", "image/png", "image/gif", "image/webp",
    "application/pdf",
    "video/mp4", "video/quicktime",
  ];

  // Marquer lu à l'ouverture / changement de client
  useEffect(() => {
    markRead.mutate(client.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client.id]);

  // Marquer lu dès qu'il existe un inbound non lu dans la conv ouverte
  const hasUnreadInbound = messages.some((m) => !m.read && m.direction === "inbound");
  useEffect(() => {
    if (hasUnreadInbound) {
      markRead.mutate(client.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasUnreadInbound, client.id]);

  // Auto-scroll en bas: useLayoutEffect pour scroller AVANT la peinture
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, client.id]);

  // Reset attachments quand on change de client
  useEffect(() => {
    setAttachments([]);
  }, [client.id]);

  const handleFilesSelected = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const incoming = Array.from(files);
    const errors: string[] = [];
    const accepted: File[] = [];

    for (const f of incoming) {
      if (!ALLOWED_TYPES.includes(f.type)) {
        errors.push(`${f.name}: type non supporté`);
        continue;
      }
      if (f.size > MAX_FILE_SIZE) {
        errors.push(`${f.name}: dépasse 5 Mo`);
        continue;
      }
      accepted.push(f);
    }

    setAttachments((prev) => {
      const combined = [...prev, ...accepted];
      if (combined.length > MAX_FILES) {
        errors.push(`Maximum ${MAX_FILES} fichiers`);
        return combined.slice(0, MAX_FILES);
      }
      return combined;
    });

    if (errors.length > 0) toast.error(errors.join(" · "));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = (idx: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  const uploadAttachments = async (): Promise<string[]> => {
    if (attachments.length === 0) return [];
    const urls: string[] = [];
    for (const file of attachments) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${client.id}/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
      const { error: upErr } = await supabase.storage
        .from("message-media")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw new Error(`Upload échoué: ${upErr.message}`);
      const { data } = supabase.storage.from("message-media").getPublicUrl(path);
      urls.push(data.publicUrl);
    }
    return urls;
  };

  const handleSend = async () => {
    const body = text.trim();
    if (!body && attachments.length === 0) return;
    if (isBlocked) {
      toast.error("Ce numéro est bloqué — débloquez-le pour envoyer un message.");
      return;
    }
    try {
      let media_urls: string[] = [];
      if (attachments.length > 0) {
        setUploading(true);
        media_urls = await uploadAttachments();
        setUploading(false);
      }
      await sendMutation.mutateAsync({
        client_id: client.id,
        to: client.phone,
        message: body,
        media_urls,
      });
      setText("");
      setAttachments([]);
    } catch (e) {
      setUploading(false);
      const msg = e instanceof Error ? e.message : "Échec envoi";
      toast.error(msg);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="px-4 py-3 border-b bg-card shrink-0">
        <div className="font-semibold">{client.name}</div>
        <div className="text-xs text-muted-foreground">{formatPhone(client.phone)}</div>
      </div>

      {isBlocked && (
        <div className="px-4 py-2 bg-destructive/10 border-b border-destructive/20 text-xs text-destructive flex items-center gap-2 shrink-0">
          <ShieldOff className="h-3.5 w-3.5" />
          Ce numéro est bloqué — l'envoi est désactivé.
        </div>
      )}

      {/* Messages — zone scrollable INTERNE (overflow-y-auto + min-h-0) */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain"
      >
        <div className="p-4 space-y-3 max-w-3xl mx-auto">
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
      </div>

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
            disabled={!text.trim() || sendMutation.isPending || isBlocked}
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

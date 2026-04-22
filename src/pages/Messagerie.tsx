import { useEffect, useMemo, useState } from "react";
import { Search, MessageSquare, ShieldOff, ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useCustomers } from "@/hooks/useSupabaseData";
import { useMessages, useUnreadMessages } from "@/hooks/useMessages";
import { ChatPanel } from "@/components/messagerie/ChatPanel";
import { BlockedNumbersTab } from "@/components/messagerie/BlockedNumbersTab";
import { formatPhone } from "@/lib/phoneFormat";
import { useBlockedNumbers, normalizeForBlock } from "@/hooks/useBlockedNumbers";
import { useIsMobile } from "@/hooks/use-mobile";

export default function Messagerie() {
  const { data: customers = [] } = useCustomers();
  const { data: allMessages = [] } = useMessages();
  const { data: unread = [] } = useUnreadMessages();
  const { data: blocked = [] } = useBlockedNumbers();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const isMobile = useIsMobile();
  // Sur mobile: afficher liste OU chat. Sur desktop: les deux.
  const showList = !isMobile || !selectedId;
  const showChat = !isMobile || !!selectedId;

  // Set des 10-derniers-chiffres pour lookup O(1) d'un client bloqué
  const blockedSet = useMemo(
    () => new Set(blocked.map((b) => b.phone_normalized)),
    [blocked],
  );

  // Clients avec téléphone, non cachés
  const eligible = useMemo(
    () => customers.filter((c) => !c.hidden && c.phone && c.phone.trim().length > 0),
    [customers],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return eligible;
    return eligible.filter((c) => c.name.toLowerCase().includes(q));
  }, [eligible, search]);

  // Trier par dernier message (plus récent en haut), puis par nom
  const sortedClients = useMemo(() => {
    const lastMsgByClient = new Map<string, string>();
    for (const m of allMessages) {
      const prev = lastMsgByClient.get(m.client_id);
      if (!prev || m.created_at > prev) lastMsgByClient.set(m.client_id, m.created_at);
    }
    return [...filtered].sort((a, b) => {
      const la = lastMsgByClient.get(a.id);
      const lb = lastMsgByClient.get(b.id);
      if (la && lb) return lb.localeCompare(la);
      if (la) return -1;
      if (lb) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [filtered, allMessages]);

  const unreadByClient = useMemo(() => {
    const m = new Map<string, number>();
    for (const u of unread) {
      m.set(u.client_id, (m.get(u.client_id) ?? 0) + 1);
    }
    return m;
  }, [unread]);

  const lastMsgByClient = useMemo(() => {
    const m = new Map<string, { body: string; created_at: string }>();
    for (const msg of allMessages) {
      const prev = m.get(msg.client_id);
      if (!prev || msg.created_at > prev.created_at) {
        m.set(msg.client_id, { body: msg.body, created_at: msg.created_at });
      }
    }
    return m;
  }, [allMessages]);

  // Notification navigateur sur nouveau message inbound
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  const [seenIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    for (const u of unread) {
      if (seenIds.has(u.id)) continue;
      seenIds.add(u.id);
      const client = customers.find((c) => c.id === u.client_id);
      try {
        new Notification("Nouveau message", {
          body: client?.name ?? "Client inconnu",
          tag: u.id,
        });
      } catch {
        // ignore
      }
    }
  }, [unread, customers, seenIds]);

  const selectedClient = customers.find((c) => c.id === selectedId) ?? null;

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b">
        <h1 className="text-2xl font-bold">Messagerie</h1>
        <p className="text-sm text-muted-foreground">
          Envoyez et recevez des SMS avec vos clients
        </p>
      </div>

      <Tabs defaultValue="conversations" className="flex-1 flex flex-col min-h-0">
        <div className="px-6 pt-3 border-b bg-card">
          <TabsList>
            <TabsTrigger value="conversations" className="gap-2">
              <MessageSquare className="h-4 w-4" />
              Conversations
            </TabsTrigger>
            <TabsTrigger value="blocked" className="gap-2">
              <ShieldOff className="h-4 w-4" />
              Numéros bloqués
              {blocked.length > 0 && (
                <Badge variant="secondary" className="h-5 min-w-5 text-xs ml-1">
                  {blocked.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent
          value="conversations"
          className="flex-1 min-h-0 m-0 data-[state=inactive]:hidden"
        >
          <div className="flex h-full min-h-0">
            {/* Liste */}
            <div className="w-80 border-r flex flex-col bg-card">
              <div className="p-3 border-b">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher un client..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
              <ScrollArea className="flex-1">
                {sortedClients.length === 0 ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">
                    Aucun client avec numéro de téléphone
                  </div>
                ) : (
                  <ul className="divide-y">
                    {sortedClients.map((c) => {
                      const last = lastMsgByClient.get(c.id);
                      const unreadCount = unreadByClient.get(c.id) ?? 0;
                      const isClientBlocked = blockedSet.has(normalizeForBlock(c.phone));
                      return (
                        <li key={c.id}>
                          <button
                            type="button"
                            onClick={() => setSelectedId(c.id)}
                            className={cn(
                              "w-full text-left px-3 py-3 flex items-start gap-3 hover:bg-accent transition-colors",
                              selectedId === c.id && "bg-accent",
                            )}
                          >
                            <Avatar>
                              <AvatarFallback>
                                {c.name
                                  .split(" ")
                                  .map((p) => p[0])
                                  .join("")
                                  .slice(0, 2)
                                  .toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <span
                                  className={cn(
                                    "font-medium truncate",
                                    isClientBlocked && "text-muted-foreground line-through",
                                  )}
                                >
                                  {c.name}
                                </span>
                                <div className="flex items-center gap-1">
                                  {isClientBlocked && (
                                    <ShieldOff
                                      className="h-3.5 w-3.5 text-destructive"
                                      aria-label="Numéro bloqué"
                                    />
                                  )}
                                  {unreadCount > 0 && (
                                    <Badge
                                      variant="destructive"
                                      className="h-5 min-w-5 text-xs"
                                    >
                                      {unreadCount}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <p className="text-xs text-muted-foreground truncate">
                                {last?.body || formatPhone(c.phone)}
                              </p>
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </ScrollArea>
            </div>

            {/* Chat */}
            <div className="flex-1 flex flex-col min-w-0">
              {selectedClient ? (
                <ChatPanel client={selectedClient} />
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mb-3 opacity-40" />
                  <p>Sélectionnez un client pour démarrer une conversation</p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent
          value="blocked"
          className="flex-1 min-h-0 m-0 data-[state=inactive]:hidden"
        >
          <BlockedNumbersTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

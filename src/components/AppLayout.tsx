import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  const isMessagerie = location.pathname.startsWith("/messagerie");

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/auth";
  };

  // Toast global pour nouveaux SMS entrants
  useEffect(() => {
    const channel = supabase
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
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-14 border-b flex items-center px-4 bg-card">
            <SidebarTrigger className="mr-4" />
            <h1 className="text-lg font-semibold text-foreground">Haie ACF</h1>
            <div className="ml-auto flex items-center gap-3">
              {user?.email && (
                <span className="text-xs text-muted-foreground hidden sm:inline">
                  {user.email}
                </span>
              )}
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-1" /> Déconnexion
              </Button>
            </div>
          </header>
          <main className={isMessagerie ? "flex-1 overflow-hidden" : "flex-1 p-6 overflow-auto"}>
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

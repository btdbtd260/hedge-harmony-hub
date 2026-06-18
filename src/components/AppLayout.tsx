import { useLocation } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Button } from "@/components/ui/button";
import { LogOut, ScissorsLineDashed } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeSubscriptions } from "@/hooks/useRealtimeSubscriptions";
import { useAuth } from "@/hooks/useAuth";

function Breadcrumb() {
  const location = useLocation();
  const segments = location.pathname.split("/").filter(Boolean);

  if (segments.length === 0) return null;

  const labels: Record<string, string> = {
    clients: "Clients",
    estimation: "Estimation",
    jobs: "Jobs",
    calendar: "Calendrier",
    invoices: "Facturation",
    finance: "Finance",
    apercu: "Aperçu",
    depenses: "Dépenses",
    paie: "Paie employés",
    historique: "Historique profit",
    employees: "Employés",
    reminders: "Rappels",
    messagerie: "Messagerie",
    analytics: "Analytics",
    settings: "Paramètres",
  };

  return (
    <nav className="flex items-center gap-1.5 text-xs text-muted-foreground ml-2">
      <span className="text-muted-foreground/50">/</span>
      {segments.map((seg, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-muted-foreground/30">/</span>}
          <span className={i === segments.length - 1 ? "text-foreground/70 font-medium" : ""}>
            {labels[seg] || seg.charAt(0).toUpperCase() + seg.slice(1)}
          </span>
        </span>
      ))}
    </nav>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  const isMessagerie = location.pathname.startsWith("/messagerie");

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/auth";
  };

  useRealtimeSubscriptions();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background/80 backdrop-blur-sm px-4">
            <SidebarTrigger className="shrink-0" />
            <div className="flex items-center gap-2 min-w-0">
              <ScissorsLineDashed className="h-5 w-5 text-primary shrink-0" />
              <h1 className="text-base font-semibold text-foreground whitespace-nowrap">Haie ACF</h1>
              <Breadcrumb />
            </div>
            <div className="ml-auto flex items-center gap-3">
              {user?.email && (
                <span className="text-xs text-muted-foreground hidden sm:inline">
                  {user.email}
                </span>
              )}
              <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground hover:text-foreground">
                <LogOut className="h-4 w-4 mr-1.5" /> Déconnexion
              </Button>
            </div>
          </header>
          <main className={isMessagerie ? "flex-1 overflow-hidden bg-muted/30" : "flex-1 p-6 overflow-auto bg-muted/30"}>
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

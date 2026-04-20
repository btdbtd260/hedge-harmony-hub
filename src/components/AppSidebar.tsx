import {
  LayoutDashboard,
  Users,
  Calculator,
  Briefcase,
  CalendarDays,
  FileText,
  DollarSign,
  UserCog,
  Bell,
  BarChart3,
  Settings,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { useReminders, useEstimationRequests } from "@/hooks/useSupabaseData";
import { Badge } from "@/components/ui/badge";

const navItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Clients", url: "/clients", icon: Users },
  { title: "Estimation", url: "/estimation", icon: Calculator },
  { title: "Jobs", url: "/jobs", icon: Briefcase },
  { title: "Calendrier", url: "/calendar", icon: CalendarDays },
  { title: "Facturation", url: "/invoices", icon: FileText },
  { title: "Finance", url: "/finance", icon: DollarSign },
  { title: "Employés", url: "/employees", icon: UserCog },
  { title: "Rappels", url: "/reminders", icon: Bell },
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
  { title: "Paramètres", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { data: reminders = [] } = useReminders();
  const { data: estimationRequests = [] } = useEstimationRequests();

  // Only count reminders due within next 7 days
  const inOneWeek = new Date();
  inOneWeek.setDate(inOneWeek.getDate() + 7);
  const inOneWeekStr = inOneWeek.toISOString().split("T")[0];
  const activeReminders = reminders.filter((r) => !r.is_completed && r.due_date <= inOneWeekStr).length;

  // Unseen external estimation requests (new submissions never opened, not done, not hidden)
  const unseenRequests = estimationRequests.filter(
    (r) => !r.seen_at && r.status !== "done" && !r.hidden,
  ).length;

  return (
    <Sidebar>
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-md bg-primary flex items-center justify-center">
            <span className="text-primary-foreground text-xs font-bold">ACF</span>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-sidebar-foreground">Haie ACF</h2>
            <p className="text-xs text-muted-foreground">Gestion</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="flex items-center gap-3 px-3 py-2 rounded-md text-sidebar-foreground hover:bg-sidebar-accent"
                      activeClassName="bg-sidebar-accent text-primary font-medium"
                    >
                      <item.icon className="h-4 w-4" />
                      <span className="flex-1">{item.title}</span>
                      {item.title === "Rappels" && activeReminders > 0 && (
                        <Badge variant="destructive" className="h-5 min-w-5 text-xs flex items-center justify-center">
                          {activeReminders}
                        </Badge>
                      )}
                      {item.title === "Calendrier" && unseenRequests > 0 && (
                        <Badge
                          variant="destructive"
                          className="h-5 min-w-5 text-xs flex items-center justify-center"
                          title={`${unseenRequests} nouvelle(s) demande(s) d'estimation`}
                        >
                          {unseenRequests}
                        </Badge>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

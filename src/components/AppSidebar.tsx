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
  MessageSquare,
  ChevronRight,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import type { NavLinkCompatProps } from "@/components/NavLink";
import { forwardRef } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { useReminders, useEstimationRequests } from "@/hooks/useSupabaseData";
import { useUnreadMessages } from "@/hooks/useMessages";
import { Badge } from "@/components/ui/badge";

type NavItem =
  | { type: "link"; title: string; url: string; icon: LucideIcon; end?: boolean }
  | { type: "section"; title: string; icon: LucideIcon; defaultOpen?: boolean; items: { title: string; url: string; icon?: LucideIcon }[] };

const navItems: NavItem[] = [
  { type: "link", title: "Dashboard", url: "/", icon: LayoutDashboard, end: true },
  {
    type: "section",
    title: "Clients",
    icon: Users,
    defaultOpen: true,
    items: [
      { title: "Clients", url: "/clients" },
      { title: "Estimation clients", url: "/clients/estimation", icon: Calculator },
    ],
  },
  { type: "link", title: "Estimation", url: "/estimation", icon: Calculator },
  { type: "link", title: "Jobs", url: "/jobs", icon: Briefcase },
  { type: "link", title: "Calendrier", url: "/calendar", icon: CalendarDays },
  { type: "link", title: "Facturation", url: "/invoices", icon: FileText },
  {
    type: "section",
    title: "Finance",
    icon: DollarSign,
    defaultOpen: true,
    items: [
      { title: "Aperçu", url: "/finance/apercu", icon: BarChart3 },
      { title: "Dépenses", url: "/finance/depenses", icon: TrendingDown },
      { title: "Paie employés", url: "/finance/paie", icon: UserCog },
      { title: "Historique profit", url: "/finance/historique", icon: TrendingUp },
    ],
  },
  { type: "link", title: "Employés", url: "/employees", icon: UserCog },
  { type: "link", title: "Rappels", url: "/reminders", icon: Bell },
  { type: "link", title: "Messagerie", url: "/messagerie", icon: MessageSquare },
  { type: "link", title: "Analytics", url: "/analytics", icon: BarChart3 },
  { type: "link", title: "Paramètres", url: "/settings", icon: Settings },
];

/**
 * SidebarNavLink — a wrapper around NavLink that closes the mobile sidebar
 * when a nav link is clicked on mobile devices. On desktop, behaves identically
 * to the regular NavLink.
 */
const SidebarNavLink = forwardRef<HTMLAnchorElement, NavLinkCompatProps & React.ComponentPropsWithoutRef<"a">>(
  ({ onClick, ...props }, ref) => {
    const { isMobile, setOpenMobile } = useSidebar();

    const handleClick: React.MouseEventHandler<HTMLAnchorElement> = (e) => {
      // Call the original onClick if provided
      onClick?.(e);

      // Close the mobile sidebar if on mobile — do NOT call on desktop
      if (isMobile) {
        setOpenMobile(false);
      }
    };

    return <NavLink ref={ref} onClick={handleClick} {...props} />;
  },
);

SidebarNavLink.displayName = "SidebarNavLink";

export { SidebarNavLink };

export function AppSidebar() {
  const { data: reminders = [] } = useReminders();
  const { data: estimationRequests = [] } = useEstimationRequests();
  const { data: unreadMessages = [] } = useUnreadMessages();

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
              {navItems.map((item) =>
                item.type === "link" ? (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <SidebarNavLink
                        to={item.url}
                        end={item.end}
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
                        {item.title === "Messagerie" && unreadMessages.length > 0 && (
                          <Badge
                            variant="destructive"
                            className="h-5 min-w-5 text-xs flex items-center justify-center"
                            title={`${unreadMessages.length} message(s) non lu(s)`}
                          >
                            {unreadMessages.length}
                          </Badge>
                        )}
                      </SidebarNavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ) : (
                  <Collapsible key={item.title} defaultOpen={item.defaultOpen ?? true} className="group/collapsible">
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton className="flex items-center gap-3 px-3 py-2 rounded-md text-sidebar-foreground hover:bg-sidebar-accent data-[state=open]:hover:bg-sidebar-accent">
                          <item.icon className="h-4 w-4" />
                          <span className="flex-1">{item.title}</span>
                          <ChevronRight className="h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                    </SidebarMenuItem>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {item.items.map((sub) => (
                          <SidebarMenuSubItem key={sub.title}>
                            <SidebarMenuSubButton asChild>
                              <SidebarNavLink
                                to={sub.url}
                                end
                                className="flex items-center gap-3 px-3 py-2 rounded-md text-sidebar-foreground hover:bg-sidebar-accent"
                                activeClassName="bg-sidebar-accent text-primary font-medium"
                              >
                                {sub.icon && <sub.icon className="h-4 w-4" />}
                                <span>{sub.title}</span>
                              </SidebarNavLink>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </Collapsible>
                )
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

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
  ScissorsLineDashed,
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
  SidebarSeparator,
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
  | { type: "link"; title: string; url: string; icon: LucideIcon; end?: boolean; badge?: "reminders" | "estimations" | "messages" }
  | {
      type: "section";
      title: string;
      icon: LucideIcon;
      defaultOpen?: boolean;
      items: { title: string; url: string; icon?: LucideIcon }[];
    };

const navItems: NavItem[] = [
  { type: "link", title: "Dashboard", url: "/", icon: LayoutDashboard, end: true },
  {
    type: "section",
    title: "Clients",
    icon: Users,
    defaultOpen: false,
    items: [
      { title: "Clients", url: "/clients" },
      { title: "Estimation clients", url: "/clients/estimation", icon: Calculator },
    ],
  },
  { type: "link", title: "Estimation", url: "/estimation", icon: Calculator },
  { type: "link", title: "Jobs", url: "/jobs", icon: Briefcase },
  { type: "link", title: "Calendrier", url: "/calendar", icon: CalendarDays, badge: "estimations" },
  {
    type: "section",
    title: "Finance",
    icon: DollarSign,
    defaultOpen: false,
    items: [
      { title: "Aperçu", url: "/finance/apercu", icon: BarChart3 },
      { title: "Dépenses", url: "/finance/depenses", icon: TrendingDown },
      { title: "Paie employés", url: "/finance/paie", icon: UserCog },
      { title: "Historique profit", url: "/finance/historique", icon: TrendingUp },
    ],
  },
  { type: "link", title: "Facturation", url: "/invoices", icon: FileText },
  { type: "link", title: "Employés", url: "/employees", icon: UserCog },
  { type: "link", title: "Rappels", url: "/reminders", icon: Bell, badge: "reminders" },
  { type: "link", title: "Messagerie", url: "/messagerie", icon: MessageSquare, badge: "messages" },
  { type: "link", title: "Analytics", url: "/analytics", icon: BarChart3 },
  { type: "link", title: "Paramètres", url: "/settings", icon: Settings },
];

const SidebarNavLink = forwardRef<HTMLAnchorElement, NavLinkCompatProps & React.ComponentPropsWithoutRef<"a">>(
  ({ onClick, ...props }, ref) => {
    const { isMobile, setOpenMobile } = useSidebar();

    const handleClick: React.MouseEventHandler<HTMLAnchorElement> = (e) => {
      onClick?.(e);
      if (isMobile) {
        setOpenMobile(false);
      }
    };

    return <NavLink ref={ref} onClick={handleClick} {...props} />;
  },
);

SidebarNavLink.displayName = "SidebarNavLink";

export { SidebarNavLink };

function NavItemBadge({ type }: { type: "reminders" | "estimations" | "messages" }) {
  const { data: reminders = [] } = useReminders();
  const { data: estimationRequests = [] } = useEstimationRequests();
  const { data: unreadMessages = [] } = useUnreadMessages();

  if (type === "reminders") {
    const inOneWeek = new Date();
    inOneWeek.setDate(inOneWeek.getDate() + 7);
    const inOneWeekStr = inOneWeek.toISOString().split("T")[0];
    const activeReminders = reminders.filter(
      (r) => !r.is_completed && r.due_date <= inOneWeekStr,
    ).length;
    if (activeReminders === 0) return null;
    return (
      <Badge variant="destructive" className="ml-auto h-5 min-w-5 text-[10px] flex items-center justify-center px-1">
        {activeReminders}
      </Badge>
    );
  }

  if (type === "estimations") {
    const unseenRequests = estimationRequests.filter(
      (r) => !r.seen_at && r.status !== "done" && !r.hidden,
    ).length;
    if (unseenRequests === 0) return null;
    return (
      <Badge variant="warning" className="ml-auto h-5 min-w-5 text-[10px] flex items-center justify-center px-1">
        {unseenRequests}
      </Badge>
    );
  }

  if (type === "messages") {
    if (unreadMessages.length === 0) return null;
    return (
      <Badge variant="info" className="ml-auto h-5 min-w-5 text-[10px] flex items-center justify-center px-1">
        {unreadMessages.length}
      </Badge>
    );
  }

  return null;
}

export function AppSidebar() {
  return (
    <Sidebar className="border-r shadow-sm">
      <SidebarHeader className="px-4 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary shadow-sm">
            <ScissorsLineDashed className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-sidebar-foreground tracking-tight">Haie ACF</h2>
            <p className="text-[11px] text-muted-foreground">Gestion de haies</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarSeparator className="mb-2" />
      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupLabel className="text-[11px] text-muted-foreground/60 tracking-wider uppercase">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) =>
                item.type === "link" ? (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <SidebarNavLink
                        to={item.url}
                        end={item.end}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
                        activeClassName="bg-sidebar-accent text-primary font-semibold shadow-sm"
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        <span className="flex-1 truncate">{item.title}</span>
                        {item.badge && <NavItemBadge type={item.badge} />}
                      </SidebarNavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ) : (
                  <Collapsible
                    key={item.title}
                    defaultOpen={item.defaultOpen ?? false}
                    className="group/collapsible"
                  >
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors">
                          <item.icon className="h-4 w-4 shrink-0" />
                          <span className="flex-1 truncate">{item.title}</span>
                          <ChevronRight className="h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90 text-muted-foreground/40" />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                    </SidebarMenuItem>
                    <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                      <SidebarMenuSub className="border-l border-sidebar-border ml-4 pl-2">
                        {item.items.map((sub) => (
                          <SidebarMenuSubItem key={sub.title}>
                            <SidebarMenuSubButton asChild>
                              <SidebarNavLink
                                to={sub.url}
                                end
                                className="flex items-center gap-3 px-3 py-1.5 rounded-md text-[13px] text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
                                activeClassName="bg-sidebar-accent text-primary font-medium"
                              >
                                {sub.icon && <sub.icon className="h-3.5 w-3.5 shrink-0" />}
                                <span className="truncate">{sub.title}</span>
                              </SidebarNavLink>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </Collapsible>
                ),
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

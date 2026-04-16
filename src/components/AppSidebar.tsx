import { Wrench, ArrowLeftRight, Crosshair, BarChart2, UserCheck, Settings } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { BiLabel } from "@/components/BiLabel";
import { Badge } from "@/components/ui/badge";
import { useDb } from "@/hooks/useDb";
import { all } from "@/lib/db";

const items = [
  { en: "Inventory", pt: "Inventário", url: "/", icon: Wrench, end: true },
  { en: "Movements", pt: "Movimentações", url: "/movements", icon: ArrowLeftRight, badge: true },
  { en: "Calibration", pt: "Calibração", url: "/calibration", icon: Crosshair },
  { en: "Reports", pt: "Relatórios", url: "/reports", icon: BarChart2 },
  { en: "Technician Register", pt: "Cadastro de Técnicos", url: "/technicians", icon: UserCheck },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { ready, version } = useDb();

  const pendingCount = ready
    ? (all<{ c: number }>("SELECT COUNT(*) as c FROM movements WHERE date_in IS NULL")[0]?.c ?? 0)
    : 0;
  // version ref to refresh
  void version;

  const isActive = (path: string, end?: boolean) =>
    end ? location.pathname === path : location.pathname.startsWith(path);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-md bg-sidebar-primary text-sidebar-primary-foreground flex items-center justify-center shrink-0">
            <Wrench className="h-4 w-4" />
          </div>
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold text-sidebar-foreground">Tool Control</span>
              <span className="text-[10px] italic text-sidebar-foreground/60">Controle de Ferramentas</span>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const active = isActive(item.url, item.end);
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      asChild
                      className={
                        active
                          ? "bg-blue-50 text-blue-700 hover:bg-blue-50 hover:text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                          : "hover:bg-slate-100 dark:hover:bg-slate-800"
                      }
                    >
                      <NavLink to={item.url} end={item.end} className="h-auto py-2">
                        <item.icon className={active ? "text-blue-700 dark:text-blue-300" : ""} />
                        {!collapsed && (
                          <>
                            <BiLabel en={item.en} pt={item.pt} size="small" className="flex-1" />
                            {item.badge && pendingCount > 0 && (
                              <Badge variant="destructive" className="ml-auto h-5 px-1.5 text-[10px]">
                                {pendingCount}
                              </Badge>
                            )}
                          </>
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className={
                isActive("/settings")
                  ? "bg-blue-50 text-blue-700 hover:bg-blue-50 hover:text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                  : "hover:bg-slate-100 dark:hover:bg-slate-800"
              }
            >
              <NavLink to="/settings" className="h-auto py-2">
                <Settings />
                {!collapsed && <BiLabel en="Settings" pt="Configurações" size="small" />}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

import { 
  LayoutDashboard, 
  ClipboardList, 
  UtensilsCrossed, 
  Soup,
  Columns3,
  Settings,
  Users,
  LogOut,
  ChefHat
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
  SidebarFooter,
} from "@/components/ui/sidebar";

const adminItems = [
  { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
  { title: "Pedidos", url: "/admin/pedidos", icon: ClipboardList },
  { title: "Cardápio", url: "/admin/cardapio", icon: UtensilsCrossed },
  { title: "Almoço", url: "/admin/almoco", icon: Soup },
  { title: "Kanban Cozinha", url: "/admin/kanban", icon: Columns3 },
  { title: "Usuários", url: "/admin/usuarios", icon: Users },
  { title: "Configurações", url: "/admin/configuracoes", icon: Settings },
];

const staffItems = [
  { title: "Dashboard", url: "/staff", icon: LayoutDashboard },
  { title: "Kanban Cozinha", url: "/staff/kanban", icon: Columns3 },
  { title: "Pedidos", url: "/staff/pedidos", icon: ClipboardList },
];

interface AppSidebarProps {
  variant?: "admin" | "staff";
}

export function AppSidebar({ variant = "admin" }: AppSidebarProps) {
  const items = variant === "admin" ? adminItems : staffItems;
  const title = variant === "admin" ? "Administração" : "Cozinha";

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sidebar-primary">
            <ChefHat className="h-6 w-6 text-sidebar-primary-foreground" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-sidebar-foreground">Sabor de Mãe</h2>
            <p className="text-xs text-sidebar-foreground/70">{title}</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/60">Menu Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink 
                      to={item.url} 
                      end={item.url === "/admin" || item.url === "/staff"}
                      className="flex items-center gap-3 text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                    >
                      <item.icon className="h-5 w-5" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <NavLink 
                to="/login" 
                className="flex items-center gap-3 text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
              >
                <LogOut className="h-5 w-5" />
                <span>Sair</span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

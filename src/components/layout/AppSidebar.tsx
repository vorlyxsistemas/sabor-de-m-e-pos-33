import { 
  LayoutDashboard, 
  ClipboardList, 
  UtensilsCrossed, 
  Soup,
  Columns3,
  Settings,
  Users,
  LogOut,
  ChefHat,
  Tags,
  MapPin,
  PlusCircle,
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
import { useAuth } from "@/hooks/useAuth";

const adminItems = [
  { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
  { title: "Categorias", url: "/admin/categories", icon: Tags },
  { title: "Itens", url: "/admin/items", icon: UtensilsCrossed },
  { title: "Almoço", url: "/admin/lunch", icon: Soup },
  { title: "Taxas de Entrega", url: "/admin/delivery-zones", icon: MapPin },
  { title: "Usuários", url: "/admin/users", icon: Users },
];

const adminOperationItems = [
  { title: "Pedidos", url: "/admin/pedidos", icon: ClipboardList },
  { title: "Cozinha", url: "/kitchen", icon: Columns3 },
  { title: "Novo Pedido", url: "/orders/new", icon: PlusCircle },
];

const staffItems = [
  { title: "Novo Pedido", url: "/orders/new", icon: PlusCircle },
  { title: "Cozinha", url: "/kitchen", icon: Columns3 },
  { title: "Pedidos", url: "/orders", icon: ClipboardList },
];

interface AppSidebarProps {
  variant?: "admin" | "staff";
}

export function AppSidebar({ variant = "admin" }: AppSidebarProps) {
  const { signOut } = useAuth();
  const title = variant === "admin" ? "Administração" : "Cozinha";

  const handleSignOut = async () => {
    await signOut();
  };

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
        {variant === "admin" ? (
          <>
            <SidebarGroup>
              <SidebarGroupLabel className="text-sidebar-foreground/60">Gestão</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {adminItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild>
                        <NavLink 
                          to={item.url} 
                          end={item.url === "/admin"}
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

            <SidebarGroup>
              <SidebarGroupLabel className="text-sidebar-foreground/60">Operação</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {adminOperationItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild>
                        <NavLink 
                          to={item.url} 
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
          </>
        ) : (
          <SidebarGroup>
            <SidebarGroupLabel className="text-sidebar-foreground/60">Menu</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {staffItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink 
                        to={item.url} 
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
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        <SidebarMenu>
          {variant === "admin" && (
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <NavLink 
                  to="/admin/configuracoes" 
                  className="flex items-center gap-3 text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
                  activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                >
                  <Settings className="h-5 w-5" />
                  <span>Configurações</span>
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          <SidebarMenuItem>
            <SidebarMenuButton 
              onClick={handleSignOut}
              className="flex items-center gap-3 text-sidebar-foreground/80 hover:bg-destructive/10 hover:text-destructive transition-colors cursor-pointer"
            >
              <LogOut className="h-5 w-5" />
              <span>Sair</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

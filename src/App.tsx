import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";

// Pages
import Index from "./pages/Index";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

// Admin Pages
import Dashboard from "./pages/admin/Dashboard";
import Pedidos from "./pages/admin/Pedidos";
import Cardapio from "./pages/admin/Cardapio";
import Almoco from "./pages/admin/Almoco";
import Kanban from "./pages/admin/Kanban";
import Usuarios from "./pages/admin/Usuarios";
import Configuracoes from "./pages/admin/Configuracoes";

// Staff Pages
import StaffDashboard from "./pages/staff/StaffDashboard";
import StaffKanban from "./pages/staff/StaffKanban";
import StaffPedidos from "./pages/staff/StaffPedidos";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Index />} />
          <Route path="/login" element={<Login />} />

          {/* Admin Routes */}
          <Route path="/admin" element={<Dashboard />} />
          <Route path="/admin/pedidos" element={<Pedidos />} />
          <Route path="/admin/cardapio" element={<Cardapio />} />
          <Route path="/admin/almoco" element={<Almoco />} />
          <Route path="/admin/kanban" element={<Kanban />} />
          <Route path="/admin/usuarios" element={<Usuarios />} />
          <Route path="/admin/configuracoes" element={<Configuracoes />} />

          {/* Staff Routes */}
          <Route path="/staff" element={<StaffDashboard />} />
          <Route path="/staff/kanban" element={<StaffKanban />} />
          <Route path="/staff/pedidos" element={<StaffPedidos />} />

          {/* 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

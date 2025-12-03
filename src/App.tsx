import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

// Pages
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

// Admin Pages
import Dashboard from "./pages/admin/Dashboard";
import Categories from "./pages/admin/Categories";
import Items from "./pages/admin/Items";
import Lunch from "./pages/admin/Lunch";
import Almoco from "./pages/admin/Almoco";
import DeliveryZones from "./pages/admin/DeliveryZones";
import Users from "./pages/admin/Users";
import Pedidos from "./pages/admin/Pedidos";
import Configuracoes from "./pages/admin/Configuracoes";

// Staff/Shared Pages
import Kitchen from "./pages/Kitchen";
import Orders from "./pages/Orders";
import NewOrder from "./pages/NewOrder";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public */}
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Auth />} />

            {/* Admin Routes */}
            <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin']}><Dashboard /></ProtectedRoute>} />
            <Route path="/admin/categories" element={<ProtectedRoute allowedRoles={['admin']}><Categories /></ProtectedRoute>} />
            <Route path="/admin/items" element={<ProtectedRoute allowedRoles={['admin']}><Items /></ProtectedRoute>} />
            <Route path="/admin/lunch" element={<ProtectedRoute allowedRoles={['admin']}><Lunch /></ProtectedRoute>} />
            <Route path="/admin/almoco" element={<ProtectedRoute allowedRoles={['admin']}><Almoco /></ProtectedRoute>} />
            <Route path="/admin/delivery-zones" element={<ProtectedRoute allowedRoles={['admin']}><DeliveryZones /></ProtectedRoute>} />
            <Route path="/admin/users" element={<ProtectedRoute allowedRoles={['admin']}><Users /></ProtectedRoute>} />
            <Route path="/admin/pedidos" element={<ProtectedRoute allowedRoles={['admin']}><Pedidos /></ProtectedRoute>} />
            <Route path="/admin/configuracoes" element={<ProtectedRoute allowedRoles={['admin']}><Configuracoes /></ProtectedRoute>} />

            {/* Staff Routes */}
            <Route path="/kitchen" element={<ProtectedRoute allowedRoles={['admin', 'staff']}><Kitchen /></ProtectedRoute>} />
            <Route path="/orders" element={<ProtectedRoute allowedRoles={['admin', 'staff']}><Orders /></ProtectedRoute>} />
            <Route path="/orders/new" element={<ProtectedRoute allowedRoles={['admin', 'staff']}><NewOrder /></ProtectedRoute>} />

            {/* 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
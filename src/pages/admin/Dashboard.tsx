import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { StatsCard } from "@/components/shared/StatsCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { generateDailyReport } from "@/lib/generateDailyReport";
import { 
  ShoppingBag, 
  DollarSign, 
  Users, 
  TrendingUp,
  Clock,
  Loader2,
  MapPin,
  Store,
  Truck,
  FileText
} from "lucide-react";

interface DashboardStats {
  totalOrders: number;
  totalRevenue: number;
  avgTicket: number;
  activeCustomers: number;
  ordersByType: { local: number; retirada: number; entrega: number };
}

interface RecentOrder {
  id: string;
  customer_name: string;
  total: number;
  status: string;
  order_type: string;
  created_at: string;
}

const Dashboard = () => {
  const { toast } = useToast();
  const [stats, setStats] = useState<DashboardStats>({
    totalOrders: 0,
    totalRevenue: 0,
    avgTicket: 0,
    activeCustomers: 0,
    ordersByType: { local: 0, retirada: 0, entrega: 0 },
  });
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingReport, setGeneratingReport] = useState(false);

  const handleGenerateReport = async () => {
    setGeneratingReport(true);
    try {
      await generateDailyReport();
      toast({
        title: "Relatório gerado!",
        description: "O PDF foi baixado com sucesso.",
      });
    } catch (error) {
      console.error("Error generating report:", error);
      toast({
        title: "Erro ao gerar relatório",
        description: "Tente novamente em alguns instantes.",
        variant: "destructive",
      });
    } finally {
      setGeneratingReport(false);
    }
  };

  const fetchDashboardData = async () => {
    try {
      // Get today's date range in Brazil timezone
      const now = new Date();
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);

      // Fetch today's orders (excluding cancelled)
      const { data: todayOrders, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .gte('created_at', startOfDay.toISOString())
        .lte('created_at', endOfDay.toISOString())
        .neq('status', 'cancelled');

      if (ordersError) throw ordersError;

      // Calculate stats
      const deliveredOrders = todayOrders?.filter(o => o.status === 'delivered') || [];
      const allTodayOrders = todayOrders || [];
      
      const totalRevenue = deliveredOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
      const totalOrders = allTodayOrders.length;
      const avgTicket = totalOrders > 0 ? totalRevenue / deliveredOrders.length || 0 : 0;
      
      // Count unique customers
      const uniqueCustomers = new Set(allTodayOrders.map(o => o.customer_phone || o.customer_name));
      
      // Count by order type
      const ordersByType = {
        local: allTodayOrders.filter(o => o.order_type === 'local').length,
        retirada: allTodayOrders.filter(o => o.order_type === 'retirada').length,
        entrega: allTodayOrders.filter(o => o.order_type === 'entrega').length,
      };

      setStats({
        totalOrders,
        totalRevenue,
        avgTicket: isNaN(avgTicket) ? 0 : avgTicket,
        activeCustomers: uniqueCustomers.size,
        ordersByType,
      });

      // Fetch recent orders
      const { data: recent, error: recentError } = await supabase
        .from('orders')
        .select('id, customer_name, total, status, order_type, created_at')
        .order('created_at', { ascending: false })
        .limit(10);

      if (recentError) throw recentError;
      setRecentOrders(recent || []);

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();

    // Set up realtime subscription for orders
    const channel = supabase
      .channel('dashboard-orders')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders'
        },
        () => {
          console.log('Order changed, refreshing dashboard...');
          fetchDashboardData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
      pending: { label: "Pendente", variant: "secondary" },
      preparing: { label: "Preparando", variant: "default" },
      ready: { label: "Pronto", variant: "outline" },
      delivered: { label: "Entregue", variant: "default" },
      cancelled: { label: "Cancelado", variant: "destructive" },
    };
    const s = statusMap[status] || { label: status, variant: "secondary" };
    return <Badge variant={s.variant}>{s.label}</Badge>;
  };

  const getOrderTypeBadge = (type: string) => {
    const typeMap: Record<string, { label: string; icon: any }> = {
      local: { label: "Local", icon: Store },
      retirada: { label: "Retirada", icon: MapPin },
      entrega: { label: "Entrega", icon: Truck },
    };
    const t = typeMap[type] || { label: type, icon: Store };
    const Icon = t.icon;
    return (
      <Badge variant="outline" className="gap-1">
        <Icon className="h-3 w-3" />
        {t.label}
      </Badge>
    );
  };

  if (loading) {
    return (
      <AdminLayout title="Dashboard" subtitle="Visão geral do sistema">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Dashboard" subtitle="Visão geral do sistema">
      {/* Report Button */}
      <div className="flex justify-end mb-4">
        <Button 
          onClick={handleGenerateReport} 
          disabled={generatingReport}
          className="gap-2"
        >
          {generatingReport ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileText className="h-4 w-4" />
          )}
          Gerar Relatório Diário (PDF)
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatsCard
          title="Pedidos Hoje"
          value={stats.totalOrders.toString()}
          icon={ShoppingBag}
          trend={{ value: 0, isPositive: true }}
        />
        <StatsCard
          title="Faturamento"
          value={`R$ ${stats.totalRevenue.toFixed(2).replace('.', ',')}`}
          icon={DollarSign}
          trend={{ value: 0, isPositive: true }}
        />
        <StatsCard
          title="Clientes Ativos"
          value={stats.activeCustomers.toString()}
          icon={Users}
        />
        <StatsCard
          title="Ticket Médio"
          value={`R$ ${stats.avgTicket.toFixed(2).replace('.', ',')}`}
          icon={TrendingUp}
        />
      </div>

      {/* Order Type Distribution */}
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card className="shadow-soft">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Store className="h-5 w-5 text-primary" />
                <span className="font-medium">Local</span>
              </div>
              <span className="text-2xl font-bold">{stats.ordersByType.local}</span>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-soft">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                <span className="font-medium">Retirada</span>
              </div>
              <span className="text-2xl font-bold">{stats.ordersByType.retirada}</span>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-soft">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Truck className="h-5 w-5 text-primary" />
                <span className="font-medium">Entrega</span>
              </div>
              <span className="text-2xl font-bold">{stats.ordersByType.entrega}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Content Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Orders */}
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-primary" />
              Últimos Pedidos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum pedido registrado ainda
              </p>
            ) : (
              <div className="space-y-3">
                {recentOrders.map((order) => (
                  <div key={order.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                    <div className="space-y-1">
                      <p className="font-medium text-sm">{order.customer_name}</p>
                      <div className="flex gap-2">
                        {getStatusBadge(order.status)}
                        {getOrderTypeBadge(order.order_type)}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-sm">R$ {Number(order.total).toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(order.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Info */}
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Horário de Funcionamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Segunda a Sábado</span>
                <span className="font-medium">07:00 - 14:00</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Lanches</span>
                <span className="font-medium">até 10:00</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Almoço</span>
                <span className="font-medium">a partir de 11:00</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Domingo</span>
                <span className="font-medium text-destructive">Fechado</span>
              </div>
            </div>
            <div className="mt-4 p-3 rounded-lg bg-accent">
              <p className="text-xs text-accent-foreground">
                Configure os horários na página de Configurações
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default Dashboard;

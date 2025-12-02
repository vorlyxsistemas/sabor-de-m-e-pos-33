import { AdminLayout } from "@/components/layout/AdminLayout";
import { StatsCard } from "@/components/shared/StatsCard";
import { DataTable } from "@/components/shared/DataTable";
import { 
  ShoppingBag, 
  DollarSign, 
  Users, 
  TrendingUp,
  Clock
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const Dashboard = () => {
  const pedidosColumns = [
    { key: "id", label: "#" },
    { key: "cliente", label: "Cliente" },
    { key: "itens", label: "Itens" },
    { key: "valor", label: "Valor" },
    { key: "status", label: "Status" },
  ];

  return (
    <AdminLayout title="Dashboard" subtitle="Visão geral do sistema">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatsCard
          title="Pedidos Hoje"
          value="0"
          icon={ShoppingBag}
          trend={{ value: 0, isPositive: true }}
        />
        <StatsCard
          title="Faturamento"
          value="R$ 0,00"
          icon={DollarSign}
          trend={{ value: 0, isPositive: true }}
        />
        <StatsCard
          title="Clientes Ativos"
          value="0"
          icon={Users}
        />
        <StatsCard
          title="Ticket Médio"
          value="R$ 0,00"
          icon={TrendingUp}
        />
      </div>

      {/* Content Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Orders */}
        <DataTable
          title="Últimos Pedidos"
          columns={pedidosColumns}
          emptyMessage="Nenhum pedido registrado ainda"
        />

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
                <span className="text-muted-foreground">Segunda a Sexta</span>
                <span className="font-medium">11:00 - 22:00</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Sábado</span>
                <span className="font-medium">11:00 - 23:00</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Domingo</span>
                <span className="font-medium">11:00 - 20:00</span>
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

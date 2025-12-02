import { AdminLayout } from "@/components/layout/AdminLayout";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const Pedidos = () => {
  const columns = [
    { key: "numero", label: "Nº Pedido" },
    { key: "cliente", label: "Cliente" },
    { key: "telefone", label: "Telefone" },
    { key: "itens", label: "Itens" },
    { key: "valor", label: "Valor Total" },
    { key: "tipo", label: "Tipo" },
    { key: "status", label: "Status" },
    { key: "data", label: "Data/Hora" },
  ];

  return (
    <AdminLayout title="Pedidos" subtitle="Gerenciamento de pedidos">
      <PageHeader
        title="Todos os Pedidos"
        description="Visualize e gerencie todos os pedidos da lanchonete"
        action={{ label: "Novo Pedido" }}
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <Input placeholder="Buscar por cliente ou número..." className="max-w-xs" />
        <Button variant="outline" className="gap-2">
          <Filter className="h-4 w-4" />
          Filtros
        </Button>
        <Button variant="outline">Hoje</Button>
        <Button variant="outline">Esta Semana</Button>
        <Button variant="outline">Este Mês</Button>
      </div>

      {/* Orders Table */}
      <DataTable
        columns={columns}
        emptyMessage="Nenhum pedido encontrado. Os pedidos aparecerão aqui quando forem criados."
      />
    </AdminLayout>
  );
};

export default Pedidos;

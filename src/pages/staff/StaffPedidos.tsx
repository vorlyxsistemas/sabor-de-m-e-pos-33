import { StaffLayout } from "@/components/layout/StaffLayout";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";

const StaffPedidos = () => {
  const columns = [
    { key: "numero", label: "Nº" },
    { key: "itens", label: "Itens" },
    { key: "observacao", label: "Observação" },
    { key: "tipo", label: "Tipo" },
    { key: "tempo", label: "Tempo" },
    { key: "status", label: "Status" },
  ];

  return (
    <StaffLayout title="Pedidos" subtitle="Lista de pedidos">
      <PageHeader
        title="Pedidos do Dia"
        description="Visualize todos os pedidos em produção"
      />

      <DataTable
        columns={columns}
        emptyMessage="Nenhum pedido no momento. Aguarde novos pedidos."
      />
    </StaffLayout>
  );
};

export default StaffPedidos;

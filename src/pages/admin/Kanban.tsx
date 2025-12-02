import { AdminLayout } from "@/components/layout/AdminLayout";
import { PageHeader } from "@/components/shared/PageHeader";
import { KanbanColumn } from "@/components/shared/KanbanColumn";
import { RefreshCw } from "lucide-react";

const Kanban = () => {
  return (
    <AdminLayout title="Kanban" subtitle="Acompanhamento de pedidos em tempo real">
      <PageHeader
        title="Kanban da Cozinha"
        description="Visualize o status de todos os pedidos em produção"
        action={{ label: "Atualizar", icon: RefreshCw }}
      />

      <div className="flex gap-4 overflow-x-auto pb-4">
        <KanbanColumn 
          title="Aguardando" 
          count={0} 
          color="default"
        />
        <KanbanColumn 
          title="Em Preparo" 
          count={0} 
          color="warning"
        />
        <KanbanColumn 
          title="Pronto" 
          count={0} 
          color="success"
        />
        <KanbanColumn 
          title="Entregue" 
          count={0} 
          color="default"
        />
      </div>
    </AdminLayout>
  );
};

export default Kanban;

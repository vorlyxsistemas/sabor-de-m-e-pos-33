import { StaffLayout } from "@/components/layout/StaffLayout";
import { PageHeader } from "@/components/shared/PageHeader";
import { KanbanColumn } from "@/components/shared/KanbanColumn";
import { RefreshCw } from "lucide-react";

const StaffKanban = () => {
  return (
    <StaffLayout title="Kanban" subtitle="Produção da cozinha">
      <PageHeader
        title="Kanban da Cozinha"
        description="Arraste os pedidos conforme o progresso"
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
          title="Pronto para Entrega" 
          count={0} 
          color="success"
        />
      </div>
    </StaffLayout>
  );
};

export default StaffKanban;

import { StaffLayout } from "@/components/layout/StaffLayout";
import { StatsCard } from "@/components/shared/StatsCard";
import { KanbanColumn, KanbanCard } from "@/components/shared/KanbanColumn";
import { ClipboardList, Clock, CheckCircle, AlertCircle } from "lucide-react";

const StaffDashboard = () => {
  return (
    <StaffLayout title="Cozinha" subtitle="Painel de produção">
      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <StatsCard
          title="Aguardando"
          value="0"
          icon={ClipboardList}
        />
        <StatsCard
          title="Em Preparo"
          value="0"
          icon={Clock}
        />
        <StatsCard
          title="Prontos"
          value="0"
          icon={CheckCircle}
        />
        <StatsCard
          title="Atrasados"
          value="0"
          icon={AlertCircle}
        />
      </div>

      {/* Mini Kanban */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        <KanbanColumn title="Aguardando" count={0} color="default" />
        <KanbanColumn title="Em Preparo" count={0} color="warning" />
        <KanbanColumn title="Pronto" count={0} color="success" />
      </div>
    </StaffLayout>
  );
};

export default StaffDashboard;

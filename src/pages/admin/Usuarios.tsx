import { AdminLayout } from "@/components/layout/AdminLayout";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { UserPlus } from "lucide-react";

const Usuarios = () => {
  const columns = [
    { key: "nome", label: "Nome" },
    { key: "email", label: "Email" },
    { key: "cargo", label: "Cargo" },
    { key: "status", label: "Status" },
    { key: "ultimoAcesso", label: "Último Acesso" },
  ];

  return (
    <AdminLayout title="Usuários" subtitle="Gerenciamento de usuários do sistema">
      <PageHeader
        title="Usuários"
        description="Gerencie os funcionários e acessos ao sistema"
        action={{ label: "Novo Usuário", icon: UserPlus }}
      />

      <DataTable
        columns={columns}
        emptyMessage="Nenhum usuário cadastrado. Adicione funcionários para gerenciar o acesso ao sistema."
      />
    </AdminLayout>
  );
};

export default Usuarios;

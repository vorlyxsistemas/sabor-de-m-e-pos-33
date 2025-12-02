import { AdminLayout } from "@/components/layout/AdminLayout";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const diasSemana = [
  { dia: "Segunda", carne: "Não definida" },
  { dia: "Terça", carne: "Não definida" },
  { dia: "Quarta", carne: "Não definida" },
  { dia: "Quinta", carne: "Não definida" },
  { dia: "Sexta", carne: "Não definida" },
  { dia: "Sábado", carne: "Não definida" },
  { dia: "Domingo", carne: "Não definida" },
];

const Almoco = () => {
  const hoje = new Date().toLocaleDateString('pt-BR', { weekday: 'long' });

  return (
    <AdminLayout title="Almoço" subtitle="Cardápio do almoço por dia da semana">
      <PageHeader
        title="Cardápio de Almoço"
        description="Configure as carnes e acompanhamentos do almoço para cada dia da semana"
        action={{ label: "Configurar Semana" }}
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {diasSemana.map((item) => {
          const isHoje = hoje.toLowerCase().includes(item.dia.toLowerCase());
          
          return (
            <Card 
              key={item.dia} 
              className={`shadow-soft transition-all hover:shadow-lg ${isHoje ? 'ring-2 ring-primary' : ''}`}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{item.dia}</CardTitle>
                  {isHoje && <Badge>Hoje</Badge>}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Carne do dia</p>
                    <p className="font-medium text-foreground">{item.carne}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Acompanhamentos</p>
                    <p className="text-sm text-muted-foreground">
                      Arroz, feijão, salada e farofa
                    </p>
                  </div>
                  <div className="pt-2 border-t border-border">
                    <p className="text-xs text-muted-foreground mb-1">Preço</p>
                    <p className="text-lg font-bold text-primary">R$ --,--</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </AdminLayout>
  );
};

export default Almoco;

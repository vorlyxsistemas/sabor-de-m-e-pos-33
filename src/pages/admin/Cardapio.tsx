import { AdminLayout } from "@/components/layout/AdminLayout";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { UtensilsCrossed } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const categorias = [
  { id: "tapiocas", label: "Tapiocas" },
  { id: "lanches", label: "Lanches" },
  { id: "bebidas", label: "Bebidas" },
  { id: "caldos", label: "Caldos" },
  { id: "porcoes", label: "Porções" },
];

const Cardapio = () => {
  return (
    <AdminLayout title="Cardápio" subtitle="Gerenciamento do cardápio">
      <PageHeader
        title="Cardápio"
        description="Adicione e edite os itens do cardápio"
        action={{ label: "Novo Item" }}
      />

      <Tabs defaultValue="tapiocas" className="w-full">
        <TabsList className="mb-6">
          {categorias.map((cat) => (
            <TabsTrigger key={cat.id} value={cat.id}>
              {cat.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {categorias.map((cat) => (
          <TabsContent key={cat.id} value={cat.id}>
            <Card className="shadow-soft">
              <CardHeader>
                <CardTitle>{cat.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <EmptyState
                  icon={UtensilsCrossed}
                  title={`Nenhuma ${cat.label.toLowerCase().slice(0, -1)} cadastrada`}
                  description="Adicione itens ao cardápio para que apareçam aqui"
                  action={{ label: `Adicionar ${cat.label.slice(0, -1)}` }}
                />
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </AdminLayout>
  );
};

export default Cardapio;

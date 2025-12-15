import { CustomerLayout } from "@/components/layout/CustomerLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
const CustomerHome = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <CustomerLayout title="Bem-vindo" subtitle="Área do Cliente">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center py-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Olá{user?.user_metadata?.name ? `, ${user.user_metadata.name}` : ""}! 👋
          </h1>
          <p className="text-muted-foreground">
            Seja bem-vindo ao Sabor de Mãe. Faça seu pedido de forma rápida e prática.
          </p>
        </div>

        <div className="max-w-md mx-auto">
          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate("/cliente/pedido")}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <ShoppingCart className="h-5 w-5 text-primary" />
                Fazer Pedido
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Monte seu pedido escolhendo os itens do cardápio e finalize sua compra.
              </p>
              <Button className="w-full">
                Fazer Pedido
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock className="h-5 w-5 text-primary" />
              Horário de Funcionamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-medium">Segunda a Sábado</p>
                <p className="text-muted-foreground">07:00 - 14:00</p>
              </div>
              <div>
                <p className="font-medium">Domingo</p>
                <p className="text-muted-foreground">Fechado</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              * Lanches disponíveis até 10h | Almoço a partir das 11h
            </p>
          </CardContent>
        </Card>
      </div>
    </CustomerLayout>
  );
};

export default CustomerHome;

import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

// Carnes padrão por dia (fallback)
const DEFAULT_MEATS: Record<number, string[]> = {
  0: [], // Domingo - não funciona
  1: ["Lasanha de frango", "Picadinho"], // Segunda
  2: ["Frango ao molho", "Carne de sol"], // Terça
  3: ["Almôndega", "Costela"], // Quarta
  4: ["Lasanha de carne", "Bife ao molho"], // Quinta
  5: ["Peixe frito", "Peixe cozido", "Fígado acebolado"], // Sexta
  6: ["Feijoada", "Porco frito/cozido", "Panelada"], // Sábado
};

const diasSemana = [
  { value: 1, dia: "Segunda" },
  { value: 2, dia: "Terça" },
  { value: 3, dia: "Quarta" },
  { value: 4, dia: "Quinta" },
  { value: 5, dia: "Sexta" },
  { value: 6, dia: "Sábado" },
];

interface LunchMenuItem {
  meat_name: string;
  meat_price: number;
}

const Almoco = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [lunchMenu, setLunchMenu] = useState<Record<number, LunchMenuItem[]>>({});
  const hoje = new Date().getDay();

  useEffect(() => {
    fetchLunchMenu();
  }, []);

  const fetchLunchMenu = async () => {
    try {
      const { data, error } = await supabase
        .from('lunch_menu')
        .select('weekday, meat_name, meat_price')
        .order('weekday');

      if (error) throw error;

      // Group by weekday
      const grouped: Record<number, LunchMenuItem[]> = {};
      diasSemana.forEach(day => {
        const dayMeats = data?.filter(item => item.weekday === day.value) || [];
        if (dayMeats.length > 0) {
          grouped[day.value] = dayMeats.map(m => ({ 
            meat_name: m.meat_name, 
            meat_price: m.meat_price 
          }));
        } else {
          // Use default meats as fallback
          grouped[day.value] = DEFAULT_MEATS[day.value].map(name => ({
            meat_name: name,
            meat_price: 0
          }));
        }
      });

      setLunchMenu(grouped);
    } catch (error) {
      console.error('Error fetching lunch menu:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout title="Almoço" subtitle="Cardápio do almoço por dia da semana">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Almoço" subtitle="Cardápio do almoço por dia da semana">
      <PageHeader
        title="Cardápio de Almoço"
        description="Visualize as carnes do dia. Clique em 'Configurar' para editar."
        action={{ 
          label: "Configurar Carnes",
          onClick: () => navigate('/admin/lunch')
        }}
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {diasSemana.map((item) => {
          const isHoje = hoje === item.value;
          const meats = lunchMenu[item.value] || [];
          
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
                    <p className="text-xs text-muted-foreground mb-2">Carnes do dia</p>
                    {meats.length > 0 ? (
                      <div className="space-y-1">
                        {meats.map((meat, idx) => (
                          <div key={idx} className="flex justify-between items-center">
                            <span className="font-medium text-foreground text-sm">
                              {meat.meat_name}
                            </span>
                            {meat.meat_price > 0 && (
                              <span className="text-xs text-muted-foreground">
                                R$ {meat.meat_price.toFixed(2)}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Não definida</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Acompanhamentos grátis</p>
                    <p className="text-sm text-muted-foreground">
                      Macarrão, Farofa, Macaxeira, Salada
                    </p>
                  </div>
                  <div className="pt-2 border-t border-border">
                    <p className="text-xs text-muted-foreground mb-1">Bases disponíveis</p>
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="outline" className="text-xs">Arroz/Feijão R$14</Badge>
                      <Badge variant="outline" className="text-xs">Baião R$14-16</Badge>
                    </div>
                  </div>
                  <div className="pt-2">
                    <p className="text-xs text-muted-foreground">
                      • 2 carnes incluídas • Carne extra +R$6
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Info Card */}
      <Card className="mt-6 bg-muted/50">
        <CardContent className="py-4">
          <h4 className="font-semibold mb-2">Regras do Almoço</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Funcionamento: Segunda a Sábado, das 11h às 14h</li>
            <li>• O almoço inclui 2 carnes por padrão (sem alteração de preço)</li>
            <li>• Cliente pode optar por apenas 1 carne se preferir</li>
            <li>• Carne adicional: R$ 6,00 cada</li>
            <li>• Acompanhamentos (grátis): Macarrão, Farofa, Macaxeira, Salada</li>
            <li>• <strong>Sábado:</strong> Feijoada, Porco frito/cozido e Panelada disponíveis</li>
          </ul>
        </CardContent>
      </Card>
    </AdminLayout>
  );
};

export default Almoco;

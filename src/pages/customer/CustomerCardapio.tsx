import { useState, useEffect } from "react";
import { CustomerLayout } from "@/components/layout/CustomerLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, UtensilsCrossed, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Item {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category_id: string;
  available: boolean;
  extras?: { id: string; name: string; price: number }[];
}

interface Category {
  id: string;
  name: string;
}

const CustomerCardapio = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [isClosed, setIsClosed] = useState(false);
  const [closedMessage, setClosedMessage] = useState("");

  useEffect(() => {
    fetchMenu();
  }, []);

  const fetchMenu = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("menu", {
        body: {},
      });

      if (error) throw error;

      if (data?.data?.closed) {
        setIsClosed(true);
        setClosedMessage(data.data.message || "Estamos fechados no momento");
        setCategories([]);
        setItems([]);
      } else {
        setCategories(data?.data?.categories || []);
        setItems(data?.data?.items || []);
        setIsClosed(false);
      }
    } catch (error) {
      console.error("Erro ao carregar cardápio:", error);
    } finally {
      setLoading(false);
    }
  };

  const getItemsByCategory = (categoryId: string) => {
    return items.filter((item) => item.category_id === categoryId);
  };

  if (loading) {
    return (
      <CustomerLayout title="Cardápio" subtitle="Nosso cardápio completo">
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </CustomerLayout>
    );
  }

  return (
    <CustomerLayout title="Cardápio" subtitle="Nosso cardápio completo">
      <div className="max-w-4xl mx-auto space-y-6">
        {isClosed && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{closedMessage}</AlertDescription>
          </Alert>
        )}

        {categories.length === 0 && !isClosed && (
          <div className="text-center py-12">
            <UtensilsCrossed className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhum item disponível no momento</p>
          </div>
        )}

        {categories.map((category) => {
          const categoryItems = getItemsByCategory(category.id);
          if (categoryItems.length === 0) return null;

          return (
            <Card key={category.id}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <UtensilsCrossed className="h-5 w-5 text-primary" />
                  {category.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="divide-y">
                  {categoryItems.map((item) => (
                    <div key={item.id} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h4 className="font-medium text-foreground">{item.name}</h4>
                          {item.description && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {item.description}
                            </p>
                          )}
                          {item.extras && item.extras.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {item.extras.map((extra) => (
                                <Badge key={extra.id} variant="secondary" className="text-xs">
                                  {extra.name} +R$ {extra.price.toFixed(2)}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="text-right ml-4">
                          <span className="text-lg font-bold text-primary">
                            R$ {item.price.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </CustomerLayout>
  );
};

export default CustomerCardapio;

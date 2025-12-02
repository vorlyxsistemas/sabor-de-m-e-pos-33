import { useState, useEffect } from "react";
import { StaffLayout } from "@/components/layout/StaffLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ChevronRight } from "lucide-react";

type OrderStatus = 'pending' | 'preparing' | 'ready' | 'delivered' | 'cancelled';

interface Order {
  id: string;
  customer_name: string;
  status: OrderStatus;
  created_at: string;
  order_items: { quantity: number; item: { name: string } | null }[];
}

const columns: { status: OrderStatus; title: string; color: string }[] = [
  { status: 'pending', title: 'A Preparar', color: 'bg-yellow-500' },
  { status: 'preparing', title: 'Preparando', color: 'bg-blue-500' },
  { status: 'ready', title: 'Pronto', color: 'bg-green-500' },
  { status: 'delivered', title: 'Entregue', color: 'bg-gray-500' },
];

const Kitchen = () => {
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrders();
    
    // Realtime subscription
    const channel = supabase
      .channel('orders-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchOrders();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchOrders = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from('orders')
        .select(`*, order_items(quantity, item:items(name))`)
        .gte('created_at', today.toISOString())
        .order('created_at');

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const moveOrder = async (orderId: string, newStatus: OrderStatus) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId);

      if (error) throw error;
      toast({ title: "Status atualizado!" });
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  const getNextStatus = (current: OrderStatus): OrderStatus | null => {
    const idx = columns.findIndex(c => c.status === current);
    return idx < columns.length - 1 ? columns[idx + 1].status : null;
  };

  if (loading) {
    return (
      <StaffLayout title="Cozinha" subtitle="Kanban de pedidos">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </StaffLayout>
    );
  }

  return (
    <StaffLayout title="Cozinha" subtitle="Kanban de pedidos em tempo real">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {columns.map((col) => (
          <div key={col.status} className="space-y-3">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${col.color}`} />
              <h3 className="font-semibold">{col.title}</h3>
              <Badge variant="outline">{orders.filter(o => o.status === col.status).length}</Badge>
            </div>
            <div className="space-y-2 min-h-[200px] bg-muted/30 rounded-lg p-2">
              {orders.filter(o => o.status === col.status).map((order) => (
                <Card key={order.id} className="shadow-sm">
                  <CardHeader className="py-2 px-3">
                    <CardTitle className="text-sm flex justify-between">
                      <span>{order.customer_name}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(order.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="py-2 px-3">
                    <ul className="text-xs text-muted-foreground space-y-1">
                      {order.order_items?.slice(0, 3).map((oi, i) => (
                        <li key={i}>{oi.quantity}x {oi.item?.name || 'Item'}</li>
                      ))}
                      {order.order_items?.length > 3 && <li>+{order.order_items.length - 3} mais</li>}
                    </ul>
                    {getNextStatus(order.status) && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full mt-2 h-7 text-xs"
                        onClick={() => moveOrder(order.id, getNextStatus(order.status)!)}
                      >
                        Avançar <ChevronRight className="h-3 w-3 ml-1" />
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    </StaffLayout>
  );
};

export default Kitchen;

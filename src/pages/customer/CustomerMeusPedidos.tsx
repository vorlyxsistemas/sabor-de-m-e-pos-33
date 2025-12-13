import { useState, useEffect } from "react";
import { CustomerLayout } from "@/components/layout/CustomerLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Package, Clock, ChefHat, CheckCircle, Truck, MapPin, Store } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Order {
  id: string;
  customer_name: string;
  order_type: string;
  status: string;
  subtotal: number;
  delivery_tax: number;
  total: number;
  address: string | null;
  created_at: string;
  order_items: {
    id: string;
    quantity: number;
    price: number;
    extras: any;
    items: { name: string } | null;
  }[];
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType; step: number }> = {
  pending: { label: "Pendente", color: "bg-yellow-500", icon: Clock, step: 1 },
  preparing: { label: "Preparando", color: "bg-blue-500", icon: ChefHat, step: 2 },
  ready: { label: "Pronto", color: "bg-green-500", icon: CheckCircle, step: 3 },
  delivered: { label: "Entregue", color: "bg-emerald-600", icon: Truck, step: 4 },
};

const CustomerMeusPedidos = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = async () => {
    if (!user) return;
    
    // Query orders filtered by user_id - RLS will also enforce this on server-side
    // Using rpc or manual filter since user_id column may not be in generated types yet
    const { data, error } = await supabase
      .from('orders')
      .select('id, customer_name, order_type, status, subtotal, delivery_tax, total, address, created_at, order_items(id, quantity, price, extras, items(name))')
      .filter('user_id', 'eq', user.id) // Filter by authenticated user's ID
      .order('created_at', { ascending: false })
      .limit(20);

    if (!error && data) {
      setOrders(data as unknown as Order[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();

    const channel = supabase
      .channel('customer-orders-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => fetchOrders()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const getOrderTypeIcon = (type: string) => {
    switch (type) {
      case 'entrega': return <Truck className="h-4 w-4" />;
      case 'retirada': return <MapPin className="h-4 w-4" />;
      default: return <Store className="h-4 w-4" />;
    }
  };

  const getOrderTypeLabel = (type: string) => {
    switch (type) {
      case 'entrega': return 'Entrega';
      case 'retirada': return 'Retirada';
      default: return 'Local';
    }
  };

  if (loading) {
    return (
      <CustomerLayout title="Meus Pedidos" subtitle="Acompanhe seus pedidos">
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </CustomerLayout>
    );
  }

  return (
    <CustomerLayout title="Meus Pedidos" subtitle="Acompanhe seus pedidos em tempo real">
      <div className="space-y-4 max-w-3xl mx-auto">
        {orders.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Você ainda não fez nenhum pedido</p>
            </CardContent>
          </Card>
        ) : (
          orders.map((order) => {
            const status = statusConfig[order.status] || statusConfig.pending;
            const StatusIcon = status.icon;
            const isDelivered = order.status === 'delivered';

            return (
              <Card key={order.id} className={`transition-all ${!isDelivered ? 'border-primary/50 shadow-md' : ''}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${status.color} text-white`}>
                        <StatusIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-base">
                          Pedido #{order.id.slice(0, 8).toUpperCase()}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(order.created_at), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="gap-1">
                        {getOrderTypeIcon(order.order_type)}
                        {getOrderTypeLabel(order.order_type)}
                      </Badge>
                      <Badge className={`${status.color} text-white`}>
                        {status.label}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Progress Steps */}
                  {!isDelivered && (
                    <div className="relative">
                      <div className="flex justify-between mb-2">
                        {Object.entries(statusConfig).map(([key, config]) => {
                          const isActive = status.step >= config.step;
                          const isCurrent = status.step === config.step;
                          const Icon = config.icon;
                          
                          return (
                            <div key={key} className={`flex flex-col items-center ${isCurrent ? 'scale-110' : ''} transition-transform`}>
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${isActive ? config.color + ' text-white' : 'bg-muted text-muted-foreground'} ${isCurrent ? 'ring-2 ring-offset-2 ring-primary animate-pulse' : ''}`}>
                                <Icon className="h-4 w-4" />
                              </div>
                              <span className={`text-[10px] mt-1 ${isActive ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                                {config.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      <div className="absolute top-4 left-4 right-4 h-0.5 bg-muted -z-10">
                        <div className="h-full bg-primary transition-all duration-500" style={{ width: `${((status.step - 1) / 3) * 100}%` }} />
                      </div>
                    </div>
                  )}

                  {/* Order Items */}
                  <div className="space-y-1 text-sm">
                    {order.order_items.map((item, idx) => (
                      <div key={item.id || idx} className="flex justify-between text-muted-foreground">
                        <span>{item.quantity}x {item.items?.name || 'Item'}</span>
                        <span>R$ {Number(item.price).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>

                  {/* Address */}
                  {order.order_type === 'entrega' && order.address && (
                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      <span>{order.address}</span>
                    </div>
                  )}

                  {/* Total */}
                  <div className="flex justify-between pt-2 border-t font-medium">
                    <span>Total</span>
                    <span className="text-primary">R$ {Number(order.total).toFixed(2)}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </CustomerLayout>
  );
};

export default CustomerMeusPedidos;

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
  customer_phone: string | null;
  order_type: string;
  status: string;
  subtotal: number;
  delivery_tax: number;
  extras_fee: number;
  total: number;
  address: string | null;
  bairro: string | null;
  created_at: string;
  order_items: {
    id: string;
    quantity: number;
    price: number;
    extras: any;
    tapioca_molhada: boolean;
    item: { name: string } | null;
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
    
    console.log('Fetching orders for user:', user.id);
    
    // Filter orders by user_id to only show orders made by this customer
    // @ts-ignore - Supabase types issue with complex queries
    const { data, error } = await supabase
      .from('orders')
      .select('id, customer_name, customer_phone, order_type, status, subtotal, delivery_tax, extras_fee, total, address, bairro, created_at, order_items(id, quantity, price, extras, tapioca_molhada, item:items(name))')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20) as any;

    console.log('Orders fetched:', data, 'Error:', error);

    if (!error && data) {
      setOrders(data as Order[]);
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
                          Pedido #{order.id.slice(-6).toUpperCase()}
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
                  <div className="space-y-2 text-sm border rounded-lg p-3 bg-muted/30">
                    <p className="font-medium text-xs text-muted-foreground uppercase tracking-wide">Itens do Pedido</p>
                    {order.order_items.map((item, idx) => {
                      const extrasAny = item.extras as any;
                      const isLunch = extrasAny?.type === "lunch";
                      const itemLabel = item.item?.name || (isLunch ? `Almoço - ${extrasAny?.base?.name}` : "Item");

                      const selectedVariation =
                        !isLunch && extrasAny && typeof extrasAny === "object" && !Array.isArray(extrasAny)
                          ? (extrasAny.selected_variation as string | undefined)
                          : undefined;

                      const regularExtras = !isLunch
                        ? (Array.isArray(extrasAny)
                            ? extrasAny
                            : (Array.isArray(extrasAny?.regularExtras) ? extrasAny.regularExtras : []))
                        : [];

                      return (
                        <div key={item.id || idx} className="flex justify-between items-start">
                          <div>
                            <span className="font-medium">{item.quantity}x {itemLabel}</span>
                            {item.tapioca_molhada && (
                              <Badge variant="secondary" className="ml-2 text-[10px]">Molhada</Badge>
                            )}
                            {selectedVariation && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                Tipo: {selectedVariation}
                              </p>
                            )}
                            {regularExtras.length > 0 && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                + {regularExtras.map((e: any) => e.name || e).join(', ')}
                              </p>
                            )}
                          </div>
                          <span className="font-medium">R$ {(Number(item.price) * item.quantity).toFixed(2)}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Address */}
                  {order.order_type === 'entrega' && (order.address || order.bairro) && (
                    <div className="text-sm text-muted-foreground flex items-start gap-2 bg-muted/30 rounded-lg p-3">
                      <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-foreground">Endereço de Entrega</p>
                        {order.address && <p>{order.address}</p>}
                        {order.bairro && <p>{order.bairro}</p>}
                      </div>
                    </div>
                  )}

                  {/* Totals breakdown */}
                  <div className="space-y-1 pt-2 border-t text-sm">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Subtotal</span>
                      <span>R$ {Number(order.subtotal).toFixed(2)}</span>
                    </div>
                    {Number(order.extras_fee) > 0 && (
                      <div className="flex justify-between text-muted-foreground">
                        <span>Extras</span>
                        <span>R$ {Number(order.extras_fee).toFixed(2)}</span>
                      </div>
                    )}
                    {order.order_type === 'entrega' && Number(order.delivery_tax) > 0 && (
                      <div className="flex justify-between text-muted-foreground">
                        <span>Taxa de Entrega</span>
                        <span>R$ {Number(order.delivery_tax).toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-base pt-1">
                      <span>Total</span>
                      <span className="text-primary">R$ {Number(order.total).toFixed(2)}</span>
                    </div>
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

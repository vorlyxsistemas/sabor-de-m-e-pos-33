import { useState, useEffect, useCallback, useRef } from "react";
import { StaffLayout } from "@/components/layout/StaffLayout";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { KanbanCard } from "@/components/kitchen/KanbanCard";
import { OrderDetailsModal } from "@/components/kitchen/OrderDetailsModal";
import { PrintReceipt } from "@/components/kitchen/PrintReceipt";
import { printReceipt } from "@/lib/printReceipt";

type OrderStatus = "pending" | "preparing" | "ready" | "delivered" | "cancelled";

interface OrderItem {
  quantity: number;
  price: number;
  extras: any;
  tapioca_molhada: boolean;
  item: { name: string } | null;
}

interface Order {
  id: string;
  customer_name: string;
  customer_phone: string | null;
  status: OrderStatus;
  order_type: string;
  table_number: number | null;
  address: string | null;
  bairro: string | null;
  cep: string | null;
  reference: string | null;
  subtotal: number;
  delivery_tax: number | null;
  extras_fee: number | null;
  total: number;
  created_at: string;
  scheduled_for: string | null;
  payment_method: string | null;
  troco: number | null;
  order_items: OrderItem[];
}

const STATUS_ORDER: OrderStatus[] = ["pending", "preparing", "ready", "delivered"];

const columns: { status: OrderStatus; title: string; color: string }[] = [
  { status: "pending", title: "A Preparar", color: "bg-yellow-500" },
  { status: "preparing", title: "Preparando", color: "bg-blue-500" },
  { status: "ready", title: "Pronto", color: "bg-green-500" },
  { status: "delivered", title: "Entregue", color: "bg-gray-500" },
];

function getNextStatus(current: OrderStatus): OrderStatus | null {
  const idx = STATUS_ORDER.indexOf(current);
  if (idx < 0 || idx >= STATUS_ORDER.length - 1) return null;
  return STATUS_ORDER[idx + 1];
}

const Kitchen = () => {
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [printOrder, setPrintOrder] = useState<Order | null>(null);
  const [autoPrintEnabled, setAutoPrintEnabled] = useState(false);
  const printedOrdersRef = useRef<Set<string>>(new Set());

  // Fetch auto-print setting
  const fetchSettings = useCallback(async () => {
    try {
      const { data } = await supabase.functions.invoke("settings", {
        method: "GET",
      });
      setAutoPrintEnabled(data?.auto_print_enabled || false);
    } catch (error) {
      console.error("Erro ao carregar configurações:", error);
    }
  }, []);

  const fetchOrders = useCallback(async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // @ts-ignore - bairro/payment_method/troco columns exist but types are not updated
      const { data, error } = await (supabase as any)
        .from("orders")
        .select(`
          id,
          customer_name,
          customer_phone,
          status,
          order_type,
          table_number,
          address,
          bairro,
          cep,
          reference,
          subtotal,
          delivery_tax,
          extras_fee,
          total,
          created_at,
          scheduled_for,
          payment_method,
          troco,
          order_items(quantity, price, extras, tapioca_molhada, item:items(name))
        `)
        .gte("created_at", today.toISOString())
        .neq("status", "cancelled")
        .order("created_at");

      if (error) throw error;
      setOrders((data as Order[]) || []);
    } catch (error) {
      console.error("Erro ao buscar pedidos:", error);
      toast({
        title: "Erro ao carregar pedidos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Auto-print new pending orders (only if enabled)
  const autoPrintPendingOrders = useCallback((newOrders: Order[], shouldPrint: boolean) => {
    if (!shouldPrint) {
      console.log("Auto-print disabled, skipping");
      return;
    }

    newOrders.forEach((order) => {
      if (order.status === "pending" && !printedOrdersRef.current.has(order.id)) {
        printedOrdersRef.current.add(order.id);
        console.log("Auto-printing order:", order.id);
        
        // Small delay to ensure order data is complete
        setTimeout(() => {
          try {
            printReceipt(order);
            toast({
              title: "Comanda impressa",
              description: `Pedido #${order.id.slice(-6).toUpperCase()} enviado para impressão`,
            });
          } catch (error) {
            console.error("Erro ao imprimir comanda:", error);
            toast({
              title: "Erro na impressão",
              description: "Não foi possível imprimir a comanda automaticamente",
              variant: "destructive",
            });
          }
        }, 500);
      }
    });
  }, [toast]);

  useEffect(() => {
    fetchSettings();
    fetchOrders();

    // Realtime subscription
    const channel = supabase
      .channel("kitchen-orders-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        async (payload) => {
          console.log("New order inserted:", payload);
          // Fetch latest settings to check if auto-print is enabled
          const { data: settings } = await supabase.functions.invoke("settings", {
            method: "GET",
          });
          const shouldPrint = settings?.auto_print_enabled || false;
          
          // Fetch the complete order with items for printing
          // @ts-ignore - bairro/payment_method/troco columns exist but types are not updated
          const { data: newOrder } = await (supabase as any)
            .from("orders")
            .select(`
              id,
              customer_name,
              customer_phone,
              status,
              order_type,
              address,
              bairro,
              cep,
              reference,
              subtotal,
              delivery_tax,
              extras_fee,
              total,
              created_at,
              scheduled_for,
              payment_method,
              troco,
              order_items(quantity, price, extras, tapioca_molhada, item:items(name))
            `)
            .eq("id", payload.new.id)
            .single();
          
          if (newOrder && (newOrder as any).status === "pending") {
            autoPrintPendingOrders([newOrder as Order], shouldPrint);
          }
          fetchOrders();
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders" },
        () => {
          fetchOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchOrders, fetchSettings, autoPrintPendingOrders]);

  const moveOrder = async (orderId: string, currentStatus: OrderStatus) => {
    const nextStatus = getNextStatus(currentStatus);
    if (!nextStatus) {
      toast({ title: "Este pedido já está no último estágio" });
      return;
    }

    try {
      const { error } = await supabase
        .from("orders")
        .update({ status: nextStatus })
        .eq("id", orderId);

      if (error) throw error;

      // Optimistic update
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: nextStatus } : o))
      );

      toast({
        title: "Status atualizado!",
        description: `Pedido movido para "${columns.find((c) => c.status === nextStatus)?.title}"`,
      });
    } catch (error: any) {
      console.error("Erro ao atualizar status:", error);
      toast({
        title: "Erro ao atualizar",
        description: error.message || "Tente novamente",
        variant: "destructive",
      });
    }
  };

  const cancelOrder = async (orderId: string, reason: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from("orders")
        .update({ 
          status: "cancelled",
          cancel_reason: reason,
          cancelled_at: new Date().toISOString(),
          cancelled_by: user?.id || null
        } as any)
        .eq("id", orderId);

      if (error) throw error;

      setOrders((prev) => prev.filter((o) => o.id !== orderId));

      toast({
        title: "Pedido cancelado",
        description: `Pedido #${orderId.slice(-6).toUpperCase()} foi cancelado`,
      });
    } catch (error: any) {
      console.error("Erro ao cancelar pedido:", error);
      toast({
        title: "Erro ao cancelar",
        description: error.message || "Tente novamente",
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleViewDetails = (order: Order) => {
    setSelectedOrder(order);
    setShowDetails(true);
  };

  const handlePrint = (order: Order) => {
    setShowDetails(false);
    setPrintOrder(order);
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

  if (printOrder) {
    return <PrintReceipt order={printOrder} onClose={() => setPrintOrder(null)} />;
  }

  return (
    <StaffLayout title="Cozinha" subtitle="Kanban de pedidos em tempo real">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {columns.map((col) => {
          const columnOrders = orders.filter((o) => o.status === col.status);
          return (
            <div key={col.status} className="flex flex-col min-w-0 relative z-0">
              <div className="flex items-center gap-2 sticky top-0 bg-background py-2 z-10">
                <div className={`w-3 h-3 rounded-full ${col.color}`} />
                <h3 className="font-semibold">{col.title}</h3>
                <Badge variant="outline">{columnOrders.length}</Badge>
              </div>
              <div className="flex flex-col gap-2 min-h-[200px] bg-muted/30 rounded-lg p-2 overflow-x-hidden overflow-y-auto">
                {columnOrders.map((order) => (
                  <KanbanCard
                    key={order.id}
                    order={order}
                    onAdvance={() => moveOrder(order.id, order.status)}
                    onViewDetails={() => handleViewDetails(order)}
                    onCancel={cancelOrder}
                    canAdvance={col.status !== "delivered"}
                    canCancel={order.status === "pending"}
                  />
                ))}
                {columnOrders.length === 0 && (
                  <div className="text-center text-muted-foreground text-sm py-8">
                    Nenhum pedido
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <OrderDetailsModal
        order={selectedOrder}
        open={showDetails}
        onClose={() => setShowDetails(false)}
        onPrint={handlePrint}
      />
    </StaffLayout>
  );
};

export default Kitchen;

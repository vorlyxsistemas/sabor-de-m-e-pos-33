import { useState, useEffect, useCallback, useRef } from "react";
import { StaffLayout } from "@/components/layout/StaffLayout";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { KanbanCard } from "@/components/kitchen/KanbanCard";
import { OrderDetailsModal } from "@/components/kitchen/OrderDetailsModal";
import { EditOrderModal } from "@/components/kitchen/EditOrderModal";
import { PrintReceipt } from "@/components/kitchen/PrintReceipt";
import { printReceipt } from "@/lib/printReceipt";

type OrderStatus = "pending" | "preparing" | "ready" | "delivered" | "cancelled";

interface OrderItem {
  item_id?: string | null;
  quantity: number;
  price: number;
  extras: any;
  tapioca_molhada: boolean;
  item: { id?: string; name: string; price?: number } | null;
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
  last_modified_at?: string | null;
  observations?: string | null;
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

const StaffKanban = () => {
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [editOrder, setEditOrder] = useState<Order | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [printOrder, setPrintOrder] = useState<Order | null>(null);
  const [autoPrintEnabled, setAutoPrintEnabled] = useState(false);
  const printedOrdersRef = useRef<Set<string>>(new Set());

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

      // Use edge function to fetch orders with items (bypasses RLS issues)
      const { data, error } = await supabase.functions.invoke("orders", {
        method: "GET",
      });

      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      const allOrders = (((data as any)?.data || []) as Order[]).filter(Boolean);

      // Filter for today and non-cancelled
      const filtered = allOrders
        .filter((o) => {
          const createdAt = new Date(o.created_at);
          return createdAt >= today && o.status !== "cancelled";
        })
        // keep same ordering as before (created_at asc)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      setOrders(filtered);
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

  const autoPrintPendingOrders = useCallback((newOrders: Order[], shouldPrint: boolean) => {
    if (!shouldPrint) return;

    newOrders.forEach((order) => {
      if (order.status === "pending" && !printedOrdersRef.current.has(order.id)) {
        printedOrdersRef.current.add(order.id);
        setTimeout(() => {
          try {
            printReceipt(order);
            toast({
              title: "Comanda impressa",
              description: `Pedido #${order.id.slice(-6).toUpperCase()} enviado para impressão`,
            });
          } catch (error) {
            console.error("Erro ao imprimir comanda:", error);
          }
        }, 500);
      }
    });
  }, [toast]);

  useEffect(() => {
    fetchSettings();
    fetchOrders();

    const channel = supabase
      .channel("staff-kanban-orders")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        async (payload) => {
          const { data: settings } = await supabase.functions.invoke("settings", {
            method: "GET",
          });
          const shouldPrint = settings?.auto_print_enabled || false;

          // Fetch the new order via edge function to get complete data with item names
          const { data: ordersData } = await supabase.functions.invoke("orders", {
            method: "GET",
          });

          const allOrders = (((ordersData as any)?.data || []) as Order[]).filter(Boolean);
          const newOrder = allOrders.find((o) => o.id === payload.new.id);

          if (newOrder && newOrder.status === "pending") {
            autoPrintPendingOrders([newOrder], shouldPrint);
          }
          fetchOrders();
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders" },
        () => fetchOrders()
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

  const handleEditOrder = (order: Order) => {
    setEditOrder(order);
    setShowEditModal(true);
  };

  const handlePrint = (order: Order) => {
    setShowDetails(false);
    setPrintOrder(order);
  };

  if (loading) {
    return (
      <StaffLayout title="Kanban" subtitle="Produção da cozinha">
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
    <StaffLayout title="Kanban" subtitle="Produção da cozinha em tempo real">
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
                    onEdit={() => handleEditOrder(order)}
                    canAdvance={col.status !== "delivered"}
                    canCancel={order.status === "pending"}
                    canEdit={order.status !== "cancelled"}
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

      <EditOrderModal
        open={showEditModal}
        onOpenChange={setShowEditModal}
        order={editOrder}
        onOrderUpdated={fetchOrders}
      />
    </StaffLayout>
  );
};

export default StaffKanban;

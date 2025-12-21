import { useState, useEffect, useCallback, useRef } from "react";
import { StaffLayout } from "@/components/layout/StaffLayout";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Printer } from "lucide-react";
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
  observations: string | null;
  printed?: boolean;
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
  const [editOrder, setEditOrder] = useState<Order | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [printOrder, setPrintOrder] = useState<Order | null>(null);
  const [autoPrintEnabled, setAutoPrintEnabled] = useState(false);
  const [togglingAutoPrint, setTogglingAutoPrint] = useState(false);
  const printedOrdersRef = useRef<Set<string>>(new Set());
  const initialPrintDoneRef = useRef(false);

  // Fetch auto-print setting using public endpoint (accessible to staff)
  const fetchSettings = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke("settings-public", {
        method: "GET",
      });
      if (error) {
        console.error("Erro ao carregar configurações:", error);
        // Fallback to localStorage if settings fetch fails
        const localSetting = localStorage.getItem("autoPrintEnabled");
        setAutoPrintEnabled(localSetting === "true");
        return;
      }
      setAutoPrintEnabled(data?.auto_print_enabled || false);
    } catch (error) {
      console.error("Erro ao carregar configurações:", error);
      // Fallback to localStorage
      const localSetting = localStorage.getItem("autoPrintEnabled");
      setAutoPrintEnabled(localSetting === "true");
    }
  }, []);

  // Toggle auto-print setting
  const toggleAutoPrint = async (enabled: boolean) => {
    setTogglingAutoPrint(true);
    try {
      // Try to update in database via settings endpoint (admin only)
      const { error } = await supabase.functions.invoke("settings", {
        method: "POST",
        body: { auto_print_enabled: enabled },
      });

      if (error) {
        // If not admin, save locally only
        console.log("Salvando configuração localmente");
        localStorage.setItem("autoPrintEnabled", String(enabled));
      }

      setAutoPrintEnabled(enabled);
      toast({
        title: enabled ? "Impressão automática ativada" : "Impressão automática desativada",
        description: enabled 
          ? "Novos pedidos serão impressos automaticamente" 
          : "Impressão manual continua disponível",
      });
    } catch (error) {
      console.error("Erro ao alterar configuração:", error);
      // Fallback to localStorage
      localStorage.setItem("autoPrintEnabled", String(enabled));
      setAutoPrintEnabled(enabled);
    } finally {
      setTogglingAutoPrint(false);
    }
  };

  const fetchOrders = useCallback(async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

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
          observations,
          printed,
          order_items(item_id, quantity, price, extras, tapioca_molhada, item:items(name))
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

  // Auto-print new pending orders (only if enabled and not already printed)
  const autoPrintPendingOrders = useCallback(
    async (newOrders: Order[], shouldPrint: boolean) => {
      if (!shouldPrint) {
        console.log("Auto-print desativado, ignorando impressão");
        return;
      }

      console.log(`Verificando ${newOrders.length} pedidos para impressão automática...`);

      for (const order of newOrders) {
        console.log(`Pedido ${order.id}: status=${order.status}, printed=${order.printed}, já impresso nesta sessão=${printedOrdersRef.current.has(order.id)}`);
        
        // Check if order is pending, not already printed in DB, and not printed in this session
        if (order.status === "pending" && order.printed === false && !printedOrdersRef.current.has(order.id)) {
          // Mark as being printed in this session IMMEDIATELY to prevent duplicates
          printedOrdersRef.current.add(order.id);
          console.log(`[AUTO-PRINT] Iniciando impressão do pedido ${order.id}...`);

          try {
            // Print the receipt
            const success = await printReceipt(order);
            
            if (success) {
              // Mark as printed in database
              const { error: updateError } = await (supabase as any)
                .from("orders")
                .update({ printed: true })
                .eq("id", order.id);

              if (updateError) {
                console.error("Erro ao atualizar status de impressão:", updateError);
              } else {
                console.log(`[AUTO-PRINT] Pedido ${order.id} marcado como impresso no banco`);
              }

              toast({
                title: "🖨️ Comanda impressa automaticamente",
                description: `Pedido #${order.id.slice(-6).toUpperCase()}`,
              });
            } else {
              console.error(`[AUTO-PRINT] Falha ao imprimir pedido ${order.id}`);
              toast({
                title: "Erro na impressão",
                description: `Não foi possível imprimir pedido #${order.id.slice(-6).toUpperCase()}`,
                variant: "destructive",
              });
            }
          } catch (error) {
            console.error("Erro ao imprimir comanda:", error);
            toast({
              title: "Erro na impressão",
              description: "Não foi possível imprimir a comanda automaticamente",
              variant: "destructive",
            });
          }

          // Small delay between prints to avoid overwhelming the printer
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      }
    },
    [toast]
  );

  // Print unprinted pending orders on initial load (for computer restart scenario)
  const printUnprintedOrders = useCallback(async (ordersToCheck: Order[], shouldPrint: boolean) => {
    if (!shouldPrint) {
      console.log("Impressão automática desativada, ignorando pedidos pendentes");
      return;
    }
    
    if (initialPrintDoneRef.current) {
      console.log("Impressão inicial já realizada nesta sessão");
      return;
    }
    
    initialPrintDoneRef.current = true;

    const unprintedPending = ordersToCheck.filter(
      order => order.status === "pending" && order.printed === false && !printedOrdersRef.current.has(order.id)
    );

    if (unprintedPending.length === 0) {
      console.log("Nenhum pedido pendente não impresso encontrado");
      return;
    }

    console.log(`[STARTUP] Encontrados ${unprintedPending.length} pedidos pendentes não impressos`);
    
    // Small delay to ensure page is fully loaded
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    for (const order of unprintedPending) {
      printedOrdersRef.current.add(order.id);
      console.log(`[STARTUP] Imprimindo pedido pendente: ${order.id}`);

      try {
        const success = await printReceipt(order);
        
        if (success) {
          // Mark as printed in database
          await (supabase as any)
            .from("orders")
            .update({ printed: true })
            .eq("id", order.id);

          toast({
            title: "🖨️ Comanda impressa (pendente)",
            description: `Pedido #${order.id.slice(-6).toUpperCase()}`,
          });
        }
      } catch (error) {
        console.error("Erro ao imprimir comanda:", error);
      }

      // Delay between prints
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }, [toast]);

  useEffect(() => {
    const initializeKitchen = async () => {
      await fetchSettings();
      
      // Fetch orders and check for unprinted pending orders
      const today = new Date();
      today.setHours(0, 0, 0, 0);

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
          observations,
          printed,
          order_items(item_id, quantity, price, extras, tapioca_molhada, item:items(name))
        `)
        .gte("created_at", today.toISOString())
        .neq("status", "cancelled")
        .order("created_at");

      if (!error && data) {
        setOrders(data as Order[]);
        setLoading(false);

        // Check localStorage first (for staff), then use state
        const localSetting = localStorage.getItem("autoPrintEnabled");
        const shouldPrint = localSetting === "true" || autoPrintEnabled;
        
        // Print any unprinted pending orders from previous session
        await printUnprintedOrders(data as Order[], shouldPrint);
      } else {
        setLoading(false);
      }
    };

    initializeKitchen();

    // Realtime subscription
    const channel = supabase
      .channel("kitchen-orders-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        async (payload) => {
          console.log("[REALTIME] Novo pedido detectado:", payload.new.id);
          
          // Check if auto-print is enabled (localStorage first, then DB)
          const localSetting = localStorage.getItem("autoPrintEnabled");
          let shouldPrint = localSetting === "true";
          
          console.log(`[REALTIME] Auto-print localStorage: ${localSetting}, shouldPrint inicial: ${shouldPrint}`);
          
          if (!shouldPrint && localSetting !== "false") {
            // Only check DB if localStorage doesn't have an explicit setting
            try {
              const { data: settings } = await supabase.functions.invoke("settings-public", {
                method: "GET",
              });
              shouldPrint = settings?.auto_print_enabled || false;
              console.log(`[REALTIME] Auto-print do banco: ${shouldPrint}`);
            } catch (err) {
              console.error("[REALTIME] Erro ao buscar configurações:", err);
              shouldPrint = false;
            }
          }

          console.log(`[REALTIME] Decisão final: shouldPrint = ${shouldPrint}`);

          // Fetch the complete order with items for printing
          const { data: newOrder, error: fetchError } = await (supabase as any)
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
              observations,
              printed,
              order_items(item_id, quantity, price, extras, tapioca_molhada, item:items(name))
            `)
            .eq("id", payload.new.id)
            .single();

          if (fetchError) {
            console.error("[REALTIME] Erro ao buscar detalhes do pedido:", fetchError);
            fetchOrders();
            return;
          }

          console.log(`[REALTIME] Pedido carregado: status=${newOrder?.status}, printed=${newOrder?.printed}`);

          if (newOrder && newOrder.status === "pending") {
            // Call auto-print function
            await autoPrintPendingOrders([newOrder as Order], shouldPrint);
          }
          
          fetchOrders();
        }
      )
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders" }, () => {
        fetchOrders();
      })
      .subscribe((status) => {
        console.log(`[REALTIME] Status da conexão: ${status}`);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchOrders, fetchSettings, autoPrintPendingOrders, printUnprintedOrders, autoPrintEnabled]);

  const moveOrder = async (orderId: string, currentStatus: OrderStatus) => {
    const nextStatus = getNextStatus(currentStatus);
    if (!nextStatus) {
      toast({ title: "Este pedido já está no último estágio" });
      return;
    }

    try {
      const { error } = await supabase.from("orders").update({ status: nextStatus }).eq("id", orderId);

      if (error) throw error;

      // Optimistic update
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: nextStatus } : o)));

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
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { error } = await supabase
        .from("orders")
        .update(
          {
            status: "cancelled",
            cancel_reason: reason,
            cancelled_at: new Date().toISOString(),
            cancelled_by: user?.id || null,
          } as any
        )
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
      {/* Auto-print toggle */}
      <div className="flex items-center justify-end gap-3 mb-4 p-3 bg-muted/50 rounded-lg">
        <Printer className="h-4 w-4 text-muted-foreground" />
        <Label htmlFor="auto-print" className="text-sm font-medium cursor-pointer">
          Impressão automática
        </Label>
        <Switch
          id="auto-print"
          checked={autoPrintEnabled}
          onCheckedChange={toggleAutoPrint}
          disabled={togglingAutoPrint}
        />
        <span className={`text-xs font-medium px-2 py-1 rounded ${autoPrintEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
          {autoPrintEnabled ? "Ativada" : "Desativada"}
        </span>
      </div>

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
                  <div className="text-center text-muted-foreground text-sm py-8">Nenhum pedido</div>
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

export default Kitchen;

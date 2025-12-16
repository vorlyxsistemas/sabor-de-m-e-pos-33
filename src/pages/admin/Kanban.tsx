import { useState, useEffect, useCallback, useRef } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Archive, ArchiveX } from "lucide-react";
import { KanbanCard } from "@/components/kitchen/KanbanCard";
import { OrderDetailsModal } from "@/components/kitchen/OrderDetailsModal";
import { PrintReceipt } from "@/components/kitchen/PrintReceipt";
import { printReceipt } from "@/lib/printReceipt";
import { Card, CardContent } from "@/components/ui/card";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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
  archived?: boolean;
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

const isMissingArchivedColumnError = (err: any) => {
  const code = err?.code;
  return code === "42703" || code === "PGRST204";
};

const Kanban = () => {
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [archivedOrders, setArchivedOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [printOrder, setPrintOrder] = useState<Order | null>(null);
  const [autoPrintEnabled, setAutoPrintEnabled] = useState(false);
  const [activeTab, setActiveTab] = useState("kanban");
  const [archiveSupported, setArchiveSupported] = useState(false);
  const printedOrdersRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!archiveSupported && activeTab !== "kanban") setActiveTab("kanban");
  }, [archiveSupported, activeTab]);

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

      const queryBase = (select: string) =>
        (supabase as any)
          .from("orders")
          .select(select)
          .gte("created_at", today.toISOString())
          .neq("status", "cancelled")
          .order("created_at");

      const selectWithArchived = `
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
          archived,
          order_items(quantity, price, extras, tapioca_molhada, item:items(name))
        `;

      const selectWithoutArchived = `
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
        `;

      // 1) Try with archived (if schema supports it)
      // @ts-ignore - archived/bairro/payment_method/troco columns exist but types are not updated
      const { data, error } = await queryBase(selectWithArchived);

      if (error && isMissingArchivedColumnError(error)) {
        // 2) Fallback without archived (keeps Kanban working)
        setArchiveSupported(false);
        // @ts-ignore - bairro/payment_method/troco columns exist but types are not updated
        const { data: fallbackData, error: fallbackError } = await queryBase(selectWithoutArchived);
        if (fallbackError) throw fallbackError;

        const allOrders = ((fallbackData || []) as Order[]).map((o) => ({ ...o, archived: false }));
        setOrders(allOrders);
        setArchivedOrders([]);
        return;
      }

      if (error) throw error;

      setArchiveSupported(true);
      const allOrders = ((data || []) as Order[]).map((o) => ({ ...o, archived: !!o.archived }));
      setOrders(allOrders.filter((o) => !o.archived));
      setArchivedOrders(allOrders.filter((o) => o.archived));
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

  const autoPrintPendingOrders = useCallback(
    (newOrders: Order[], shouldPrint: boolean) => {
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
    },
    [toast]
  );

  useEffect(() => {
    fetchSettings();
    fetchOrders();

    const channel = supabase
      .channel("admin-kanban-orders")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        async (payload) => {
          const { data: settings } = await supabase.functions.invoke("settings", {
            method: "GET",
          });
          const shouldPrint = settings?.auto_print_enabled || false;

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
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders" }, () => {
        fetchOrders();
      })
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
      const { error } = await supabase.from("orders").update({ status: nextStatus }).eq("id", orderId);

      if (error) throw error;

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

  const archiveOrder = async (orderId: string) => {
    if (!archiveSupported) {
      toast({
        title: "Arquivamento indisponível",
        description: "Falta a coluna 'archived' no banco. Adicione-a para habilitar.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase.from("orders").update({ archived: true } as any).eq("id", orderId);
      if (error) {
        if (isMissingArchivedColumnError(error)) setArchiveSupported(false);
        throw error;
      }
      toast({ title: "Pedido arquivado!" });
      fetchOrders();
    } catch (error: any) {
      console.error("Erro ao arquivar:", error);
      toast({
        title: "Erro ao arquivar",
        description: error.message || "Tente novamente",
        variant: "destructive",
      });
    }
  };

  const unarchiveOrder = async (orderId: string) => {
    if (!archiveSupported) {
      toast({
        title: "Arquivamento indisponível",
        description: "Falta a coluna 'archived' no banco. Adicione-a para habilitar.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase.from("orders").update({ archived: false } as any).eq("id", orderId);
      if (error) {
        if (isMissingArchivedColumnError(error)) setArchiveSupported(false);
        throw error;
      }
      toast({ title: "Pedido restaurado!" });
      fetchOrders();
    } catch (error: any) {
      console.error("Erro ao restaurar:", error);
      toast({
        title: "Erro ao restaurar",
        description: error.message || "Tente novamente",
        variant: "destructive",
      });
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
      <AdminLayout title="Cozinha" subtitle="Kanban de pedidos">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </AdminLayout>
    );
  }

  if (printOrder) {
    return <PrintReceipt order={printOrder} onClose={() => setPrintOrder(null)} />;
  }

  return (
    <AdminLayout title="Cozinha" subtitle="Kanban de pedidos em tempo real">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="kanban" className="gap-2">
            Kanban
            <Badge variant="secondary">{orders.length}</Badge>
          </TabsTrigger>
          {archiveSupported && (
            <TabsTrigger value="archived" className="gap-2">
              <Archive className="h-4 w-4" />
              Arquivados
              <Badge variant="outline">{archivedOrders.length}</Badge>
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="kanban">
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
                      <div key={order.id} className="space-y-2">
                        <KanbanCard
                          order={order}
                          onAdvance={() => moveOrder(order.id, order.status)}
                          onViewDetails={() => handleViewDetails(order)}
                          canAdvance={col.status !== "delivered"}
                        />
                        {archiveSupported && col.status === "delivered" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full text-xs gap-1"
                            onClick={() => archiveOrder(order.id)}
                          >
                            <Archive className="h-3 w-3" />
                            Arquivar
                          </Button>
                        )}
                      </div>
                    ))}
                    {columnOrders.length === 0 && (
                      <div className="text-center text-muted-foreground text-sm py-8">Nenhum pedido</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>

        {archiveSupported && (
          <TabsContent value="archived">
            <div className="space-y-4">
              {archivedOrders.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Archive className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">Nenhum pedido arquivado hoje</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {archivedOrders.map((order) => (
                    <Card key={order.id} className="opacity-75">
                      <CardContent className="pt-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-semibold">#{order.id.slice(-6).toUpperCase()}</span>
                          <span className="text-sm text-muted-foreground">
                            {format(new Date(order.created_at), "HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                        <p className="text-sm">{order.customer_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {order.order_items?.length || 0} itens • R$ {Number(order.total).toFixed(2)}
                        </p>
                        <div className="flex gap-2 mt-3">
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 text-xs"
                            onClick={() => handleViewDetails(order)}
                          >
                            Detalhes
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs gap-1"
                            onClick={() => unarchiveOrder(order.id)}
                          >
                            <ArchiveX className="h-3 w-3" />
                            Restaurar
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        )}
      </Tabs>

      <OrderDetailsModal
        order={selectedOrder}
        open={showDetails}
        onClose={() => setShowDetails(false)}
        onPrint={handlePrint}
      />
    </AdminLayout>
  );
};

export default Kanban;

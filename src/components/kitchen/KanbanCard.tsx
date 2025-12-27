import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, Eye, Truck, Package, UtensilsCrossed, Clock, X, Pencil } from "lucide-react";
import { format } from "date-fns";
import { CancelOrderDialog } from "@/components/order/CancelOrderDialog";

interface OrderItem {
  quantity: number;
  price: number;
  extras: any;
  tapioca_molhada?: boolean;
  item: { name: string } | null;
}

interface Order {
  id: string;
  customer_name: string;
  status: string;
  order_type: string;
  table_number: number | null;
  created_at: string;
  order_items: OrderItem[];
  observations?: string | null;
  last_modified_at?: string | null;
}

interface KanbanCardProps {
  order: Order;
  onAdvance: () => void;
  onViewDetails: () => void;
  onCancel?: (orderId: string, reason: string) => Promise<void>;
  onEdit?: () => void;
  canAdvance: boolean;
  canCancel?: boolean;
  canEdit?: boolean;
}

const orderTypeConfig: Record<string, { icon: React.ReactNode; label: string; bgColor: string; textColor: string }> = {
  entrega: {
    icon: <Truck className="h-3 w-3" />,
    label: "Entrega",
    bgColor: "bg-blue-100",
    textColor: "text-blue-700",
  },
  retirada: {
    icon: <Package className="h-3 w-3" />,
    label: "Retirada",
    bgColor: "bg-orange-100",
    textColor: "text-orange-700",
  },
  local: {
    icon: <UtensilsCrossed className="h-3 w-3" />,
    label: "Local",
    bgColor: "bg-green-100",
    textColor: "text-green-700",
  },
};

export function KanbanCard({ order, onAdvance, onViewDetails, onCancel, onEdit, canAdvance, canCancel = true, canEdit = false }: KanbanCardProps) {
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const orderNumber = order.id.slice(-6).toUpperCase();
  const time = format(new Date(order.created_at), "HH:mm");
  const typeConfig = orderTypeConfig[order.order_type] || orderTypeConfig.local;
  const wasModified = !!order.last_modified_at;

  const itemsSummary = order.order_items
    ?.map((oi) => {
      const extras = oi.extras as any;
      const isLunch = extras?.type === "lunch";
      if (isLunch) {
        const baseName = extras?.base?.name || "Base";
        return `${oi.quantity}x Almoço (${baseName})`;
      }

      // Ensure we always have a name - check multiple sources
      const name = oi.item?.name || extras?.itemName || "Item";
      const variation = extras?.selected_variation;
      return variation ? `${oi.quantity}x ${name} (${variation})` : `${oi.quantity}x ${name}`;
    })
    .join(", ") || "Sem itens";

  const handleCancelConfirm = async (reason: string) => {
    if (!onCancel) return;
    setIsCancelling(true);
    try {
      await onCancel(order.id, reason);
      setCancelDialogOpen(false);
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <>
      <Card
        className="w-full max-w-full min-h-[130px] bg-white border border-border/50 rounded-xl p-4 flex flex-col justify-between gap-1.5 overflow-hidden shadow-sm transition-shadow box-border relative z-[1]"
      >
        {/* Top: Order ID + Badge + Modified indicator */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-foreground/80 truncate">
              #{orderNumber}
            </span>
            {wasModified && (
              <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 bg-amber-50 text-amber-700 border-amber-200">
                Atualizado
              </Badge>
            )}
          </div>
          <div
            className={`flex items-center gap-1 px-1.5 h-5 rounded-full text-xs font-medium shrink-0 ${typeConfig.bgColor} ${typeConfig.textColor}`}
          >
            {typeConfig.icon}
            <span>{typeConfig.label}</span>
            {order.order_type === 'local' && order.table_number && (
              <span className="ml-1">Mesa {order.table_number}</span>
            )}
          </div>
        </div>

        {/* Content: Time, Name, Summary */}
        <div className="flex flex-col gap-1 flex-1">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{time}</span>
          </div>

          <div className="text-sm font-medium text-foreground break-words">
            {order.customer_name}
          </div>

          <div className="text-[13px] text-muted-foreground break-words leading-tight">
            {itemsSummary}
          </div>

          {/* Observações */}
          {order.observations && (
            <div className="mt-1 rounded-md border border-border/50 bg-accent/30 px-2 py-1 text-[12px] text-foreground whitespace-pre-wrap break-words">
              <span className="font-semibold">Observações:</span> {order.observations}
            </div>
          )}
        </div>

      {/* Actions */}
      <div className="flex gap-1.5 mt-1.5 flex-wrap">
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-[11px] px-2 rounded-md"
          onClick={onViewDetails}
        >
          <Eye className="h-3 w-3 mr-1" />
          Detalhes
        </Button>
        {canEdit && onEdit && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 rounded-md text-blue-600 border-blue-200 hover:bg-blue-50"
            onClick={onEdit}
          >
            <Pencil className="h-3 w-3" />
          </Button>
        )}
        {canCancel && onCancel && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 rounded-md text-destructive border-destructive/50 hover:bg-destructive/10"
            onClick={() => setCancelDialogOpen(true)}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
        {canAdvance && (
          <Button
            size="sm"
            className="flex-1 h-7 text-[11px] px-2 rounded-md"
            onClick={onAdvance}
          >
            Avançar
            <ChevronRight className="h-3 w-3 ml-0.5" />
          </Button>
        )}
      </div>
    </Card>

    <CancelOrderDialog
      open={cancelDialogOpen}
      onOpenChange={setCancelDialogOpen}
      onConfirm={handleCancelConfirm}
      orderNumber={orderNumber}
      isLoading={isCancelling}
    />
  </>
);
}

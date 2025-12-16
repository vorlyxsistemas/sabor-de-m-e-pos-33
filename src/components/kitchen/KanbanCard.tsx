import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronRight, Eye, Truck, Package, UtensilsCrossed, Clock } from "lucide-react";
import { format } from "date-fns";

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
  created_at: string;
  order_items: OrderItem[];
}

interface KanbanCardProps {
  order: Order;
  onAdvance: () => void;
  onViewDetails: () => void;
  canAdvance: boolean;
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

export function KanbanCard({ order, onAdvance, onViewDetails, canAdvance }: KanbanCardProps) {
  const orderNumber = order.id.slice(-6).toUpperCase();
  const time = format(new Date(order.created_at), "HH:mm");
  const typeConfig = orderTypeConfig[order.order_type] || orderTypeConfig.local;

  const itemsSummary = order.order_items
    ?.map((oi) => {
      const extras = oi.extras as any;
      const isLunch = extras?.type === "lunch";
      if (isLunch) {
        return `${oi.quantity}x Almoço (${extras?.base?.name || "Base"})`;
      }

      const name = oi.item?.name || "Item";
      const variation = extras?.selected_variation;
      return variation ? `${oi.quantity}x ${name} (${variation})` : `${oi.quantity}x ${name}`;
    })
    .join(", ") || "Sem itens";

  return (
    <Card
      className="w-full max-w-full min-h-[130px] bg-white border border-border/50 rounded-xl p-4 flex flex-col justify-between gap-1.5 overflow-hidden shadow-sm transition-shadow box-border relative z-[1]"
    >
      {/* Top: Order ID + Badge */}
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-sm text-foreground/80 truncate">
          #{orderNumber}
        </span>
        <div
          className={`flex items-center gap-1 px-1.5 h-5 rounded-full text-xs font-medium shrink-0 ${typeConfig.bgColor} ${typeConfig.textColor}`}
        >
          {typeConfig.icon}
          <span>{typeConfig.label}</span>
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
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-1.5">
        <Button
          size="sm"
          variant="outline"
          className="flex-1 h-8 text-xs rounded-lg"
          onClick={onViewDetails}
        >
          <Eye className="h-3.5 w-3.5 mr-1" />
          Detalhes
        </Button>
        {canAdvance && (
          <Button
            size="sm"
            className="flex-1 h-8 text-xs rounded-lg"
            onClick={onAdvance}
          >
            Avançar
            <ChevronRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        )}
      </div>
    </Card>
  );
}

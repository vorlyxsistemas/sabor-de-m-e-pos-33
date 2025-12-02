import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, Eye, Truck, Package, UtensilsCrossed } from "lucide-react";
import { format } from "date-fns";

interface OrderItem {
  quantity: number;
  price: number;
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

const orderTypeIcons: Record<string, React.ReactNode> = {
  entrega: <Truck className="h-4 w-4" />,
  retirada: <Package className="h-4 w-4" />,
  local: <UtensilsCrossed className="h-4 w-4" />,
};

const orderTypeColors: Record<string, string> = {
  entrega: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  retirada: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  local: "bg-green-500/10 text-green-600 border-green-500/20",
};

export function KanbanCard({ order, onAdvance, onViewDetails, canAdvance }: KanbanCardProps) {
  const orderNumber = order.id.slice(-6).toUpperCase();
  const time = format(new Date(order.created_at), "HH:mm");
  
  const itemsSummary = order.order_items
    ?.slice(0, 2)
    .map((oi) => `${oi.quantity}x ${oi.item?.name || "Item"}`)
    .join(", ");
  
  const remainingItems = (order.order_items?.length || 0) - 2;

  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="py-2 px-3 pb-1">
        <CardTitle className="text-sm flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-bold">#{orderNumber}</span>
            <Badge 
              variant="outline" 
              className={`text-xs px-1.5 py-0 ${orderTypeColors[order.order_type] || ""}`}
            >
              <span className="mr-1">{orderTypeIcons[order.order_type]}</span>
              {order.order_type === "entrega" ? "Entrega" : order.order_type === "retirada" ? "Retirada" : "Local"}
            </Badge>
          </div>
          <span className="text-xs font-normal text-muted-foreground">{time}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="py-2 px-3 space-y-2">
        <div className="text-sm font-medium truncate">{order.customer_name}</div>
        
        <div className="text-xs text-muted-foreground">
          {itemsSummary}
          {remainingItems > 0 && ` +${remainingItems} mais`}
        </div>

        <div className="flex gap-1.5 pt-1">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 h-7 text-xs"
            onClick={onViewDetails}
          >
            <Eye className="h-3 w-3 mr-1" />
            Detalhes
          </Button>
          {canAdvance && (
            <Button
              size="sm"
              className="flex-1 h-7 text-xs"
              onClick={onAdvance}
            >
              Avançar
              <ChevronRight className="h-3 w-3 ml-1" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

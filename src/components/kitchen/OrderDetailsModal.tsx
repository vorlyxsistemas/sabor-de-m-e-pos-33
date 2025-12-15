import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Printer, MapPin, Phone, User, Clock, CreditCard, Copy, Check } from "lucide-react";
import { format } from "date-fns";
import { printReceipt } from "@/lib/printReceipt";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

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
  status: string;
  order_type: string;
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

interface OrderDetailsModalProps {
  order: Order | null;
  open: boolean;
  onClose: () => void;
  onPrint: (order: Order) => void;
}

const orderTypeLabels: Record<string, string> = {
  local: "Comer no local",
  retirada: "Retirada",
  entrega: "Entrega",
};

const paymentMethodLabels: Record<string, string> = {
  pix: "PIX",
  dinheiro: "Dinheiro",
  cartao: "Cartão",
};

// PIX info
const PIX_KEY = "88982207599";
const PIX_OWNER = "Jorge Luis do Nascimento Francelino";

export function OrderDetailsModal({ order, open, onClose, onPrint }: OrderDetailsModalProps) {
  const [copiedPix, setCopiedPix] = useState(false);
  const { toast } = useToast();

  if (!order) return null;

  const orderNumber = order.id.slice(-6).toUpperCase();
  const paymentRaw = (order.payment_method || "").trim();
  const paymentKey = paymentRaw.toLowerCase();
  const paymentLabel = paymentMethodLabels[paymentKey] || (paymentRaw ? paymentRaw.toUpperCase() : "Não informado");

  const handlePrint = () => {
    printReceipt(order);
  };

  const handleCopyPix = async () => {
    try {
      await navigator.clipboard.writeText(PIX_KEY);
      setCopiedPix(true);
      toast({ title: "Chave PIX copiada!" });
      setTimeout(() => setCopiedPix(false), 2000);
    } catch {
      toast({ title: "Erro ao copiar", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center justify-between">
            <span>Pedido #{orderNumber}</span>
            <Badge variant="outline">{orderTypeLabels[order.order_type] || order.order_type}</Badge>
          </DialogTitle>
          <DialogDescription>
            Detalhes do pedido de {order.customer_name}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          {/* Customer Info */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{order.customer_name}</span>
            </div>
            {order.customer_phone && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="h-4 w-4" />
                <span>{order.customer_phone}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>{format(new Date(order.created_at), "dd/MM/yyyy 'às' HH:mm")}</span>
            </div>
          </div>

          {/* Address (if delivery) */}
          {order.order_type === "entrega" && (
            <div className="bg-muted/50 rounded-lg p-3 space-y-1">
              <div className="flex items-center gap-2 text-sm font-medium">
                <MapPin className="h-4 w-4" />
                Endereço de Entrega
              </div>
              {order.bairro && <p className="text-sm font-medium text-primary">Bairro: {order.bairro}</p>}
              {order.address && <p className="text-sm text-muted-foreground">{order.address}</p>}
              {order.cep && <p className="text-sm text-muted-foreground">CEP: {order.cep}</p>}
              {order.reference && <p className="text-sm font-medium">Referência: {order.reference}</p>}
            </div>
          )}

          {/* Payment Info */}
            <div className="bg-muted/50 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <CreditCard className="h-4 w-4" />
                Pagamento: {paymentLabel}
              </div>
              {paymentKey === "dinheiro" && order.troco && (
                <p className="text-sm font-medium text-orange-600">Troco para: R$ {order.troco.toFixed(2)}</p>
              )}
              {paymentKey === "pix" && (
                <div className="space-y-2 pt-1">
                  <p className="text-xs text-muted-foreground">Chave PIX (Telefone):</p>
                  <div className="flex items-center gap-2">
                    <code className="text-sm bg-background px-2 py-1 rounded flex-1">{PIX_KEY}</code>
                    <Button size="sm" variant="outline" onClick={handleCopyPix} className="gap-1">
                      {copiedPix ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      {copiedPix ? 'Copiado' : 'Copiar'}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Favorecido: {PIX_OWNER}</p>
                </div>
              )}
            </div>

          {/* Items */}
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Itens do Pedido</h4>
            <div className="bg-muted/30 rounded-lg p-3 space-y-3">
              {order.order_items?.map((item, idx) => {
                const extras = item.extras as any;
                const isLunch = extras?.type === "lunch";

                return (
                  <div key={idx} className="border-b border-border/50 last:border-0 pb-2 last:pb-0">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">
                        {item.quantity}x {item.item?.name || (isLunch ? `Almoço - ${extras?.base?.name}` : "Item")}
                        {item.tapioca_molhada && " (molhada)"}
                      </span>
                      <span className="text-muted-foreground">
                        R$ {item.price.toFixed(2)}
                      </span>
                    </div>
                    
                    {/* Selected Variation (e.g., type of broth) */}
                    {!isLunch && extras?.selected_variation && (
                      <div className="mt-1 text-xs text-amber-600 pl-2 font-medium">
                        Tipo: {extras.selected_variation}
                      </div>
                    )}
                    
                    {/* Lunch Details */}
                    {isLunch && (
                      <div className="mt-1 space-y-1 text-xs text-muted-foreground pl-2">
                        {extras?.meats && extras.meats.length > 0 && (
                          <div>
                            <span className="font-medium text-foreground/80">Carnes: </span>
                            {extras.meats.join(", ")}
                          </div>
                        )}
                        {extras?.extraMeats && extras.extraMeats.length > 0 && (
                          <div className="text-orange-600">
                            <span className="font-medium">+ Extras: </span>
                            {extras.extraMeats.join(", ")} (+R$6 cada)
                          </div>
                        )}
                        {extras?.sides && extras.sides.length > 0 && (
                          <div className="text-green-600">
                            <span className="font-medium">Acomp: </span>
                            {extras.sides.map((s: string) => {
                              const sideMap: Record<string, string> = {
                                macarrao: "Macarrão", farofa: "Farofa",
                                macaxeira: "Macaxeira", salada: "Salada"
                              };
                              return sideMap[s] || s;
                            }).join(", ")}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Regular Extras */}
                    {!isLunch && extras && Array.isArray(extras) && extras.length > 0 && (
                      <div className="mt-1 text-xs text-muted-foreground pl-2">
                        <span className="font-medium">Extras: </span>
                        {extras.map((e: any) => e.name).join(", ")}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Totals */}
          <div className="border-t pt-3 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>R$ {order.subtotal.toFixed(2)}</span>
            </div>
            {order.extras_fee && order.extras_fee > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Extras</span>
                <span>R$ {order.extras_fee.toFixed(2)}</span>
              </div>
            )}
            {order.delivery_tax && order.delivery_tax > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Taxa de Entrega</span>
                <span>R$ {order.delivery_tax.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold pt-1 border-t">
              <span>Total</span>
              <span>R$ {order.total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Actions - Fixed at bottom */}
        <div className="flex gap-2 pt-4 flex-shrink-0 border-t mt-2">
          <Button onClick={handlePrint} className="flex-1" variant="outline">
            <Printer className="h-4 w-4 mr-2" />
            Imprimir Comanda
          </Button>
          <Button onClick={() => onPrint(order)} className="flex-1" variant="secondary">
            <Printer className="h-4 w-4 mr-2" />
            Visualizar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

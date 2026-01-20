import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Printer, MapPin, Phone, User, Clock, CreditCard, Copy, Check } from "lucide-react";
import { format } from "date-fns";
import { printReceipt } from "@/lib/printReceipt";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

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
  status: string;
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
  observations?: string | null;
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
const PIX_KEY = "64569575000102";
const PIX_OWNER = "JORGE LUIS DO N FRANCELINO LTDA";

export function OrderDetailsModal({ order, open, onClose, onPrint }: OrderDetailsModalProps) {
  const [copiedPix, setCopiedPix] = useState(false);
  const [resolvedItemNames, setResolvedItemNames] = useState<Record<string, string>>({});
  const { toast } = useToast();

  // useEffect MUST come before any conditional return
  useEffect(() => {
    if (!open || !order) return;

    const missingIds = Array.from(
      new Set(
        (order.order_items || [])
          .filter((oi) => !!oi.item_id && !oi.item?.name)
          .map((oi) => oi.item_id as string)
      )
    );

    if (missingIds.length === 0) {
      setResolvedItemNames({});
      return;
    }

    (async () => {
      const { data, error } = await supabase
        .from("items")
        .select("id,name")
        .in("id", missingIds);

      if (error) {
        console.warn("Não foi possível carregar nomes de itens faltantes:", error);
        return;
      }

      const map: Record<string, string> = {};
      (data || []).forEach((it: any) => {
        if (it?.id && it?.name) map[it.id] = it.name;
      });
      setResolvedItemNames(map);
    })();
  }, [open, order?.id]);

  // Early return AFTER all hooks
  if (!order) return null;

  const getResolvedOrderForPrint = () => {
    return {
      ...order,
      order_items: (order.order_items || []).map((oi) => {
        if (oi.item?.name) return oi;
        const id = oi.item_id || undefined;
        const name = id ? resolvedItemNames[id] : undefined;
        if (!name) return oi;
        return { ...oi, item: { name } };
      }),
    } as Order;
  };

  const orderNumber = order.id.slice(-6).toUpperCase();
  const paymentRaw = (order.payment_method || "").trim();
  const paymentKey = paymentRaw.toLowerCase();
  const paymentLabel = paymentMethodLabels[paymentKey] || (paymentRaw ? paymentRaw.toUpperCase() : "Não informado");

  const handlePrint = () => {
    printReceipt(getResolvedOrderForPrint());
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

  const orderItems = Array.isArray(order.order_items) ? order.order_items : [];

  // Some legacy orders were persisted with item.price already as a LINE TOTAL (price×qty and sometimes including extras).
  // Detect it at order level and normalize display/calculations so quantity is applied only once.
  const isLegacyLinePrices = (() => {
    if (orderItems.length === 0) return false;

    const sumExtrasUnit = (extras: any): number => {
      if (!extras) return 0;
      if (Array.isArray(extras)) return extras.reduce((s, e) => s + (Number(e?.price) || 0), 0);
      if (typeof extras === "object" && !Array.isArray(extras) && Array.isArray((extras as any).regularExtras)) {
        return (extras as any).regularExtras.reduce((s: number, e: any) => s + (Number(e?.price) || 0), 0);
      }
      return 0;
    };

    const isLunch = (extras: any) => !!extras && typeof extras === "object" && !Array.isArray(extras) && (extras as any).type === "lunch";

    const getLunchExtrasUnit = (extras: any): number => {
      if (!isLunch(extras)) return 0;
      const meatUnit = Number(extras?.base?.singleMeatPrice) || 6;
      const extraMeats = Array.isArray(extras?.extraMeats) ? extras.extraMeats.length : 0;
      const paidSidesTotal = Array.isArray(extras?.paidSides)
        ? extras.paidSides.reduce((sum: number, s: any) => sum + (Number(s?.price) || 0), 0)
        : 0;
      const regularExtrasTotal = Array.isArray(extras?.regularExtras)
        ? extras.regularExtras.reduce((sum: number, e: any) => sum + (Number(e?.price) || 0), 0)
        : 0;
      return extraMeats * meatUnit + paidSidesTotal + regularExtrasTotal;
    };

    const subtotalAssumingUnitRule = orderItems.reduce((sum, it) => {
      const qty = Number(it.quantity) || 1;
      const extras = it.extras as any;
      const lunch = isLunch(extras);

      const unitBase = lunch ? (Number(extras?.base?.price) || Number(it.price) || 0) : (Number(it.price) || 0);
      const extrasUnit = lunch ? getLunchExtrasUnit(extras) : sumExtrasUnit(extras);

      return sum + (unitBase + extrasUnit) * qty;
    }, 0);

    // Line-price legacy: for non-lunch items, DB price already represents the full line total
    const subtotalAssumingLineRule = orderItems.reduce((sum, it) => {
      const qty = Number(it.quantity) || 1;
      const extras = it.extras as any;
      const lunch = isLunch(extras);

      if (!lunch) return sum + (Number(it.price) || 0);

      const unitBase = Number(extras?.base?.price) || Number(it.price) || 0;
      const extrasUnit = getLunchExtrasUnit(extras);
      return sum + (unitBase + extrasUnit) * qty;
    }, 0);

    const target = Number(order.subtotal) || 0;
    const diffUnit = Math.abs(subtotalAssumingUnitRule - target);
    const diffLine = Math.abs(subtotalAssumingLineRule - target);

    return diffLine + 0.01 < diffUnit;
  })();

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
                  <p className="text-xs text-muted-foreground">Chave PIX (CNPJ):</p>
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


          {/* Observações - always show when present, regardless of order source */}
          {order.observations && order.observations.trim() && (
            <div className="bg-accent/20 border border-border/50 rounded-lg p-3 space-y-1">
              <div className="text-sm font-medium">Observações</div>
              <p className="text-sm text-foreground/90 whitespace-pre-wrap break-words">{order.observations}</p>
            </div>
          )}

          {/* Items */}
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Itens do Pedido</h4>
            <div className="bg-muted/30 rounded-lg p-3 space-y-3">
              {orderItems.map((item, idx) => {
                const extras = item.extras as any;
                const isLunch = extras?.type === "lunch";

                const regularExtras = !isLunch
                  ? (Array.isArray(extras)
                      ? extras
                      : (Array.isArray(extras?.regularExtras) ? extras.regularExtras : []))
                  : [];

                const qty = Number(item.quantity) || 1;

                // Name fallback (never blank)
                const resolvedName =
                  item.item?.name ||
                  (isLunch ? `Almoço - ${extras?.base?.name || "Base"}` : undefined) ||
                  (item.item_id ? resolvedItemNames[item.item_id] : undefined) ||
                  extras?.itemName ||
                  extras?.name ||
                  "Item não identificado";

                // Extras (per unit)
                let extrasUnit = 0;
                if (isLunch) {
                  const meatUnit = Number(extras?.base?.singleMeatPrice) || 6;
                  extrasUnit += (Array.isArray(extras?.extraMeats) ? extras.extraMeats.length : 0) * meatUnit;
                  if (Array.isArray(extras?.paidSides)) {
                    extrasUnit += extras.paidSides.reduce((sum: number, s: any) => sum + (Number(s?.price) || 0), 0);
                  }
                  if (Array.isArray(extras?.regularExtras)) {
                    extrasUnit += extras.regularExtras.reduce((sum: number, e: any) => sum + (Number(e?.price) || 0), 0);
                  }
                } else {
                  extrasUnit += regularExtras.reduce((sum: number, e: any) => sum + (Number(e?.price) || 0), 0);
                }

                // Unit base price (quantity applied ONCE)
                let unitBase = 0;
                if (isLunch) {
                  unitBase = Number(extras?.base?.price) || Number(item.price) || 0;
                } else if (isLegacyLinePrices && qty > 0) {
                  // legacy: item.price is line total -> convert to unit base (excluding extras)
                  unitBase = (Number(item.price) || 0) / qty - extrasUnit;
                } else {
                  unitBase = Number(item.price) || 0;
                }

                unitBase = Math.max(0, Math.round(unitBase * 100) / 100);
                const unitTotal = unitBase + extrasUnit;
                const lineTotal = unitTotal * qty;

                return (
                  <div key={idx} className="border-b border-border/50 last:border-0 pb-2 last:pb-0">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">
                        {qty}x {resolvedName}
                        {item.tapioca_molhada && " (molhada)"}
                      </span>
                      <span className="text-muted-foreground">R$ {lineTotal.toFixed(2)}</span>
                    </div>
                    {qty > 1 && (
                      <div className="text-[11px] text-muted-foreground pl-2">
                        (R$ {unitTotal.toFixed(2)} cada)
                      </div>
                    )}
                    
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
                    {!isLunch && regularExtras.length > 0 && (
                      <div className="mt-1 text-xs text-muted-foreground pl-2">
                        <span className="font-medium">Extras: </span>
                        {regularExtras.map((e: any) => e.name).join(", ")}
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
          <Button onClick={() => onPrint(getResolvedOrderForPrint())} className="flex-1" variant="secondary">
            <Printer className="h-4 w-4 mr-2" />
            Visualizar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
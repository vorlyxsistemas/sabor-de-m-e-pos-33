import { useEffect, useRef } from "react";
import { format } from "date-fns";

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
  payment_method: string | null;
  troco: number | null;
  order_items: OrderItem[];
}

interface PrintReceiptProps {
  order: Order;
  onClose: () => void;
}

const orderTypeLabels: Record<string, string> = {
  local: "COMER NO LOCAL",
  retirada: "RETIRADA",
  entrega: "ENTREGA",
};

const paymentMethodLabels: Record<string, string> = {
  pix: "PIX",
  dinheiro: "DINHEIRO",
  cartao: "CARTÃO",
};

export function PrintReceipt({ order, onClose }: PrintReceiptProps) {
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      window.print();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleAfterPrint = () => {
      onClose();
    };
    window.addEventListener("afterprint", handleAfterPrint);
    return () => window.removeEventListener("afterprint", handleAfterPrint);
  }, [onClose]);

  const orderNumber = order.id.slice(-6).toUpperCase();
  const dateTime = format(new Date(order.created_at), "dd/MM/yyyy HH:mm");
  const paymentLabel = paymentMethodLabels[order.payment_method || ""] || order.payment_method || "NÃO INFORMADO";

  return (
    <div className="fixed inset-0 bg-background z-50 p-4 overflow-auto print:p-0">
      <style>
        {`
          @media print {
            body * {
              visibility: hidden;
            }
            .print-receipt, .print-receipt * {
              visibility: visible;
              color: #000 !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .print-receipt {
              position: absolute;
              left: 0;
              top: 0;
              width: 80mm;
              padding: 5mm;
              background: #fff !important;
            }
            .no-print {
              display: none !important;
            }
          }
        `}
      </style>

      <div className="no-print mb-4 flex gap-2">
        <button
          onClick={() => window.print()}
          className="px-4 py-2 bg-primary text-primary-foreground rounded font-medium"
        >
          Imprimir
        </button>
        <button
          onClick={onClose}
          className="px-4 py-2 bg-secondary text-secondary-foreground rounded"
        >
          Fechar
        </button>
      </div>

      <div ref={printRef} className="print-receipt font-mono text-sm max-w-[300px] mx-auto bg-white text-black p-4">
        <div className="text-center mb-4">
          <div className="font-bold text-lg">SABOR DE MÃE</div>
          <div className="text-xs font-bold">================================</div>
        </div>

        <div className="mb-2">
          <div className="font-bold">PEDIDO: #{orderNumber}</div>
          <div>DATA: {dateTime}</div>
          <div className="font-bold text-base">TIPO: {orderTypeLabels[order.order_type] || order.order_type}</div>
        </div>

        <div className="mb-2">
          <div className="font-bold">CLIENTE: {order.customer_name.toUpperCase()}</div>
          {order.customer_phone && <div>TEL: {order.customer_phone}</div>}
        </div>

        {order.order_type === "entrega" && (
          <div className="mb-2 border-2 border-black p-2">
            <div className="font-bold mb-1">ENTREGA:</div>
            {order.bairro && <div className="font-bold">BAIRRO: {order.bairro.toUpperCase()}</div>}
            {order.address && <div>ENDEREÇO: {order.address.toUpperCase()}</div>}
            {order.cep && <div>CEP: {order.cep}</div>}
            {order.reference && <div className="font-bold">REF: {order.reference.toUpperCase()}</div>}
          </div>
        )}

        <div className="my-2">
          <div className="text-xs font-bold">======== ITENS DO PEDIDO ========</div>
        </div>

        <div className="mb-2">
          {order.order_items?.map((item, idx) => {
            const extras = item.extras as any;
            const isLunch = extras?.type === "lunch";
            const itemName = item.item?.name || (isLunch ? `ALMOÇO - ${extras?.base?.name}` : "ITEM");

            return (
              <div key={idx} className="mb-2">
                <div className="flex justify-between font-bold">
                  <span>
                    {item.quantity} UND. {itemName.toUpperCase()}
                    {item.tapioca_molhada && " (MOLHADA)"}
                  </span>
                  <span>R${item.price.toFixed(2)}</span>
                </div>
                
                {/* Lunch Details */}
                {isLunch && (
                  <div className="pl-2 text-xs">
                    {extras?.meats && extras.meats.length > 0 && (
                      <div className="font-bold">CARNES: {extras.meats.join(", ").toUpperCase()}</div>
                    )}
                    {extras?.extraMeats && extras.extraMeats.length > 0 && (
                      <div className="font-bold">+ EXTRAS: {extras.extraMeats.join(", ").toUpperCase()}</div>
                    )}
                    {extras?.sides && extras.sides.length > 0 && (
                      <div>
                        ACOMP: {extras.sides.map((s: string) => {
                          const sideMap: Record<string, string> = {
                            macarrao: "MACARRÃO", farofa: "FAROFA",
                            macaxeira: "MACAXEIRA", salada: "SALADA"
                          };
                          return sideMap[s] || s.toUpperCase();
                        }).join(", ")}
                      </div>
                    )}
                  </div>
                )}

                {/* Regular Extras */}
                {!isLunch && extras && Array.isArray(extras) && extras.length > 0 && (
                  <div className="pl-2 text-xs font-bold">
                    EXTRAS: {extras.map((e: any) => e.name.toUpperCase()).join(", ")}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="text-xs font-bold">================================</div>

        <div className="mt-2 space-y-1 font-bold">
          <div className="flex justify-between">
            <span>SUBTOTAL:</span>
            <span>R$ {order.subtotal.toFixed(2)}</span>
          </div>
          {order.extras_fee && order.extras_fee > 0 && (
            <div className="flex justify-between">
              <span>EXTRAS:</span>
              <span>R$ {order.extras_fee.toFixed(2)}</span>
            </div>
          )}
          {order.delivery_tax && order.delivery_tax > 0 && (
            <div className="flex justify-between">
              <span>TAXA DE ENTREGA:</span>
              <span>R$ {order.delivery_tax.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-base border-t-2 border-black pt-1">
            <span>TOTAL:</span>
            <span>R$ {order.total.toFixed(2)}</span>
          </div>
        </div>

        {/* Payment Info */}
        <div className="mt-2 border-2 border-black p-2">
          <div className="font-bold">PAGAMENTO: {paymentLabel}</div>
          {order.payment_method === "dinheiro" && order.troco && (
            <div className="font-bold">TROCO PARA: R$ {order.troco.toFixed(2)}</div>
          )}
        </div>

        <div className="mt-4 text-center text-xs font-bold">
          <div>================================</div>
          <div>OBRIGADO PELA PREFERÊNCIA!</div>
          <div>================================</div>
        </div>
      </div>
    </div>
  );
}

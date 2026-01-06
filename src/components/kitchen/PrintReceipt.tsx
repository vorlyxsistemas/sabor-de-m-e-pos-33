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
  observations?: string | null;
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

const sideNameMap: Record<string, string> = {
  macarrao: "MACARRÃO",
  farofa: "FAROFA",
  macaxeira: "MACAXEIRA",
  salada: "SALADA",
};

export function PrintReceipt({ order, onClose }: PrintReceiptProps) {
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => window.print(), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleAfterPrint = () => onClose();
    window.addEventListener("afterprint", handleAfterPrint);
    return () => window.removeEventListener("afterprint", handleAfterPrint);
  }, [onClose]);

  const orderNumber = order.id.slice(-6).toUpperCase();
  const dateTime = format(new Date(order.created_at), "dd/MM/yyyy HH:mm");

  const paymentRaw = (order.payment_method || "").trim();
  const paymentKey = paymentRaw.toLowerCase();
  const paymentLabel =
    paymentMethodLabels[paymentKey] ||
    (paymentRaw ? paymentRaw.toUpperCase() : "NÃO INFORMADO");

  return (
    <div className="fixed inset-0 bg-white z-50 p-4 overflow-auto print:p-0">
      <div
        ref={printRef}
        className="print-receipt mx-auto"
        style={{
          fontFamily: "'Courier New', Courier, monospace",
          fontSize: "12px",
          fontWeight: 700,
          lineHeight: 1.3,
          color: "#000",
          background: "#fff",
          width: "76mm",
          padding: "2mm",
        }}
      >
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 12 }}>
          <div style={{ fontWeight: 900, fontSize: 20 }}>SABOR DE MÃE</div>
          <div>================================</div>
        </div>

        {/* Pedido */}
        <div>
          <div style={{ fontWeight: 900 }}>PEDIDO: #{orderNumber}</div>
          <div>DATA: {dateTime}</div>
          <div
            style={{
              border: "2px solid #000",
              marginTop: 4,
              padding: 4,
              textAlign: "center",
              fontWeight: 900,
            }}
          >
            {orderTypeLabels[order.order_type] || order.order_type}
          </div>
        </div>

        <div>--------------------------------</div>

        {/* Cliente */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontWeight: 900 }}>
            ★ CLIENTE: {order.customer_name.toUpperCase()}
          </div>
          {order.customer_phone && <div>TEL: {order.customer_phone}</div>}
        </div>

        {/* Entrega */}
        {order.order_type === "entrega" && (
          <div style={{ border: "3px solid #000", padding: 8, marginBottom: 10 }}>
            <div style={{ fontWeight: 900 }}>*** ENTREGA ***</div>
            {order.bairro && <div>BAIRRO: {order.bairro.toUpperCase()}</div>}
            {order.address && <div>END: {order.address.toUpperCase()}</div>}
            {order.reference && <div>REF: {order.reference.toUpperCase()}</div>}
          </div>
        )}

        <div>======== ITENS DO PEDIDO ========</div>

        {/* Itens */}
        {order.order_items.map((item, idx) => {
          const extras = item.extras || {};
          const isLunch = extras?.type === "lunch";

          /** ✅ NORMALIZAÇÃO DEFINITIVA DOS EXTRAS */
          let extrasList: any[] = [];

          if (!isLunch) {
            if (Array.isArray(extras)) extrasList = extras;
            if (Array.isArray(extras?.regularExtras))
              extrasList = extras.regularExtras;
          }

          let extrasPrice = 0;
          extrasList.forEach((e) => {
            extrasPrice += Number(e.price) || 0;
          });

          const unitPrice = Number(item.price) || 0;
          const lineTotal = (unitPrice + extrasPrice) * item.quantity;

          return (
            <div key={idx} style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>
                  {item.quantity}x {item.item?.name?.toUpperCase()}
                </span>
                <span>R$ {lineTotal.toFixed(2)}</span>
              </div>

              {extrasList.length > 0 && (
                <div style={{ paddingLeft: 12 }}>
                  ► EXTRAS:{" "}
                  {extrasList.map((e) => e.name.toUpperCase()).join(", ")}
                </div>
              )}
            </div>
          );
        })}

        <div>================================</div>

        {/* Totais */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>SUBTOTAL:</span>
            <span>R$ {order.subtotal.toFixed(2)}</span>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontWeight: 900,
              fontSize: 16,
              borderTop: "2px solid #000",
              marginTop: 4,
            }}
          >
            <span>TOTAL:</span>
            <span>R$ {order.total.toFixed(2)}</span>
          </div>
        </div>

        {/* Pagamento */}
        <div style={{ border: "3px solid #000", marginTop: 10, padding: 6 }}>
          PAGAMENTO: {paymentLabel}
        </div>

        {order.observations && (
          <div style={{ marginTop: 10 }}>
            OBS: {order.observations.toUpperCase()}
          </div>
        )}

        <div style={{ textAlign: "center", marginTop: 10 }}>
          OBRIGADO PELA PREFERÊNCIA!
        </div>
      </div>
    </div>
  );
}

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

// Map for side names
const sideNameMap: Record<string, string> = {
  macarrao: "MACARRÃO",
  farofa: "FAROFA",
  macaxeira: "MACAXEIRA",
  salada: "SALADA"
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
  const paymentRaw = (order.payment_method || "").trim();
  const paymentKey = paymentRaw.toLowerCase();
  const paymentLabel = paymentMethodLabels[paymentKey] || (paymentRaw ? paymentRaw.toUpperCase() : "NÃO INFORMADO");

  return (
    <div className="fixed inset-0 bg-white z-50 p-4 overflow-auto print:p-0">
      <style>
        {`
          @media print {
            @page {
              size: 80mm auto;
              margin: 0 !important;
              padding: 0 !important;
            }
            html, body {
              margin: 0 !important;
              padding: 0 !important;
              width: 80mm !important;
            }
            * {
              visibility: hidden;
              color: #000 !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .print-receipt, .print-receipt * {
              visibility: visible;
              color: #000 !important;
            }
            .print-receipt {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              transform: none !important;
              width: 76mm !important;
              max-width: 76mm !important;
              padding: 2mm !important;
              margin: 0 !important;
              background: #fff !important;
              font-size: 12px !important;
              box-sizing: border-box !important;
            }
            .no-print {
              display: none !important;
            }
          }
          @media print and (max-width: 62mm) {
            @page {
              size: 58mm auto;
              margin: 0 !important;
            }
            html, body {
              width: 58mm !important;
            }
            .print-receipt {
              width: 54mm !important;
              max-width: 54mm !important;
              font-size: 11px !important;
              padding: 1mm !important;
            }
          }
          .print-receipt {
            font-family: 'Courier New', Courier, monospace;
            color: #000 !important;
            background: #fff !important;
          }
          .print-receipt * {
            color: #000 !important;
          }
        `}
      </style>

      <div className="no-print mb-4 flex gap-2">
        <button
          onClick={() => window.print()}
          className="px-4 py-2 bg-black text-white rounded font-bold"
        >
          Imprimir
        </button>
        <button
          onClick={onClose}
          className="px-4 py-2 bg-gray-800 text-white rounded font-bold"
        >
          Fechar
        </button>
      </div>

      <div 
        ref={printRef} 
        className="print-receipt mx-auto p-4"
        style={{ 
          fontFamily: "'Courier New', Courier, monospace",
          fontSize: '12px',
          fontWeight: 700,
          lineHeight: 1.3,
          color: '#000',
          background: '#fff',
          maxWidth: '280px',
          width: '100%'
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '12px' }}>
          <div style={{ fontWeight: 900, fontSize: '20px', letterSpacing: '1px' }}>SABOR DE MÃE</div>
          <div style={{ fontWeight: 900, fontSize: '13px' }}>================================</div>
        </div>

        {/* Order Info */}
        <div style={{ marginBottom: '10px' }}>
          <div style={{ fontWeight: 900, fontSize: '16px' }}>PEDIDO: #{orderNumber}</div>
          <div style={{ fontWeight: 700 }}>DATA: {dateTime}</div>
          <div style={{ 
            fontWeight: 900, 
            fontSize: '16px', 
            border: '2px solid #000', 
            padding: '4px', 
            marginTop: '4px', 
            textAlign: 'center' 
          }}>
            {orderTypeLabels[order.order_type] || order.order_type}
          </div>
        </div>

        <div style={{ fontWeight: 900, fontSize: '13px' }}>--------------------------------</div>

        {/* Customer Info */}
        <div style={{ marginBottom: '10px' }}>
          <div style={{ fontWeight: 900, fontSize: '15px' }}>★ CLIENTE: {order.customer_name.toUpperCase()}</div>
          {order.customer_phone && <div style={{ fontWeight: 700 }}>TEL: {order.customer_phone}</div>}
        </div>

        {/* Delivery Info */}
        {order.order_type === "entrega" && (
          <div style={{ 
            margin: '12px 0', 
            border: '3px solid #000', 
            padding: '10px',
            background: '#fff'
          }}>
            <div style={{ fontWeight: 900, fontSize: '15px', marginBottom: '6px', textDecoration: 'underline' }}>
              *** ENTREGA ***
            </div>
            {order.bairro && (
              <div style={{ fontWeight: 900, fontSize: '14px' }}>BAIRRO: {order.bairro.toUpperCase()}</div>
            )}
            {order.address && (
              <div style={{ fontWeight: 700, fontSize: '13px' }}>ENDEREÇO: {order.address.toUpperCase()}</div>
            )}
            {order.cep && (
              <div style={{ fontWeight: 700, fontSize: '13px' }}>CEP: {order.cep}</div>
            )}
            {order.reference && (
              <div style={{ fontWeight: 900, fontSize: '14px', marginTop: '4px' }}>
                ★ REF: {order.reference.toUpperCase()}
              </div>
            )}
          </div>
        )}

        {/* Items Header */}
        <div style={{ margin: '10px 0' }}>
          <div style={{ fontWeight: 900, fontSize: '13px' }}>======== ITENS DO PEDIDO ========</div>
        </div>

         {/* Items */}
         <div style={{ marginBottom: '10px' }}>
           {order.order_items?.map((item, idx) => {
             const extras = item.extras as any;
             const isLunch = extras?.type === "lunch";
             const itemName = item.item?.name || (isLunch ? `ALMOÇO - ${extras?.base?.name}` : "ITEM");

             const regularExtras = !isLunch
               ? (Array.isArray(extras)
                   ? extras
                   : (Array.isArray(extras?.regularExtras) ? extras.regularExtras : []))
               : [];
             
             // Calculate extras price for display
             let extrasPrice = 0;
             if (isLunch) {
               const extraMeats = extras?.extraMeats || [];
               extrasPrice += extraMeats.length * 3;
               const paidSides = extras?.paidSides || [];
               paidSides.forEach((side: any) => {
                 extrasPrice += Number(side.price) || 0;
               });
             } else if (regularExtras.length > 0) {
               regularExtras.forEach((extra: any) => {
                 extrasPrice += Number(extra.price) || 0;
               });
             }
             
             // Unit price is the base price stored in item.price
             const unitPrice = Number(item.price) || 0;
             // Line total = (unitPrice + extrasPrice) × quantity
             const lineTotal = (unitPrice + extrasPrice) * item.quantity;

             return (
               <div key={idx} style={{ marginBottom: '12px', borderBottom: '1px dashed #000', paddingBottom: '8px' }}>
                 <div style={{ 
                   display: 'flex', 
                   justifyContent: 'space-between', 
                   fontWeight: 900, 
                   fontSize: '14px' 
                 }}>
                   <span>
                     {item.quantity}x {itemName.toUpperCase()}
                     {item.tapioca_molhada && " (MOLHADA)"}
                   </span>
                   <span>R${lineTotal.toFixed(2)}</span>
                 </div>
                 {/* Show unit price when quantity > 1 for clarity */}
                 {item.quantity > 1 && (
                   <div style={{ fontSize: '11px', fontWeight: 600, color: '#555', paddingLeft: '12px' }}>
                     (R${unitPrice.toFixed(2)} cada)
                   </div>
                 )}
                 
                 {/* Selected Variation */}
                 {!isLunch && extras?.selected_variation && (
                   <div style={{ paddingLeft: '12px', fontSize: '13px', fontWeight: 700 }}>
                     ► TIPO: {extras.selected_variation.toUpperCase()}
                   </div>
                 )}
                 
                 {/* Lunch Details */}
                 {isLunch && (
                   <div style={{ paddingLeft: '12px', fontSize: '13px' }}>
                     {/* Included meats */}
                     {extras?.meats && extras.meats.length > 0 && (
                       <div style={{ fontWeight: 900, marginTop: '4px' }}>
                         ► CARNES INCLUÍDAS:
                         <div style={{ paddingLeft: '8px', fontWeight: 700 }}>
                           {extras.meats.map((meat: string, i: number) => (
                             <div key={i}>• {meat.toUpperCase()}</div>
                           ))}
                         </div>
                       </div>
                     )}
                     
                     {/* Extra meats */}
                     {extras?.extraMeats && extras.extraMeats.length > 0 && (
                       <div style={{ fontWeight: 900, marginTop: '4px', borderTop: '1px dotted #000', paddingTop: '4px' }}>
                         ► CARNES EXTRAS (+R$):
                         <div style={{ paddingLeft: '8px', fontWeight: 700 }}>
                           {extras.extraMeats.map((meat: string, i: number) => (
                             <div key={i}>• {meat.toUpperCase()}</div>
                           ))}
                         </div>
                       </div>
                     )}
                     
                     {/* Free sides */}
                     {extras?.sides && extras.sides.length > 0 && (
                       <div style={{ fontWeight: 900, marginTop: '4px', borderTop: '1px dotted #000', paddingTop: '4px' }}>
                         ► ACOMPANHAMENTOS (GRÁTIS):
                         <div style={{ paddingLeft: '8px', fontWeight: 700 }}>
                           {extras.sides.map((side: string, i: number) => (
                             <div key={i}>• {(sideNameMap[side] || side).toUpperCase()}</div>
                           ))}
                         </div>
                       </div>
                     )}
                     
                     {/* Paid sides */}
                     {extras?.paidSides && extras.paidSides.length > 0 && (
                       <div style={{ fontWeight: 900, marginTop: '4px', borderTop: '1px dotted #000', paddingTop: '4px' }}>
                         ► ACOMPANHAMENTOS (+R$):
                         <div style={{ paddingLeft: '8px', fontWeight: 700 }}>
                           {extras.paidSides.map((side: any, i: number) => (
                             <div key={i}>• {side.name.toUpperCase()} (+R${Number(side.price).toFixed(2)})</div>
                           ))}
                         </div>
                       </div>
                     )}
                   </div>
                 )}

                 {/* Regular Extras */}
                 {!isLunch && regularExtras.length > 0 && (
                   <div style={{ paddingLeft: '12px', fontSize: '13px', fontWeight: 700 }}>
                     ► EXTRAS: {regularExtras.map((e: any) => e.name.toUpperCase()).join(", ")}
                   </div>
                 )}
               </div>
             );
           })}
         </div>

        <div style={{ fontWeight: 900, fontSize: '13px' }}>================================</div>

        {/* Totals */}
        <div style={{ marginTop: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: '14px' }}>
            <span>SUBTOTAL:</span>
            <span>R$ {order.subtotal.toFixed(2)}</span>
          </div>
          {order.extras_fee && order.extras_fee > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: '14px' }}>
              <span>EXTRAS:</span>
              <span>R$ {order.extras_fee.toFixed(2)}</span>
            </div>
          )}
          {order.delivery_tax && order.delivery_tax > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: '14px' }}>
              <span>TAXA ENTREGA:</span>
              <span>R$ {order.delivery_tax.toFixed(2)}</span>
            </div>
          )}
          {/* Grand Total */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            fontWeight: 900, 
            fontSize: '18px',
            borderTop: '3px solid #000',
            paddingTop: '6px',
            marginTop: '6px'
          }}>
            <span>★ TOTAL:</span>
            <span>R$ {order.total.toFixed(2)}</span>
          </div>
        </div>

        {/* Payment Info */}
        <div style={{ 
          marginTop: '12px', 
          border: '3px solid #000', 
          padding: '10px',
          background: '#fff'
        }}>
          <div style={{ fontWeight: 900, fontSize: '15px' }}>★ PAGAMENTO: {paymentLabel}</div>
          {paymentKey === "dinheiro" && order.troco && (
            <div style={{ fontWeight: 900, fontSize: '14px' }}>TROCO PARA: R$ {order.troco.toFixed(2)}</div>
          )}
        </div>

        {/* Observations */}
        {order.observations && (
          <div style={{ 
            marginTop: '12px', 
            border: '3px solid #000', 
            padding: '10px',
            background: '#fff'
          }}>
            <div style={{ fontWeight: 900, fontSize: '14px' }}>★ OBSERVAÇÕES:</div>
            <div style={{ fontWeight: 700, fontSize: '13px' }}>{order.observations.toUpperCase()}</div>
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: '12px' }}>
          <div style={{ fontWeight: 900, fontSize: '13px' }}>================================</div>
          <div style={{ fontWeight: 900, fontSize: '12px' }}>OBRIGADO PELA PREFERÊNCIA!</div>
          <div style={{ fontWeight: 900, fontSize: '13px' }}>================================</div>
        </div>
      </div>
    </div>
  );
}

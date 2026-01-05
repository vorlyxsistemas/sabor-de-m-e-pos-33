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
  payment_method: string | null;
  troco: number | null;
  observations?: string | null;
  order_items: OrderItem[];
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

export function generateReceiptHTML(order: Order): string {
  const orderNumber = order.id.slice(-6).toUpperCase();
  const dateTime = format(new Date(order.created_at), "dd/MM/yyyy HH:mm");

  let itemsHTML = "";
  order.order_items?.forEach((item) => {
    const extras = item.extras as any;
    const isLunch = extras?.type === "lunch";
    const itemName = item.item?.name || (isLunch ? `ALMOÇO - ${extras?.base?.name}` : "ITEM");

    const qty = Number(item.quantity) || 1;
    const unitBase = Number(item.price) || 0;
    let extrasPrice = 0;

    if (isLunch) {
      const meatUnit = Number(extras?.base?.singleMeatPrice) || 6;
      extrasPrice += (Array.isArray(extras?.extraMeats) ? extras.extraMeats.length : 0) * meatUnit;
      if (Array.isArray(extras?.paidSides)) {
        extrasPrice += extras.paidSides.reduce((sum: number, s: any) => sum + (Number(s?.price) || 0), 0);
      }
      if (Array.isArray(extras?.regularExtras)) {
        extrasPrice += extras.regularExtras.reduce((sum: number, e: any) => sum + (Number(e?.price) || 0), 0);
      }
    } else if (extras && typeof extras === 'object' && !Array.isArray(extras) && Array.isArray(extras?.regularExtras)) {
      extrasPrice += extras.regularExtras.reduce((sum: number, e: any) => sum + (Number(e?.price) || 0), 0);
    } else if (Array.isArray(extras)) {
      extrasPrice += extras.reduce((sum: number, e: any) => sum + (Number(e?.price) || 0), 0);
    }

    if (item.tapioca_molhada) {
      extrasPrice += 1;
    }

    const lineTotal = (unitBase + extrasPrice) * qty;

    itemsHTML += `
      <div class="item">
        <div class="item-line">
          <span>${qty}x ${itemName.toUpperCase()}${item.tapioca_molhada ? " (MOLHADA)" : ""}</span>
          <span>R$${lineTotal.toFixed(2)}</span>
        </div>
        ${qty > 1 ? `<div class="item-unit">(R$${unitBase.toFixed(2)} cada)</div>` : ""}
    `;

    if (!isLunch && extras?.selected_variation) {
      itemsHTML += `<div class="item-extras">► TIPO: ${extras.selected_variation.toUpperCase()}</div>`;
    }

    if (isLunch) {
      if (extras?.meats?.length > 0) {
        itemsHTML += `<div class="item-extras">► CARNES INCLUÍDAS:</div>`;
        extras.meats.forEach((meat: string) => {
          itemsHTML += `<div class="item-sub">• ${meat.toUpperCase()}</div>`;
        });
      }
      if (extras?.extraMeats?.length > 0) {
        itemsHTML += `<div class="item-extras item-extras-border">► CARNES EXTRAS (+R$):</div>`;
        extras.extraMeats.forEach((meat: string) => {
          itemsHTML += `<div class="item-sub">• ${meat.toUpperCase()}</div>`;
        });
      }
      if (extras?.sides?.length > 0) {
        itemsHTML += `<div class="item-extras item-extras-border">► ACOMPANHAMENTOS (GRÁTIS):</div>`;
        extras.sides.forEach((side: string) => {
          const sideName = sideNameMap[side] || side.toUpperCase();
          itemsHTML += `<div class="item-sub">• ${sideName}</div>`;
        });
      }
      if (extras?.paidSides?.length > 0) {
        itemsHTML += `<div class="item-extras item-extras-border">► ACOMPANHAMENTOS (+R$):</div>`;
        extras.paidSides.forEach((side: any) => {
          itemsHTML += `<div class="item-sub">• ${side.name.toUpperCase()} (+R$${Number(side.price).toFixed(2)})</div>`;
        });
      }
    }

    const regularExtras = !isLunch
      ? (Array.isArray(extras) ? extras : (Array.isArray(extras?.regularExtras) ? extras.regularExtras : []))
      : [];

    if (!isLunch && regularExtras.length > 0) {
      itemsHTML += `<div class="item-extras">► EXTRAS: ${regularExtras.map((e: any) => e.name.toUpperCase()).join(", ")}</div>`;
    }

    itemsHTML += `</div>`;
  });

  let deliverySection = "";
  if (order.order_type === "entrega") {
    deliverySection = `
      <div class="section delivery">
        <div class="delivery-header">*** ENTREGA ***</div>
        ${order.bairro ? `<div class="delivery-bairro">BAIRRO: ${order.bairro.toUpperCase()}</div>` : ""}
        ${order.address ? `<div>ENDEREÇO: ${order.address.toUpperCase()}</div>` : ""}
        ${order.cep ? `<div>CEP: ${order.cep}</div>` : ""}
        ${order.reference ? `<div class="reference">★ REF: ${order.reference.toUpperCase()}</div>` : ""}
      </div>
    `;
  }

  const paymentRaw = (order.payment_method || "").trim();
  const paymentKey = paymentRaw.toLowerCase();
  const paymentLabel = paymentMethodLabels[paymentKey] || (paymentRaw ? paymentRaw.toUpperCase() : "NÃO INFORMADO");
  const paymentSection = `
    <div class="section payment-box">
      <div class="payment">★ PAGAMENTO: ${paymentLabel}</div>
      ${paymentKey === "dinheiro" && order.troco ? `<div class="troco">TROCO PARA: R$ ${order.troco.toFixed(2)}</div>` : ""}
    </div>
  `;

  let observationsSection = "";
  if (order.observations && order.observations.trim()) {
    observationsSection = `
      <div class="section observations-box">
        <div class="obs-header">★ OBSERVAÇÕES:</div>
        <div class="obs-text">${order.observations.toUpperCase()}</div>
      </div>
    `;
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        @page { 
          size: 80mm auto; 
          margin: 0 !important;
          padding: 0 !important;
        }
        * {
          color: #000 !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          box-sizing: border-box;
        }
        body { 
          font-family: 'Courier New', Courier, monospace; 
          font-size: 12px; 
          font-weight: 700;
          width: 76mm; 
          max-width: 76mm;
          margin: 0 auto; 
          padding: 2mm;
          color: #000 !important;
          background: #fff !important;
          line-height: 1.3;
        }
        .header { 
          text-align: center; 
          margin-bottom: 12px; 
        }
        .title { 
          font-weight: 900; 
          font-size: 20px; 
          letter-spacing: 1px;
        }
        .divider { 
          font-size: 13px; 
          font-weight: 900; 
          letter-spacing: -1px;
        }
        .section { 
          margin-bottom: 10px; 
        }
        .order-number {
          font-weight: 900;
          font-size: 16px;
        }
        .order-type-box {
          font-weight: 900;
          font-size: 16px;
          border: 2px solid #000;
          padding: 4px;
          margin-top: 4px;
          text-align: center;
        }
        .customer-name {
          font-weight: 900;
          font-size: 15px;
        }
        .totals { 
          margin-top: 10px; 
        }
        .total-line { 
          display: flex; 
          justify-content: space-between; 
          font-weight: 900; 
          font-size: 14px;
        }
        .grand-total {
          display: flex; 
          justify-content: space-between; 
          font-weight: 900; 
          font-size: 18px;
          border-top: 3px solid #000;
          padding-top: 6px;
          margin-top: 6px;
        }
        .footer { 
          text-align: center; 
          margin-top: 12px; 
          font-size: 12px; 
          font-weight: 900; 
        }
        .item {
          margin-bottom: 12px;
          border-bottom: 1px dashed #000;
          padding-bottom: 8px;
        }
        .item-line {
          display: flex;
          justify-content: space-between;
          font-weight: 900;
          font-size: 14px;
        }
        .item-unit {
          font-size: 11px;
          font-weight: 600;
          padding-left: 12px;
        }
        .item-extras {
          font-size: 13px;
          font-weight: 900;
          padding-left: 12px;
          margin-top: 4px;
        }
        .item-extras-border {
          border-top: 1px dotted #000;
          padding-top: 4px;
        }
        .item-sub {
          font-size: 13px;
          font-weight: 700;
          padding-left: 20px;
        }
        .delivery {
          border: 3px solid #000;
          padding: 10px;
          margin: 12px 0;
          background: #fff;
        }
        .delivery-header {
          text-align: center;
          font-weight: 900;
          font-size: 15px;
          margin-bottom: 6px;
          text-decoration: underline;
        }
        .delivery-bairro {
          font-weight: 900;
          font-size: 14px;
        }
        .reference {
          font-weight: 900;
          font-size: 14px;
          margin-top: 4px;
        }
        .payment-box {
          border: 3px solid #000;
          padding: 10px;
          margin-top: 12px;
          background: #fff;
        }
        .payment {
          font-weight: 900;
          font-size: 15px;
        }
        .troco {
          font-weight: 900;
          font-size: 14px;
        }
        .observations-box {
          border: 3px solid #000;
          padding: 10px;
          margin-top: 12px;
          background: #fff;
        }
        .obs-header {
          font-weight: 900;
          font-size: 14px;
        }
        .obs-text {
          font-weight: 700;
          font-size: 13px;
        }
        @media print {
          @page {
            size: 80mm auto;
            margin: 0 !important;
          }
          * {
            color: #000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body {
            background: #fff !important;
            width: 76mm !important;
            max-width: 76mm !important;
            padding: 2mm !important;
            margin: 0 !important;
          }
        }
        @media print and (max-width: 62mm) {
          @page {
            size: 58mm auto;
            margin: 0 !important;
          }
          body {
            width: 54mm !important;
            max-width: 54mm !important;
            font-size: 11px !important;
            padding: 1mm !important;
          }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="title">SABOR DE MÃE</div>
        <div class="divider">================================</div>
      </div>

      <div class="section">
        <div class="order-number">PEDIDO: #${orderNumber}</div>
        <div>DATA: ${dateTime}</div>
        <div class="order-type-box">
          ${orderTypeLabels[order.order_type] || order.order_type}${order.order_type === 'local' && order.table_number ? ` - MESA ${order.table_number}` : ''}
        </div>
      </div>

      <div class="divider">--------------------------------</div>

      <div class="section">
        <div class="customer-name">★ CLIENTE: ${order.customer_name.toUpperCase()}</div>
        ${order.customer_phone ? `<div>TEL: ${order.customer_phone}</div>` : ""}
      </div>

      ${deliverySection}

      <div class="section">
        <div class="divider">======== ITENS DO PEDIDO ========</div>
      </div>

      <div class="items">
        ${itemsHTML}
      </div>

      <div class="divider">================================</div>

      <div class="totals">
        <div class="total-line">
          <span>SUBTOTAL (ITENS+EXTRAS):</span>
          <span>R$ ${order.subtotal.toFixed(2)}</span>
        </div>
        ${order.delivery_tax && order.delivery_tax > 0 ? `
          <div class="total-line">
            <span>TAXA ENTREGA:</span>
            <span>R$ ${order.delivery_tax.toFixed(2)}</span>
          </div>
        ` : ""}
        <div class="grand-total">
          <span>★ TOTAL:</span>
          <span>R$ ${order.total.toFixed(2)}</span>
        </div>
      </div>

      ${paymentSection}

      ${observationsSection}

      <div class="footer">
        <div class="divider">================================</div>
        <div>OBRIGADO PELA PREFERÊNCIA!</div>
        <div class="divider">================================</div>
      </div>
    </body>
    </html>
  `;
}

export function printReceipt(order: Order): Promise<boolean> {
  return new Promise((resolve) => {
    const receiptHTML = generateReceiptHTML(order);
    
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "none";
    iframe.style.visibility = "hidden";
    
    document.body.appendChild(iframe);
    
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) {
      console.error("Não foi possível criar iframe para impressão");
      document.body.removeChild(iframe);
      resolve(false);
      return;
    }
    
    iframeDoc.open();
    iframeDoc.write(receiptHTML);
    iframeDoc.close();
    
    iframe.onload = () => {
      setTimeout(() => {
        try {
          const iframeWindow = iframe.contentWindow;
          if (iframeWindow) {
            console.log("Disparando impressão...");
            iframeWindow.focus();
            iframeWindow.print();
          }
          
          setTimeout(() => {
            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe);
            }
            resolve(true);
          }, 1000);
        } catch (error) {
          console.error("Erro ao imprimir:", error);
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
          resolve(false);
        }
      }, 300);
    };
    
    setTimeout(() => {
      if (iframe.onload) {
        iframe.onload(new Event("load"));
      }
    }, 500);
  });
}

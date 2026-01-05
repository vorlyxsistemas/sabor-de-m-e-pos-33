import { format } from "date-fns";

/* =======================
   TYPES
======================= */

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

/* =======================
   LABEL MAPS
======================= */

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

/* =======================
   CORE — SINGLE SOURCE OF TRUTH
======================= */

export function buildReceiptText(order: Order): string {
  const orderNumber = order.id.slice(-6).toUpperCase();
  const dateTime = format(new Date(order.created_at), "dd/MM/yyyy HH:mm");

  let text = "";

  text += "SABOR DE MÃE\n";
  text += "================================\n";
  text += `PEDIDO: #${orderNumber}\n`;
  text += `DATA: ${dateTime}\n`;
  text += `${orderTypeLabels[order.order_type] || order.order_type}`;
  if (order.order_type === "local" && order.table_number) {
    text += ` - MESA ${order.table_number}`;
  }
  text += "\n";
  text += "--------------------------------\n";

  text += `CLIENTE: ${order.customer_name.toUpperCase()}\n`;
  if (order.customer_phone) {
    text += `TEL: ${order.customer_phone}\n`;
  }

  if (order.order_type === "entrega") {
    text += "*** ENTREGA ***\n";
    if (order.bairro) text += `BAIRRO: ${order.bairro.toUpperCase()}\n`;
    if (order.address) text += `ENDEREÇO: ${order.address.toUpperCase()}\n`;
    if (order.reference) text += `REF: ${order.reference.toUpperCase()}\n`;
  }

  text += "======== ITENS DO PEDIDO ========\n";

  order.order_items.forEach((item) => {
    const qty = Number(item.quantity) || 1;
    const name = item.item?.name || "ITEM";
    const unitPrice = Number(item.price) || 0;
    const total = unitPrice * qty;

    text += `${qty}x ${name.toUpperCase()}`;
    if (item.tapioca_molhada) text += " (MOLHADA)";
    text += ` R$${total.toFixed(2)}\n`;

    if (Array.isArray(item.extras) && item.extras.length > 0) {
      text += `► EXTRAS: ${item.extras
        .map((e: any) => e.name?.toUpperCase())
        .join(", ")}\n`;
    }
  });

  text += "================================\n";
  text += `SUBTOTAL: R$ ${order.subtotal.toFixed(2)}\n`;

  if (order.extras_fee && order.extras_fee > 0) {
    text += `EXTRAS: R$ ${order.extras_fee.toFixed(2)}\n`;
  }

  if (order.delivery_tax && order.delivery_tax > 0) {
    text += `TAXA ENTREGA: R$ ${order.delivery_tax.toFixed(2)}\n`;
  }

  text += `TOTAL: R$ ${order.total.toFixed(2)}\n`;

  const paymentRaw = (order.payment_method || "").trim();
  const paymentKey = paymentRaw.toLowerCase();
  const paymentLabel =
    paymentMethodLabels[paymentKey] || paymentRaw.toUpperCase();

  text += `PAGAMENTO: ${paymentLabel}\n`;

  if (paymentKey === "dinheiro" && order.troco) {
    text += `TROCO PARA: R$ ${order.troco.toFixed(2)}\n`;
  }

  if (order.observations && order.observations.trim()) {
    text += "OBSERVAÇÕES:\n";
    text += order.observations.toUpperCase() + "\n";
  }

  text += "================================\n";
  text += "OBRIGADO PELA PREFERÊNCIA!\n";

  return text;
}

/* =======================
   HTML PRINT (BROWSER)
======================= */

export function generateReceiptHTML(order: Order): string {
  const text = buildReceiptText(order);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Comanda</title>
  <style>
    @page { size: 80mm auto; margin: 3mm; }
    body {
      margin: 0;
      font-family: Courier, monospace;
      font-size: 12px;
      white-space: pre-wrap;
    }
  </style>
</head>
<body>
<pre>${text}</pre>
</body>
</html>
`;
}

/* =======================
   AUTO PRINT (IFRAME)
======================= */

export function printReceipt(order: Order): Promise<boolean> {
  return new Promise((resolve) => {
    const html = generateReceiptHTML(order);

    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.style.visibility = "hidden";

    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) {
      resolve(false);
      return;
    }

    doc.open();
    doc.write(html);
    doc.close();

    iframe.onload = () => {
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();

        setTimeout(() => {
          document.body.removeChild(iframe);
          resolve(true);
        }, 500);
      }, 300);
    };
  });
}

/* =======================
   ESC/POS — PRINT SERVER
======================= */

export function generateESCPOSCommands(order: Order): Uint8Array {
  const encoder = new TextEncoder();
  const text = buildReceiptText(order);
  return encoder.encode(text);
}

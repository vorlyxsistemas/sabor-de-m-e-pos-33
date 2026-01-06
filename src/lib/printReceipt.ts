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
  cartao: "CARTAO",
};

const RECEIPT_WIDTH = 48;

function padRight(text: string, width: number): string {
  return text.substring(0, width).padEnd(width, " ");
}

function padLeft(text: string, width: number): string {
  return text.substring(0, width).padStart(width, " ");
}

function centerText(text: string, width: number): string {
  const trimmed = text.substring(0, width);
  const padding = Math.floor((width - trimmed.length) / 2);
  return " ".repeat(padding) + trimmed;
}

function formatPrice(value: number): string {
  return `R$${value.toFixed(2)}`;
}

function lineWithPrice(label: string, price: string, width: number): string {
  const priceLen = price.length;
  const labelMaxLen = width - priceLen - 1;
  const trimmedLabel = label.substring(0, labelMaxLen);
  const spaces = width - trimmedLabel.length - priceLen;
  return trimmedLabel + " ".repeat(Math.max(1, spaces)) + price;
}

export function generateReceiptText(order: Order): string {
  const lines: string[] = [];
  const W = RECEIPT_WIDTH;
  const dividerDouble = "=".repeat(W);
  const dividerSingle = "-".repeat(W);

  const orderNumber = order.id.slice(-6).toUpperCase();
  const dateTime = format(new Date(order.created_at), "dd/MM/yyyy HH:mm");

  // Header
  lines.push(centerText("SABOR DE MAE", W));
  lines.push(dividerDouble);
  lines.push(`PEDIDO: #${orderNumber}`);
  lines.push(`DATA: ${dateTime}`);

  // Order type
  const orderTypeText = orderTypeLabels[order.order_type] || order.order_type.toUpperCase();
  const tableText = order.order_type === "local" && order.table_number ? ` - MESA ${order.table_number}` : "";
  lines.push(orderTypeText + tableText);
  lines.push(dividerSingle);

  // Customer
  lines.push(`* CLIENTE: ${order.customer_name.toUpperCase()}`);
  if (order.customer_phone) {
    lines.push(`TEL: ${order.customer_phone}`);
  }

  // Delivery section
  if (order.order_type === "entrega") {
    lines.push(centerText("*** ENTREGA ***", W));
    if (order.bairro) {
      lines.push(`BAIRRO: ${order.bairro.toUpperCase()}`);
    }
    if (order.address) {
      lines.push(`END: ${order.address.toUpperCase()}`);
    }
    if (order.cep) {
      lines.push(`CEP: ${order.cep}`);
    }
    if (order.reference) {
      lines.push(`* REF: ${order.reference.toUpperCase()}`);
    }
  }

  // Items header - single line format
  const itemsTitle = "ITENS DO PEDIDO";
  const dashCount = Math.floor((W - itemsTitle.length) / 2);
  const itemsHeader = "-".repeat(dashCount) + itemsTitle + "-".repeat(dashCount);
  lines.push(itemsHeader.substring(0, W));

  // Items
  order.order_items?.forEach((item) => {
    const extras = item.extras as any;
    const isLunch = extras?.type === "lunch";
    let itemName = item.item?.name || (isLunch ? `ALMOCO - ${extras?.base?.name || ""}` : "ITEM");
    if (item.tapioca_molhada) {
      itemName += " (MOLHADA)";
    }

    const qty = Number(item.quantity) || 1;
    let unitBase = Number(item.price) || 0;
    let extrasUnit = 0;

    if (isLunch) {
      const meatUnit = Number(extras?.base?.singleMeatPrice) || 6;
      unitBase = Number(extras?.base?.price) || unitBase;
      extrasUnit += (Array.isArray(extras?.extraMeats) ? extras.extraMeats.length : 0) * meatUnit;
      if (Array.isArray(extras?.paidSides)) {
        extrasUnit += extras.paidSides.reduce((sum: number, s: any) => sum + (Number(s?.price) || 0), 0);
      }
      if (Array.isArray(extras?.regularExtras)) {
        extrasUnit += extras.regularExtras.reduce((sum: number, e: any) => sum + (Number(e?.price) || 0), 0);
      }
    } else if (extras && typeof extras === "object" && !Array.isArray(extras) && Array.isArray(extras?.regularExtras)) {
      extrasUnit += extras.regularExtras.reduce((sum: number, e: any) => sum + (Number(e?.price) || 0), 0);
    } else if (Array.isArray(extras)) {
      extrasUnit += extras.reduce((sum: number, e: any) => sum + (Number(e?.price) || 0), 0);
    }

    const lineTotal = (unitBase + extrasUnit) * qty;
    const priceStr = formatPrice(lineTotal);
    const qtyLabel = `${qty}x ${itemName.toUpperCase()}`;

    lines.push(lineWithPrice(qtyLabel, priceStr, W));

    if (qty > 1) {
      lines.push(` (${formatPrice(unitBase)} cada)`);
    }

    // Selected variation
    if (!isLunch && extras?.selected_variation) {
      lines.push(` > TIPO: ${extras.selected_variation.toUpperCase()}`);
    }

    // Lunch details
    if (isLunch) {
      if (extras?.meats?.length > 0) {
        lines.push(` > CARNES: ${extras.meats.join(", ").toUpperCase()}`);
      }
      if (extras?.extraMeats?.length > 0) {
        lines.push(` > + EXTRAS: ${extras.extraMeats.join(", ").toUpperCase()}`);
      }
      if (extras?.sides?.length > 0) {
        const sideMap: Record<string, string> = {
          macarrao: "MACARRAO",
          farofa: "FAROFA",
          macaxeira: "MACAXEIRA",
          salada: "SALADA",
        };
        const sidesStr = extras.sides.map((s: string) => sideMap[s] || s.toUpperCase()).join(", ");
        lines.push(` > ACOMP: ${sidesStr}`);
      }
      if (Array.isArray(extras?.paidSides) && extras.paidSides.length > 0) {
        const paidStr = extras.paidSides.map((s: any) => s.name?.toUpperCase() || "").filter(Boolean).join(", ");
        if (paidStr) {
          lines.push(` > ACOMP EXTRA: ${paidStr}`);
        }
      }
      if (Array.isArray(extras?.regularExtras) && extras.regularExtras.length > 0) {
        const extrasStr = extras.regularExtras.map((e: any) => e.name?.toUpperCase() || "").filter(Boolean).join(", ");
        if (extrasStr) {
          lines.push(` > EXTRAS: ${extrasStr}`);
        }
      }
    }

    // Regular extras (non-lunch)
    if (!isLunch && extras && Array.isArray(extras) && extras.length > 0) {
      const extrasStr = extras.map((e: any) => e.name?.toUpperCase() || "").filter(Boolean).join(", ");
      if (extrasStr) {
        lines.push(` > EXTRAS: ${extrasStr}`);
      }
    }
  });

  // Totals
  lines.push(dividerSingle);
  lines.push(lineWithPrice("SUBTOTAL:", formatPrice(order.subtotal), W));

  if (order.extras_fee && order.extras_fee > 0) {
    lines.push(lineWithPrice("EXTRAS:", formatPrice(order.extras_fee), W));
  }

  if (order.delivery_tax && order.delivery_tax > 0) {
    lines.push(lineWithPrice("TAXA ENTREGA:", formatPrice(order.delivery_tax), W));
  }

  lines.push(lineWithPrice("* TOTAL:", formatPrice(order.total), W));

  // Payment
  const paymentRaw = (order.payment_method || "").trim();
  const paymentKey = paymentRaw.toLowerCase();
  const paymentLabel = paymentMethodLabels[paymentKey] || (paymentRaw ? paymentRaw.toUpperCase() : "NAO INFORMADO");
  lines.push(`* PAGAMENTO: ${paymentLabel}`);

  if (paymentKey === "dinheiro" && order.troco) {
    lines.push(`TROCO PARA: ${formatPrice(order.troco)}`);
  }

  // Observations
  if (order.observations && order.observations.trim()) {
    lines.push(dividerSingle);
    lines.push("* OBSERVACOES:");
    lines.push(order.observations.toUpperCase());
  }

  // Footer
  lines.push(dividerSingle);
  lines.push(centerText("OBRIGADO PELA PREFERENCIA!", W));

  return lines.join("\n");
}

// HTML generation for thermal receipt printing (58mm/80mm)
export function generateReceiptHTML(order: Order): string {
  const text = generateReceiptText(order);
  const escapedText = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Comanda #${order.id.slice(-6).toUpperCase()}</title>
  <style>
    @page { size: 58mm auto; margin: 0; }
    @media print { @page { size: 58mm auto; margin: 0; } }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: 58mm;
      max-width: 58mm;
      margin: 0;
      padding: 2mm;
      font-family: 'Courier New', Courier, monospace;
      font-size: 11px;
      font-weight: bold;
      color: #000;
      line-height: 1.2;
      white-space: pre;
    }
  </style>
</head>
<body>${escapedText}</body>
</html>`;
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

// ESC/POS command generator for thermal printers
export function generateESCPOSCommands(order: Order): Uint8Array {
  const text = generateReceiptText(order);
  const encoder = new TextEncoder();
  const commands: number[] = [];

  const ESC = 0x1b;
  const GS = 0x1d;
  const LF = 0x0a;

  // Initialize printer
  commands.push(ESC, 0x40);

  // Set print density to maximum
  commands.push(GS, 0x7c, 0x08);

  // Bold mode
  commands.push(ESC, 0x45, 0x01);

  // Add text
  commands.push(...encoder.encode(text));

  // Line feeds and cut
  commands.push(LF, LF, LF);
  commands.push(GS, 0x56, 0x00);

  return new Uint8Array(commands);
}

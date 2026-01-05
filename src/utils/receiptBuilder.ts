import { format } from "date-fns";

// ============================================================
// TIPOS
// ============================================================

export interface OrderItem {
  quantity: number;
  price: number;
  extras: any;
  tapioca_molhada: boolean;
  item: { name: string } | null;
}

export interface Order {
  id: string;
  customer_name: string;
  customer_phone: string | null;
  status: string;
  order_type: string;
  table_number?: number | null;
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

// ============================================================
// CONSTANTES
// ============================================================

const W = 32; // Largura padrão para impressora térmica 58mm

export const orderTypeLabels: Record<string, string> = {
  local: "COMER NO LOCAL",
  retirada: "RETIRADA",
  entrega: "ENTREGA",
};

export const paymentMethodLabels: Record<string, string> = {
  pix: "PIX",
  dinheiro: "DINHEIRO",
  cartao: "CARTÃO",
};

export const sideNameMap: Record<string, string> = {
  macarrao: "MACARRÃO",
  farofa: "FAROFA",
  macaxeira: "MACAXEIRA",
  salada: "SALADA",
};

// ============================================================
// HELPERS
// ============================================================

function center(text: string, width = W): string {
  const pad = Math.max(0, width - text.length);
  const left = Math.floor(pad / 2);
  return " ".repeat(left) + text;
}

function line(char = "-", width = W): string {
  return char.repeat(width);
}

function leftRight(left: string, right: string, width = W): string {
  const space = Math.max(1, width - left.length - right.length);
  return left + " ".repeat(space) + right;
}

function wrap(text: string, width = W, indent = 0): string {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  const prefix = " ".repeat(indent);
  const maxLen = width - indent;

  for (const word of words) {
    if (current.length + word.length + 1 <= maxLen) {
      current = current ? current + " " + word : word;
    } else {
      if (current) lines.push(prefix + current);
      current = word;
    }
  }
  if (current) lines.push(prefix + current);
  return lines.join("\n");
}

function box(text: string, width = W): string {
  const inner = width - 4;
  const textLen = text.length;
  const pad = Math.max(0, inner - textLen);
  const left = Math.floor(pad / 2);
  const right = pad - left;
  return `| ${" ".repeat(left)}${text}${" ".repeat(right)} |`;
}

function boxTop(width = W): string {
  return "+" + "-".repeat(width - 2) + "+";
}

function boxBottom(width = W): string {
  return "+" + "-".repeat(width - 2) + "+";
}

// ============================================================
// GERADOR ÚNICO DE COMANDA HTML (TEXTO PRÉ-FORMATADO)
// ============================================================

/**
 * Gera o HTML completo da comanda para impressão térmica.
 * Usa <pre> com texto monospace para máxima compatibilidade.
 */
export function buildReceiptHTML(order: Order): string {
  const orderNumber = order.id.slice(-6).toUpperCase();
  const dateTime = format(new Date(order.created_at), "dd/MM/yyyy HH:mm");

  const lines: string[] = [];

  // Header
  lines.push(center("SABOR DE MÃE"));
  lines.push("");
  lines.push(`PEDIDO: #${orderNumber}`);
  lines.push(`DATA: ${dateTime}`);
  
  // Tipo de pedido em caixa
  const orderTypeText = orderTypeLabels[order.order_type] || order.order_type;
  const orderTypeWithTable = order.order_type === 'local' && order.table_number 
    ? `${orderTypeText} - MESA ${order.table_number}` 
    : orderTypeText;
  lines.push(boxTop());
  lines.push(box(orderTypeWithTable));
  lines.push(boxBottom());
  
  lines.push(line("-"));
  
  // Cliente
  lines.push(`★ CLIENTE: ${order.customer_name.toUpperCase()}`);
  if (order.customer_phone) {
    lines.push(`TEL: ${order.customer_phone}`);
  }

  // Entrega
  if (order.order_type === "entrega") {
    lines.push("");
    lines.push(center("*** ENTREGA ***"));
    if (order.bairro) lines.push(`BAIRRO: ${order.bairro.toUpperCase()}`);
    if (order.address) lines.push(`ENDEREÇO: ${order.address.toUpperCase()}`);
    if (order.reference) lines.push(`★ REF: ${order.reference.toUpperCase()}`);
  }

  lines.push(line("="));
  lines.push(center("ITENS DO PEDIDO"));
  lines.push(line("="));

  // Itens
  order.order_items?.forEach((item) => {
    const extras = item.extras as any;
    const isLunch = extras?.type === "lunch";
    const itemName = item.item?.name || (isLunch ? `ALMOÇO - ${extras?.base?.name}` : "ITEM");

    const qty = Number(item.quantity) || 1;
    const unitBase = Number(item.price) || 0;
    let extrasPrice = 0;

    // Calcula preço dos extras
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
    const itemNameFull = `${qty}x ${itemName.toUpperCase()}${item.tapioca_molhada ? " (MOLHADA)" : ""}`;
    const priceStr = `R$${lineTotal.toFixed(2)}`;

    lines.push("");
    lines.push(leftRight(itemNameFull.substring(0, W - priceStr.length - 1), priceStr));
    
    if (qty > 1) {
      lines.push(`  (R$${unitBase.toFixed(2)} cada)`);
    }

    // Variação selecionada
    if (!isLunch && extras?.selected_variation) {
      lines.push(`  ► TIPO: ${extras.selected_variation.toUpperCase()}`);
    }

    // Detalhes do almoço
    if (isLunch) {
      if (extras?.meats?.length > 0) {
        lines.push("  ► CARNES INCLUÍDAS:");
        extras.meats.forEach((meat: string) => {
          lines.push(`    • ${meat.toUpperCase()}`);
        });
      }
      if (extras?.extraMeats?.length > 0) {
        lines.push("  ► CARNES EXTRAS (+R$):");
        extras.extraMeats.forEach((meat: string) => {
          lines.push(`    • ${meat.toUpperCase()}`);
        });
      }
      if (extras?.sides?.length > 0) {
        lines.push("  ► ACOMPANHAMENTOS");
        lines.push("    (GRÁTIS):");
        extras.sides.forEach((side: string) => {
          const sideName = sideNameMap[side] || side.toUpperCase();
          lines.push(`    • ${sideName}`);
        });
      }
      if (extras?.paidSides?.length > 0) {
        lines.push("  ► ACOMPANHAMENTOS (+R$):");
        extras.paidSides.forEach((side: any) => {
          lines.push(`    • ${side.name.toUpperCase()}`);
        });
      }
    }

    // Extras regulares
    const regularExtras = !isLunch
      ? (Array.isArray(extras) ? extras : (Array.isArray(extras?.regularExtras) ? extras.regularExtras : []))
      : [];

    if (!isLunch && regularExtras.length > 0) {
      lines.push(`  ► EXTRAS: ${regularExtras.map((e: any) => e.name.toUpperCase()).join(", ")}`);
    }
  });

  lines.push("");
  lines.push(line("="));

  // Totais
  lines.push(leftRight("SUBTOTAL:", `R$ ${order.subtotal.toFixed(2)}`));
  lines.push(leftRight("(ITENS+EXTRAS)", `${order.subtotal.toFixed(2)}`));
  
  if (order.delivery_tax && order.delivery_tax > 0) {
    lines.push(leftRight("TAXA ENTREGA:", `R$ ${order.delivery_tax.toFixed(2)}`));
  }
  
  lines.push("");
  lines.push(leftRight(`★ TOTAL:`, `R$ ${order.total.toFixed(2)}`));

  // Pagamento em caixa
  const paymentRaw = (order.payment_method || "").trim();
  const paymentKey = paymentRaw.toLowerCase();
  const paymentLabel = paymentMethodLabels[paymentKey] || (paymentRaw ? paymentRaw.toUpperCase() : "NÃO INFORMADO");
  
  lines.push("");
  lines.push(boxTop());
  lines.push(box(`★ PAGAMENTO: ${paymentLabel}`));
  lines.push(boxBottom());
  
  if (paymentKey === "dinheiro" && order.troco) {
    lines.push(`TROCO PARA: R$ ${order.troco.toFixed(2)}`);
  }

  // Observações
  if (order.observations && order.observations.trim()) {
    lines.push("");
    lines.push(boxTop());
    lines.push(box("★ OBSERVAÇÕES"));
    lines.push(boxBottom());
    lines.push(wrap(order.observations.toUpperCase(), W, 0));
  }

  // Footer
  lines.push("");
  lines.push(line("-"));
  lines.push(center("OBRIGADO PELA PREFERÊNCIA!"));
  lines.push(line("-"));

  const contentText = lines.join("\n");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<style>
@page{size:58mm auto;margin:0}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Courier New',Courier,monospace;font-size:12px;line-height:1.2;background:#fff;color:#000;width:58mm;max-width:58mm}
pre{font-family:inherit;font-size:inherit;white-space:pre;margin:0;padding:2mm}
</style>
</head>
<body>
<pre>${contentText}</pre>
</body>
</html>`;
}

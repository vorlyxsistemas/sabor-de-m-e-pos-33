/* =========================================================
   RECEIPT HTML - SABOR DE MÃE
   Layout térmico profissional (58mm / 80mm)
   ÚNICA FONTE DE VERDADE PARA IMPRESSÃO
========================================================= */

export interface OrderItem {
  quantity: number;
  price: number;
  extras: any;
  tapioca_molhada?: boolean;
  item: {
    name: string;
  } | null;
}

export interface Order {
  id: string;
  customer_name: string;
  customer_phone?: string | null;
  order_type: string;
  address?: string | null;
  bairro?: string | null;
  reference?: string | null;
  created_at: string;
  payment_method?: string | null;
  troco?: number | null;
  observations?: string | null;
  subtotal: number;
  delivery_tax?: number | null;
  total: number;
  order_items: OrderItem[];
}

/* =========================================================
   HELPERS
========================================================= */

function formatMoney(value: number): string {
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
}

function formatDate(date: string): string {
  return new Date(date).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function orderTypeLabel(type: string): string {
  if (type === "entrega") return "ENTREGA";
  if (type === "retirada") return "RETIRADA";
  return "LOCAL";
}

/* =========================================================
   MAIN GENERATOR
========================================================= */

export function generateReceiptHTML(order: Order): string {
  const orderNumber = order.id.slice(-6).toUpperCase();

  const itemsHTML = order.order_items
    .map((item) => {
      const name = item.item?.name || "ITEM";
      const unit = item.price;
      const total = unit * item.quantity;

      const extras: string[] = [];

      if (Array.isArray(item.extras)) {
        item.extras.forEach((e: any) => extras.push(e.name));
      } else if (item.extras?.meats) {
        extras.push(`CARNES: ${item.extras.meats.join(", ")}`);
      }

      if (item.tapioca_molhada) {
        extras.push("TAPIOCA MOLHADA");
      }

      return `
<div class="item">
  <div class="item-line">
    ${item.quantity}x ${name}
    <span class="price">${formatMoney(total)}</span>
  </div>
  ${
    extras.length
      ? `<div class="extras">► ${extras.join(" • ")}</div>`
      : ""
  }
</div>
`;
    })
    .join("");

  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<style>

@page {
  size: 58mm auto;
  margin: 0;
}

html, body {
  margin: 0;
  padding: 0;
  width: 58mm;
}

body {
  font-family: "Courier New", monospace;
  font-size: 11px;
  font-weight: 700;
  line-height: 1.3;
  padding: 2mm;
  box-sizing: border-box;
}

.center {
  text-align: center;
}

.sep {
  border-top: 1px dashed #000;
  margin: 6px 0;
}

.item {
  margin-bottom: 6px;
}

.item-line {
  white-space: normal;
  word-break: break-word;
}

.price {
  float: right;
}

.extras {
  padding-left: 6px;
  font-size: 10px;
}

.total {
  font-size: 13px;
  font-weight: 900;
}

.clear {
  clear: both;
}

</style>
</head>

<body>

<div class="center">
  <div><strong>SABOR DE MÃE</strong></div>
</div>

<div class="sep"></div>

<div>PEDIDO: #${orderNumber}</div>
<div>DATA: ${formatDate(order.created_at)}</div>

<div class="sep"></div>

<div class="center">
  <strong>${orderTypeLabel(order.order_type)}</strong>
</div>

<div class="sep"></div>

<div><strong>CLIENTE:</strong> ${order.customer_name}</div>

${
  order.order_type === "entrega"
    ? `
<div class="sep"></div>
<div><strong>ENTREGA</strong></div>
${order.bairro ? `<div>BAIRRO: ${order.bairro}</div>` : ""}
${order.address ? `<div>END: ${order.address}</div>` : ""}
${order.reference ? `<div>REF: ${order.reference}</div>` : ""}
`
    : ""
}

<div class="sep"></div>

<div class="center"><strong>ITENS</strong></div>

<div class="sep"></div>

${itemsHTML}

<div class="sep"></div>

<div>SUBTOTAL <span class="price">${formatMoney(order.subtotal)}</span></div>
<div class="clear"></div>

${
  order.delivery_tax
    ? `<div>TAXA ENTREGA <span class="price">${formatMoney(order.delivery_tax)}</span></div><div class="clear"></div>`
    : ""
}

<div class="sep"></div>

<div class="total">
  TOTAL <span class="price">${formatMoney(order.total)}</span>
</div>
<div class="clear"></div>

<div class="sep"></div>

<div><strong>PAGAMENTO:</strong> ${order.payment_method?.toUpperCase() || "-"}</div>

${
  order.observations
    ? `
<div class="sep"></div>
<div><strong>OBS:</strong></div>
<div>${order.observations}</div>
`
    : ""
}

<div class="sep"></div>

<div class="center">
  OBRIGADO PELA PREFERÊNCIA!
</div>

</body>
</html>
`.trim();
}

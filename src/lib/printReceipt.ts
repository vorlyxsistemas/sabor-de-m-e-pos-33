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

export function generateReceiptHTML(order: Order): string {
  const orderNumber = order.id.slice(-6).toUpperCase();
  const dateTime = format(new Date(order.created_at), "dd/MM/yyyy HH:mm");

  let itemsHTML = "";
  order.order_items?.forEach((item) => {
    const extras = item.extras as any;
    const isLunch = extras?.type === "lunch";
    const itemName = item.item?.name || (isLunch ? `ALMOÇO - ${extras?.base?.name}` : "ITEM");

    itemsHTML += `
      <div style="margin-bottom: 8px;">
        <div style="display: flex; justify-content: space-between;">
          <span style="font-weight: bold;">${item.quantity} UND. ${itemName.toUpperCase()}${item.tapioca_molhada ? " (MOLHADA)" : ""}</span>
          <span style="font-weight: bold;">R$${item.price.toFixed(2)}</span>
        </div>
    `;

    // Lunch details
    if (isLunch) {
      if (extras?.meats?.length > 0) {
        itemsHTML += `<div style="padding-left: 10px; font-size: 11px; font-weight: bold;">CARNES: ${extras.meats.join(", ").toUpperCase()}</div>`;
      }
      if (extras?.extraMeats?.length > 0) {
        itemsHTML += `<div style="padding-left: 10px; font-size: 11px; font-weight: bold;">+ EXTRAS: ${extras.extraMeats.join(", ").toUpperCase()}</div>`;
      }
      if (extras?.sides?.length > 0) {
        const sideMap: Record<string, string> = {
          macarrao: "MACARRÃO",
          farofa: "FAROFA",
          macaxeira: "MACAXEIRA",
          salada: "SALADA",
        };
        const sidesStr = extras.sides.map((s: string) => sideMap[s] || s.toUpperCase()).join(", ");
        itemsHTML += `<div style="padding-left: 10px; font-size: 11px;">ACOMP: ${sidesStr}</div>`;
      }
    }

    // Regular extras
    if (!isLunch && extras && Array.isArray(extras) && extras.length > 0) {
      itemsHTML += `<div style="padding-left: 10px; font-size: 11px; font-weight: bold;">EXTRAS: ${extras.map((e: any) => e.name.toUpperCase()).join(", ")}</div>`;
    }

    itemsHTML += `</div>`;
  });

  let deliverySection = "";
  if (order.order_type === "entrega") {
    deliverySection = `
      <div style="margin-bottom: 8px; border: 2px solid #000; padding: 8px;">
        <div style="font-weight: bold; font-size: 13px; margin-bottom: 4px;">ENTREGA:</div>
        ${order.bairro ? `<div style="font-weight: bold;">BAIRRO: ${order.bairro.toUpperCase()}</div>` : ""}
        ${order.address ? `<div>ENDEREÇO: ${order.address.toUpperCase()}</div>` : ""}
        ${order.cep ? `<div>CEP: ${order.cep}</div>` : ""}
        ${order.reference ? `<div style="font-weight: bold;">REFERÊNCIA: ${order.reference.toUpperCase()}</div>` : ""}
      </div>
    `;
  }

  // Payment section
  const paymentRaw = (order.payment_method || "").trim();
  const paymentKey = paymentRaw.toLowerCase();
  const paymentLabel = paymentMethodLabels[paymentKey] || (paymentRaw ? paymentRaw.toUpperCase() : "NÃO INFORMADO");
  let paymentSection = `
    <div style="margin-top: 8px; border: 2px solid #000; padding: 8px;">
      <div style="font-weight: bold; font-size: 13px;">PAGAMENTO: ${paymentLabel}</div>
      ${paymentKey === "dinheiro" && order.troco ? `<div style="font-weight: bold;">TROCO PARA: R$ ${order.troco.toFixed(2)}</div>` : ""}
    </div>
  `;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Comanda #${orderNumber}</title>
      <style>
        @page { size: 80mm auto; margin: 5mm; }
        body { 
          font-family: 'Courier New', Courier, monospace; 
          font-size: 12px; 
          width: 70mm; 
          margin: 0 auto; 
          padding: 5mm;
          color: #000;
          background: #fff;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        * {
          color: #000 !important;
        }
        .header { text-align: center; margin-bottom: 10px; }
        .title { font-weight: bold; font-size: 16px; }
        .divider { font-size: 12px; font-weight: bold; }
        .section { margin-bottom: 8px; }
        .totals { margin-top: 8px; }
        .total-line { display: flex; justify-content: space-between; font-weight: bold; }
        .bold { font-weight: bold; }
        .footer { text-align: center; margin-top: 10px; font-size: 11px; font-weight: bold; }
        @media print {
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
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
        <div style="font-weight: bold;">PEDIDO: #${orderNumber}</div>
        <div>DATA: ${dateTime}</div>
        <div style="font-weight: bold; font-size: 14px;">TIPO: ${orderTypeLabels[order.order_type] || order.order_type}</div>
      </div>

      <div class="section">
        <div style="font-weight: bold;">CLIENTE: ${order.customer_name.toUpperCase()}</div>
        ${order.customer_phone ? `<div>TEL: ${order.customer_phone}</div>` : ""}
      </div>

      ${deliverySection}

      <div class="section">
        <div class="divider">======== ITENS DO PEDIDO ========</div>
      </div>

      <div class="section">
        ${itemsHTML}
      </div>

      <div class="divider">================================</div>

      <div class="totals">
        <div class="total-line">
          <span>SUBTOTAL:</span>
          <span>R$ ${order.subtotal.toFixed(2)}</span>
        </div>
        ${order.extras_fee && order.extras_fee > 0 ? `
          <div class="total-line">
            <span>EXTRAS:</span>
            <span>R$ ${order.extras_fee.toFixed(2)}</span>
          </div>
        ` : ""}
        ${order.delivery_tax && order.delivery_tax > 0 ? `
          <div class="total-line">
            <span>TAXA DE ENTREGA:</span>
            <span>R$ ${order.delivery_tax.toFixed(2)}</span>
          </div>
        ` : ""}
        <div class="total-line" style="font-size: 14px; margin-top: 4px; border-top: 2px solid #000; padding-top: 4px;">
          <span>TOTAL:</span>
          <span>R$ ${order.total.toFixed(2)}</span>
        </div>
      </div>

      ${paymentSection}

      <div class="footer">
        <div class="divider">================================</div>
        <div>OBRIGADO PELA PREFERÊNCIA!</div>
        <div class="divider">================================</div>
      </div>
    </body>
    </html>
  `;
}

export function printReceipt(order: Order): void {
  const receiptHTML = generateReceiptHTML(order);
  
  // Open print window
  const printWindow = window.open("", "_blank", "width=300,height=600");
  if (!printWindow) {
    console.error("Não foi possível abrir a janela de impressão. Verifique se pop-ups estão bloqueados.");
    return;
  }

  printWindow.document.write(receiptHTML);
  printWindow.document.close();

  // Wait for content to load, then print
  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.print();
      printWindow.onafterprint = () => {
        printWindow.close();
      };
    }, 100);
  };
}

// ESC/POS command generator for Elgin I9 (for future WebSocket/USB integration)
export function generateESCPOSCommands(order: Order): Uint8Array {
  const encoder = new TextEncoder();
  const commands: number[] = [];
  
  // ESC/POS Commands
  const ESC = 0x1B;
  const GS = 0x1D;
  const LF = 0x0A;
  
  // Initialize printer
  commands.push(ESC, 0x40); // ESC @ - Initialize
  
  // Center alignment
  commands.push(ESC, 0x61, 0x01); // ESC a 1 - Center
  
  // Bold on
  commands.push(ESC, 0x45, 0x01); // ESC E 1 - Bold on
  
  // Header
  const header = "SABOR DE MAE\n";
  commands.push(...encoder.encode(header));
  
  // Bold off
  commands.push(ESC, 0x45, 0x00);
  
  commands.push(...encoder.encode("================================\n"));
  
  // Left alignment
  commands.push(ESC, 0x61, 0x00);
  
  const orderNumber = order.id.slice(-6).toUpperCase();
  const dateTime = format(new Date(order.created_at), "dd/MM/yyyy HH:mm");
  
  // Bold on for important info
  commands.push(ESC, 0x45, 0x01);
  commands.push(...encoder.encode(`PEDIDO: #${orderNumber}\n`));
  commands.push(ESC, 0x45, 0x00);
  commands.push(...encoder.encode(`DATA: ${dateTime}\n`));
  commands.push(ESC, 0x45, 0x01);
  commands.push(...encoder.encode(`TIPO: ${orderTypeLabels[order.order_type] || order.order_type}\n`));
  commands.push(ESC, 0x45, 0x00);
  commands.push(LF);
  commands.push(ESC, 0x45, 0x01);
  commands.push(...encoder.encode(`CLIENTE: ${order.customer_name.toUpperCase()}\n`));
  commands.push(ESC, 0x45, 0x00);
  
  if (order.customer_phone) {
    commands.push(...encoder.encode(`TEL: ${order.customer_phone}\n`));
  }
  
  if (order.order_type === "entrega") {
    commands.push(LF);
    commands.push(...encoder.encode("================================\n"));
    commands.push(ESC, 0x45, 0x01);
    commands.push(...encoder.encode("ENTREGA:\n"));
    if (order.bairro) commands.push(...encoder.encode(`BAIRRO: ${order.bairro.toUpperCase()}\n`));
    commands.push(ESC, 0x45, 0x00);
    if (order.address) commands.push(...encoder.encode(`ENDERECO: ${order.address.toUpperCase()}\n`));
    if (order.cep) commands.push(...encoder.encode(`CEP: ${order.cep}\n`));
    if (order.reference) {
      commands.push(ESC, 0x45, 0x01);
      commands.push(...encoder.encode(`REF: ${order.reference.toUpperCase()}\n`));
      commands.push(ESC, 0x45, 0x00);
    }
  }
  
  commands.push(LF);
  commands.push(...encoder.encode("======== ITENS DO PEDIDO ========\n"));
  commands.push(LF);
  
  // Items
  order.order_items?.forEach((item) => {
    const extras = item.extras as any;
    const isLunch = extras?.type === "lunch";
    const itemName = item.item?.name || (isLunch ? `ALMOCO - ${extras?.base?.name}` : "ITEM");
    
    commands.push(ESC, 0x45, 0x01);
    commands.push(...encoder.encode(`${item.quantity} UND. ${itemName.toUpperCase()}`));
    if (item.tapioca_molhada) commands.push(...encoder.encode(" (MOLHADA)"));
    commands.push(...encoder.encode(` R$${item.price.toFixed(2)}\n`));
    commands.push(ESC, 0x45, 0x00);
    
    if (isLunch) {
      if (extras?.meats?.length > 0) {
        commands.push(ESC, 0x45, 0x01);
        commands.push(...encoder.encode(`  CARNES: ${extras.meats.join(", ").toUpperCase()}\n`));
        commands.push(ESC, 0x45, 0x00);
      }
      if (extras?.extraMeats?.length > 0) {
        commands.push(ESC, 0x45, 0x01);
        commands.push(...encoder.encode(`  + EXTRAS: ${extras.extraMeats.join(", ").toUpperCase()}\n`));
        commands.push(ESC, 0x45, 0x00);
      }
      if (extras?.sides?.length > 0) {
        const sideMap: Record<string, string> = {
          macarrao: "MACARRAO", farofa: "FAROFA",
          macaxeira: "MACAXEIRA", salada: "SALADA"
        };
        const sidesStr = extras.sides.map((s: string) => sideMap[s] || s.toUpperCase()).join(", ");
        commands.push(...encoder.encode(`  ACOMP: ${sidesStr}\n`));
      }
    }
    
    if (!isLunch && extras && Array.isArray(extras) && extras.length > 0) {
      commands.push(ESC, 0x45, 0x01);
      commands.push(...encoder.encode(`  EXTRAS: ${extras.map((e: any) => e.name.toUpperCase()).join(", ")}\n`));
      commands.push(ESC, 0x45, 0x00);
    }
  });
  
  commands.push(LF);
  commands.push(...encoder.encode("================================\n"));
  
  // Totals
  commands.push(ESC, 0x45, 0x01);
  commands.push(...encoder.encode(`SUBTOTAL: R$ ${order.subtotal.toFixed(2)}\n`));
  if (order.extras_fee && order.extras_fee > 0) {
    commands.push(...encoder.encode(`EXTRAS: R$ ${order.extras_fee.toFixed(2)}\n`));
  }
  if (order.delivery_tax && order.delivery_tax > 0) {
    commands.push(...encoder.encode(`TAXA ENTREGA: R$ ${order.delivery_tax.toFixed(2)}\n`));
  }
  
  // Bold on for total
  commands.push(...encoder.encode(`TOTAL: R$ ${order.total.toFixed(2)}\n`));
  commands.push(ESC, 0x45, 0x00);
  
  // Payment info
  commands.push(LF);
  commands.push(...encoder.encode("================================\n"));
  const paymentRaw = (order.payment_method || "").trim();
  const paymentKey = paymentRaw.toLowerCase();
  const paymentLabel = paymentMethodLabels[paymentKey] || (paymentRaw ? paymentRaw.toUpperCase() : "NAO INFORMADO");
  commands.push(ESC, 0x45, 0x01);
  commands.push(...encoder.encode(`PAGAMENTO: ${paymentLabel}\n`));
  if (paymentKey === "dinheiro" && order.troco) {
    commands.push(...encoder.encode(`TROCO PARA: R$ ${order.troco.toFixed(2)}\n`));
  }
  commands.push(ESC, 0x45, 0x00);
  
  // Footer
  commands.push(LF);
  commands.push(ESC, 0x61, 0x01); // Center
  commands.push(...encoder.encode("================================\n"));
  commands.push(ESC, 0x45, 0x01);
  commands.push(...encoder.encode("OBRIGADO PELA PREFERENCIA!\n"));
  commands.push(ESC, 0x45, 0x00);
  commands.push(...encoder.encode("================================\n"));
  
  // Cut paper
  commands.push(LF, LF, LF);
  commands.push(GS, 0x56, 0x00); // GS V 0 - Full cut
  
  return new Uint8Array(commands);
}

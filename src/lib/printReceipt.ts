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

export function generateReceiptHTML(order: Order): string {
  const orderNumber = order.id.slice(-6).toUpperCase();
  const dateTime = format(new Date(order.created_at), "dd/MM/yyyy HH:mm");

  let itemsHTML = "";
  order.order_items?.forEach((item) => {
    const extras = item.extras as any;
    const isLunch = extras?.type === "lunch";
    const itemName = item.item?.name || (isLunch ? `ALMOÇO - ${extras?.base?.name}` : "ITEM");

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
    } else if (extras && typeof extras === 'object' && !Array.isArray(extras) && Array.isArray(extras?.regularExtras)) {
      extrasUnit += extras.regularExtras.reduce((sum: number, e: any) => sum + (Number(e?.price) || 0), 0);
    } else if (Array.isArray(extras)) {
      extrasUnit += extras.reduce((sum: number, e: any) => sum + (Number(e?.price) || 0), 0);
    }

    const lineTotal = (unitBase + extrasUnit) * qty;

    itemsHTML += `
      <div style="margin-bottom: 10px;">
        <div style="display: flex; justify-content: space-between; font-weight: 900; font-size: 14px;">
          <span>${qty}x ${itemName.toUpperCase()}${item.tapioca_molhada ? " (MOLHADA)" : ""}</span>
          <span>R$${lineTotal.toFixed(2)}</span>
        </div>
        ${qty > 1 ? `<div style="padding-left: 12px; font-size: 11px; font-weight: 700; color: #555;">(R$${unitBase.toFixed(2)} cada)</div>` : ""}
    `;

    // Selected Variation
    if (!isLunch && extras?.selected_variation) {
      itemsHTML += `<div style="padding-left: 12px; font-size: 13px; font-weight: 700;">► TIPO: ${extras.selected_variation.toUpperCase()}</div>`;
    }

    // Lunch details
    if (isLunch) {
      if (extras?.meats?.length > 0) {
        itemsHTML += `<div style="padding-left: 12px; font-size: 13px; font-weight: 700;">► CARNES: ${extras.meats.join(", ").toUpperCase()}</div>`;
      }
      if (extras?.extraMeats?.length > 0) {
        itemsHTML += `<div style="padding-left: 12px; font-size: 13px; font-weight: 700;">► + EXTRAS: ${extras.extraMeats.join(", ").toUpperCase()}</div>`;
      }
      if (extras?.sides?.length > 0) {
        const sideMap: Record<string, string> = {
          macarrao: "MACARRÃO",
          farofa: "FAROFA",
          macaxeira: "MACAXEIRA",
          salada: "SALADA",
        };
        const sidesStr = extras.sides.map((s: string) => sideMap[s] || s.toUpperCase()).join(", ");
        itemsHTML += `<div style="padding-left: 12px; font-size: 13px; font-weight: 700;">► ACOMP: ${sidesStr}</div>`;
      }
    }

    // Regular extras
    if (!isLunch && extras && Array.isArray(extras) && extras.length > 0) {
      itemsHTML += `<div style="padding-left: 12px; font-size: 13px; font-weight: 700;">► EXTRAS: ${extras.map((e: any) => e.name.toUpperCase()).join(", ")}</div>`;
    }

    itemsHTML += `</div>`;
  });

  let deliverySection = "";
  if (order.order_type === "entrega") {
    deliverySection = `
      <div style="margin: 12px 0; border: 3px solid #000; padding: 10px; background: #fff;">
        <div style="font-weight: 900; font-size: 15px; margin-bottom: 6px; text-decoration: underline;">*** ENTREGA ***</div>
        ${order.bairro ? `<div style="font-weight: 900; font-size: 14px;">BAIRRO: ${order.bairro.toUpperCase()}</div>` : ""}
        ${order.address ? `<div style="font-weight: 700; font-size: 13px;">ENDEREÇO: ${order.address.toUpperCase()}</div>` : ""}
        ${order.cep ? `<div style="font-weight: 700; font-size: 13px;">CEP: ${order.cep}</div>` : ""}
        ${order.reference ? `<div style="font-weight: 900; font-size: 14px; margin-top: 4px;">★ REF: ${order.reference.toUpperCase()}</div>` : ""}
      </div>
    `;
  }

  // Payment section
  const paymentRaw = (order.payment_method || "").trim();
  const paymentKey = paymentRaw.toLowerCase();
  const paymentLabel = paymentMethodLabels[paymentKey] || (paymentRaw ? paymentRaw.toUpperCase() : "NÃO INFORMADO");
  let paymentSection = `
  <div style="margin-top: 12px; border: 3px solid #000; padding: 10px; background: #fff;">
    <div style="font-weight: 900; font-size: 15px;">★ PAGAMENTO: ${paymentLabel}</div>

    ${paymentKey === "dinheiro" && order.troco
      ? `<div style="font-weight: 900; font-size: 14px;">TROCO PARA: R$ ${order.troco.toFixed(2)}</div>`
      : ""
    }

    ${paymentKey === "pix"
      ? `
        <div style="margin-top: 6px; font-weight: 700; font-size: 13px;">
          <div>CNPJ: 64569575000102</div>
          <div>JORGE LUIS DO N FRANCELINO LTDA</div>
        </div>
      `
      : ""
    }
  </div>
  `;

  // Observations section - always show when present, regardless of order source
  let observationsSection = "";
  if (order.observations && order.observations.trim()) {
    observationsSection = `
      <div style="margin-top: 12px; border: 3px solid #000; padding: 10px; background: #fff;">
        <div style="font-weight: 900; font-size: 14px;">★ OBSERVAÇÕES:</div>
        <div style="font-weight: 700; font-size: 13px;">${order.observations.toUpperCase()}</div>
      </div>
    `;
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Comanda #${orderNumber}</title>
      <style>
        @page { 
          size: 80mm auto; 
          margin: 3mm; 
        }
        * {
          color: #000 !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        body { 
          font-family: 'Courier New', Courier, monospace; 
          font-size: 13px; 
          font-weight: 700;
          width: 72mm; 
          margin: 0 auto; 
          padding: 4mm;
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
        @media print {
          * {
            color: #000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body {
            background: #fff !important;
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
        <div style="font-weight: 900; font-size: 16px;">PEDIDO: #${orderNumber}</div>
        <div style="font-weight: 700;">DATA: ${dateTime}</div>
        <div style="font-weight: 900; font-size: 16px; border: 2px solid #000; padding: 4px; margin-top: 4px; text-align: center;">
          ${orderTypeLabels[order.order_type] || order.order_type}${order.order_type === 'local' && order.table_number ? ` - MESA ${order.table_number}` : ''}
        </div>
      </div>

      <div class="divider">--------------------------------</div>

      <div class="section">
        <div style="font-weight: 900; font-size: 15px;">★ CLIENTE: ${order.customer_name.toUpperCase()}</div>
        ${order.customer_phone ? `<div style="font-weight: 700;">TEL: ${order.customer_phone}</div>` : ""}
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
    
    // Create hidden iframe for printing (avoids popup blockers)
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
    
    // Wait for content to load, then print
    iframe.onload = () => {
      setTimeout(() => {
        try {
          const iframeWindow = iframe.contentWindow;
          if (iframeWindow) {
            console.log("Disparando impressão automática...");
            iframeWindow.focus();
            iframeWindow.print();
          }
          
          // Clean up iframe after print dialog closes
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
    
    // Fallback: trigger onload manually for some browsers
    setTimeout(() => {
      if (iframe.onload) {
        iframe.onload(new Event("load"));
      }
    }, 500);
  });
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
  
  // Set print density to maximum (darker print)
  commands.push(GS, 0x7C, 0x08); // GS | n - Set print density (8 = max)
  
  // Center alignment
  commands.push(ESC, 0x61, 0x01); // ESC a 1 - Center
  
  // Double height + Bold for header
  commands.push(ESC, 0x21, 0x38); // ESC ! n - Select print mode (double height + bold)
  
  // Header
  const header = "SABOR DE MAE\n";
  commands.push(...encoder.encode(header));
  
  // Reset to normal + bold
  commands.push(ESC, 0x21, 0x08); // Bold only
  
  commands.push(...encoder.encode("================================\n"));
  
  // Left alignment
  commands.push(ESC, 0x61, 0x00);
  
  const orderNumber = order.id.slice(-6).toUpperCase();
  const dateTime = format(new Date(order.created_at), "dd/MM/yyyy HH:mm");
  
  // Double width for order number
  commands.push(ESC, 0x21, 0x28); // Double width + bold
  commands.push(...encoder.encode(`PEDIDO: #${orderNumber}\n`));
  commands.push(ESC, 0x21, 0x08); // Bold only
  commands.push(...encoder.encode(`DATA: ${dateTime}\n`));
  
  // Double height + bold for order type
  commands.push(ESC, 0x21, 0x38);
  const orderTypeText = order.order_type === 'local' && order.table_number 
    ? `${orderTypeLabels[order.order_type] || order.order_type} - MESA ${order.table_number}`
    : (orderTypeLabels[order.order_type] || order.order_type);
  commands.push(...encoder.encode(`${orderTypeText}\n`));
  commands.push(ESC, 0x21, 0x08);
  
  commands.push(...encoder.encode("--------------------------------\n"));
  
  // Customer name - emphasized
  commands.push(ESC, 0x21, 0x18); // Double height + bold
  commands.push(...encoder.encode(`CLIENTE: ${order.customer_name.toUpperCase()}\n`));
  commands.push(ESC, 0x21, 0x08);
  
  if (order.customer_phone) {
    commands.push(...encoder.encode(`TEL: ${order.customer_phone}\n`));
  }
  
  // Delivery section - heavily emphasized
  if (order.order_type === "entrega") {
    commands.push(LF);
    commands.push(...encoder.encode("================================\n"));
    commands.push(ESC, 0x21, 0x38); // Double height + bold
    commands.push(...encoder.encode("*** ENTREGA ***\n"));
    commands.push(ESC, 0x21, 0x08);
    
    if (order.bairro) {
      commands.push(ESC, 0x21, 0x18); // Double height + bold
      commands.push(...encoder.encode(`BAIRRO: ${order.bairro.toUpperCase()}\n`));
      commands.push(ESC, 0x21, 0x08);
    }
    if (order.address) {
      commands.push(...encoder.encode(`ENDERECO: ${order.address.toUpperCase()}\n`));
    }
    if (order.cep) {
      commands.push(...encoder.encode(`CEP: ${order.cep}\n`));
    }
    if (order.reference) {
      commands.push(ESC, 0x21, 0x18);
      commands.push(...encoder.encode(`REF: ${order.reference.toUpperCase()}\n`));
      commands.push(ESC, 0x21, 0x08);
    }
    commands.push(...encoder.encode("================================\n"));
  }
  
  commands.push(LF);
  commands.push(...encoder.encode("======== ITENS DO PEDIDO ========\n"));
  commands.push(LF);
  
  // Items - all bold
  order.order_items?.forEach((item) => {
    const extras = item.extras as any;
    const isLunch = extras?.type === "lunch";
    const itemName = item.item?.name || (isLunch ? `ALMOCO - ${extras?.base?.name}` : "ITEM");

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
    } else if (extras && typeof extras === 'object' && !Array.isArray(extras) && Array.isArray(extras?.regularExtras)) {
      extrasUnit += extras.regularExtras.reduce((sum: number, e: any) => sum + (Number(e?.price) || 0), 0);
    } else if (Array.isArray(extras)) {
      extrasUnit += extras.reduce((sum: number, e: any) => sum + (Number(e?.price) || 0), 0);
    }

    const lineTotal = (unitBase + extrasUnit) * qty;

    commands.push(ESC, 0x21, 0x18); // Double height + bold
    commands.push(...encoder.encode(`${qty}x ${itemName.toUpperCase()}`));
    if (item.tapioca_molhada) commands.push(...encoder.encode(" (MOLHADA)"));
    commands.push(...encoder.encode(` R$${lineTotal.toFixed(2)}\n`));
    commands.push(ESC, 0x21, 0x08); // Bold only

    if (qty > 1) {
      commands.push(...encoder.encode(`  (R$${unitBase.toFixed(2)} cada)\n`));
    }
    
    // Selected variation
    if (!isLunch && extras?.selected_variation) {
      commands.push(...encoder.encode(`  > TIPO: ${extras.selected_variation.toUpperCase()}\n`));
    }
    
    if (isLunch) {
      if (extras?.meats?.length > 0) {
        commands.push(...encoder.encode(`  > CARNES: ${extras.meats.join(", ").toUpperCase()}\n`));
      }
      if (extras?.extraMeats?.length > 0) {
        commands.push(...encoder.encode(`  > + EXTRAS: ${extras.extraMeats.join(", ").toUpperCase()}\n`));
      }
      if (extras?.sides?.length > 0) {
        const sideMap: Record<string, string> = {
          macarrao: "MACARRAO", farofa: "FAROFA",
          macaxeira: "MACAXEIRA", salada: "SALADA"
        };
        const sidesStr = extras.sides.map((s: string) => sideMap[s] || s.toUpperCase()).join(", ");
        commands.push(...encoder.encode(`  > ACOMP: ${sidesStr}\n`));
      }
    }
    
    if (!isLunch && extras && Array.isArray(extras) && extras.length > 0) {
      commands.push(...encoder.encode(`  > EXTRAS: ${extras.map((e: any) => e.name.toUpperCase()).join(", ")}\n`));
    }
  });
  
  commands.push(LF);
  commands.push(...encoder.encode("================================\n"));
  
  // Totals - all emphasized
  commands.push(ESC, 0x21, 0x08); // Bold
  commands.push(...encoder.encode(`SUBTOTAL: R$ ${order.subtotal.toFixed(2)}\n`));
  if (order.extras_fee && order.extras_fee > 0) {
    commands.push(...encoder.encode(`EXTRAS: R$ ${order.extras_fee.toFixed(2)}\n`));
  }
  if (order.delivery_tax && order.delivery_tax > 0) {
    commands.push(...encoder.encode(`TAXA ENTREGA: R$ ${order.delivery_tax.toFixed(2)}\n`));
  }
  
  // Grand total - maximum emphasis
  commands.push(...encoder.encode("--------------------------------\n"));
  commands.push(ESC, 0x21, 0x38); // Double height + bold
  commands.push(...encoder.encode(`TOTAL: R$ ${order.total.toFixed(2)}\n`));
  commands.push(ESC, 0x21, 0x08);
  
  // Payment info - emphasized
  commands.push(LF);
  commands.push(...encoder.encode("================================\n"));
  const paymentRaw = (order.payment_method || "").trim();
  const paymentKey = paymentRaw.toLowerCase();
  const paymentLabel = paymentMethodLabels[paymentKey] || (paymentRaw ? paymentRaw.toUpperCase() : "NAO INFORMADO");
  commands.push(ESC, 0x21, 0x18); // Double height + bold
  commands.push(...encoder.encode(`PAGAMENTO: ${paymentLabel}\n`));
  if (paymentKey === "dinheiro" && order.troco) {
    commands.push(...encoder.encode(`TROCO PARA: R$ ${order.troco.toFixed(2)}\n`));
  }
  commands.push(ESC, 0x21, 0x08);
  commands.push(...encoder.encode("================================\n"));
  
  // Observations - always show when present, regardless of order source
  if (order.observations && order.observations.trim()) {
    commands.push(LF);
    commands.push(ESC, 0x21, 0x18);
    commands.push(...encoder.encode("OBSERVACOES:\n"));
    commands.push(ESC, 0x21, 0x08);
    commands.push(...encoder.encode(`${order.observations.toUpperCase()}\n`));
    commands.push(...encoder.encode("================================\n"));
  }
  
  // Footer
  commands.push(LF);
  commands.push(ESC, 0x61, 0x01); // Center
  commands.push(ESC, 0x21, 0x08);
  commands.push(...encoder.encode("OBRIGADO PELA PREFERENCIA!\n"));
  commands.push(...encoder.encode("================================\n"));
  
  // Cut paper
  commands.push(LF, LF, LF);
  commands.push(GS, 0x56, 0x00); // GS V 0 - Full cut
  
  return new Uint8Array(commands);
}
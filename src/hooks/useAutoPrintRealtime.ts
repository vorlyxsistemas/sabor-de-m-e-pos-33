import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

const PRINT_SERVER_URL = "http://localhost:5000";

/**
 * Hook para impressão automática de pedidos via Supabase Realtime.
 *
 * VERSÃO CORRIGIDA - USA /print-html PARA LAYOUT COMPLETO
 *
 * - Escuta eventos INSERT na tabela "orders"
 * - Gera HTML completo da comanda (igual PrintReceipt.tsx)
 * - Envia para Print Server via /print-html
 * - Marca o pedido como impresso após sucesso
 * - Usa Set em memória para evitar impressões duplicadas
 */

interface OrderItem {
  id: string;
  quantity: number;
  price: number;
  extras: any;
  tapioca_molhada: boolean;
  item: { id: string; name: string } | null;
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
  printed?: boolean;
  printed_at?: string | null;
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

/**
 * Gera HTML completo da comanda
 * Layout IDÊNTICO ao PrintReceipt.tsx
 */
function gerarHTMLComanda(order: Order): string {
  const orderNumber = order.id.slice(-6).toUpperCase();

  // Formatar data/hora
  const dateTime = new Date(order.created_at).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const paymentRaw = (order.payment_method || "").trim();
  const paymentKey = paymentRaw.toLowerCase();
  const paymentLabel = paymentMethodLabels[paymentKey] || (paymentRaw ? paymentRaw.toUpperCase() : "NÃO INFORMADO");

  // Gerar HTML dos itens
  const itemsHTML =
    order.order_items
      ?.map((item) => {
        const extras = item.extras as any;
        const isLunch = extras?.type === "lunch";
        const itemName = item.item?.name || (isLunch ? `ALMOÇO - ${extras?.base?.name}` : "ITEM");

        const regularExtras = !isLunch
          ? Array.isArray(extras)
            ? extras
            : Array.isArray(extras?.regularExtras)
              ? extras.regularExtras
              : []
          : [];

        // Calculate extras price
        let extrasPrice = 0;
        if (isLunch) {
          const extraMeats = extras?.extraMeats || [];
          extrasPrice += extraMeats.length * 6;
          const paidSides = extras?.paidSides || [];
          paidSides.forEach((side: any) => {
            extrasPrice += Number(side.price) || 0;
          });
          const lunchRegularExtras = extras?.regularExtras || [];
          lunchRegularExtras.forEach((extra: any) => {
            extrasPrice += Number(extra.price) || 0;
          });
        } else if (regularExtras.length > 0) {
          regularExtras.forEach((extra: any) => {
            extrasPrice += Number(extra.price) || 0;
          });
        }

        if (item.tapioca_molhada) {
          extrasPrice += 1;
        }

        const unitPrice = Number(item.price) || 0;
        const lineTotal = (unitPrice + extrasPrice) * item.quantity;

        let itemHTML = `
      <div style="margin-bottom: 12px; border-bottom: 1px dashed #000; padding-bottom: 8px;">
        <div style="display: flex; justify-content: space-between; font-weight: 900; font-size: 14px;">
          <span>${item.quantity}x ${itemName.toUpperCase()}${item.tapioca_molhada ? " (MOLHADA)" : ""}</span>
          <span>R$${lineTotal.toFixed(2)}</span>
        </div>
    `;

        if (item.quantity > 1) {
          itemHTML += `
        <div style="font-size: 11px; font-weight: 700; padding-left: 12px;">
          (R$${unitPrice.toFixed(2)} cada)
        </div>
      `;
        }

        if (!isLunch && extras?.selected_variation) {
          itemHTML += `
        <div style="padding-left: 12px; font-size: 13px; font-weight: 700;">
          ► TIPO: ${extras.selected_variation.toUpperCase()}
        </div>
      `;
        }

        if (isLunch) {
          itemHTML += `<div style="padding-left: 12px; font-size: 13px;">`;

          if (extras?.meats && extras.meats.length > 0) {
            itemHTML += `
          <div style="font-weight: 900; margin-top: 4px;">
            ► CARNES INCLUÍDAS:
            <div style="padding-left: 8px; font-weight: 700;">
              ${extras.meats.map((meat: string) => `<div>• ${meat.toUpperCase()}</div>`).join("")}
            </div>
          </div>
        `;
          }

          if (extras?.extraMeats && extras.extraMeats.length > 0) {
            itemHTML += `
          <div style="font-weight: 900; margin-top: 4px; border-top: 1px dotted #000; padding-top: 4px;">
            ► CARNES EXTRAS (+R$):
            <div style="padding-left: 8px; font-weight: 700;">
              ${extras.extraMeats.map((meat: string) => `<div>• ${meat.toUpperCase()}</div>`).join("")}
            </div>
          </div>
        `;
          }

          if (extras?.sides && extras.sides.length > 0) {
            itemHTML += `
          <div style="font-weight: 900; margin-top: 4px; border-top: 1px dotted #000; padding-top: 4px;">
            ► ACOMPANHAMENTOS (GRÁTIS):
            <div style="padding-left: 8px; font-weight: 700;">
              ${extras.sides.map((side: string) => `<div>• ${(sideNameMap[side] || side).toUpperCase()}</div>`).join("")}
            </div>
          </div>
        `;
          }

          if (extras?.paidSides && extras.paidSides.length > 0) {
            itemHTML += `
          <div style="font-weight: 900; margin-top: 4px; border-top: 1px dotted #000; padding-top: 4px;">
            ► ACOMPANHAMENTOS (+R$):
            <div style="padding-left: 8px; font-weight: 700;">
              ${extras.paidSides.map((side: any) => `<div>• ${side.name.toUpperCase()} (+R$${Number(side.price).toFixed(2)})</div>`).join("")}
            </div>
          </div>
        `;
          }

          itemHTML += `</div>`;
        }

        if (!isLunch && regularExtras.length > 0) {
          itemHTML += `
        <div style="padding-left: 12px; font-size: 13px; font-weight: 700;">
          ► EXTRAS: ${regularExtras.map((e: any) => e.name.toUpperCase()).join(", ")}
        </div>
      `;
        }

        itemHTML += `</div>`;
        return itemHTML;
      })
      .join("") || "";

  // HTML completo
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    @page {
      size: 80mm auto;
      margin: 0 !important;
      padding: 0 !important;
    }
    
    @media print and (max-width: 62mm) {
      @page {
        size: 58mm auto;
        margin: 0 !important;
      }
      html, body {
        width: 58mm !important;
      }
      body {
        width: 54mm !important;
        max-width: 54mm !important;
        font-size: 11px !important;
        padding: 1mm !important;
      }
    }
    
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      width: 80mm !important;
    }
    
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 12px;
      font-weight: 700;
      line-height: 1.3;
      color: #000 !important;
      background: #fff !important;
      width: 76mm !important;
      max-width: 76mm !important;
      padding: 2mm !important;
      box-sizing: border-box !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    
    * {
      color: #000 !important;
    }
  </style>
</head>
<body>
  <div style="text-align: center; margin-bottom: 12px;">
    <div style="font-weight: 900; font-size: 20px; letter-spacing: 1px;">SABOR DE MÃE</div>
    <div style="font-weight: 900; font-size: 13px;">================================</div>
  </div>

  <div style="margin-bottom: 10px;">
    <div style="font-weight: 900; font-size: 16px;">PEDIDO: #${orderNumber}</div>
    <div style="font-weight: 700;">DATA: ${dateTime}</div>
    <div style="font-weight: 900; font-size: 16px; border: 2px solid #000; padding: 4px; margin-top: 4px; text-align: center;">
      ${orderTypeLabels[order.order_type] || order.order_type}
    </div>
  </div>

  <div style="font-weight: 900; font-size: 13px;">--------------------------------</div>

  <div style="margin-bottom: 10px;">
    <div style="font-weight: 900; font-size: 15px;">★ CLIENTE: ${order.customer_name.toUpperCase()}</div>
    ${order.customer_phone ? `<div style="font-weight: 700;">TEL: ${order.customer_phone}</div>` : ""}
  </div>

  ${
    order.order_type === "entrega"
      ? `
    <div style="margin: 12px 0; border: 3px solid #000; padding: 10px; background: #fff;">
      <div style="font-weight: 900; font-size: 15px; margin-bottom: 6px; text-decoration: underline;">
        *** ENTREGA ***
      </div>
      ${order.bairro ? `<div style="font-weight: 900; font-size: 14px;">BAIRRO: ${order.bairro.toUpperCase()}</div>` : ""}
      ${order.address ? `<div style="font-weight: 900; font-size: 13px;">ENDEREÇO: ${order.address.toUpperCase()}</div>` : ""}
      ${order.cep ? `<div style="font-weight: 700; font-size: 13px;">CEP: ${order.cep}</div>` : ""}
      ${order.reference ? `<div style="font-weight: 900; font-size: 14px; margin-top: 4px;">★ REF: ${order.reference.toUpperCase()}</div>` : ""}
    </div>
  `
      : ""
  }

  <div style="margin: 10px 0;">
    <div style="font-weight: 900; font-size: 13px;">======== ITENS DO PEDIDO ========</div>
  </div>

  <div style="margin-bottom: 10px;">
    ${itemsHTML}
  </div>

  <div style="font-weight: 900; font-size: 13px;">================================</div>

  <div style="margin-top: 10px;">
    <div style="display: flex; justify-content: space-between; font-weight: 900; font-size: 14px;">
      <span>SUBTOTAL (ITENS+EXTRAS):</span>
      <span>R$ ${order.subtotal.toFixed(2)}</span>
    </div>
    ${
      order.delivery_tax && order.delivery_tax > 0
        ? `
      <div style="display: flex; justify-content: space-between; font-weight: 900; font-size: 14px;">
        <span>TAXA ENTREGA:</span>
        <span>R$ ${order.delivery_tax.toFixed(2)}</span>
      </div>
    `
        : ""
    }
    <div style="display: flex; justify-content: space-between; font-weight: 900; font-size: 18px; border-top: 3px solid #000; padding-top: 6px; margin-top: 6px;">
      <span>★ TOTAL:</span>
      <span>R$ ${order.total.toFixed(2)}</span>
    </div>
  </div>

  <div style="margin-top: 12px; border: 3px solid #000; padding: 10px; background: #fff;">
    <div style="font-weight: 900; font-size: 15px;">★ PAGAMENTO: ${paymentLabel}</div>
    ${paymentKey === "dinheiro" && order.troco ? `<div style="font-weight: 900; font-size: 14px;">TROCO PARA: R$ ${order.troco.toFixed(2)}</div>` : ""}
  </div>

  ${
    order.observations && order.observations.trim()
      ? `
    <div style="margin-top: 12px; border: 3px solid #000; padding: 10px; background: #fff;">
      <div style="font-weight: 900; font-size: 14px;">★ OBSERVAÇÕES:</div>
      <div style="font-weight: 700; font-size: 13px;">${order.observations.toUpperCase()}</div>
    </div>
  `
      : ""
  }

  <div style="text-align: center; margin-top: 12px;">
    <div style="font-weight: 900; font-size: 13px;">================================</div>
    <div style="font-weight: 900; font-size: 12px;">OBRIGADO PELA PREFERÊNCIA!</div>
    <div style="font-weight: 900; font-size: 13px;">================================</div>
  </div>
</body>
</html>
  `.trim();
}

export function useAutoPrintRealtime(): void {
  const processedOrdersRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    console.log("[AutoPrint] Iniciando listener de impressão automática (HTML)...");

    const channel = supabase
      .channel("auto-print-orders")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "orders",
        },
        async (payload) => {
          const order = payload.new as Record<string, unknown>;
          const orderId = order.id as string;
          const printed = order.printed as boolean | undefined;

          if (processedOrdersRef.current.has(orderId)) {
            console.log(`[AutoPrint] Pedido ${orderId} já processado, ignorando.`);
            return;
          }

          if (printed === true) {
            console.log(`[AutoPrint] Pedido ${orderId} já está impresso, ignorando.`);
            processedOrdersRef.current.add(orderId);
            return;
          }

          processedOrdersRef.current.add(orderId);
          console.log(`[AutoPrint] Novo pedido detectado: ${orderId}`);

          try {
            // Buscar dados completos
            const { data, error: fetchError } = await supabase
              .from("orders")
              .select(
                `
                *,
                order_items (
                  id,
                  quantity,
                  price,
                  extras,
                  tapioca_molhada,
                  item:items (
                    id,
                    name
                  )
                )
              `,
              )
              .eq("id", orderId)
              .single();

            if (fetchError || !data) {
              console.error(`[AutoPrint] Erro ao buscar pedido ${orderId}:`, fetchError);
              return;
            }

            const fullOrder = data as unknown as Order;

            if (fullOrder.printed === true) {
              console.log(`[AutoPrint] Pedido ${orderId} já impresso (verificação dupla).`);
              return;
            }

            // GERAR HTML COMPLETO
            console.log(`[AutoPrint] Gerando HTML da comanda ${orderId}...`);
            const html = gerarHTMLComanda(fullOrder);

            console.log(`[AutoPrint] Enviando pedido ${orderId} para /print-html...`);

            // ENVIAR PARA /print-html (NÃO /print!)
            const printResponse = await fetch("http://localhost:5000/print-html", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ html }), // Envia HTML completo
            });

            if (!printResponse.ok) {
              const errorText = await printResponse.text();
              console.error(`[AutoPrint] Print Server retornou erro para ${orderId}:`, errorText);
              return;
            }

            const result = await printResponse.json();

            if (!result.success) {
              console.error(`[AutoPrint] Falha na impressão de ${orderId}:`, result.error);
              return;
            }

            console.log(`[AutoPrint] Impressão HTML enviada com sucesso para ${orderId}`);

            // Marcar como impresso
            const { error: updateError } = await supabase
              .from("orders")
              .update({
                printed: true,
                printed_at: new Date().toISOString(),
              } as any)
              .eq("id", orderId);

            if (updateError) {
              console.error(`[AutoPrint] Erro ao marcar pedido ${orderId} como impresso:`, updateError);
            } else {
              console.log(`[AutoPrint] Pedido ${orderId} marcado como impresso.`);
            }
          } catch (error) {
            console.error(`[AutoPrint] Erro ao processar pedido ${orderId}:`, error);
          }
        },
      )
      .subscribe((status) => {
        console.log(`[AutoPrint] Status do canal: ${status}`);
      });

    return () => {
      console.log("[AutoPrint] Removendo listener de impressão automática...");
      supabase.removeChannel(channel);
    };
  }, []);
}

import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { buildReceiptHTML } from "@/utils/receiptBuilder";

/**
 * Hook de impressão automática de comandas
 * - Usa o MESMO template da impressão manual (buildReceiptHTML)
 * - Garante pedido completo antes de imprimir (anti race condition)
 * - Envia HTML completo para o print server
 */
export function useAutoPrintRealtime(enabled: boolean = true) {
  const printingOrdersRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!enabled) return;

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
          const orderId = payload.new.id as string;

          // Evita duplicidade local
          if (printingOrdersRef.current.has(orderId)) return;
          printingOrdersRef.current.add(orderId);

          try {
            await processAndPrintOrder(orderId);
          } catch (error) {
            console.error("[AUTO PRINT] Erro:", error);
            printingOrdersRef.current.delete(orderId);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled]);
}

/* ============================================================
   FLUXO PRINCIPAL
   ============================================================ */

async function processAndPrintOrder(orderId: string) {
  // Aguarda pedido estar totalmente persistido
  const order = await waitForCompleteOrder(orderId);

  // Gera HTML usando o MESMO template da impressão manual
  const html = buildReceiptHTML(order as any);

  // Envia para o print server
  await sendToPrintServer(html);

  console.log("[AUTO PRINT] Pedido impresso:", orderId);
}

/* ============================================================
   ANTI RACE CONDITION
   ============================================================ */

async function waitForCompleteOrder(orderId: string, retries: number = 6, delay: number = 500) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const { data: order, error } = await supabase
      .from("orders")
      .select(
        `
        *,
        order_items (
          quantity,
          price,
          extras,
          tapioca_molhada,
          item:items (
            name
          )
        )
      `,
      )
      .eq("id", orderId)
      .single();

    if (
      !error &&
      order &&
      Array.isArray(order.order_items) &&
      order.order_items.length > 0 &&
      order.total &&
      order.total > 0 &&
      order.customer_name
    ) {
      return order;
    }

    await sleep(delay);
  }

  throw new Error("Pedido incompleto após múltiplas tentativas");
}

/* ============================================================
   ENVIO PARA O PRINT SERVER
   ============================================================ */

async function sendToPrintServer(html: string) {
  const response = await fetch("/print-html", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ html }),
  });

  const result = await response.json();

  if (!result?.success) {
    throw new Error("Falha ao imprimir no print server");
  }
}

/* ============================================================
   UTILITÁRIOS
   ============================================================ */

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

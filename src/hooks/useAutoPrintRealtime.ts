import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

/**
 * Hook de impressão automática de comandas
 * - NÃO usa IP
 * - NÃO usa localStorage
 * - Usa fetch relativo (mesmo padrão atual)
 * - Corrige race condition
 * - Garante pedido completo antes de imprimir
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

  // Envia para o print server (URL RELATIVA)
  await sendToPrintServer(order);

  // Marca como impresso
  await supabase
    .from("orders")
    .update({
      printed_at: new Date().toISOString(),
    })
    .eq("id", orderId);
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
   ENVIO PARA O PRINT SERVER (SEM URL FIXA)
   ============================================================ */

async function sendToPrintServer(order: any) {
  const response = await fetch("/print-html", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      html: buildReceiptHTML(order),
    }),
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

/**
 * IMPORTANTE:
 * Aqui você deve reutilizar o HTML REAL
 * do PrintReceipt.tsx (sem botões / window.print)
 */
function buildReceiptHTML(order: any): string {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Comanda</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: 'Courier New', monospace;
      color: #000;
    }
  </style>
</head>
<body>
  <strong>PEDIDO:</strong> ${order.id}<br/>
  <strong>CLIENTE:</strong> ${order.customer_name}
</body>
</html>
`;
}

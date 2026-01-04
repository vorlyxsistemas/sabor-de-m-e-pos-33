import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { generateReceiptHTML } from "@/lib/printReceipt";

/**
 * Hook para impressão automática de pedidos via Supabase Realtime.
 *
 * ⚠️ USO: Este hook deve ser chamado SOMENTE no layout/admin da cozinha,
 *         no notebook conectado à impressora local.
 *         NÃO usar em App.tsx ou outros layouts.
 *
 * - Escuta eventos INSERT na tabela "orders"
 * - Gera o HTML da comanda (mesmo da impressão manual) via generateReceiptHTML
 * - Envia o HTML para o Print Server local via POST /print-html
 * - Marca o pedido como impresso (printed=true, printed_at) após sucesso
 * - Usa Set em memória para evitar impressões duplicadas
 * - Não interfere nos botões manuais de impressão
 * - Usa timeout de 5s para evitar travamento de rede
 */

// URL do Print Server via variável de ambiente (sem fallback - obrigatório configurar)
const PRINT_SERVER_URL = import.meta.env.VITE_PRINT_SERVER_URL;

export function useAutoPrintRealtime(): void {
  // Set para rastrear pedidos já impressos com sucesso (evita duplicação)
  const processedOrdersRef = useRef<Set<string>>(new Set());
  // Set para rastrear pedidos em processamento (evita chamadas paralelas)
  const processingOrdersRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Validação: se a variável de ambiente não estiver definida, desativar impressão automática
    if (!PRINT_SERVER_URL) {
      console.error("[AutoPrint] VITE_PRINT_SERVER_URL não definida. Impressão automática desativada.");
      return;
    }

    console.log("[AutoPrint] Iniciando listener de impressão automática...");
    console.log("[AutoPrint] Print Server URL:", PRINT_SERVER_URL);

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

          // Verificar se já foi impresso com sucesso anteriormente
          if (processedOrdersRef.current.has(orderId)) {
            console.log(`[AutoPrint] Pedido ${orderId} já foi impresso, ignorando.`);
            return;
          }

          // Verificar se está em processamento (evita chamadas paralelas)
          if (processingOrdersRef.current.has(orderId)) {
            console.log(`[AutoPrint] Pedido ${orderId} já está em processamento, ignorando.`);
            return;
          }

          // Verificar se já está marcado como impresso no banco
          if (printed === true) {
            console.log(`[AutoPrint] Pedido ${orderId} já está impresso no banco, ignorando.`);
            processedOrdersRef.current.add(orderId);
            return;
          }

          // Marcar como em processamento (temporário)
          processingOrdersRef.current.add(orderId);
          console.log(`[AutoPrint] Novo pedido detectado: ${orderId}`);

          try {
            // Buscar dados completos do pedido (incluindo order_items com extras e preços)
            const { data, error: fetchError } = await supabase
              .from("orders")
              .select(`
                *,
                order_items (
                  id,
                  quantity,
                  price,
                  notes,
                  extras,
                  tapioca_molhada,
                  item:items (
                    id,
                    name
                  )
                )
              `)
              .eq("id", orderId)
              .single();

            if (fetchError || !data) {
              console.error(`[AutoPrint] Erro ao buscar pedido ${orderId}:`, fetchError);
              processingOrdersRef.current.delete(orderId);
              return;
            }

            // Cast para any para acessar campos dinamicamente
            const fullOrder = data as any;

            // Verificar novamente se já foi impresso (pode ter mudado)
            if (fullOrder.printed === true) {
              console.log(`[AutoPrint] Pedido ${orderId} já impresso (verificação dupla).`);
              processedOrdersRef.current.add(orderId);
              processingOrdersRef.current.delete(orderId);
              return;
            }

            // Preparar objeto do pedido no formato esperado por generateReceiptHTML
            const orderForPrint = {
              id: fullOrder.id,
              customer_name: fullOrder.customer_name || "",
              customer_phone: fullOrder.customer_phone || null,
              status: fullOrder.status || "",
              order_type: fullOrder.order_type || "",
              table_number: fullOrder.table_number || null,
              address: fullOrder.address || null,
              bairro: fullOrder.bairro || null,
              cep: fullOrder.cep || null,
              reference: fullOrder.reference || null,
              subtotal: Number(fullOrder.subtotal) || 0,
              delivery_tax: fullOrder.delivery_tax ? Number(fullOrder.delivery_tax) : null,
              extras_fee: fullOrder.extras_fee ? Number(fullOrder.extras_fee) : null,
              total: Number(fullOrder.total) || 0,
              created_at: fullOrder.created_at || new Date().toISOString(),
              payment_method: fullOrder.payment_method || null,
              troco: fullOrder.troco ? Number(fullOrder.troco) : null,
              observations: fullOrder.observations || fullOrder.notes || null,
              order_items: (fullOrder.order_items || []).map((oi: any) => ({
                quantity: oi.quantity || 1,
                price: oi.price || 0,
                extras: oi.extras || null,
                tapioca_molhada: oi.tapioca_molhada || false,
                item: oi.item || null,
              })),
            };

            // Gerar HTML usando a mesma função da impressão manual
            const html = generateReceiptHTML(orderForPrint);

            console.log(`[AutoPrint] HTML gerado para pedido ${orderId} (${html.length} chars)`);
            console.log(`[AutoPrint] Enviando HTML para ${PRINT_SERVER_URL}/print-html...`);

            // Usar AbortController com timeout de 5s para evitar travamento
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            try {
              // Enviar HTML para o Print Server local
              const printResponse = await fetch(`${PRINT_SERVER_URL}/print-html`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ html }),
                signal: controller.signal,
              });

              clearTimeout(timeoutId);

              if (!printResponse.ok) {
                const errorText = await printResponse.text();
                console.error(`[AutoPrint] Print Server retornou erro para ${orderId}:`, errorText);
                // Remove do processamento para permitir retry manual
                processingOrdersRef.current.delete(orderId);
                // NÃO adiciona ao processedOrdersRef - permite reimprimir depois
                return;
              }
            } catch (fetchError) {
              clearTimeout(timeoutId);
              if ((fetchError as Error).name === "AbortError") {
                console.error(`[AutoPrint] Timeout (5s) ao tentar imprimir pedido ${orderId}`);
              } else {
                console.error(`[AutoPrint] Erro de rede ao imprimir pedido ${orderId}:`, fetchError);
              }
              // Remove do processamento para permitir retry manual
              processingOrdersRef.current.delete(orderId);
              // NÃO adiciona ao processedOrdersRef - permite reimprimir depois
              return;
            }

            console.log(`[AutoPrint] Pedido impresso com sucesso: ${orderId}`);

            // ✅ SOMENTE após sucesso: marcar como impresso no banco
            const { error: updateError } = await supabase
              .from("orders")
              .update({
                printed: true,
                printed_at: new Date().toISOString(),
              } as Record<string, unknown>)
              .eq("id", orderId);

            if (updateError) {
              console.error(`[AutoPrint] Erro ao marcar pedido ${orderId} como impresso:`, updateError);
            } else {
              console.log(`[AutoPrint] Pedido ${orderId} marcado como impresso no banco.`);
            }

            // ✅ SOMENTE após sucesso: adicionar ao Set de processados
            processedOrdersRef.current.add(orderId);
            processingOrdersRef.current.delete(orderId);
          } catch (error) {
            // Falha na impressão - não trava o sistema
            console.error(`[AutoPrint] Erro na impressão:`, error);
            // Remove do processamento para permitir retry manual
            processingOrdersRef.current.delete(orderId);
            // NÃO adiciona ao processedOrdersRef - permite reimprimir depois
          }
        }
      )
      .subscribe((status) => {
        console.log(`[AutoPrint] Status do canal: ${status}`);
      });

    // Cleanup ao desmontar
    return () => {
      console.log("[AutoPrint] Removendo listener de impressão automática...");
      supabase.removeChannel(channel);
    };
  }, []);
}

/**
 * @deprecated Use buildReceiptHTML from @/utils/receiptBuilder instead.
 * Este arquivo é mantido para compatibilidade, mas delega para o utilitário único.
 */

import { buildReceiptHTML, type Order, type OrderItem } from "@/utils/receiptBuilder";

// Re-export for backward compatibility
export { buildReceiptHTML as generateReceiptHTML };
export type { Order, OrderItem };

/**
 * Imprime a comanda usando iframe oculto (para impressão manual via browser)
 */
export function printReceipt(order: Order): Promise<boolean> {
  return new Promise((resolve) => {
    const receiptHTML = buildReceiptHTML(order);
    
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
            console.log("Disparando impressão...");
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

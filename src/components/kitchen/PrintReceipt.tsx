import { generateReceiptHTML } from "@/lib/receiptHtml";

interface Order {
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
  order_items: any[];
}

export function printReceipt(order: Order): Promise<boolean> {
  return new Promise((resolve) => {
    const html = generateReceiptHTML(order);

    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "none";

    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      resolve(false);
      return;
    }

    doc.open();
    doc.write(html);
    doc.close();

    iframe.onload = () => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();

      setTimeout(() => {
        document.body.removeChild(iframe);
        resolve(true);
      }, 500);
    };
  });
}

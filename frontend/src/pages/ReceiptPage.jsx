import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { errorMessage, getSale, getSettings } from "../api/client";
import "./ReceiptPage.css";

const DISPLAY_TZ = "Asia/Karachi";
const money = (n) => n.toFixed(2);

// FEFO can split one product across batches; the customer sees one line per product.
function groupItems(items) {
  const lines = new Map();
  for (const it of items) {
    const key = `${it.product_id}:${it.unit_price}`;
    const existing = lines.get(key);
    if (existing) {
      existing.quantity += it.quantity;
    } else {
      lines.set(key, { name: it.product_name, unitPrice: it.unit_price, quantity: it.quantity });
    }
  }
  return [...lines.values()];
}

// Sets the printed page to exactly the receipt's height, so a short receipt
// doesn't feed blank paper and a long one doesn't split onto a second page.
function printFitted(receiptEl) {
  if (receiptEl) {
    const heightMm = Math.ceil((receiptEl.getBoundingClientRect().height * 25.4) / 96) + 4;
    let style = document.getElementById("receipt-page-size");
    if (!style) {
      style = document.createElement("style");
      style.id = "receipt-page-size";
      document.head.appendChild(style);
    }
    style.textContent = `@page { size: 80mm ${heightMm}mm; margin: 0; }`;
  }
  window.print();
}

export default function ReceiptPage() {
  const { saleId } = useParams();
  const [sale, setSale] = useState(null);
  const [store, setStore] = useState(null);
  const [error, setError] = useState("");
  const receiptRef = useRef(null);

  useEffect(() => {
    Promise.all([getSale(saleId), getSettings()])
      .then(([saleData, storeData]) => {
        setSale(saleData);
        setStore(storeData);
      })
      .catch((e) => setError(errorMessage(e, "Could not load receipt.")));
  }, [saleId]);

  const ready = Boolean(sale && store);

  // Open the print dialog once, as soon as the receipt has rendered.
  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => printFitted(receiptRef.current), 300);
    return () => clearTimeout(timer);
  }, [ready]);

  if (error) return <p className="error-text" style={{ padding: "1rem" }}>{error}</p>;
  if (!ready) return <p className="empty-state" style={{ padding: "1rem" }}>Loading receipt...</p>;

  const lines = groupItems(sale.items);
  const subtotal = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  const when = new Date(sale.created_at).toLocaleString("en-GB", {
    timeZone: DISPLAY_TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="receipt-page">
      <div className="receipt-actions no-print">
        <button onClick={() => printFitted(receiptRef.current)}>Print again</button>
        <button className="secondary" onClick={() => window.close()}>
          Close
        </button>
      </div>

      <div className="receipt" dir="ltr" ref={receiptRef}>
        <div className="r-center r-store" dir="auto">{store.store_name}</div>
        {store.address && <div className="r-center r-multiline" dir="auto">{store.address}</div>}
        {store.phone && <div className="r-center">Tel: {store.phone}</div>}

        <div className="r-rule" />
        <div className="r-row">
          <span>Receipt #{sale.id}</span>
          <span>{when}</span>
        </div>
        {sale.cashier_username && (
          <div>
            Cashier: <bdi>{sale.cashier_username}</bdi>
          </div>
        )}

        <div className="r-rule" />
        {lines.map((l, i) => (
          <div className="r-item" key={i}>
            <div dir="auto">{l.name}</div>
            <div className="r-row">
              <span>
                {l.quantity} x {money(l.unitPrice)}
              </span>
              <span>{money(l.unitPrice * l.quantity)}</span>
            </div>
          </div>
        ))}

        <div className="r-rule" />
        <div className="r-row">
          <span>Subtotal</span>
          <span>{money(subtotal)}</span>
        </div>
        {sale.tax > 0 && (
          <div className="r-row">
            <span>Tax</span>
            <span>{money(sale.tax)}</span>
          </div>
        )}
        <div className="r-row r-total">
          <span>TOTAL (Rs)</span>
          <span>{money(sale.total)}</span>
        </div>

        {store.receipt_footer && (
          <>
            <div className="r-rule" />
            <div className="r-center r-multiline" dir="auto">{store.receipt_footer}</div>
          </>
        )}
      </div>
    </div>
  );
}

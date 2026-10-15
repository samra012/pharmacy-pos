import { Fragment, useEffect, useState } from "react";
import { listSales } from "../api/client";
import { openReceipt } from "../utils/receipt";

const DISPLAY_TZ = "Asia/Karachi";

export default function SalesHistoryPage() {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    listSales()
      .then((data) => {
        setSales(data);
        setError("");
      })
      .catch(() => setError("Could not load sales. Is the backend running?"))
      .finally(() => setLoading(false));
  }, []);

  function productCount(sale) {
    return new Set(sale.items.map((it) => it.product_id)).size;
  }

  return (
    <div>
      <h2 className="page-title">Sales History</h2>
      {error && <p className="error-text">{error}</p>}
      <div className="card">
        {loading ? (
          <p className="empty-state">Loading...</p>
        ) : sales.length === 0 ? (
          <p className="empty-state">No sales recorded yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Sale #</th>
                <th>Date/Time</th>
                <th>Cashier</th>
                <th>Products</th>
                <th>Tax</th>
                <th>Total</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sales.map((s) => (
                <Fragment key={s.id}>
                  <tr>
                    <td>{s.id}</td>
                    <td>{new Date(s.created_at).toLocaleString("en-US", { timeZone: DISPLAY_TZ })}</td>
                    <td>{s.cashier_username ?? "—"}</td>
                    <td>{productCount(s)}</td>
                    <td>Rs {s.tax.toFixed(2)}</td>
                    <td>Rs {s.total.toFixed(2)}</td>
                    <td>
                      <div style={{ display: "flex", gap: "0.4rem" }}>
                        <button
                          className="secondary"
                          onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
                        >
                          {expandedId === s.id ? "Hide" : "Details"}
                        </button>
                        <button className="secondary" onClick={() => openReceipt(s.id)}>
                          Receipt
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedId === s.id && (
                    <tr>
                      <td colSpan={7} style={{ background: "#fafbfc" }}>
                        <table>
                          <thead>
                            <tr>
                              <th>Product</th>
                              <th>Batch</th>
                              <th>Qty</th>
                              <th>Unit Price</th>
                            </tr>
                          </thead>
                          <tbody>
                            {s.items.map((it, idx) => (
                              <tr key={idx}>
                                <td>{it.product_name}</td>
                                <td>{it.batch_number ?? "-"}</td>
                                <td>{it.quantity}</td>
                                <td>Rs {it.unit_price.toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

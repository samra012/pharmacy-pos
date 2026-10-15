import { useEffect, useState } from "react";
import { dailySales, lowStock, nearExpiry, topItems } from "../api/client";

export default function ReportsPage() {
  const [daily, setDaily] = useState(null);
  const [top, setTop] = useState([]);
  const [low, setLow] = useState([]);
  const [expiry, setExpiry] = useState([]);
  const [expiryDays, setExpiryDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    refreshAll();
  }, []);

  useEffect(() => {
    nearExpiry(expiryDays).then(setExpiry).catch(() => {});
  }, [expiryDays]);

  function refreshAll() {
    setLoading(true);
    setError("");
    Promise.all([dailySales(), topItems(5), lowStock(), nearExpiry(expiryDays)])
      .then(([d, t, l, e]) => {
        setDaily(d);
        setTop(t);
        setLow(l);
        setExpiry(e);
      })
      .catch(() => setError("Could not load reports. Is the backend running?"))
      .finally(() => setLoading(false));
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 className="page-title">Reports</h2>
        <button className="secondary" onClick={refreshAll}>
          Refresh
        </button>
      </div>
      {error && <p className="error-text">{error}</p>}
      {loading ? (
        <p className="empty-state">Loading reports...</p>
      ) : (
        <>
          <div className="stat-grid">
            <div className="stat-box">
              <div className="label">Today's Sales ({daily?.date})</div>
              <div className="value">Rs {daily?.total_sales.toFixed(2)}</div>
            </div>
            <div className="stat-box">
              <div className="label">Transactions Today</div>
              <div className="value">{daily?.transaction_count}</div>
            </div>
            <div className="stat-box">
              <div className="label">Low Stock Items</div>
              <div className="value">{low.length}</div>
            </div>
            <div className="stat-box">
              <div className="label">Near-Expiry Batches</div>
              <div className="value">{expiry.length}</div>
            </div>
          </div>

          <div className="grid-2">
            <div className="card">
              <h3 style={{ marginTop: 0 }}>Top Selling Items</h3>
              {top.length === 0 ? (
                <p className="empty-state">No sales yet.</p>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Units Sold</th>
                    </tr>
                  </thead>
                  <tbody>
                    {top.map((t) => (
                      <tr key={t.product_id}>
                        <td>{t.product_name}</td>
                        <td>{t.total_quantity_sold}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="card">
              <h3 style={{ marginTop: 0 }}>Low Stock Alerts</h3>
              {low.length === 0 ? (
                <p className="empty-state">All products are above reorder level.</p>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Stock</th>
                      <th>Reorder Level</th>
                    </tr>
                  </thead>
                  <tbody>
                    {low.map((l) => (
                      <tr key={l.product_id}>
                        <td>{l.product_name}</td>
                        <td>
                          <span className="badge warn">{l.total_stock}</span>
                        </td>
                        <td>{l.reorder_level}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ marginTop: 0 }}>Near-Expiry Batches</h3>
              <div style={{ width: 160 }}>
                <select value={expiryDays} onChange={(e) => setExpiryDays(Number(e.target.value))}>
                  <option value={7}>Next 7 days</option>
                  <option value={30}>Next 30 days</option>
                  <option value={60}>Next 60 days</option>
                  <option value={90}>Next 90 days</option>
                </select>
              </div>
            </div>
            {expiry.length === 0 ? (
              <p className="empty-state">No batches expiring in this window.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Batch #</th>
                    <th>Expiry Date</th>
                    <th>Quantity</th>
                    <th>Days Left</th>
                  </tr>
                </thead>
                <tbody>
                  {expiry.map((e) => (
                    <tr key={e.batch_id}>
                      <td>{e.product_name}</td>
                      <td>{e.batch_number}</td>
                      <td>{e.expiry_date}</td>
                      <td>{e.quantity}</td>
                      <td>
                        {e.days_until_expiry <= 7 ? (
                          <span className="badge warn">{e.days_until_expiry}</span>
                        ) : (
                          e.days_until_expiry
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}

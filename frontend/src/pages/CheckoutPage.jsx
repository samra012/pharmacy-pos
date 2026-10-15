import { useEffect, useMemo, useState } from "react";
import { checkPrescriptions, checkout, errorMessage, listProducts } from "../api/client";
import { openReceipt } from "../utils/receipt";

export default function CheckoutPage() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState([]); // [{product, quantity}]
  const [taxRatePercent, setTaxRatePercent] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(null); // { flagged } | null
  const [completedSale, setCompletedSale] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    refreshProducts();
  }, []);

  function refreshProducts() {
    setLoading(true);
    listProducts()
      .then((data) => {
        setProducts(data);
        setError("");
      })
      .catch(() => setError("Could not load products. Is the backend running?"))
      .finally(() => setLoading(false));
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.category || "").toLowerCase().includes(q)
    );
  }, [products, search]);

  function addToCart(product) {
    setCart((prev) => {
      const existing = prev.find((c) => c.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.total_stock) return prev;
        return prev.map((c) =>
          c.product.id === product.id ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      if (product.total_stock <= 0) return prev;
      return [...prev, { product, quantity: 1 }];
    });
  }

  function changeQty(productId, delta) {
    setCart((prev) =>
      prev
        .map((c) => {
          if (c.product.id !== productId) return c;
          const next = c.quantity + delta;
          const max = c.product.total_stock;
          return { ...c, quantity: Math.max(0, Math.min(next, max)) };
        })
        .filter((c) => c.quantity > 0)
    );
  }

  function removeFromCart(productId) {
    setCart((prev) => prev.filter((c) => c.product.id !== productId));
  }

  const subtotal = cart.reduce((sum, c) => sum + c.product.price * c.quantity, 0);
  const taxRate = (Number(taxRatePercent) || 0) / 100;
  const tax = subtotal * taxRate;
  const total = subtotal + tax;

  function buildPayload() {
    return {
      items: cart.map((c) => ({ product_id: c.product.id, quantity: c.quantity })),
      tax_rate: taxRate,
    };
  }

  async function handleCheckoutClick() {
    if (cart.length === 0) return;
    setError("");
    try {
      const result = await checkPrescriptions(buildPayload());
      if (result.requires_prescription && result.requires_prescription.length > 0) {
        setConfirming({ flagged: result.requires_prescription });
      } else {
        await finalizeSale();
      }
    } catch (e) {
      setError(errorMessage(e, "Could not check prescriptions."));
    }
  }

  async function finalizeSale() {
    setSubmitting(true);
    setError("");
    try {
      const sale = await checkout(buildPayload());
      setCompletedSale(sale);
      setCart([]);
      setConfirming(null);
      refreshProducts();
    } catch (e) {
      setError(errorMessage(e, "Checkout failed."));
      setConfirming(null);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h2 className="page-title">Checkout</h2>
      {error && <p className="error-text">{error}</p>}

      <div className="grid-2">
        <div className="card">
          <div className="form-row">
            <label>Search products</label>
            <input
              placeholder="Search by name or category..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {loading ? (
            <p className="empty-state">Loading products...</p>
          ) : filtered.length === 0 ? (
            <p className="empty-state">No products found.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>Stock</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id}>
                    <td>
                      {p.name}{" "}
                      {p.requires_prescription && <span className="badge warn">Rx</span>}
                    </td>
                    <td>{p.category || "-"}</td>
                    <td>Rs {p.price.toFixed(2)}</td>
                    <td>
                      {p.total_stock <= p.reorder_level ? (
                        <span className="badge warn">{p.total_stock}</span>
                      ) : (
                        p.total_stock
                      )}
                    </td>
                    <td>
                      <button onClick={() => addToCart(p)} disabled={p.total_stock <= 0}>
                        Add
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Cart</h3>
          {cart.length === 0 ? (
            <p className="empty-state">Cart is empty.</p>
          ) : (
            cart.map((c) => (
              <div className="cart-row" key={c.product.id}>
                <div>
                  <div>{c.product.name}</div>
                  <div style={{ fontSize: "0.8rem", color: "#8a94a0" }}>
                    Rs {c.product.price.toFixed(2)} each
                  </div>
                </div>
                <div className="qty-control">
                  <button className="secondary" onClick={() => changeQty(c.product.id, -1)}>
                    −
                  </button>
                  <span>{c.quantity}</span>
                  <button
                    className="secondary"
                    onClick={() => changeQty(c.product.id, 1)}
                    disabled={c.quantity >= c.product.total_stock}
                  >
                    +
                  </button>
                  <button className="danger" onClick={() => removeFromCart(c.product.id)}>
                    ×
                  </button>
                </div>
              </div>
            ))
          )}

          <div className="form-row" style={{ marginTop: "1rem" }}>
            <label>Tax rate % (e.g. 8 for 8%)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={taxRatePercent}
              onChange={(e) => setTaxRatePercent(e.target.value)}
            />
          </div>

          <div className="totals">
            <div className="line">
              <span>Subtotal</span>
              <span>Rs {subtotal.toFixed(2)}</span>
            </div>
            <div className="line">
              <span>Tax</span>
              <span>Rs {tax.toFixed(2)}</span>
            </div>
            <div className="line grand">
              <span>Total</span>
              <span>Rs {total.toFixed(2)}</span>
            </div>
          </div>

          <button
            style={{ marginTop: "1rem", width: "100%" }}
            disabled={cart.length === 0 || submitting}
            onClick={handleCheckoutClick}
          >
            {submitting ? "Processing..." : "Checkout"}
          </button>
        </div>
      </div>

      {confirming && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h3 style={{ marginTop: 0 }}>Prescription required</h3>
            <p>The following items require a prescription. Confirm the cashier has verified it:</p>
            <ul>
              {confirming.flagged.map((f) => (
                <li key={f.product_id}>{f.product_name}</li>
              ))}
            </ul>
            <div className="modal-actions">
              <button className="secondary" onClick={() => setConfirming(null)}>
                Cancel
              </button>
              <button onClick={finalizeSale} disabled={submitting}>
                {submitting ? "Processing..." : "Confirm & Complete Sale"}
              </button>
            </div>
          </div>
        </div>
      )}

      {completedSale && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h3 style={{ marginTop: 0 }}>Sale complete</h3>
            <p>
              Sale #{completedSale.id} — Total Rs {completedSale.total.toFixed(2)} (tax Rs{" "}
              {completedSale.tax.toFixed(2)})
            </p>
            <div className="modal-actions">
              <button className="secondary" onClick={() => openReceipt(completedSale.id)}>
                Print receipt
              </button>
              <button onClick={() => setCompletedSale(null)}>Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

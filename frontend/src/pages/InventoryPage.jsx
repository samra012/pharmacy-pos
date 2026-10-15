import { useEffect, useState } from "react";
import {
  addBatch,
  createProduct,
  deleteProduct,
  errorMessage,
  listProducts,
  updateProduct,
} from "../api/client";

const emptyForm = {
  name: "",
  category: "",
  price: "",
  requires_prescription: false,
  reorder_level: 10,
  batch_number: "",
  expiry_date: "",
  quantity: "",
};

export default function InventoryPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [batchModal, setBatchModal] = useState(null); // product or null
  const [batchForm, setBatchForm] = useState({ batch_number: "", expiry_date: "", quantity: "" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    refresh();
  }, []);

  function refresh() {
    setLoading(true);
    listProducts()
      .then((data) => {
        setProducts(data);
        setError("");
      })
      .catch(() => setError("Could not load products. Is the backend running?"))
      .finally(() => setLoading(false));
  }

  function openCreate() {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(true);
    setError("");
  }

  function openEdit(p) {
    setForm({
      name: p.name,
      category: p.category || "",
      price: p.price,
      requires_prescription: p.requires_prescription,
      reorder_level: p.reorder_level,
      batch_number: "",
      expiry_date: "",
      quantity: "",
    });
    setEditingId(p.id);
    setShowForm(true);
    setError("");
  }

  function buildInitialBatch() {
    const { batch_number, expiry_date, quantity } = form;
    const anyFilled = batch_number || expiry_date || quantity;
    if (!anyFilled) return { batch: null, error: null };

    if (!batch_number || !expiry_date || !quantity) {
      return {
        batch: null,
        error: "To receive an initial batch, fill in batch number, expiry date, and quantity together (or leave all three blank).",
      };
    }
    if (Number(quantity) <= 0) {
      return { batch: null, error: "Initial batch quantity must be greater than 0." };
    }
    return {
      batch: { batch_number, expiry_date, quantity: Number(quantity) },
      error: null,
    };
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!editingId) {
      const { batch, error: batchError } = buildInitialBatch();
      if (batchError) {
        setError(batchError);
        return;
      }
      setSubmitting(true);
      try {
        const payload = {
          name: form.name,
          category: form.category || null,
          price: Number(form.price),
          requires_prescription: form.requires_prescription,
          reorder_level: Number(form.reorder_level),
        };
        if (batch) payload.initial_batch = batch;
        await createProduct(payload);
        setShowForm(false);
        refresh();
      } catch (e) {
        setError(errorMessage(e, "Could not save product."));
      } finally {
        setSubmitting(false);
      }
      return;
    }

    setSubmitting(true);
    try {
      await updateProduct(editingId, {
        name: form.name,
        category: form.category || null,
        price: Number(form.price),
        requires_prescription: form.requires_prescription,
        reorder_level: Number(form.reorder_level),
      });
      setShowForm(false);
      refresh();
    } catch (e) {
      setError(errorMessage(e, "Could not save product."));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this product? This cannot be undone.")) return;
    try {
      await deleteProduct(id);
      refresh();
    } catch (e) {
      setError(errorMessage(e, "Could not delete product."));
    }
  }

  function openBatchModal(product) {
    setBatchModal(product);
    setBatchForm({ batch_number: "", expiry_date: "", quantity: "" });
    setError("");
  }

  async function handleAddBatch(e) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await addBatch(batchModal.id, {
        batch_number: batchForm.batch_number,
        expiry_date: batchForm.expiry_date,
        quantity: Number(batchForm.quantity),
      });
      setBatchModal(null);
      refresh();
    } catch (e) {
      setError(errorMessage(e, "Could not add batch."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 className="page-title">Inventory</h2>
        <button onClick={openCreate}>+ New Product</button>
      </div>
      {error && !showForm && !batchModal && <p className="error-text">{error}</p>}

      <div className="card">
        {loading ? (
          <p className="empty-state">Loading...</p>
        ) : products.length === 0 ? (
          <p className="empty-state">No products yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Category</th>
                <th>Price</th>
                <th>Stock</th>
                <th>Reorder level</th>
                <th>Rx</th>
                <th>Batches</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>{p.category || "-"}</td>
                  <td>Rs {p.price.toFixed(2)}</td>
                  <td>
                    {p.total_stock <= p.reorder_level ? (
                      <span className="badge warn">{p.total_stock}</span>
                    ) : (
                      p.total_stock
                    )}
                  </td>
                  <td>{p.reorder_level}</td>
                  <td>{p.requires_prescription ? <span className="badge warn">Rx</span> : "-"}</td>
                  <td>
                    {p.batches.length === 0 ? (
                      "-"
                    ) : (
                      p.batches.map((b, idx) => (
                        <span key={b.id}>
                          {idx > 0 && ", "}
                          {b.batch_number} ({b.quantity})
                          {b.is_expired && <span className="badge warn"> Expired</span>}
                        </span>
                      ))
                    )}
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: "0.4rem" }}>
                      <button className="secondary" onClick={() => openEdit(p)}>
                        Edit
                      </button>
                      <button className="secondary" onClick={() => openBatchModal(p)}>
                        + Batch
                      </button>
                      <button className="danger" onClick={() => handleDelete(p.id)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: 480 }}>
            <h3 style={{ marginTop: 0 }}>{editingId ? "Edit Product" : "New Product"}</h3>
            {error && <p className="error-text">{error}</p>}
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <label>Name</label>
                <input
                  required
                  dir="auto"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="form-grid">
                <div className="form-row">
                  <label>Category</label>
                  <input
                    dir="auto"
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                  />
                </div>
                <div className="form-row">
                  <label>Price (Rs)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-grid">
                <div className="form-row">
                  <label>Reorder level</label>
                  <input
                    type="number"
                    min="0"
                    value={form.reorder_level}
                    onChange={(e) => setForm({ ...form, reorder_level: e.target.value })}
                  />
                </div>
                <div className="form-row">
                  <label>Requires prescription?</label>
                  <select
                    value={form.requires_prescription ? "yes" : "no"}
                    onChange={(e) =>
                      setForm({ ...form, requires_prescription: e.target.value === "yes" })
                    }
                  >
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </select>
                </div>
              </div>

              {!editingId && (
                <>
                  <p style={{ fontSize: "0.85rem", color: "#8a94a0", marginBottom: "0.4rem" }}>
                    Optionally receive an initial batch now (fill in all three, or leave all blank):
                  </p>
                  <div className="form-grid">
                    <div className="form-row">
                      <label>Batch number</label>
                      <input
                        dir="auto"
                        value={form.batch_number}
                        onChange={(e) => setForm({ ...form, batch_number: e.target.value })}
                      />
                    </div>
                    <div className="form-row">
                      <label>Expiry date</label>
                      <input
                        type="date"
                        value={form.expiry_date}
                        onChange={(e) => setForm({ ...form, expiry_date: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="form-row">
                    <label>Quantity</label>
                    <input
                      type="number"
                      min="1"
                      value={form.quantity}
                      onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                    />
                  </div>
                </>
              )}

              <div className="modal-actions">
                <button type="button" className="secondary" onClick={() => setShowForm(false)}>
                  Cancel
                </button>
                <button type="submit" disabled={submitting}>
                  {submitting ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {batchModal && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h3 style={{ marginTop: 0 }}>Receive batch — {batchModal.name}</h3>
            {error && <p className="error-text">{error}</p>}
            <form onSubmit={handleAddBatch}>
              <div className="form-row">
                <label>Batch number</label>
                <input
                  required
                  dir="auto"
                  value={batchForm.batch_number}
                  onChange={(e) => setBatchForm({ ...batchForm, batch_number: e.target.value })}
                />
              </div>
              <div className="form-row">
                <label>Expiry date</label>
                <input
                  type="date"
                  required
                  value={batchForm.expiry_date}
                  onChange={(e) => setBatchForm({ ...batchForm, expiry_date: e.target.value })}
                />
              </div>
              <div className="form-row">
                <label>Quantity</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={batchForm.quantity}
                  onChange={(e) => setBatchForm({ ...batchForm, quantity: e.target.value })}
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="secondary" onClick={() => setBatchModal(null)}>
                  Cancel
                </button>
                <button type="submit" disabled={submitting}>
                  {submitting ? "Saving..." : "Add Batch"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

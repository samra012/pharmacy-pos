import { useEffect, useState } from "react";
import { createUser, errorMessage, listUsers, updateUser } from "../api/client";
import { useAuth } from "../auth/AuthContext";

const DISPLAY_TZ = "Asia/Karachi";
const emptyForm = { username: "", password: "", role: "cashier" };

export default function StaffPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [resetFor, setResetFor] = useState(null); // user whose password is being reset
  const [newPassword, setNewPassword] = useState("");
  const [modalError, setModalError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    refresh();
  }, []);

  function refresh() {
    setLoading(true);
    listUsers()
      .then((data) => {
        setUsers(data);
        setError("");
      })
      .catch((e) => setError(errorMessage(e, "Could not load staff.")))
      .finally(() => setLoading(false));
  }

  function openCreate() {
    setForm(emptyForm);
    setModalError("");
    setShowCreate(true);
  }

  async function handleCreate(e) {
    e.preventDefault();
    setModalError("");
    setSubmitting(true);
    try {
      await createUser(form);
      setShowCreate(false);
      refresh();
    } catch (err) {
      setModalError(errorMessage(err, "Could not create account."));
    } finally {
      setSubmitting(false);
    }
  }

  async function applyUpdate(target, changes, fallback) {
    setError("");
    try {
      await updateUser(target.id, changes);
      refresh();
    } catch (err) {
      setError(errorMessage(err, fallback));
    }
  }

  function toggleActive(target) {
    if (target.is_active && !window.confirm(`Deactivate ${target.username}? They won't be able to log in.`)) {
      return;
    }
    applyUpdate(target, { is_active: !target.is_active }, "Could not update account.");
  }

  function openReset(target) {
    setResetFor(target);
    setNewPassword("");
    setModalError("");
  }

  async function handleReset(e) {
    e.preventDefault();
    setModalError("");
    setSubmitting(true);
    try {
      await updateUser(resetFor.id, { password: newPassword });
      setResetFor(null);
    } catch (err) {
      setModalError(errorMessage(err, "Could not reset password."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 className="page-title">Staff</h2>
        <button onClick={openCreate}>+ Add Staff</button>
      </div>
      {error && <p className="error-text">{error}</p>}

      <div className="card">
        {loading ? (
          <p className="empty-state">Loading...</p>
        ) : users.length === 0 ? (
          <p className="empty-state">No staff accounts.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Username</th>
                <th>Role</th>
                <th>Status</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isSelf = u.id === currentUser.id;
                return (
                  <tr key={u.id}>
                    <td>
                      {u.username} {isSelf && <span style={{ color: "#8a94a0" }}>(you)</span>}
                    </td>
                    <td>
                      <span className="badge info">{u.role}</span>
                    </td>
                    <td>
                      {u.is_active ? (
                        <span className="badge ok">Active</span>
                      ) : (
                        <span className="badge warn">Inactive</span>
                      )}
                    </td>
                    <td>{new Date(u.created_at).toLocaleDateString("en-GB", { timeZone: DISPLAY_TZ })}</td>
                    <td>
                      <div style={{ display: "flex", gap: "0.4rem" }}>
                        {!isSelf && (
                          <button
                            className="secondary"
                            onClick={() =>
                              applyUpdate(
                                u,
                                { role: u.role === "manager" ? "cashier" : "manager" },
                                "Could not change role."
                              )
                            }
                          >
                            {u.role === "manager" ? "Make cashier" : "Make manager"}
                          </button>
                        )}
                        <button className="secondary" onClick={() => openReset(u)}>
                          Reset password
                        </button>
                        {!isSelf && (
                          <button
                            className={u.is_active ? "danger" : "secondary"}
                            onClick={() => toggleActive(u)}
                          >
                            {u.is_active ? "Deactivate" : "Reactivate"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h3 style={{ marginTop: 0 }}>Add Staff</h3>
            {modalError && <p className="error-text">{modalError}</p>}
            <form onSubmit={handleCreate}>
              <div className="form-row">
                <label>Username</label>
                <input
                  required
                  autoComplete="off"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                />
              </div>
              <div className="form-row">
                <label>Password (at least 8 characters)</label>
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </div>
              <div className="form-row">
                <label>Role</label>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  <option value="cashier">Cashier</option>
                  <option value="manager">Manager</option>
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" className="secondary" onClick={() => setShowCreate(false)}>
                  Cancel
                </button>
                <button type="submit" disabled={submitting}>
                  {submitting ? "Saving..." : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {resetFor && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h3 style={{ marginTop: 0 }}>Reset password — {resetFor.username}</h3>
            {modalError && <p className="error-text">{modalError}</p>}
            <form onSubmit={handleReset}>
              <div className="form-row">
                <label>New password (at least 8 characters)</label>
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="secondary" onClick={() => setResetFor(null)}>
                  Cancel
                </button>
                <button type="submit" disabled={submitting}>
                  {submitting ? "Saving..." : "Reset password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

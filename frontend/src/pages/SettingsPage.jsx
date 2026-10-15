import { useEffect, useState } from "react";
import { errorMessage, getSettings, updateSettings } from "../api/client";
import BackupsCard from "../components/BackupsCard";

const emptySettings = { store_name: "", address: "", phone: "", receipt_footer: "" };

export default function SettingsPage() {
  const [form, setForm] = useState(emptySettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getSettings()
      .then((data) => {
        setForm(data);
        setError("");
      })
      .catch((e) => setError(errorMessage(e, "Could not load settings.")))
      .finally(() => setLoading(false));
  }, []);

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaved(false);
    setSaving(true);
    try {
      const data = await updateSettings(form);
      setForm(data); // show exactly what was stored (e.g. trimmed spaces)
      setSaved(true);
    } catch (err) {
      setError(errorMessage(err, "Could not save settings."));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="empty-state">Loading...</p>;

  return (
    <div>
      <h2 className="page-title">Settings</h2>
      <div className="card" style={{ maxWidth: 560 }}>
        <h3 style={{ marginTop: 0 }}>Receipt details</h3>
        <p style={{ color: "#8a94a0", fontSize: "0.9rem", marginTop: 0 }}>
          These appear at the top and bottom of every printed receipt.
        </p>
        {error && <p className="error-text">{error}</p>}
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <label>Pharmacy name</label>
            <input
              required
              maxLength={80}
              dir="auto"
              value={form.store_name}
              onChange={(e) => update("store_name", e.target.value)}
            />
          </div>
          <div className="form-row">
            <label>Address</label>
            <textarea
              rows={2}
              maxLength={200}
              dir="auto"
              value={form.address}
              onChange={(e) => update("address", e.target.value)}
            />
          </div>
          <div className="form-row">
            <label>Phone</label>
            <input
              maxLength={40}
              dir="auto"
              value={form.phone}
              onChange={(e) => update("phone", e.target.value)}
            />
          </div>
          <div className="form-row">
            <label>Receipt footer</label>
            <textarea
              rows={2}
              maxLength={200}
              dir="auto"
              value={form.receipt_footer}
              onChange={(e) => update("receipt_footer", e.target.value)}
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </button>
            {saved && <span className="badge ok">Saved</span>}
          </div>
        </form>
      </div>
      <BackupsCard />
    </div>
  );
}

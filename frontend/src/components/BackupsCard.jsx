import { useEffect, useState } from "react";
import { createBackupNow, errorMessage, getBackups } from "../api/client";

const DISPLAY_TZ = "Asia/Karachi";

function describeAge(hours) {
  if (hours < 1) {
    const minutes = Math.max(1, Math.round(hours * 60));
    return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  }
  if (hours < 48) {
    const h = Math.round(hours);
    return `${h} hour${h === 1 ? "" : "s"} ago`;
  }
  return `${Math.round(hours / 24)} days ago`;
}

function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function problemText(info) {
  if (info.last_error) return `The last backup attempt failed: ${info.last_error}`;
  if (info.newest_age_hours === null) return "No backups have been made yet.";
  return `The newest backup is from ${describeAge(info.newest_age_hours)}. Backups may have stopped working.`;
}

export default function BackupsCard() {
  const [info, setInfo] = useState(null);
  const [error, setError] = useState(""); // loading the status failed
  const [backupError, setBackupError] = useState(""); // the last "Back up now" failed
  const [message, setMessage] = useState("");
  const [running, setRunning] = useState(false);

  useEffect(() => {
    refresh();
  }, []);

  function refresh() {
    getBackups()
      .then((data) => {
        setInfo(data);
        setError("");
      })
      .catch((e) => setError(errorMessage(e, "Could not load backup status.")));
  }

  async function handleBackupNow() {
    setRunning(true);
    setMessage("");
    setBackupError("");
    try {
      const created = await createBackupNow();
      setMessage(`Backup created: ${created.filename}`);
    } catch (e) {
      // Kept separate from `error`, which refresh() below clears on a successful load.
      setBackupError(errorMessage(e, "Backup failed."));
    } finally {
      setRunning(false);
      refresh();
    }
  }

  return (
    <div className="card" style={{ maxWidth: 560 }}>
      <h3 style={{ marginTop: 0 }}>Backups</h3>
      {error && <p className="error-text">{error}</p>}
      {backupError && <p className="error-text">{backupError}</p>}

      {!info ? (
        !error && <p className="empty-state">Loading...</p>
      ) : (
        <>
          {info.healthy ? (
            <p>
              <span className="badge ok">Working</span> Last backup{" "}
              {describeAge(info.newest_age_hours)}
            </p>
          ) : (
            <p className="error-text">
              <span className="badge warn">Check backups</span> {problemText(info)}
            </p>
          )}

          <p style={{ fontSize: "0.85rem", color: "#556" }}>
            Saved to: <code dir="ltr">{info.backup_dir}</code>
            <br />
            Automatic every {info.interval_hours} hours while the app is running. The newest{" "}
            {info.keep} are kept.
          </p>

          {info.backups.length > 0 && (
            <table style={{ marginBottom: "1rem" }}>
              <thead>
                <tr>
                  <th>Recent backups</th>
                  <th>Size</th>
                </tr>
              </thead>
              <tbody>
                {info.backups.map((b) => (
                  <tr key={b.filename}>
                    <td>
                      {new Date(b.created_at).toLocaleString("en-GB", { timeZone: DISPLAY_TZ })}
                    </td>
                    <td>{formatSize(b.size_bytes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <button onClick={handleBackupNow} disabled={running}>
              {running ? "Backing up..." : "Back up now"}
            </button>
            {message && <span className="badge ok">{message}</span>}
          </div>
        </>
      )}
    </div>
  );
}

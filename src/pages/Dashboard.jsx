import { useState } from "react";
import { signOut } from "firebase/auth";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";
import useGigaStore from "../store/useGigaStore";

export default function Dashboard() {
  const user = useGigaStore((s) => s.user);
  const maps = useGigaStore((s) => s.maps);
  const subscribeToMap = useGigaStore((s) => s.subscribeToMap);
  const deleteMap = useGigaStore((s) => s.deleteMap);

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const openMap = (map) => {
    subscribeToMap(map.id);
  };

  const createMap = async () => {
    // In-flight-vakt: dobbel Enter / dobbeltklikk skal ikke gi duplikatkart
    if (busy || !newName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const ref = await addDoc(collection(db, "maps"), {
        title: newName.trim(),
        ownerId: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setCreating(false);
      setNewName("");
      subscribeToMap(ref.id);
    } catch (err) {
      console.error("Create map failed:", err);
      setError(`${err.code}: ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  const formatDate = (ts) => {
    if (!ts?.seconds) return "Nylig";
    return new Date(ts.seconds * 1000).toLocaleDateString("nb-NO", {
      day: "numeric", month: "short", year: "numeric"
    });
  };

  const mapIcons = ["🗺", "🏢", "🔗", "📊", "⚙️", "🚀", "💡", "🧩"];

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div className="dashboard-logo">🗺 Gigamapping</div>
        <div className="dashboard-user">
          {user.photoURL && <img src={user.photoURL} alt="avatar" className="dashboard-avatar" />}
          <span>{user.displayName || user.email}</span>
          <button
            className="btn btn-ghost"
            style={{ marginLeft: 8 }}
            onClick={() => signOut(auth)}
          >
            Logg ut
          </button>
        </div>
      </div>

      <div className="dashboard-content">
        <h1 className="dashboard-title">Mine kart</h1>
        <p className="dashboard-desc">Velg et kart å redigere, eller opprett et nytt gigamap.</p>

        <div className="maps-grid">
          {/* Create new card */}
          {creating ? (
            <div className="glass-card map-card" style={{ display: "flex", flexDirection: "column", gap: 12, minHeight: 140 }}>
              <input
                autoFocus
                placeholder="Navn på kart..."
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") createMap(); if (e.key === "Escape") setCreating(false); }}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-primary" onClick={createMap} disabled={busy} style={{ flex: 1 }}>
                  {busy ? "Oppretter..." : "Opprett"}
                </button>
                <button className="btn btn-ghost" onClick={() => setCreating(false)}>Avbryt</button>
              </div>
              {error && (
                <div style={{
                  padding: "10px 14px", borderRadius: 8,
                  background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)",
                  fontSize: 11, color: "#f87171", lineHeight: 1.5, wordBreak: "break-word",
                }}>
                  ⚠️ {error}
                </div>
              )}
            </div>
          ) : (
            <div className="glass-card map-card map-card-new" onClick={() => setCreating(true)}>
              <div className="plus">+</div>
              <div className="label">Nytt kart</div>
            </div>
          )}

          {/* Existing maps */}
          {maps.map((map, i) => (
            <div key={map.id} className="glass-card map-card" style={{ position: "relative" }}>
              <div onClick={() => openMap(map)} style={{ cursor: "pointer" }}>
                <div className="map-card-icon">{mapIcons[i % mapIcons.length]}</div>
                <div className="map-card-title">{map.title}</div>
                <div className="map-card-meta">
                  Oppdatert {formatDate(map.updatedAt)}
                </div>
              </div>
              <button
                className="btn btn-ghost btn-icon"
                title="Slett kart"
                style={{
                  position: "absolute", top: 10, right: 10,
                  fontSize: 14, color: "var(--text-muted)",
                  padding: 4, borderRadius: 8,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (window.confirm(`Slette "${map.title}"? Alle noder, koblinger og ideer slettes permanent.`)) {
                    // deleteMap sletter også subkolleksjonene — Firestore
                    // kaskade-sletter aldri selv
                    deleteMap(map.id);
                  }
                }}
              >
                🗑
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

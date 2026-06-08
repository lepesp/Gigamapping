import { useState } from "react";
import { signOut } from "firebase/auth";
import { collection, addDoc, deleteDoc, doc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";
import useGigaStore from "../store/useGigaStore";
import ShareModal from "../components/ShareModal";

export default function Dashboard() {
  const { user, maps, setCurrentMapId, subscribeToMap, leaveMap } = useGigaStore();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState(null);
  const [shareMapId, setShareMapId] = useState(null);

  const openMap = (map) => {
    subscribeToMap(map.id);
  };

  const createMap = async () => {
    if (!newName.trim()) return;
    setError(null);
    try {
      const ref = await addDoc(collection(db, "maps"), {
        title: newName.trim(),
        ownerId: user.uid,
        members: {
          [user.uid]: {
            role: "owner",
            email: (user.email || "").toLowerCase(),
            displayName: user.displayName || "",
          },
        },
        memberUids: [user.uid],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setCreating(false);
      setNewName("");
      subscribeToMap(ref.id);
    } catch (err) {
      console.error("Create map failed:", err);
      setError(`${err.code}: ${err.message}`);
    }
  };

  const handleLeaveMap = async (e, map) => {
    e.stopPropagation();
    if (window.confirm(`Forlate "${map.title}"? Du mister tilgang til dette kartet.`)) {
      await leaveMap(map.id);
    }
  };

  const formatDate = (ts) => {
    if (!ts?.seconds) return "Nylig";
    return new Date(ts.seconds * 1000).toLocaleDateString("nb-NO", {
      day: "numeric", month: "short", year: "numeric"
    });
  };

  const mapIcons = ["🗺", "🏢", "🔗", "📊", "⚙️", "🚀", "💡", "🧩"];

  // Split maps into owned and shared
  const myMaps = maps.filter((m) => m.ownerId === user.uid);
  const sharedMaps = maps.filter((m) => m.ownerId !== user.uid);

  // Find owner name for shared maps
  const getOwnerName = (map) => {
    if (!map.members) return "Ukjent";
    const ownerEntry = Object.values(map.members).find((m) => m.role === "owner");
    return ownerEntry?.displayName || ownerEntry?.email || "Ukjent";
  };

  const getUserRole = (map) => {
    return map.members?.[user.uid]?.role || (map.ownerId === user.uid ? "owner" : null);
  };

  const renderMapCard = (map, i, isShared = false) => {
    const role = getUserRole(map);
    const isOwner = role === "owner";

    return (
      <div key={map.id} className="glass-card map-card" style={{ position: "relative" }}>
        <div onClick={() => openMap(map)} style={{ cursor: "pointer" }}>
          <div className="map-card-icon">{mapIcons[i % mapIcons.length]}</div>
          <div className="map-card-title">{map.title}</div>
          <div className="map-card-meta">
            Oppdatert {formatDate(map.updatedAt)}
          </div>
          {isShared && (
            <div className="shared-by">
              Delt av {getOwnerName(map)}
            </div>
          )}
          {role && role !== "owner" && (
            <span className={`role-badge ${role}`}>
              {role === "editor" ? "Les og skriv" : "Kun les"}
            </span>
          )}
        </div>

        <div style={{ position: "absolute", top: 10, right: 10, display: "flex", gap: 4 }}>
          {isOwner && (
            <button
              className="btn btn-ghost btn-icon"
              title="Del kart"
              style={{ fontSize: 14, color: "var(--text-muted)", padding: 4, borderRadius: 8 }}
              onClick={(e) => { e.stopPropagation(); setShareMapId(map.id); }}
            >
              🔗
            </button>
          )}
          {isOwner ? (
            <button
              className="btn btn-ghost btn-icon"
              title="Slett kart"
              style={{ fontSize: 14, color: "var(--text-muted)", padding: 4, borderRadius: 8 }}
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm(`Slette "${map.title}"?`)) {
                  deleteDoc(doc(db, "maps", map.id));
                }
              }}
            >
              🗑
            </button>
          ) : (
            <button
              className="btn btn-ghost btn-icon leave-btn"
              title="Forlat kart"
              style={{ fontSize: 14, color: "var(--text-muted)", padding: 4, borderRadius: 8 }}
              onClick={(e) => handleLeaveMap(e, map)}
            >
              🚪
            </button>
          )}
        </div>
      </div>
    );
  };

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
                <button className="btn btn-primary" onClick={createMap} style={{ flex: 1 }}>Opprett</button>
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

          {/* My maps */}
          {myMaps.map((map, i) => renderMapCard(map, i))}
        </div>

        {/* Shared with me */}
        {sharedMaps.length > 0 && (
          <>
            <div className="dashboard-section-title">🔗 Delt med meg</div>
            <div className="maps-grid">
              {sharedMaps.map((map, i) => renderMapCard(map, i, true))}
            </div>
          </>
        )}
      </div>

      {/* Share Modal */}
      {shareMapId && (
        <ShareModal mapId={shareMapId} onClose={() => setShareMapId(null)} />
      )}
    </div>
  );
}

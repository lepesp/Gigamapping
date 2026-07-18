import { useState, useEffect } from "react";
import { signOut } from "firebase/auth";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";
import useGigaStore, { pageTrail } from "../store/useGigaStore";
import ExportModal from "./ExportModal";
import ThemePicker from "./ThemePicker";
import ShareModal from "./ShareModal";

export default function Toolbar() {
  const {
    user, currentMapId, maps, nodes, connections,
    setCurrentMapId, unsubscribeAll,
    addNode, pan, zoom, setZoom, setPan,
    selectedNodeId, deleteNode,
    selectedConnectionId, deleteConnection,
    userRole,
    currentPageId, setCurrentPageId, descendantCount,
  } = useGigaStore();

  // Stien fra kartets toppnivå ned hit — brukes til brødsmulene
  const trail = pageTrail(nodes, currentPageId);

  // Sletting tar hele underkartet, så vi advarer med hvor mye det gjelder
  const handleDeleteNode = () => {
    const node = nodes.find((n) => n.id === selectedNodeId);
    const count = descendantCount(selectedNodeId);
    if (count > 0) {
      const ord = count === 1 ? "element" : "elementer";
      const ok = window.confirm(
        `"${node?.title || "Noden"}" har et underkart med ${count} ${ord}.\n\nSletter du noden, slettes alt innholdet under den også. Fortsette?`
      );
      if (!ok) return;
    }
    deleteNode(selectedNodeId);
  };

  const currentMap = maps.find((m) => m.id === currentMapId);
  const [showExport, setShowExport] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [title, setTitle] = useState(currentMap?.title || "");
  const [isEditing, setIsEditing] = useState(false);
  const isViewer = userRole === "viewer";
  const isOwner = userRole === "owner";

  // Keep title in sync with Firestore (but not while user is editing)
  useEffect(() => {
    if (!isEditing && currentMap?.title) {
      setTitle(currentMap.title);
    }
  }, [currentMap?.title, isEditing]);

  const saveTitle = async () => {
    setIsEditing(false);
    if (!currentMapId || !title.trim() || title.trim() === currentMap?.title) return;
    try {
      await updateDoc(doc(db, "maps", currentMapId), {
        title: title.trim(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error("Failed to save title:", err);
      // Revert on error
      setTitle(currentMap?.title || "");
    }
  };

  const goToDashboard = () => {
    unsubscribeAll();
    setCurrentMapId(null);
  };

  const handleAddNode = () => {
    // Add node to visible center of canvas
    const centerX = (-pan.x + window.innerWidth / 2) / zoom;
    const centerY = (-pan.y + window.innerHeight / 2) / zoom;
    addNode({
      x: centerX - 110, y: centerY - 55,
      w: 220, h: 110,
      title: "Ny node",
      notes: "",
      color: "#e8edf5",
      type: "Generell",
    });
  };

  const fitToScreen = () => {
    if (nodes.length === 0) { setZoom(1); setPan({ x: 0, y: 0 }); return; }
    const minX = Math.min(...nodes.map((n) => n.x));
    const minY = Math.min(...nodes.map((n) => n.y));
    const maxX = Math.max(...nodes.map((n) => n.x + n.w));
    const maxY = Math.max(...nodes.map((n) => n.y + n.h));
    const W = window.innerWidth - 40;
    const H = window.innerHeight - 100;
    const scaleX = W / (maxX - minX + 80);
    const scaleY = H / (maxY - minY + 80);
    const newZoom = Math.min(1.5, Math.min(scaleX, scaleY));
    setZoom(newZoom);
    setPan({
      x: (W / 2) - ((minX + maxX) / 2) * newZoom + 20,
      y: (H / 2) - ((minY + maxY) / 2) * newZoom + 60,
    });
  };

  return (
    <>
      <div className="toolbar">
        {/* Back */}
        <button className="btn btn-ghost btn-icon" onClick={goToDashboard} title="Tilbake til kart">
          ←
        </button>

        <div className="toolbar-logo">🗺</div>

        {/* Map title */}
        <input
          className="toolbar-map-name"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onFocus={() => setIsEditing(true)}
          onBlur={saveTitle}
          onKeyDown={(e) => { if (e.key === "Enter") { e.target.blur(); } }}
          placeholder="Kartnavn..."
          readOnly={isViewer}
        />

        {/* Brødsmuler — vises bare når man står inne i et underkart */}
        {trail.length > 0 && (
          <nav className="breadcrumb" aria-label="Sti">
            <button
              className="breadcrumb-crumb"
              onClick={() => setCurrentPageId(null)}
              title="Tilbake til kartets toppnivå"
            >
              Toppnivå
            </button>
            {trail.map((n, i) => (
              <span key={n.id} style={{ display: "contents" }}>
                <span className="breadcrumb-sep">›</span>
                {i === trail.length - 1 ? (
                  <span className="breadcrumb-crumb current" aria-current="page">
                    {n.title || "Uten tittel"}
                  </span>
                ) : (
                  <button
                    className="breadcrumb-crumb"
                    onClick={() => setCurrentPageId(n.id)}
                    title={`Gå til ${n.title || "Uten tittel"}`}
                  >
                    {n.title || "Uten tittel"}
                  </button>
                )}
              </span>
            ))}
            <button
              className="btn btn-ghost btn-icon breadcrumb-up"
              onClick={() => setCurrentPageId(trail[trail.length - 1].parentId ?? null)}
              title="Opp ett nivå"
            >
              ↰
            </button>
          </nav>
        )}

        <div className="toolbar-sep" />

        {/* Add node — hidden for viewers */}
        {!isViewer && (
          <button className="btn btn-primary" onClick={handleAddNode} id="add-node-btn">
            + Ny node
          </button>
        )}

        {/* Role badge for non-owners */}
        {userRole && userRole !== "owner" && (
          <span className={`role-badge ${userRole}`}>
            {userRole === "editor" ? "Les og skriv" : "Kun les"}
          </span>
        )}

        <div className="toolbar-sep" />

        {/* Delete selected — hidden for viewers */}
        {!isViewer && selectedNodeId && (
          <button
            className="btn btn-danger"
            onClick={handleDeleteNode}
            title="Slett valgt node"
          >
            🗑 Slett node
          </button>
        )}
        {!isViewer && selectedConnectionId && (
          <button
            className="btn btn-danger"
            onClick={() => deleteConnection(selectedConnectionId)}
            title="Slett valgt kobling"
          >
            🗑 Slett kobling
          </button>
        )}

        <div className="toolbar-spacer" />

        {/* Stats */}
        <div style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", gap: 14 }}>
          <span>📦 {nodes.length} noder</span>
          <span>🔗 {connections.length} koblinger</span>
        </div>

        <div className="toolbar-sep" />

        {/* Fit to screen */}
        <button className="btn btn-ghost btn-icon" onClick={fitToScreen} title="Tilpass til skjerm">
          ⊡
        </button>

        {/* Export */}
        <button className="btn btn-ghost" onClick={() => setShowExport(true)} title="Eksporter / AI-eksport">
          ↑ Eksporter
        </button>

        {/* Share button — owners only */}
        {isOwner && (
          <button className="btn btn-ghost" onClick={() => setShowShare(true)} title="Del kart">
            🔗 Del
          </button>
        )}

        {/* Theme picker */}
        <ThemePicker />

        {/* User */}
        {user?.photoURL && (
          <img
            src={user.photoURL}
            alt="avatar"
            className="dashboard-avatar"
            style={{ cursor: "pointer" }}
            title={user.displayName}
            onClick={() => signOut(auth)}
          />
        )}
      </div>

      {showExport && <ExportModal onClose={() => setShowExport(false)} />}
      {showShare && <ShareModal mapId={currentMapId} onClose={() => setShowShare(false)} />}
    </>
  );
}

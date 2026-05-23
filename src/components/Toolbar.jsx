import { useState } from "react";
import { signOut } from "firebase/auth";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";
import useGigaStore from "../store/useGigaStore";
import ExportModal from "./ExportModal";
import ThemePicker from "./ThemePicker";

export default function Toolbar() {
  const {
    user, currentMapId, maps, nodes, connections,
    setCurrentMapId, unsubscribeAll,
    addNode, pan, zoom, setZoom, setPan,
    selectedNodeId, deleteNode,
    selectedConnectionId, deleteConnection,
  } = useGigaStore();

  const currentMap = maps.find((m) => m.id === currentMapId);
  const [showExport, setShowExport] = useState(false);
  const [savingTitle, setSavingTitle] = useState(false);
  const [title, setTitle] = useState(currentMap?.title || "");

  const saveTitle = async () => {
    if (!currentMapId || !title.trim()) return;
    await updateDoc(doc(db, "maps", currentMapId), {
      title: title.trim(),
      updatedAt: serverTimestamp(),
    });
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
          value={title || currentMap?.title || ""}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={saveTitle}
          onKeyDown={(e) => e.key === "Enter" && saveTitle()}
          placeholder="Kartnavn..."
        />

        <div className="toolbar-sep" />

        {/* Add node */}
        <button className="btn btn-primary" onClick={handleAddNode} id="add-node-btn">
          + Ny node
        </button>

        <div className="toolbar-sep" />

        {/* Delete selected */}
        {selectedNodeId && (
          <button
            className="btn btn-danger"
            onClick={() => deleteNode(selectedNodeId)}
            title="Slett valgt node"
          >
            🗑 Slett node
          </button>
        )}
        {selectedConnectionId && (
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
    </>
  );
}

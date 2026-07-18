import { useState } from "react";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import useGigaStore from "../store/useGigaStore";
import ExportModal from "./ExportModal";
import ThemePicker from "./ThemePicker";
import { DraftInput } from "./DraftText";

export default function Toolbar({ onFitToScreen }) {
  const user = useGigaStore((s) => s.user);
  const currentMapId = useGigaStore((s) => s.currentMapId);
  const currentMap = useGigaStore((s) =>
    s.maps.find((m) => m.id === s.currentMapId)
  );
  const nodeCount = useGigaStore((s) => s.nodes.length);
  const connectionCount = useGigaStore((s) => s.connections.length);
  const selectedNodeId = useGigaStore((s) => s.selectedNodeId);
  const selectedConnectionId = useGigaStore((s) => s.selectedConnectionId);
  const closeMap = useGigaStore((s) => s.closeMap);
  const addNode = useGigaStore((s) => s.addNode);
  const deleteNode = useGigaStore((s) => s.deleteNode);
  const deleteConnection = useGigaStore((s) => s.deleteConnection);
  const renameMap = useGigaStore((s) => s.renameMap);

  const [showExport, setShowExport] = useState(false);

  // Tomt navn avvises (returnerer false → DraftInput ruller tilbake på blur).
  // Returnerer den trimmede verdien så DraftInput gjenkjenner snapshot-ekkoet.
  const saveTitle = (value) => {
    const title = value.trim();
    if (!title || !currentMapId) return false;
    renameMap(currentMapId, title);
    return title;
  };

  const handleAddNode = () => {
    // Add node to visible center of canvas. pan/zoom leses via getState()
    // så Toolbar ikke re-rendres på hver eneste panorering.
    const { pan, zoom } = useGigaStore.getState();
    const centerX = (-pan.x + window.innerWidth / 2) / zoom;
    const centerY = (-pan.y + window.innerHeight / 2) / zoom;
    addNode({
      x: centerX - 110, y: centerY - 55,
      w: 220, h: 110,
      title: "Ny node",
      notes: "",
      color: "",
      type: "Generell",
    });
  };

  return (
    <>
      <div className="toolbar">
        {/* Back */}
        <button className="btn btn-ghost btn-icon" onClick={closeMap} title="Tilbake til kart">
          ←
        </button>

        <div className="toolbar-logo">🗺</div>

        {/* Map title. key remonterer feltet ved kartbytte, så en ventende
            kladd flushes mot det GAMLE kartets id (via saveTitle-closuren)
            i stedet for å omdøpe kartet man bytter til. */}
        <DraftInput
          key={currentMapId || "no-map"}
          className="toolbar-map-name"
          value={currentMap?.title || ""}
          onCommit={saveTitle}
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
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
          <span>📦 {nodeCount} noder</span>
          <span>🔗 {connectionCount} koblinger</span>
        </div>

        <div className="toolbar-sep" />

        {/* Fit to screen */}
        <button className="btn btn-ghost btn-icon" onClick={onFitToScreen} title="Tilpass til skjerm">
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

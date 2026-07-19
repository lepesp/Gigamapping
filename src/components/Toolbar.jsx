import { useState } from "react";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import useGigaStore, { pageTrail } from "../store/useGigaStore";
import ExportModal from "./ExportModal";
import ThemePicker from "./ThemePicker";
import ShareModal from "./ShareModal";
import MapInfoModal from "./MapInfoModal";

export default function Toolbar({ onFitToScreen }) {
  const {
    user, currentMapId, maps, nodes, connections,
    closeMap,
    addNode, pan, zoom,
    selectedNodeId, deleteNode,
    selectedConnectionId, deleteConnection,
    userRole,
    currentPageId, setCurrentPageId, descendantCount,
    updateMapMeta,
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
  const [showInfo, setShowInfo] = useState(false);
  // Kladden lever bare mens man redigerer og seedes ved fokus. Da trengs
  // ingen synk-effekt, og feltet kan ikke rykke tilbake til gammelt navn
  // midt i skrivingen fordi et snapshot kom inn.
  const [title, setTitle] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const shownTitle = isEditing ? title : (currentMap?.title || "");
  const isViewer = userRole === "viewer";
  const isOwner = userRole === "owner";

  const beginEditTitle = () => {
    setTitle(currentMap?.title || "");
    setIsEditing(true);
  };

  const saveTitle = () => {
    setIsEditing(false);
    if (!currentMapId || !title.trim() || title.trim() === currentMap?.title) return;
    // Går via storen, så en avvist skriving vises som feil i stedet for
    // å forsvinne stille
    updateMapMeta(currentMapId, { title: title.trim() });
  };

  const goToDashboard = () => {
    // closeMap rydder også kartinnholdet, ikke bare lytterne
    closeMap();
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

  // Tellerne skal gjelde nivået man står i, ikke hele kartet på tvers
  // av alle underkart
  const levelNodeCount = nodes.filter(
    (n) => (n.parentId ?? null) === (currentPageId ?? null)
  ).length;
  const levelConnCount = connections.filter(
    (c) => (c.parentId ?? null) === (currentPageId ?? null)
  ).length;

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
          value={shownTitle}
          onChange={(e) => setTitle(e.target.value)}
          onFocus={beginEditTitle}
          onBlur={saveTitle}
          onKeyDown={(e) => { if (e.key === "Enter") { e.target.blur(); } }}
          placeholder="Kartnavn..."
          readOnly={isViewer}
        />

        {/* Kartets formål — legges øverst i AI-eksporten */}
        <button
          className={`btn btn-ghost btn-icon map-info-btn${currentMap?.description ? " has-text" : ""}`}
          onClick={() => setShowInfo(true)}
          title={currentMap?.description
            ? "Om kartet — formålet er beskrevet"
            : "Om kartet — beskriv hva kartet er til for"}
        >
          ⓘ
        </button>

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
          <span>📦 {levelNodeCount} noder</span>
          <span>🔗 {levelConnCount} koblinger</span>
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
      {showInfo && <MapInfoModal onClose={() => setShowInfo(false)} readOnly={isViewer} />}
      {showShare && <ShareModal mapId={currentMapId} onClose={() => setShowShare(false)} />}
    </>
  );
}

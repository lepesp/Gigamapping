import { memo, useRef, useState, useEffect, useCallback } from "react";
import useGigaStore from "../store/useGigaStore";
import { TYPE_COLORS } from "../nodeTypes";
import { DraftInput } from "./DraftText";

// Velger lesbar tekstfarge oppå egendefinerte nodefarger, uavhengig av
// hvilket tema betrakteren bruker (fargen er lagret som absolutt hex).
function readableTextColors(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 140
    ? { "--node-text": "#1e293b", "--node-notes": "#475569" }
    : { "--node-text": "#f1f5f9", "--node-notes": "rgba(241,245,249,0.75)" };
}

function GigaNode({
  node, isSelected, isConnecting, isConnectingFrom,
  onSelect, onOpen, onStartConnect, onFinishConnect,
}) {
  const updateNode = useGigaStore((s) => s.updateNode);
  const patchNodeLocal = useGigaStore((s) => s.patchNodeLocal);
  // Fanges ved render slik at sene commits (kladd-flush, mouseup etter
  // kartbytte) treffer kartet noden hører til
  const mapId = useGigaStore((s) => s.currentMapId);
  const nodeRef = useRef(null);
  const [editingTitle, setEditingTitle] = useState(false);

  // Aktiv drag/resize må ryddes også ved unmount — f.eks. hvis noden
  // slettes av en annen bruker midt i draget.
  const gestureCleanup = useRef(null);
  useEffect(() => () => gestureCleanup.current?.(), []);

  // ── Drag ──
  // Bevegelsen holdes lokalt i storen (patchNodeLocal); Firestore får
  // ÉN skriving på mouseup i stedet for én per mousemove.
  const onMouseDownNode = useCallback((e) => {
    if (e.button !== 0) return;
    if (e.target.classList.contains("node-connect-btn")) return;
    if (e.target.classList.contains("node-resize")) return;
    if (e.target.classList.contains("node-title") && editingTitle) return;

    // If connecting mode, clicking a node finishes the connection
    if (isConnecting && !isConnectingFrom) {
      e.stopPropagation();
      onFinishConnect(node.id);
      return;
    }

    e.stopPropagation();
    onSelect(node.id);

    const start = { mx: e.clientX, my: e.clientY, nx: node.x, ny: node.y };
    let last = null;

    const onMove = (me) => {
      const { zoom } = useGigaStore.getState();
      const dx = (me.clientX - start.mx) / zoom;
      const dy = (me.clientY - start.my) / zoom;
      last = { x: start.nx + dx, y: start.ny + dy };
      patchNodeLocal(node.id, last);
    };
    const cleanup = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      gestureCleanup.current = null;
    };
    const onUp = () => {
      cleanup();
      if (last) updateNode(node.id, last, mapId);
    };
    gestureCleanup.current = cleanup;
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [node.id, node.x, node.y, editingTitle, isConnecting, isConnectingFrom,
      onSelect, onFinishConnect, patchNodeLocal, updateNode, mapId]);

  // ── Resize ──
  const onResizeMouseDown = useCallback((e) => {
    e.stopPropagation();
    e.preventDefault();
    const start = { mx: e.clientX, my: e.clientY, w: node.w, h: node.h };
    let last = null;

    const onMove = (me) => {
      const { zoom } = useGigaStore.getState();
      const dw = (me.clientX - start.mx) / zoom;
      const dh = (me.clientY - start.my) / zoom;
      last = {
        w: Math.max(160, start.w + dw),
        h: Math.max(80, start.h + dh),
      };
      patchNodeLocal(node.id, last);
    };
    const cleanup = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      gestureCleanup.current = null;
    };
    const onUp = () => {
      cleanup();
      if (last) updateNode(node.id, last, mapId);
    };
    gestureCleanup.current = cleanup;
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [node.id, node.w, node.h, patchNodeLocal, updateNode, mapId]);

  // ── Connect button ──
  const onConnectClick = useCallback((e) => {
    e.stopPropagation();
    if (isConnecting) {
      onFinishConnect(node.id);
    } else {
      onStartConnect(node.id, node.x + node.w, node.y + node.h / 2);
    }
  }, [node, isConnecting, onStartConnect, onFinishConnect]);

  // Kun tom/manglende color betyr «følg temaet». Alle lagrede hexer (også
  // gamle default-"#e8edf5") rendres som de er — luminansbasert tekstfarge
  // holder dem lesbare i alle temaer, og et eksplisitt swatch-valg
  // ignoreres aldri.
  const hasCustomColor = Boolean(node.color);
  const bgColor = hasCustomColor ? node.color : "var(--node-bg)";
  const customTextVars = hasCustomColor ? readableTextColors(node.color) : null;

  // Specific types get their own colors; Generell/Idé follow the theme accent
  const hasFixedColor = TYPE_COLORS[node.type];

  return (
    <div
      ref={nodeRef}
      className={`node${isSelected ? " selected" : ""}`}
      style={{
        left: node.x,
        top: node.y,
        width: node.w,
        height: node.h,
        background: bgColor,
        borderColor: isSelected ? "var(--accent)" : hasFixedColor ? `${hasFixedColor}44` : "var(--node-border)",
        boxShadow: isSelected
          ? `0 0 0 2px var(--accent-glow), 0 4px 16px rgba(0,0,0,0.12)`
          : `0 2px 12px rgba(0,0,0,0.08)`,
        ...customTextVars,
      }}
      onMouseDown={onMouseDownNode}
      onDoubleClick={(e) => { e.stopPropagation(); onOpen(node.id); }}
    >
      {/* Header */}
      <div className="node-header" style={{ borderBottomColor: hasFixedColor ? `${hasFixedColor}33` : "var(--border)" }}>
        <span
          className="node-type-badge"
          style={hasFixedColor
            ? { background: `${hasFixedColor}22`, color: hasFixedColor }
            : { background: "var(--accent-glow)", color: "var(--accent)" }
          }
        >
          {node.type || "Generell"}
        </span>
        {editingTitle ? (
          <DraftInput
            className="node-title"
            autoFocus
            value={node.title}
            onCommit={(v) => updateNode(node.id, { title: v }, mapId)}
            onBlur={() => setEditingTitle(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === "Escape") e.currentTarget.blur();
              e.stopPropagation();
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            className="node-title"
            onDoubleClick={(e) => { e.stopPropagation(); setEditingTitle(true); }}
            title="Dobbeltklikk for å redigere tittel"
          >
            {node.title || "Uten tittel"}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="node-body" style={{ flex: 1, overflow: "hidden" }}>
        {node.notes ? (
          <p className="node-notes">{node.notes}</p>
        ) : (
          <p className="node-notes" style={{ opacity: 0.35 }}>Dobbeltklikk for å åpne...</p>
        )}
      </div>

      {/* Footer */}
      <div className="node-footer">
        <button
          className={`node-connect-btn${isConnectingFrom ? " active" : ""}`}
          onClick={onConnectClick}
          title={isConnecting ? "Koble til denne noden" : "Start kobling"}
        >
          {isConnectingFrom ? "●" : "⊕"}
        </button>
        <button className="node-open-btn" onClick={(e) => { e.stopPropagation(); onOpen(node.id); }}>
          Åpne ↗
        </button>
      </div>

      {/* Resize handle */}
      <div className="node-resize" onMouseDown={onResizeMouseDown}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M13 1L1 13M13 8L8 13M13 5L5 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </div>
    </div>
  );
}

export default memo(GigaNode);

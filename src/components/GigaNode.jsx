import { memo, useRef, useState, useCallback, useEffect } from "react";
import useGigaStore from "../store/useGigaStore";
import { TYPE_COLORS, readableTextColors } from "../nodeTypes";

// Gammel standardfarge som ligger lagret i eksisterende noder.
// Nye noder lagres med color: "" for "følg temaet".
const LEGACY_DEFAULT_COLOR = "#e8edf5";

function GigaNode({
  node, isSelected, isConnecting, isConnectingFrom,
  onSelect, onOpen, onStartConnect, onFinishConnect, zoom,
  onEnterPage, childCount = 0,
  readOnly = false,
}) {
  const isPage = !!node.isPage;
  const { updateNode, patchNodeLocal, endGesture } = useGigaStore();
  const nodeRef = useRef(null);
  const dragging = useRef(false);
  const dragStart = useRef({ mx: 0, my: 0, nx: 0, ny: 0 });
  const resizing = useRef(false);
  const resizeStart = useRef({ mx: 0, my: 0, w: 0, h: 0 });
  const [editingTitle, setEditingTitle] = useState(false);
  // Kladden lever bare mens man redigerer, og seedes idet redigeringen
  // starter. Da trengs ingen synk-effekt mot Firestore-snapshots — som
  // var det som kunne rykke teksten tilbake midt i skrivingen.
  const [localTitle, setLocalTitle] = useState("");
  const beginEditTitle = useCallback(() => {
    setLocalTitle(node.title ?? "");
    setEditingTitle(true);
  }, [node.title]);

  // En pågående drag/resize må ryddes også hvis noden forsvinner midt i
  // gesten (f.eks. slettet av en annen bruker), ellers fortsetter
  // vindus-lytterne å skyte mot et dokument som ikke finnes.
  const gestureCleanup = useRef(null);
  useEffect(
    () => () => {
      if (gestureCleanup.current) {
        gestureCleanup.current();
        // Ellers ville gest-låsen blitt hengende og frosset nodens
        // geometri mot alle framtidige snapshots
        endGesture();
      }
    },
    [endGesture]
  );

  // ── Drag (disabled for readOnly) ──
  const onMouseDownNode = useCallback((e) => {
    if (e.button !== 0) return;
    if (e.target.classList.contains("node-connect-btn")) return;
    if (e.target.classList.contains("node-resize")) return;
    if (e.target.classList.contains("node-title") && editingTitle) return;

    // If connecting mode, clicking a node finishes the connection
    if (isConnecting && !isConnectingFrom && !readOnly) {
      e.stopPropagation();
      onFinishConnect(node.id);
      return;
    }

    e.stopPropagation();
    onSelect();

    // Don't allow dragging in readOnly mode
    if (readOnly) return;

    dragging.current = true;
    dragStart.current = { mx: e.clientX, my: e.clientY, nx: node.x, ny: node.y };

    // Bevegelsen holdes lokalt; Firestore får én skriving på mouseup
    let last = null;
    const onMove = (me) => {
      if (!dragging.current) return;
      const dx = (me.clientX - dragStart.current.mx) / zoom;
      const dy = (me.clientY - dragStart.current.my) / zoom;
      last = { x: dragStart.current.nx + dx, y: dragStart.current.ny + dy };
      patchNodeLocal(node.id, last);
    };
    const cleanup = () => {
      dragging.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      gestureCleanup.current = null;
    };
    const onUp = () => {
      cleanup();
      // Slipp gest-låsen først når skrivingen er ute, ellers kan et
      // mellomliggende snapshot vise den gamle posisjonen et øyeblikk
      if (last) Promise.resolve(updateNode(node.id, last)).finally(endGesture);
      else endGesture();
    };
    gestureCleanup.current = cleanup;
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [node, zoom, isConnecting, isConnectingFrom, editingTitle, readOnly, onSelect, onFinishConnect, updateNode, patchNodeLocal, endGesture]);

  // ── Resize ──
  const onResizeMouseDown = useCallback((e) => {
    e.stopPropagation();
    e.preventDefault();
    resizing.current = true;
    resizeStart.current = { mx: e.clientX, my: e.clientY, w: node.w, h: node.h };

    // Samme mønster som drag: lokalt underveis, én skriving på mouseup
    let last = null;
    const onMove = (me) => {
      if (!resizing.current) return;
      const dw = (me.clientX - resizeStart.current.mx) / zoom;
      const dh = (me.clientY - resizeStart.current.my) / zoom;
      last = {
        w: Math.max(160, resizeStart.current.w + dw),
        h: Math.max(80, resizeStart.current.h + dh),
      };
      patchNodeLocal(node.id, last);
    };
    const cleanup = () => {
      resizing.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      gestureCleanup.current = null;
    };
    const onUp = () => {
      cleanup();
      // Slipp gest-låsen først når skrivingen er ute, ellers kan et
      // mellomliggende snapshot vise den gamle posisjonen et øyeblikk
      if (last) Promise.resolve(updateNode(node.id, last)).finally(endGesture);
      else endGesture();
    };
    gestureCleanup.current = cleanup;
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [node, zoom, updateNode, patchNodeLocal, endGesture]);

  // ── Connect button ──
  const onConnectClick = useCallback((e) => {
    e.stopPropagation();
    if (isConnecting) {
      onFinishConnect(node.id);
    } else {
      // We pass canvas coords via node position
      onStartConnect(node.id, node.x + node.w, node.y + node.h / 2);
    }
  }, [node, isConnecting, onStartConnect, onFinishConnect]);

  // Tidligere ble også #1e2a4a og #1a1f35 regnet som "ingen farge" — men
  // de er de to første valgbare swatchene i Dark-temaet, så et bevisst
  // fargevalg ble stille forkastet. Nå er "" den eneste sentinelen.
  const hasCustomColor = node.color && node.color !== LEGACY_DEFAULT_COLOR;
  const bgColor = hasCustomColor ? node.color : "var(--node-bg)";
  // Sørg for lesbar tekst oppå egendefinert bakgrunn, uansett aktivt tema
  const customTextVars = hasCustomColor ? readableTextColors(node.color) : null;

  // Specific types get their own colors; Generell/Idé follow the theme accent
  const hasFixedColor = TYPE_COLORS[node.type];

  return (
    <div
      ref={nodeRef}
      className={`node${isSelected ? " selected" : ""}${readOnly ? " readonly" : ""}${isPage ? " node-page" : ""}`}
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
      onDoubleClick={(e) => { e.stopPropagation(); onOpen(); }}
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
        {isPage && (
          <span
            className="node-page-badge"
            title={childCount > 0
              ? `Underkart med ${childCount} ${childCount === 1 ? "element" : "elementer"}`
              : "Tomt underkart"}
          >
            ⬚ {childCount > 0 ? childCount : "tomt"}
          </span>
        )}
        {editingTitle && !readOnly ? (
          <input
            className="node-title"
            autoFocus
            value={localTitle}
            onChange={(e) => setLocalTitle(e.target.value)}
            onBlur={() => { updateNode(node.id, { title: localTitle }); setEditingTitle(false); }}
            onKeyDown={(e) => { if (e.key === "Enter") { updateNode(node.id, { title: localTitle }); setEditingTitle(false); } e.stopPropagation(); }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            className="node-title"
            onDoubleClick={(e) => { if (!readOnly) { e.stopPropagation(); beginEditTitle(); } }}
            title={readOnly ? node.title : "Dobbeltklikk for å redigere tittel"}
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
          <p className="node-notes" style={{ opacity: 0.35 }}>
            {isPage ? "Underkart – trykk for å gå inn..." : "Dobbeltklikk for å åpne..."}
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="node-footer">
        {!readOnly && (
          <button
            className={`node-connect-btn${isConnectingFrom ? " active" : ""}`}
            onClick={onConnectClick}
            title={isConnecting ? "Koble til denne noden" : "Start kobling"}
          >
            {isConnectingFrom ? "●" : "⊕"}
          </button>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>
          {isPage && (
            <button
              className="node-page-btn"
              onClick={(e) => { e.stopPropagation(); onEnterPage?.(node.id); }}
              title="Åpne underkartet til denne noden"
            >
              Åpne underkart ↘
            </button>
          )}
          <button className="node-open-btn" onClick={(e) => { e.stopPropagation(); onOpen(); }}>
            {readOnly ? "Vis ↗" : "Detaljer"}
          </button>
        </div>
      </div>

      {/* Resize handle (hidden for readOnly) */}
      {!readOnly && (
        <div className="node-resize" onMouseDown={onResizeMouseDown}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M13 1L1 13M13 8L8 13M13 5L5 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
      )}
    </div>
  );
}

export default memo(GigaNode);

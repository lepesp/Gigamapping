import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import useGigaStore from "../store/useGigaStore";
import Toolbar from "../components/Toolbar";
import GigaNode from "../components/GigaNode";
import Connections from "../components/Connections";
import MiniMap from "../components/MiniMap";
import NodeModal from "../components/NodeModal";
import ContextMenu from "../components/ContextMenu";
import IdeaPanel from "../components/IdeaPanel";
import PresenceChat from "../components/PresenceChat";

// Hvor mye ett zoom-steg endrer skalaen. Lavere tall = roligere zooming.
// Scrollhjulet gir mange hendelser etter hverandre, så det tåler et
// mindre steg enn knappene.
const WHEEL_ZOOM_STEP = 1.05;  // 5 % per hakk
const BUTTON_ZOOM_STEP = 1.1;  // 10 % per klikk

export default function MapEditor() {
  const {
    nodes, connections, zoom, setZoom, pan, setPan,
    selectedNodeId, setSelectedNodeId,
    setSelectedConnectionId,
    connectingFrom, setConnectingFrom,
    openModalNodeId, setOpenModalNodeId,
    addNode, addConnection, promoteIdea,
    userRole,
    currentPageId, enterPage, fitToScreen,
  } = useGigaStore();

  const isViewer = userRole === "viewer";

  // ── Underkart: lerretet viser bare det nivået man står i ──
  const pageId = currentPageId ?? null;
  const visibleNodes = useMemo(
    () => nodes.filter((n) => (n.parentId ?? null) === pageId),
    [nodes, pageId]
  );
  const visibleConnections = useMemo(
    () => connections.filter((c) => (c.parentId ?? null) === pageId),
    [connections, pageId]
  );
  // Antall elementer rett under hver underkart-node, til telleren på noden
  const childCounts = useMemo(() => {
    const counts = {};
    nodes.forEach((n) => {
      const p = n.parentId ?? null;
      if (p) counts[p] = (counts[p] || 0) + 1;
    });
    return counts;
  }, [nodes]);

  const canvasRef = useRef(null);
  const isPanning = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  // Refs kan ikke leses under render — egen state styrer .panning-klassen
  const [panActive, setPanActive] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [dragLine, setDragLine] = useState(null); // live connection line while dragging

  // ── Pan (middle mouse or space+drag) ──
  const onMouseDown = useCallback((e) => {
    if (e.button === 1 || (e.button === 0 && e.target === canvasRef.current)) {
      if (connectingFrom) return;
      isPanning.current = true;
      setPanActive(true);
      lastMouse.current = { x: e.clientX, y: e.clientY };
      setSelectedNodeId(null);
      setSelectedConnectionId(null);
    }
  }, [connectingFrom]);

  const onMouseMove = useCallback((e) => {
    if (isPanning.current) {
      const dx = e.clientX - lastMouse.current.x;
      const dy = e.clientY - lastMouse.current.y;
      lastMouse.current = { x: e.clientX, y: e.clientY };
      setPan((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
    }
    if (connectingFrom && dragLine) {
      const rect = canvasRef.current.getBoundingClientRect();
      const mx = (e.clientX - rect.left - pan.x) / zoom;
      const my = (e.clientY - rect.top - pan.y) / zoom;
      setDragLine((dl) => dl ? { ...dl, toX: mx, toY: my } : null);
    }
  }, [connectingFrom, dragLine, pan, zoom]);

  // Slippes museknappen utenfor lerretet (over toolbaren, eller utenfor
  // vinduet) nådde mouseup aldri canvas-diven, og kartet ble hengende
  // fast på cursoren. Derfor lyttes det på window.
  useEffect(() => {
    const endPan = () => {
      isPanning.current = false;
      setPanActive(false);
    };
    window.addEventListener("mouseup", endPan);
    window.addEventListener("blur", endPan);
    return () => {
      window.removeEventListener("mouseup", endPan);
      window.removeEventListener("blur", endPan);
    };
  }, []);

  // ── Zoom rundt et ankerpunkt ──
  const zoomAt = useCallback((factor, cx, cy) => {
    const { zoom: prevZoom, pan: prevPan } = useGigaStore.getState();
    const newZoom = Math.min(3, Math.max(0.1, prevZoom * factor));
    const scale = newZoom / prevZoom;
    setZoom(newZoom);
    setPan({
      x: cx - scale * (cx - prevPan.x),
      y: cy - scale * (cy - prevPan.y),
    });
  }, [setZoom, setPan]);

  const onWheel = useCallback((e) => {
    e.preventDefault();
    const rect = canvasRef.current.getBoundingClientRect();
    zoomAt(
      e.deltaY > 0 ? 1 / WHEEL_ZOOM_STEP : WHEEL_ZOOM_STEP,
      e.clientX - rect.left,
      e.clientY - rect.top
    );
  }, [zoomAt]);

  // Zoom-knappene ankret rundt verdens origo, så innhold som lå langt
  // unna fløy av skjermen. Ankres nå i midten av lerretet.
  const zoomButton = useCallback((factor) => {
    const el = canvasRef.current;
    if (!el) return;
    zoomAt(factor, el.clientWidth / 2, el.clientHeight / 2);
  }, [zoomAt]);

  const handleFit = useCallback(() => {
    const el = canvasRef.current;
    if (el) fitToScreen({ width: el.clientWidth, height: el.clientHeight });
  }, [fitToScreen]);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [onWheel]);

  // ── Double click: add node (disabled for viewers) ──
  const onDoubleClick = useCallback((e) => {
    if (isViewer) return;
    if (e.target !== canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left - pan.x) / zoom;
    const y = (e.clientY - rect.top - pan.y) / zoom;
    addNode({
      x, y, w: 220, h: 110,
      title: "Ny node",
      notes: "",
      color: "#e8edf5",
      type: "Generell",
    });
  }, [pan, zoom, addNode, isViewer]);

  // ── Right click: context menu (disabled for viewers) ──
  const onContextMenu = useCallback((e) => {
    e.preventDefault();
    if (isViewer) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left - pan.x) / zoom;
    const y = (e.clientY - rect.top - pan.y) / zoom;
    setContextMenu({ screenX: e.clientX, screenY: e.clientY, canvasX: x, canvasY: y });
  }, [pan, zoom, isViewer]);

  // ── Connecting nodes ──
  const startConnecting = useCallback((nodeId, startX, startY) => {
    setConnectingFrom(nodeId);
    setDragLine({ fromX: startX, fromY: startY, toX: startX, toY: startY });
  }, []);

  const finishConnecting = useCallback(async (toNodeId) => {
    if (connectingFrom && toNodeId && connectingFrom !== toNodeId) {
      // Check duplicate
      const exists = connections.some(
        (c) => (c.fromNode === connectingFrom && c.toNode === toNodeId) ||
                (c.fromNode === toNodeId && c.toNode === connectingFrom)
      );
      if (!exists) {
        await addConnection({
          fromNode: connectingFrom,
          toNode: toNodeId,
          label: "",
          color: "",
          bidirectional: false,
        });
      }
    }
    setConnectingFrom(null);
    setDragLine(null);
  }, [connectingFrom, connections, addConnection]);

  const cancelConnecting = useCallback(() => {
    setConnectingFrom(null);
    setDragLine(null);
  }, []);

  // ESC to cancel connecting / deselect
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape") {
        cancelConnecting();
        setSelectedNodeId(null);
        setSelectedConnectionId(null);
        setContextMenu(null);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [cancelConnecting]);

  const canvasClass = [
    "canvas-area",
    panActive ? "panning" : "",
    connectingFrom ? "connecting" : "",
  ].filter(Boolean).join(" ");

  return (
    <div className="app-layout">
      <Toolbar onFitToScreen={handleFit} />

      <div
        ref={canvasRef}
        className={canvasClass}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onDoubleClick={onDoubleClick}
        onContextMenu={onContextMenu}
        onClick={() => { setContextMenu(null); if (connectingFrom) cancelConnecting(); }}
        onDragOver={(e) => { if (!isViewer) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; } }}
        onDrop={(e) => {
          if (isViewer) return;
          e.preventDefault();
          const ideaId = e.dataTransfer.getData("text/plain");
          if (!ideaId || !canvasRef.current) return;
          const rect = canvasRef.current.getBoundingClientRect();
          const x = (e.clientX - rect.left - pan.x) / zoom - 110;
          const y = (e.clientY - rect.top - pan.y) / zoom - 55;
          promoteIdea(ideaId, x, y);
        }}
      >
        <div
          className="canvas-transform"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
        >
          {/* SVG layer for connections */}
          <Connections
            nodes={visibleNodes}
            connections={visibleConnections}
            dragLine={dragLine}
            zoom={zoom}
            readOnly={isViewer}
          />

          {/* Nodes */}
          {visibleNodes.map((node) => (
            <GigaNode
              key={node.id}
              node={node}
              isSelected={selectedNodeId === node.id}
              isConnecting={!!connectingFrom}
              isConnectingFrom={connectingFrom === node.id}
              onSelect={() => { setSelectedNodeId(node.id); setSelectedConnectionId(null); }}
              onOpen={() => setOpenModalNodeId(node.id)}
              onStartConnect={startConnecting}
              onFinishConnect={finishConnecting}
              onEnterPage={enterPage}
              childCount={childCounts[node.id] || 0}
              zoom={zoom}
              readOnly={isViewer}
            />
          ))}
        </div>

        {/* Zoom controls */}
        <div className="zoom-controls">
          <button className="btn btn-ghost btn-icon" onClick={() => zoomButton(1 / BUTTON_ZOOM_STEP)}>−</button>
          <span className="zoom-label">{Math.round(zoom * 100)}%</span>
          <button className="btn btn-ghost btn-icon" onClick={() => zoomButton(BUTTON_ZOOM_STEP)}>+</button>
          <button className="btn btn-ghost btn-icon" title="Tilpass skjerm" onClick={handleFit}>⊡</button>
        </div>

        {/* Mini map — viser nivået man står i */}
        <MiniMap nodes={visibleNodes} pan={pan} zoom={zoom} canvasRef={canvasRef} />

        {/* Idea brainstorm panel — hidden for viewers */}
        {!isViewer && <IdeaPanel />}

        {/* Live chat panel (left side) */}
        <PresenceChat />

        {/* Read-only banner for viewers */}
        {isViewer && (
          <div className="readonly-banner">
            👁 Kun lesetilgang
          </div>
        )}

        {/* Hint */}
        {visibleNodes.length === 0 && (
          <div style={{
            position: "absolute", top: "50%", left: "50%",
            transform: "translate(-50%,-50%)",
            textAlign: "center", pointerEvents: "none",
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>{pageId ? "📄" : "🗺"}</div>
            <div style={{ color: "var(--text-secondary)", fontSize: 16, fontFamily: "Outfit" }}>
              {pageId
                ? "Tomt underkart – dobbeltklikk for å legge til en node"
                : "Dobbeltklikk for å legge til en node"}
            </div>
            <div style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 8 }}>
              Dra for å flytte canvas · Scroll for å zoome
            </div>
          </div>
        )}
      </div>

      {/* Node detail modal */}
      {openModalNodeId && (
        <NodeModal
          nodeId={openModalNodeId}
          onClose={() => setOpenModalNodeId(null)}
          readOnly={isViewer}
        />
      )}

      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.screenX}
          y={contextMenu.screenY}
          canvasX={contextMenu.canvasX}
          canvasY={contextMenu.canvasY}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}

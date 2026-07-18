import { useState, useRef, useEffect, useCallback } from "react";
import { useShallow } from "zustand/react/shallow";
import useGigaStore from "../store/useGigaStore";
import Toolbar from "../components/Toolbar";
import GigaNode from "../components/GigaNode";
import Connections from "../components/Connections";
import MiniMap from "../components/MiniMap";
import NodeModal from "../components/NodeModal";
import ContextMenu from "../components/ContextMenu";
import IdeaPanel from "../components/IdeaPanel";

export default function MapEditor() {
  const {
    nodes, connections, zoom, setZoom, pan, setPan,
    selectedNodeId, setSelectedNodeId,
    setSelectedConnectionId,
    connectingFrom, setConnectingFrom,
    openModalNodeId, setOpenModalNodeId,
    addNode, addConnection, promoteIdea, fitToScreen,
  } = useGigaStore(
    useShallow((s) => ({
      nodes: s.nodes,
      connections: s.connections,
      zoom: s.zoom,
      setZoom: s.setZoom,
      pan: s.pan,
      setPan: s.setPan,
      selectedNodeId: s.selectedNodeId,
      setSelectedNodeId: s.setSelectedNodeId,
      setSelectedConnectionId: s.setSelectedConnectionId,
      connectingFrom: s.connectingFrom,
      setConnectingFrom: s.setConnectingFrom,
      openModalNodeId: s.openModalNodeId,
      setOpenModalNodeId: s.setOpenModalNodeId,
      addNode: s.addNode,
      addConnection: s.addConnection,
      promoteIdea: s.promoteIdea,
      fitToScreen: s.fitToScreen,
    }))
  );

  const canvasRef = useRef(null);
  const isPanning = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  // Refs kan ikke leses under render — egen state styrer .panning-klassen
  const [panActive, setPanActive] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [dragLine, setDragLine] = useState(null); // live connection line while dragging

  // ── Pan (middle mouse or drag on empty canvas) ──
  const onMouseDown = useCallback((e) => {
    if (e.button === 1 || (e.button === 0 && e.target === canvasRef.current)) {
      if (connectingFrom) return;
      isPanning.current = true;
      setPanActive(true);
      lastMouse.current = { x: e.clientX, y: e.clientY };
      setSelectedNodeId(null);
      setSelectedConnectionId(null);
    }
  }, [connectingFrom, setSelectedNodeId, setSelectedConnectionId]);

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
      setDragLine((dl) => (dl ? { ...dl, toX: mx, toY: my } : null));
    }
  }, [connectingFrom, dragLine, pan, zoom, setPan]);

  // Slipp av museknappen utenfor canvaset (toolbar, utenfor vinduet) skal
  // også avslutte panorering — ellers henger kartet fast på cursoren.
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

  // ── Zoom rundt et ankerpunkt (cursor for scroll, viewport-senter for knapper) ──
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
    zoomAt(e.deltaY > 0 ? 0.9 : 1.1, e.clientX - rect.left, e.clientY - rect.top);
  }, [zoomAt]);

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

  // ── Double click: add node ──
  const onDoubleClick = useCallback((e) => {
    if (e.target !== canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left - pan.x) / zoom;
    const y = (e.clientY - rect.top - pan.y) / zoom;
    addNode({
      x, y, w: 220, h: 110,
      title: "Ny node",
      notes: "",
      color: "",
      type: "Generell",
    });
  }, [pan, zoom, addNode]);

  // ── Right click: context menu ──
  const onContextMenu = useCallback((e) => {
    e.preventDefault();
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left - pan.x) / zoom;
    const y = (e.clientY - rect.top - pan.y) / zoom;
    setContextMenu({ screenX: e.clientX, screenY: e.clientY, canvasX: x, canvasY: y });
  }, [pan, zoom]);

  // ── Connecting nodes ──
  const startConnecting = useCallback((nodeId, startX, startY) => {
    setConnectingFrom(nodeId);
    setDragLine({ fromX: startX, fromY: startY, toX: startX, toY: startY });
  }, [setConnectingFrom]);

  const finishConnecting = useCallback(async (toNodeId) => {
    try {
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
    } finally {
      setConnectingFrom(null);
      setDragLine(null);
    }
  }, [connectingFrom, connections, addConnection, setConnectingFrom]);

  const cancelConnecting = useCallback(() => {
    setConnectingFrom(null);
    setDragLine(null);
  }, [setConnectingFrom]);

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
  }, [cancelConnecting, setSelectedNodeId, setSelectedConnectionId]);

  // Stabile callbacks slik at memoiserte GigaNode-er ikke re-rendres av pan/zoom
  const handleSelectNode = useCallback((id) => {
    setSelectedNodeId(id);
    setSelectedConnectionId(null);
  }, [setSelectedNodeId, setSelectedConnectionId]);

  const handleOpenNode = useCallback((id) => {
    setOpenModalNodeId(id);
  }, [setOpenModalNodeId]);

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
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
        onDrop={(e) => {
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
            nodes={nodes}
            connections={connections}
            dragLine={dragLine}
          />

          {/* Nodes */}
          {nodes.map((node) => (
            <GigaNode
              key={node.id}
              node={node}
              isSelected={selectedNodeId === node.id}
              isConnecting={!!connectingFrom}
              isConnectingFrom={connectingFrom === node.id}
              onSelect={handleSelectNode}
              onOpen={handleOpenNode}
              onStartConnect={startConnecting}
              onFinishConnect={finishConnecting}
            />
          ))}
        </div>

        {/* Zoom controls */}
        <div className="zoom-controls">
          <button className="btn btn-ghost btn-icon" onClick={() => zoomButton(1 / 1.2)}>−</button>
          <span className="zoom-label">{Math.round(zoom * 100)}%</span>
          <button className="btn btn-ghost btn-icon" onClick={() => zoomButton(1.2)}>+</button>
          <button className="btn btn-ghost btn-icon" title="Tilpass skjerm" onClick={handleFit}>⊡</button>
        </div>

        {/* Mini map */}
        <MiniMap nodes={nodes} pan={pan} zoom={zoom} canvasRef={canvasRef} />

        {/* Idea brainstorm panel */}
        <IdeaPanel />

        {/* Hint */}
        {nodes.length === 0 && (
          <div style={{
            position: "absolute", top: "50%", left: "50%",
            transform: "translate(-50%,-50%)",
            textAlign: "center", pointerEvents: "none",
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🗺</div>
            <div style={{ color: "var(--text-secondary)", fontSize: 16, fontFamily: "Outfit" }}>
              Dobbeltklikk for å legge til en node
            </div>
            <div style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 8 }}>
              Dra for å flytte canvas · Scroll for å zoome
            </div>
          </div>
        )}
      </div>

      {/* Node detail modal — key sikrer full remount (og kladd-flush) per node */}
      {openModalNodeId && (
        <NodeModal
          key={openModalNodeId}
          nodeId={openModalNodeId}
          onClose={() => setOpenModalNodeId(null)}
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

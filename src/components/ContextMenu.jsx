import { useRef, useState, useLayoutEffect } from "react";
import useGigaStore from "../store/useGigaStore";

export default function ContextMenu({ x, y, canvasX, canvasY, onClose }) {
  const addNode = useGigaStore((s) => s.addNode);
  const selectedNodeId = useGigaStore((s) => s.selectedNodeId);
  const deleteNode = useGigaStore((s) => s.deleteNode);
  const selectedConnectionId = useGigaStore((s) => s.selectedConnectionId);
  const deleteConnection = useGigaStore((s) => s.deleteConnection);
  const setOpenModalNodeId = useGigaStore((s) => s.setOpenModalNodeId);

  const menuRef = useRef(null);
  const [pos, setPos] = useState({ x, y });

  // Klem menyen innenfor viewporten — høyreklikk nær kanten skal ikke
  // gi en meny man ikke kan se eller klikke.
  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPos({
      x: Math.max(8, Math.min(x, window.innerWidth - rect.width - 8)),
      y: Math.max(8, Math.min(y, window.innerHeight - rect.height - 8)),
    });
  }, [x, y]);

  const items = [
    {
      label: "➕ Legg til node her",
      action: () => {
        addNode({ x: canvasX - 110, y: canvasY - 55, w: 220, h: 110, title: "Ny node", notes: "", color: "", type: "Generell" });
      },
    },
    selectedNodeId && { label: "↗ Åpne node", action: () => setOpenModalNodeId(selectedNodeId) },
    selectedNodeId && { label: "🗑 Slett node", action: () => deleteNode(selectedNodeId), danger: true },
    selectedConnectionId && { label: "🗑 Slett kobling", action: () => deleteConnection(selectedConnectionId), danger: true },
  ].filter(Boolean);

  return (
    <div
      ref={menuRef}
      className="context-menu"
      style={{ left: pos.x, top: pos.y }}
      onClick={(e) => e.stopPropagation()}
    >
      {items.map((item, i) => (
        <button
          key={i}
          className={`context-item${item.danger ? " danger" : ""}`}
          onClick={() => { item.action(); onClose(); }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

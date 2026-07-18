import { useRef, useState, useLayoutEffect } from "react";
import useGigaStore from "../store/useGigaStore";

export default function ContextMenu({ x, y, canvasX, canvasY, onClose }) {
  const {
    addNode, selectedNodeId, deleteNode, selectedConnectionId, deleteConnection,
    setOpenModalNodeId, nodes, makePage, enterPage, descendantCount,
  } = useGigaStore();

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  // Klem menyen innenfor viewporten — høyreklikk nær høyre/nedre kant
  // ga ellers en meny man verken kunne se eller klikke
  const menuRef = useRef(null);
  const [pos, setPos] = useState({ x, y });
  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPos({
      x: Math.max(8, Math.min(x, window.innerWidth - rect.width - 8)),
      y: Math.max(8, Math.min(y, window.innerHeight - rect.height - 8)),
    });
  }, [x, y]);

  // Sletting tar hele underkartet under noden — advar først
  const confirmDelete = () => {
    const count = descendantCount(selectedNodeId);
    if (count > 0) {
      const ord = count === 1 ? "element" : "elementer";
      const ok = window.confirm(
        `"${selectedNode?.title || "Noden"}" har et underkart med ${count} ${ord}.\n\nSletter du noden, slettes alt innholdet under den også. Fortsette?`
      );
      if (!ok) return;
    }
    deleteNode(selectedNodeId);
  };

  const items = [
    {
      label: "➕ Legg til node her",
      action: () => {
        addNode({ x: canvasX - 110, y: canvasY - 55, w: 220, h: 110, title: "Ny node", notes: "", color: "#e8edf5", type: "Generell" });
      },
    },
    {
      // Oppretter en node som allerede er et underkart, klar til å gå inn i
      label: "⬚ Nytt underkart her",
      action: () => {
        addNode({
          x: canvasX - 130, y: canvasY - 55, w: 260, h: 110,
          title: "Nytt underkart", notes: "", color: "#e8edf5",
          type: "Generell", isPage: true,
        });
      },
    },
    selectedNodeId && { label: "↗ Åpne node", action: () => setOpenModalNodeId(selectedNodeId) },
    selectedNode?.isPage
      ? { label: "⬚ Gå inn i underkartet", action: () => enterPage(selectedNodeId) }
      : selectedNodeId && { label: "⬚ Gjør om til underkart", action: () => makePage(selectedNodeId) },
    selectedNodeId && { label: "🗑 Slett node", action: confirmDelete, danger: true },
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

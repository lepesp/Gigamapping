import useGigaStore from "../store/useGigaStore";

export default function ContextMenu({ x, y, canvasX, canvasY, onClose }) {
  const { addNode, selectedNodeId, deleteNode, selectedConnectionId, deleteConnection, setOpenModalNodeId } = useGigaStore();

  const items = [
    {
      label: "➕ Legg til node her",
      action: () => {
        addNode({ x: canvasX - 110, y: canvasY - 55, w: 220, h: 110, title: "Ny node", notes: "", color: "#e8edf5", type: "Generell" });
      },
    },
    selectedNodeId && { label: "↗ Åpne node", action: () => setOpenModalNodeId(selectedNodeId) },
    selectedNodeId && { label: "🗑 Slett node", action: () => deleteNode(selectedNodeId), danger: true },
    selectedConnectionId && { label: "🗑 Slett kobling", action: () => deleteConnection(selectedConnectionId), danger: true },
  ].filter(Boolean);

  return (
    <div
      className="context-menu"
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
    >
      {items.map((item, i) =>
        item === "sep" ? (
          <div key={i} className="context-sep" />
        ) : (
          <button
            key={i}
            className={`context-item${item.danger ? " danger" : ""}`}
            onClick={() => { item.action(); onClose(); }}
          >
            {item.label}
          </button>
        )
      )}
    </div>
  );
}

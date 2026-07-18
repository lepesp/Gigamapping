import useGigaStore from "../store/useGigaStore";
import { getSwatches } from "../themes";
import { NODE_TYPES, TYPE_COLORS, TYPE_ICONS } from "../nodeTypes";
import { DraftInput, DraftTextarea } from "./DraftText";

const CONN_COLORS = ["#6366f1", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#f472b6", "#94a3b8"];

export default function NodeModal({ nodeId, onClose }) {
  const node = useGigaStore((s) => s.nodes.find((n) => n.id === nodeId));
  const nodes = useGigaStore((s) => s.nodes);
  const connections = useGigaStore((s) => s.connections);
  const mapId = useGigaStore((s) => s.currentMapId);
  const updateNode = useGigaStore((s) => s.updateNode);
  const deleteNode = useGigaStore((s) => s.deleteNode);
  const updateConnection = useGigaStore((s) => s.updateConnection);

  const nodeConns = connections.filter((c) => c.fromNode === nodeId || c.toNode === nodeId);

  if (!node) return null;

  // Eksplisitt mapId: kladd som flushes idet modalen lukkes/kartet byttes
  // skal lagres i kartet den ble skrevet i
  const update = (field, val) => updateNode(nodeId, { [field]: val }, mapId);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal glass-card" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="modal-header">
          <span style={{ fontSize: 22 }}>
            {TYPE_ICONS[node.type] || TYPE_ICONS.Generell}
          </span>
          <DraftInput
            className="modal-title-input"
            value={node.title}
            onCommit={(v) => update("title", v)}
            placeholder="Tittel..."
          />
          <button className="btn btn-ghost btn-icon" onClick={onClose} title="Lukk">✕</button>
        </div>

        <div className="modal-body">

          {/* Notes */}
          <div className="modal-section">
            <label>📝 Notater</label>
            <DraftTextarea
              value={node.notes || ""}
              onCommit={(v) => update("notes", v)}
              placeholder="Beskriv denne noden – hva skjer her, hvem er ansvarlig, hvilke systemer er involvert..."
              style={{ minHeight: 120 }}
            />
          </div>

          {/* Type */}
          <div className="modal-section">
            <label>🏷 Type</label>
            <div className="type-pills">
              {NODE_TYPES.map((t) => (
                <button
                  key={t}
                  className={`type-pill${node.type === t ? " active" : ""}`}
                  onClick={() => update("type", t)}
                  style={node.type === t
                    ? {
                        background: TYPE_COLORS[t] || "var(--accent)",
                        borderColor: TYPE_COLORS[t] || "var(--accent)",
                      }
                    : {}}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Color */}
          <div className="modal-section">
            <label>🎨 Bakgrunnsfarge</label>
            <div className="color-swatches">
              {getSwatches().map((c) => (
                <div
                  key={c}
                  className={`color-swatch${node.color === c ? " active" : ""}`}
                  style={{ background: c }}
                  onClick={() => update("color", c)}
                />
              ))}
            </div>
          </div>

          {/* Connections list */}
          {nodeConns.length > 0 && (
            <div className="modal-section">
              <label>🔗 Koblinger ({nodeConns.length})</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {nodeConns.map((conn) => {
                  const other = nodes.find((n) => n.id === (conn.fromNode === nodeId ? conn.toNode : conn.fromNode));
                  return (
                    <div key={conn.id} style={{
                      display: "flex", alignItems: "center", gap: 10,
                      background: "rgba(0,0,0,0.03)", borderRadius: 10, padding: "8px 12px",
                    }}>
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        {conn.fromNode === nodeId ? "→" : "←"}
                      </span>
                      <span style={{ flex: 1, fontSize: 13, color: "var(--text-primary)" }}>
                        {other?.title || "Ukjent"}
                      </span>
                      <DraftInput
                        value={conn.label || ""}
                        onCommit={(v) => updateConnection(conn.id, { label: v }, mapId)}
                        placeholder="Label..."
                        style={{ width: 110, fontSize: 12 }}
                      />
                      <div style={{ display: "flex", gap: 4 }}>
                        {CONN_COLORS.map((c) => (
                          <div
                            key={c}
                            onClick={() => updateConnection(conn.id, { color: c }, mapId)}
                            style={{
                              width: 14, height: 14, borderRadius: "50%", background: c,
                              cursor: "pointer", border: conn.color === c ? "2px solid #1e293b" : "2px solid transparent",
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button
            className="btn btn-danger"
            onClick={() => { deleteNode(nodeId); onClose(); }}
          >
            🗑 Slett node
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-ghost" onClick={onClose}>Lukk</button>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect, useRef } from "react";
import useGigaStore from "../store/useGigaStore";
import { getSwatches } from "../themes";

const TYPE_COLORS = {
  Avdeling: "#7c3aed", System: "#0284c7", Prosess: "#059669",
  Person: "#d97706", Mål: "#dc2626", Problem: "#b45309", Idé: "#6366f1", Generell: "#1e3a5f",
};

const NODE_TYPES = Object.keys(TYPE_COLORS);

const CONN_COLORS = ["#6366f1", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#f472b6", "#94a3b8"];

export default function NodeModal({ nodeId, onClose }) {
  const { nodes, connections, updateNode, deleteNode, updateConnection } = useGigaStore();
  const node = nodes.find((n) => n.id === nodeId);
  const nodeConns = connections.filter((c) => c.fromNode === nodeId || c.toNode === nodeId);

  // Local editing state to prevent cursor jumping from Firestore snapshots
  const [localTitle, setLocalTitle] = useState(node?.title || "");
  const [localNotes, setLocalNotes] = useState(node?.notes || "");
  const titleRef = useRef(null);
  const notesRef = useRef(null);

  // Track whether inputs are focused
  const titleFocused = useRef(false);
  const notesFocused = useRef(false);

  // Sync from Firestore only when not actively editing
  useEffect(() => {
    if (node && !titleFocused.current) {
      setLocalTitle(node.title || "");
    }
  }, [node?.title]);

  useEffect(() => {
    if (node && !notesFocused.current) {
      setLocalNotes(node.notes || "");
    }
  }, [node?.notes]);

  if (!node) return null;

  const update = (field, val) => updateNode(nodeId, { [field]: val });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal glass-card" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="modal-header">
          <span style={{ fontSize: 22 }}>
            {node.type === "Avdeling" ? "🏢" : node.type === "System" ? "⚙️" :
             node.type === "Prosess" ? "🔄" : node.type === "Person" ? "👤" :
             node.type === "Mål" ? "🎯" : node.type === "Problem" ? "⚠️" :
             node.type === "Idé" ? "💡" : "📌"}
          </span>
          <input
            ref={titleRef}
            className="modal-title-input"
            value={localTitle}
            onChange={(e) => setLocalTitle(e.target.value)}
            onFocus={() => { titleFocused.current = true; }}
            onBlur={() => { titleFocused.current = false; update("title", localTitle); }}
            onKeyDown={(e) => { if (e.key === "Enter") { titleRef.current?.blur(); } }}
            placeholder="Tittel..."
          />
          <button className="btn btn-ghost btn-icon" onClick={onClose} title="Lukk">✕</button>
        </div>

        <div className="modal-body">

          {/* Notes */}
          <div className="modal-section">
            <label>📝 Notater</label>
            <textarea
              ref={notesRef}
              value={localNotes}
              onChange={(e) => setLocalNotes(e.target.value)}
              onFocus={() => { notesFocused.current = true; }}
              onBlur={() => { notesFocused.current = false; update("notes", localNotes); }}
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
                  style={node.type === t ? { background: TYPE_COLORS[t], borderColor: TYPE_COLORS[t] } : {}}
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
                      <input
                        value={conn.label || ""}
                        onChange={(e) => updateConnection(conn.id, { label: e.target.value })}
                        placeholder="Label..."
                        style={{ width: 110, fontSize: 12 }}
                      />
                      <div style={{ display: "flex", gap: 4 }}>
                        {CONN_COLORS.map((c) => (
                          <div
                            key={c}
                            onClick={() => updateConnection(conn.id, { color: c })}
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

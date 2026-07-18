import { useState, useEffect, useRef } from "react";
import useGigaStore from "../store/useGigaStore";
import { getSwatches } from "../themes";
import { NODE_TYPES, TYPE_COLORS, TYPE_ICONS } from "../nodeTypes";

const CONN_COLORS = ["#6366f1", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#f472b6", "#94a3b8"];

export default function NodeModal({ nodeId, onClose, readOnly = false }) {
  const {
    nodes, connections, updateNode, deleteNode, updateConnection,
    makePage, unmakePage, enterPage, descendantCount,
  } = useGigaStore();
  const node = nodes.find((n) => n.id === nodeId);
  const nodeConns = connections.filter((c) => c.fromNode === nodeId || c.toNode === nodeId);
  // Antall elementer rett under noden (nivået inne i underkartet)
  const childCount = nodes.filter((n) => (n.parentId ?? null) === nodeId).length;

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
            {TYPE_ICONS[node.type] || TYPE_ICONS.Generell}
          </span>
          {readOnly ? (
            <span className="modal-title-input" style={{ flex: 1, fontSize: 18, fontWeight: 600 }}>
              {node.title || "Uten tittel"}
            </span>
          ) : (
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
          )}
          <button className="btn btn-ghost btn-icon" onClick={onClose} title="Lukk">✕</button>
        </div>

        <div className="modal-body">

          {/* Notes */}
          <div className="modal-section">
            <label>📝 Notater</label>
            {readOnly ? (
              <div style={{ fontSize: 13, color: "var(--text-secondary)", whiteSpace: "pre-wrap", minHeight: 40 }}>
                {node.notes || <span style={{ opacity: 0.4 }}>Ingen notater</span>}
              </div>
            ) : (
              <textarea
                ref={notesRef}
                value={localNotes}
                onChange={(e) => setLocalNotes(e.target.value)}
                onFocus={() => { notesFocused.current = true; }}
                onBlur={() => { notesFocused.current = false; update("notes", localNotes); }}
                placeholder="Beskriv denne noden – hva skjer her, hvem er ansvarlig, hvilke systemer er involvert..."
                style={{ minHeight: 120 }}
              />
            )}
          </div>

          {/* Underkart */}
          <div className="modal-section">
            <label>⬚ Underkart</label>
            {node.isPage ? (
              <div className="page-box">
                <div className="page-box-text">
                  {childCount > 0
                    ? `Denne noden har et underkart med ${childCount} ${childCount === 1 ? "element" : "elementer"}.`
                    : "Denne noden er et underkart, men er tomt ennå."}
                </div>
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  <button
                    className="btn btn-primary"
                    onClick={() => { enterPage(nodeId); onClose(); }}
                  >
                    Gå inn ↘
                  </button>
                  {!readOnly && childCount === 0 && (
                    <button
                      className="btn btn-ghost"
                      onClick={() => unmakePage(nodeId)}
                      title="Gjør om til en vanlig node igjen"
                    >
                      Angre
                    </button>
                  )}
                </div>
              </div>
            ) : readOnly ? (
              <div className="page-box">
                <div className="page-box-text">Denne noden har ikke noe underkart.</div>
              </div>
            ) : (
              <div className="page-box">
                <div className="page-box-text">
                  Gjør noden om til et underkart hvis den rommer en hel prosess
                  som fortjener sitt eget lerret.
                </div>
                <button
                  className="btn btn-ghost"
                  style={{ flexShrink: 0 }}
                  onClick={() => makePage(nodeId)}
                >
                  Gjør om til underkart
                </button>
              </div>
            )}
          </div>

          {/* Type */}
          {!readOnly && (
            <div className="modal-section">
              <label>🏷 Type</label>
              <div className="type-pills">
                {NODE_TYPES.map((t) => (
                  <button
                    key={t}
                    className={`type-pill${node.type === t ? " active" : ""}`}
                    onClick={() => update("type", t)}
                    style={node.type === t ? { background: TYPE_COLORS[t] || "var(--accent)", borderColor: TYPE_COLORS[t] || "var(--accent)" } : {}}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Color */}
          {!readOnly && (
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
          )}

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
                      {!readOnly ? (
                        <input
                          value={conn.label || ""}
                          onChange={(e) => updateConnection(conn.id, { label: e.target.value })}
                          placeholder="Label..."
                          style={{ width: 110, fontSize: 12 }}
                        />
                      ) : conn.label ? (
                        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{conn.label}</span>
                      ) : null}
                      {!readOnly && (
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
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer">
          {!readOnly && (
            <button
              className="btn btn-danger"
              onClick={() => {
                // Sletting tar hele underkartet under noden — advar først
                const count = descendantCount(nodeId);
                if (count > 0) {
                  const ord = count === 1 ? "element" : "elementer";
                  const ok = window.confirm(
                    `"${node.title || "Noden"}" har et underkart med ${count} ${ord}.\n\nSletter du noden, slettes alt innholdet under den også. Fortsette?`
                  );
                  if (!ok) return;
                }
                deleteNode(nodeId);
                onClose();
              }}
            >
              🗑 Slett node
            </button>
          )}
          <div style={{ display: "flex", gap: 8, marginLeft: readOnly ? "auto" : 0 }}>
            <button className="btn btn-ghost" onClick={onClose}>Lukk</button>
          </div>
        </div>
      </div>
    </div>
  );
}

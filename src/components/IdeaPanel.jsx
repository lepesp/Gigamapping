import { useState, useRef } from "react";
import useGigaStore from "../store/useGigaStore";

export default function IdeaPanel({ pan, zoom, canvasRef }) {
  const { ideas, addIdea, deleteIdea, promoteIdea } = useGigaStore();
  const [input, setInput] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const [draggingId, setDraggingId] = useState(null);
  const inputRef = useRef(null);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && input.trim()) {
      addIdea(input);
      setInput("");
    }
  };

  // Drag to canvas – on drop, promote idea to a full node
  const handleDragStart = (e, idea) => {
    setDraggingId(idea.id);
    e.dataTransfer.setData("text/plain", idea.id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnd = (e) => {
    setDraggingId(null);
  };

  // This is called from MapEditor's onDrop
  // But we also handle direct drop on canvas via the store's promoteIdea

  return (
    <div
      className="idea-panel"
      style={{
        position: "absolute",
        top: 20,
        right: 20,
        bottom: 170,
        width: 220,
        display: collapsed ? "block" : "flex",
        flexDirection: "column",
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: 14,
        boxShadow: "var(--shadow)",
        zIndex: 50,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "10px 14px 8px",
          borderBottom: collapsed ? "none" : "1px solid var(--border)",
          cursor: "pointer",
          flexShrink: 0,
        }}
        onClick={() => setCollapsed(!collapsed)}
      >
        <span style={{
          fontSize: 10, fontWeight: 700, textTransform: "uppercase",
          letterSpacing: "1px", color: "var(--text-muted)",
        }}>
          💡 Ideer {ideas.length > 0 && <span style={{ color: "var(--accent)" }}>({ideas.length})</span>}
        </span>
        <span style={{ fontSize: 12, color: "var(--text-muted)", transform: collapsed ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
          ▼
        </span>
      </div>

      {!collapsed && (
        <>
          {/* Input */}
          <div style={{ padding: "8px 10px", flexShrink: 0 }}>
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Skriv idé + Enter..."
              style={{
                width: "100%", fontSize: 12, padding: "7px 10px",
                borderRadius: 8, border: "1px solid var(--border)",
                background: "var(--bg-card-hover)", color: "var(--text-primary)",
                outline: "none", fontFamily: "Inter, sans-serif",
              }}
            />
          </div>

          {/* Ideas list */}
          <div style={{
            flex: 1, overflowY: "auto", padding: "0 10px 10px",
            display: "flex", flexWrap: "wrap", gap: 6,
            alignContent: "flex-start",
          }}>
            {ideas.map((idea) => (
              <div
                key={idea.id}
                draggable
                onDragStart={(e) => handleDragStart(e, idea)}
                onDragEnd={handleDragEnd}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  padding: "4px 10px", borderRadius: 20,
                  background: draggingId === idea.id ? "var(--accent-glow)" : "var(--bg-card-hover)",
                  border: `1px solid ${draggingId === idea.id ? "var(--accent)" : "var(--border)"}`,
                  fontSize: 12, color: "var(--text-primary)",
                  cursor: "grab", userSelect: "none",
                  transition: "all 0.15s",
                  maxWidth: "100%",
                }}
                title="Dra til kartet for å lage node"
              >
                <span style={{
                  overflow: "hidden", textOverflow: "ellipsis",
                  whiteSpace: "nowrap", maxWidth: 150,
                }}>
                  {idea.text}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteIdea(idea.id); }}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    fontSize: 10, color: "var(--text-muted)", padding: "0 2px",
                    lineHeight: 1, flexShrink: 0,
                  }}
                  title="Slett idé"
                >
                  ✕
                </button>
              </div>
            ))}

            {ideas.length === 0 && (
              <div style={{
                fontSize: 11, color: "var(--text-muted)",
                textAlign: "center", width: "100%",
                padding: "16px 4px", lineHeight: 1.6,
              }}>
                Skriv ideer og trykk Enter.<br />
                Dra dem til kartet etterpå.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

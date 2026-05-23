import { useState } from "react";
import useGigaStore from "../store/useGigaStore";

export default function ExportModal({ onClose }) {
  const { nodes, connections, maps, currentMapId } = useGigaStore();
  const currentMap = maps.find((m) => m.id === currentMapId);
  const [tab, setTab] = useState("ai"); // "ai" | "json" | "png"
  const [copied, setCopied] = useState(false);

  // ── AI export: structured text readable by agent ──
  const buildAIExport = () => {
    const lines = [];
    lines.push(`# GIGAMAP: ${currentMap?.title || "Uten tittel"}`);
    lines.push(`Eksportert: ${new Date().toLocaleString("nb-NO")}`);
    lines.push(`Noder: ${nodes.length} | Koblinger: ${connections.length}`);
    lines.push("");
    lines.push("## NODER");
    nodes.forEach((n) => {
      lines.push(`\n### [${n.type || "Generell"}] ${n.title}`);
      lines.push(`ID: ${n.id}`);
      if (n.notes) lines.push(`Notater: ${n.notes}`);
      const conns = connections.filter((c) => c.fromNode === n.id || c.toNode === n.id);
      if (conns.length > 0) {
        lines.push("Koblinger:");
        conns.forEach((c) => {
          const dir = c.fromNode === n.id ? "→" : "←";
          const other = nodes.find((x) => x.id === (c.fromNode === n.id ? c.toNode : c.fromNode));
          lines.push(`  ${dir} ${other?.title || "?"} ${c.label ? `(${c.label})` : ""}`);
        });
      }
    });
    lines.push("\n## KOBLINGER");
    connections.forEach((c) => {
      const from = nodes.find((n) => n.id === c.fromNode);
      const to = nodes.find((n) => n.id === c.toNode);
      lines.push(`${from?.title || "?"} → ${to?.title || "?"} ${c.label ? `[${c.label}]` : ""}`);
    });
    return lines.join("\n");
  };

  const buildJSONExport = () => {
    return JSON.stringify({
      map: { id: currentMapId, title: currentMap?.title },
      nodes: nodes.map(({ id, title, type, notes, color, x, y, w, h }) => ({
        id, title, type, notes, color, x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h),
      })),
      connections: connections.map(({ id, fromNode, toNode, label, color, bidirectional }) => ({
        id, fromNode, toNode, label, color, bidirectional,
      })),
    }, null, 2);
  };

  const content = tab === "ai" ? buildAIExport() : buildJSONExport();

  const copyToClipboard = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadFile = () => {
    const ext = tab === "json" ? "json" : "txt";
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gigamap-${currentMap?.title || "export"}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPNG = () => {
    // Use html2canvas approach via a screenshot hint
    alert("Tips: Bruk Ctrl+Shift+S (Snipping Tool) eller nettleserens skjermbilde for å lagre canvas som bilde.\n\nFull PNG-eksport kommer i neste versjon.");
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal glass-card" style={{ width: 620 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span style={{ fontSize: 20 }}>↑</span>
          <span style={{ fontFamily: "Outfit", fontSize: 18, fontWeight: 700, flex: 1 }}>
            Eksporter kart
          </span>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {/* Tabs */}
          <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
            {[
              { key: "ai", label: "🤖 AI-eksport" },
              { key: "json", label: "{ } JSON" },
              { key: "png", label: "🖼 PNG" },
            ].map((t) => (
              <button
                key={t.key}
                className={`btn ${tab === t.key ? "btn-primary" : "btn-ghost"}`}
                onClick={() => setTab(t.key)}
                style={{ fontSize: 12 }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "png" ? (
            <div style={{ textAlign: "center", padding: "32px 0" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🖼</div>
              <p style={{ color: "var(--text-secondary)", marginBottom: 20 }}>
                Eksporter hele kartet som PNG-bilde
              </p>
              <button className="btn btn-primary" onClick={exportPNG}>
                Last ned PNG
              </button>
            </div>
          ) : (
            <>
              <div className="modal-section">
                <label>
                  {tab === "ai"
                    ? "Strukturert tekst – lim inn direkte til AI-agenten for full forståelse av systemet"
                    : "JSON – for import/backup eller programmering"}
                </label>
                <textarea
                  className="export-textarea"
                  readOnly
                  value={content}
                  style={{ minHeight: 260, fontFamily: "monospace", fontSize: 11 }}
                />
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-primary" onClick={copyToClipboard} style={{ flex: 1 }}>
                  {copied ? "✓ Kopiert!" : "📋 Kopier til utklippstavle"}
                </button>
                <button className="btn btn-ghost" onClick={downloadFile}>
                  ↓ Last ned fil
                </button>
              </div>

              {tab === "ai" && (
                <div style={{
                  background: "rgba(99,102,241,0.08)",
                  border: "1px solid rgba(99,102,241,0.2)",
                  borderRadius: 10, padding: "12px 16px",
                  fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6,
                }}>
                  💡 <strong style={{ color: "var(--text-primary)" }}>Slik bruker du AI-eksporten:</strong>
                  <br />
                  Kopier teksten over og lim den inn i en ny chat med meg (Antigravity). Jeg vil da ha full
                  forståelse av strukturen din og kan hjelpe deg å planlegge og bygge systemet.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

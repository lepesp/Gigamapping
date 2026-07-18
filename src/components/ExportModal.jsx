import { useState } from "react";
import useGigaStore from "../store/useGigaStore";

export default function ExportModal({ onClose }) {
  const { nodes, connections, maps, currentMapId } = useGigaStore();
  const currentMap = maps.find((m) => m.id === currentMapId);
  const [tab, setTab] = useState("ai"); // "ai" | "json" | "png"
  const [copied, setCopied] = useState(false);

  // Brukertekst skal ikke kunne forfalske eksportens egen struktur
  // (###-overskrifter o.l.) eller smugle inn instruksjoner til AI-agenten
  const oneLine = (s) => String(s ?? "").replace(/[\s\u0085\u2028\u2029]+/g, " ").trim();
  const indentBlock = (s, pad) =>
    String(s ?? "")
      .split(/\r\n|[\n\r\u0085\u2028\u2029]/)
      .map((line) => pad + line)
      .join("\n");

  // Noder gruppert på nivå: parentId → noder. null = kartets toppnivå.
  const childrenOf = (parentId) =>
    nodes.filter((n) => (n.parentId ?? null) === (parentId ?? null));

  const pageCount = nodes.filter((n) => n.isPage).length;

  const maxDepth = (() => {
    let deepest = 0;
    const walk = (parentId, depth) => {
      const kids = childrenOf(parentId);
      if (kids.length) deepest = Math.max(deepest, depth);
      kids.forEach((k) => walk(k.id, depth + 1));
    };
    walk(null, 0);
    return deepest;
  })();

  // ── AI export: structured text readable by agent ──
  const buildAIExport = () => {
    const lines = [];
    lines.push(`# GIGAMAP: ${oneLine(currentMap?.title) || "Uten tittel"}`);
    lines.push(`Eksportert: ${new Date().toLocaleString("nb-NO")}`);
    lines.push(
      `Noder: ${nodes.length} | Koblinger: ${connections.length} | Underkart: ${pageCount} | Nivåer: ${maxDepth + 1}`
    );
    lines.push("");
    lines.push(
      "Kartet er hierarkisk: noder merket ⬚ er underkart som inneholder sitt eget lerret."
    );

    // ── Oversikt: hele treet som innrykket disposisjon ──
    lines.push("");
    lines.push("## STRUKTUR");
    const outline = (parentId, depth) => {
      childrenOf(parentId).forEach((n) => {
        const pad = "  ".repeat(depth);
        const kids = childrenOf(n.id).length;
        const marker = n.isPage
          ? ` ⬚ (underkart, ${kids} ${kids === 1 ? "element" : "elementer"})`
          : "";
        lines.push(`${pad}- [${oneLine(n.type) || "Generell"}] ${oneLine(n.title)}${marker}`);
        outline(n.id, depth + 1);
      });
    };
    outline(null, 0);

    // ── Detaljer, ett avsnitt per nivå ──
    const section = (parentId, trailTitles) => {
      const levelNodes = childrenOf(parentId);
      if (levelNodes.length === 0) return;

      const heading = trailTitles.length
        ? `## UNDERKART: ${trailTitles.join(" › ")}`
        : "## TOPPNIVÅ";
      lines.push("");
      lines.push(heading);

      const levelConns = connections.filter(
        (c) => (c.parentId ?? null) === (parentId ?? null)
      );

      levelNodes.forEach((n) => {
        const kids = childrenOf(n.id).length;
        const marker = n.isPage ? " ⬚ UNDERKART" : "";
        lines.push(`\n### [${oneLine(n.type) || "Generell"}] ${oneLine(n.title)}${marker}`);
        lines.push(`ID: ${n.id}`);
        if (n.isPage) {
          lines.push(
            `Underkart: ${kids} ${kids === 1 ? "element" : "elementer"} (se eget avsnitt nedenfor)`
          );
        }
        if (n.notes) {
          lines.push("Notater:");
          lines.push(indentBlock(n.notes, "    "));
        }
        const conns = levelConns.filter((c) => c.fromNode === n.id || c.toNode === n.id);
        if (conns.length > 0) {
          lines.push("Koblinger:");
          conns.forEach((c) => {
            const dir = c.fromNode === n.id ? "→" : "←";
            const other = nodes.find(
              (x) => x.id === (c.fromNode === n.id ? c.toNode : c.fromNode)
            );
            lines.push(
              `  ${dir} ${oneLine(other?.title) || "?"} ${c.label ? `(${oneLine(c.label)})` : ""}`
            );
          });
        }
      });

      // Rekurser ned i hvert underkart på dette nivået
      levelNodes.forEach((n) => {
        if (childrenOf(n.id).length > 0) {
          section(n.id, [...trailTitles, oneLine(n.title) || "Uten tittel"]);
        }
      });
    };
    section(null, []);

    return lines.join("\n");
  };

  const buildJSONExport = () => {
    // Bygg et ekte nestet tre, så strukturen er maskinlesbar
    const buildTree = (parentId) =>
      childrenOf(parentId).map((n) => ({
        id: n.id,
        title: n.title,
        type: n.type,
        notes: n.notes,
        color: n.color,
        isPage: !!n.isPage,
        x: Math.round(n.x), y: Math.round(n.y),
        w: Math.round(n.w), h: Math.round(n.h),
        children: buildTree(n.id),
      }));

    return JSON.stringify({
      map: { id: currentMapId, title: currentMap?.title },
      stats: {
        nodes: nodes.length,
        connections: connections.length,
        pages: pageCount,
        depth: maxDepth + 1,
      },
      // Hierarkisk visning
      tree: buildTree(null),
      // Flat visning med parentId — enklere for import/verktøy
      nodes: nodes.map(({ id, title, type, notes, color, x, y, w, h, parentId, isPage }) => ({
        id, title, type, notes, color,
        parentId: parentId ?? null,
        isPage: !!isPage,
        x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h),
      })),
      connections: connections.map(({ id, fromNode, toNode, label, color, bidirectional, parentId }) => ({
        id, fromNode, toNode, label, color, bidirectional,
        parentId: parentId ?? null,
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

import { useEffect, useState } from "react";

const MINI_W = 200;
const MINI_H = 130;
const PADDING = 40;

function getAccentColor() {
  return getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#6366f1";
}

function getAccent2Color() {
  return getComputedStyle(document.documentElement).getPropertyValue("--accent-2").trim() || "#8b5cf6";
}

export default function MiniMap({ nodes, pan, zoom, canvasRef }) {
  const [accent, setAccent] = useState(() => getAccentColor());
  const [accent2, setAccent2] = useState(() => getAccent2Color());
  // Canvas-dimensjonene leses i effekt (refs kan ikke leses under render)
  // og følger vindus-/layoutendringer via ResizeObserver.
  const [viewport, setViewport] = useState({ w: 800, h: 600 });

  // Watch for accent color changes (theme switches)
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setAccent(getAccentColor());
      setAccent2(getAccent2Color());
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["style"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const el = canvasRef?.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      setViewport({ w: el.clientWidth, h: el.clientHeight });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [canvasRef]);

  if (nodes.length === 0) return null;

  const minX = Math.min(...nodes.map((n) => n.x)) - PADDING;
  const minY = Math.min(...nodes.map((n) => n.y)) - PADDING;
  const maxX = Math.max(...nodes.map((n) => n.x + n.w)) + PADDING;
  const maxY = Math.max(...nodes.map((n) => n.y + n.h)) + PADDING;

  const worldW = maxX - minX || 1;
  const worldH = maxY - minY || 1;
  const scaleX = MINI_W / worldW;
  const scaleY = MINI_H / worldH;
  const scale = Math.min(scaleX, scaleY);

  const vW = viewport.w / zoom;
  const vH = viewport.h / zoom;
  const vX = -pan.x / zoom;
  const vY = -pan.y / zoom;

  return (
    <div className="mini-map">
      <span className="mini-map-label">Oversikt</span>
      <svg width={MINI_W} height={MINI_H} style={{ display: "block", background: "var(--minimap-bg)" }}>
        {nodes.map((node, i) => {
          const nx = (node.x - minX) * scale;
          const ny = (node.y - minY) * scale;
          const nw = Math.max(4, node.w * scale);
          const nh = Math.max(4, node.h * scale);
          // Alternate between accent and accent2 for visual variety
          const color = i % 2 === 0 ? accent : accent2;
          return (
            <rect
              key={node.id}
              x={nx} y={ny} width={nw} height={nh}
              rx={2}
              fill={color}
              opacity={0.6}
            />
          );
        })}

        {(() => {
          // Klipp viewport-indikatoren mot minikartet i begge ender —
          // ren clamping av x/y uten å krympe bredde/høyde markerte feil område
          const rx = (vX - minX) * scale;
          const ry = (vY - minY) * scale;
          const x1 = Math.max(0, rx);
          const y1 = Math.max(0, ry);
          const x2 = Math.min(MINI_W, rx + vW * scale);
          const y2 = Math.min(MINI_H, ry + vH * scale);
          return (
            <rect
              x={x1}
              y={y1}
              width={Math.max(0, x2 - x1)}
              height={Math.max(0, y2 - y1)}
              rx={2}
              fill="var(--accent-glow)"
              stroke="var(--accent)"
              strokeWidth={1.5}
            />
          );
        })()}
      </svg>
    </div>
  );
}

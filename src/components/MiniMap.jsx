import { useRef, useEffect, useState } from "react";
import useGigaStore from "../store/useGigaStore";

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
  const [accent, setAccent] = useState(getAccentColor());
  const [accent2, setAccent2] = useState(getAccent2Color());

  useEffect(() => {
    const update = () => {
      setAccent(getAccentColor());
      setAccent2(getAccent2Color());
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["style"] });
    return () => observer.disconnect();
  }, []);

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

  const canvasEl = canvasRef?.current;
  const vW = canvasEl ? canvasEl.clientWidth / zoom : 800;
  const vH = canvasEl ? canvasEl.clientHeight / zoom : 600;
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

        <rect
          x={Math.max(0, (vX - minX) * scale)}
          y={Math.max(0, (vY - minY) * scale)}
          width={Math.min(MINI_W, vW * scale)}
          height={Math.min(MINI_H, vH * scale)}
          rx={2}
          fill="var(--accent-glow)"
          stroke="var(--accent)"
          strokeWidth={1.5}
        />
      </svg>
    </div>
  );
}

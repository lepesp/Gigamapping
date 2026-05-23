import { useRef, useEffect, useState } from "react";
import useGigaStore from "../store/useGigaStore";

const CANVAS_W = 8000;
const CANVAS_H = 8000;

// Get center point of a node (for connection endpoints)
function nodeCenter(node) {
  return { x: node.x + node.w / 2, y: node.y + node.h / 2 };
}

// Get edge point (right side for "from", left for "to")
function nodeEdge(node, side = "right") {
  if (side === "right") return { x: node.x + node.w, y: node.y + node.h / 2 };
  if (side === "left") return { x: node.x, y: node.y + node.h / 2 };
  if (side === "bottom") return { x: node.x + node.w / 2, y: node.y + node.h };
  if (side === "top") return { x: node.x + node.w / 2, y: node.y };
}

function getBestEdge(from, to) {
  const fc = nodeCenter(from);
  const tc = nodeCenter(to);
  const dx = tc.x - fc.x;
  const dy = tc.y - fc.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0
      ? { from: nodeEdge(from, "right"), to: nodeEdge(to, "left") }
      : { from: nodeEdge(from, "left"), to: nodeEdge(to, "right") };
  } else {
    return dy >= 0
      ? { from: nodeEdge(from, "bottom"), to: nodeEdge(to, "top") }
      : { from: nodeEdge(from, "top"), to: nodeEdge(to, "bottom") };
  }
}

function bezierPath(x1, y1, x2, y2) {
  const cx = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`;
}

// Read the current --accent CSS variable value
function getAccentColor() {
  return getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#6366f1";
}

export default function Connections({ nodes, connections, dragLine }) {
  const { selectedConnectionId, setSelectedConnectionId, deleteConnection, updateConnection } = useGigaStore();
  const [accent, setAccent] = useState("#6366f1");
  const svgRef = useRef(null);

  // Watch for accent color changes (theme switches)
  useEffect(() => {
    setAccent(getAccentColor());
    const observer = new MutationObserver(() => setAccent(getAccentColor()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["style"] });
    return () => observer.disconnect();
  }, []);

  const nodeMap = Object.fromEntries(nodes.map((n) => [n.id, n]));

  // Collect all unique colors used (for arrow markers)
  const usedColors = new Set();
  usedColors.add(accent);
  connections.forEach((c) => { if (c.color) usedColors.add(c.color); });

  return (
    <svg
      ref={svgRef}
      className="connections-svg"
      style={{ width: CANVAS_W, height: CANVAS_H, position: "absolute", top: 0, left: 0, overflow: "visible" }}
    >
      <defs>
        {[...usedColors].map((color) => (
          <marker
            key={color}
            id={`arrow-${color.replace("#", "")}`}
            markerWidth="10" markerHeight="7"
            refX="9" refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill={color} opacity="0.8" />
          </marker>
        ))}
      </defs>

      {/* Existing connections */}
      {connections.map((conn) => {
        const fromNode = nodeMap[conn.fromNode];
        const toNode = nodeMap[conn.toNode];
        if (!fromNode || !toNode) return null;

        const { from, to } = getBestEdge(fromNode, toNode);
        const path = bezierPath(from.x, from.y, to.x, to.y);
        const color = conn.color || accent;
        const isSelected = selectedConnectionId === conn.id;
        const markerId = `arrow-${color.replace("#", "")}`;
        const midX = (from.x + to.x) / 2;
        const midY = (from.y + to.y) / 2;

        return (
          <g key={conn.id}>
            {/* Invisible wider hit area */}
            <path
              d={path}
              stroke="transparent"
              strokeWidth={16}
              fill="none"
              style={{ cursor: "pointer" }}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedConnectionId(isSelected ? null : conn.id);
              }}
            />
            {/* Visible path */}
            <path
              className={`connection-path${isSelected ? " selected" : ""}`}
              d={path}
              stroke={color}
              strokeWidth={isSelected ? 3 : 2}
              strokeDasharray={conn.dashed ? "8 4" : undefined}
              opacity={0.75}
              markerEnd={`url(#${markerId})`}
              style={{ filter: isSelected ? `drop-shadow(0 0 6px ${color})` : undefined }}
            />
            {/* Label */}
            {conn.label && (
              <text
                className="connection-label"
                x={midX}
                y={midY - 8}
                style={{ fill: "var(--text-secondary)" }}
              >
                {conn.label}
              </text>
            )}
            {/* Delete button when selected */}
            {isSelected && (
              <g
                style={{ cursor: "pointer" }}
                onClick={(e) => { e.stopPropagation(); deleteConnection(conn.id); setSelectedConnectionId(null); }}
              >
                <circle cx={midX} cy={midY} r={12} fill="var(--bg-card)" stroke="var(--danger)" strokeWidth={1.5} />
                <text x={midX} y={midY + 4} textAnchor="middle" fontSize={13} fill="var(--danger)">×</text>
              </g>
            )}
          </g>
        );
      })}

      {/* Live drag line */}
      {dragLine && (
        <path
          d={bezierPath(dragLine.fromX, dragLine.fromY, dragLine.toX, dragLine.toY)}
          stroke={accent}
          strokeWidth={2}
          strokeDasharray="6 3"
          fill="none"
          opacity={0.7}
          pointerEvents="none"
        />
      )}
    </svg>
  );
}

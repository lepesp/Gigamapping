import { useState, useRef, useEffect } from "react";
import { getThemeList, applyTheme, getSavedTheme } from "../themes";

export default function ThemePicker() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState(getSavedTheme());
  const ref = useRef(null);

  const themes = getThemeList();

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleSelect = (key) => {
    applyTheme(key);
    setCurrent(key);
    setOpen(false);
  };

  const currentTheme = themes.find((t) => t.key === current);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        className="btn btn-ghost"
        onClick={() => setOpen(!open)}
        title="Velg tema"
        style={{ gap: 6, fontSize: 13 }}
      >
        {currentTheme?.emoji || "🎨"} Tema
      </button>

      {open && (
        <div style={{
          position: "absolute",
          top: "calc(100% + 8px)",
          right: 0,
          width: 280,
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: 16,
          boxShadow: "var(--shadow)",
          padding: 8,
          zIndex: 999,
          animation: "fadeIn 0.15s ease",
        }}>
          <div style={{
            fontSize: 11, fontWeight: 600, textTransform: "uppercase",
            letterSpacing: "0.8px", color: "var(--text-muted)",
            padding: "8px 12px 6px",
          }}>
            Velg tema
          </div>

          {themes.map((t) => (
            <button
              key={t.key}
              onClick={() => handleSelect(t.key)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                width: "100%",
                padding: "10px 12px",
                border: "none",
                borderRadius: 12,
                background: current === t.key ? "var(--accent-glow)" : "transparent",
                cursor: "pointer",
                transition: "all 0.15s",
                textAlign: "left",
              }}
              onMouseEnter={(e) => {
                if (current !== t.key) e.target.style.background = "var(--bg-card-hover)";
              }}
              onMouseLeave={(e) => {
                if (current !== t.key) e.target.style.background = "transparent";
              }}
            >
              {/* Preview swatch */}
              <div style={{
                width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                background: t.bg,
                border: current === t.key ? `2px solid ${t.accent}` : "2px solid var(--border)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 16,
              }}>
                {t.emoji}
              </div>

              <div>
                <div style={{
                  fontSize: 13, fontWeight: 600,
                  color: current === t.key ? "var(--accent)" : "var(--text-primary)",
                }}>
                  {t.name}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  {t.desc}
                </div>
              </div>

              {/* Active checkmark */}
              {current === t.key && (
                <div style={{
                  marginLeft: "auto", fontSize: 14,
                  color: "var(--accent)", fontWeight: 700,
                }}>
                  ✓
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

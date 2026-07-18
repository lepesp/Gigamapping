// 6 global themes for the Gigamapping app
const themes = {
  soft: {
    name: "Soft",
    emoji: "🌸",
    desc: "Duse, rolige farger",
    swatches: [
      "#e8edf5", "#dbeafe", "#d1fae5", "#ede9fe",
      "#fce7f3", "#fef3c7", "#f1f5f9", "#e0f2fe",
      "#ccfbf1", "#f5f3ff", "#fff1f2", "#ecfdf5",
      "#eff6ff", "#faf5ff", "#fdf4ff", "#f0fdf4",
    ],
    vars: {
      "--bg-deep": "#f5f7fa", "--bg-surface": "#ffffff", "--bg-card": "#ffffff",
      "--bg-card-hover": "#f0f2f8", "--bg-modal": "#ffffff",
      "--border": "rgba(0,0,0,0.1)", "--border-focus": "rgba(99,102,241,0.6)",
      "--accent": "#6366f1", "--accent-glow": "rgba(99,102,241,0.15)", "--accent-2": "#8b5cf6", "--accent-3": "#0369a1",
      "--success": "#059669", "--warning": "#d97706", "--danger": "#dc2626",
      "--text-primary": "#1e293b", "--text-secondary": "#64748b", "--text-muted": "#94a3b8",
      "--glass": "rgba(255,255,255,0.85)", "--glass-border": "rgba(0,0,0,0.08)",
      "--shadow": "0 4px 24px rgba(0,0,0,0.08)", "--shadow-glow": "0 8px 30px rgba(99,102,241,0.15)",
      "--canvas-bg": "#f0f2f7", "--canvas-grid": "rgba(0,0,0,0.04)",
      "--node-bg": "#e8edf5", "--node-border": "rgba(0,0,0,0.1)", "--node-text": "#1e293b", "--node-notes": "#64748b",
      "--minimap-bg": "#f8fafc",
    },
  },

  dark: {
    name: "Dark",
    emoji: "🌙",
    desc: "Klassisk mørkt tema",
    swatches: [
      "#1a1f35", "#1e2a4a", "#1e3a5f", "#2d1b69",
      "#1e4a3a", "#3a1e4a", "#4a1e2a", "#0d2137",
      "#1a3a2a", "#3a1a1a", "#16213e", "#0f3460",
      "#2b2d42", "#1a2a3a", "#533483", "#4a3a1e",
    ],
    vars: {
      "--bg-deep": "#0a0b14", "--bg-surface": "#0f1120", "--bg-card": "#151829",
      "--bg-card-hover": "#1a1f35", "--bg-modal": "#12152a",
      "--border": "rgba(255,255,255,0.08)", "--border-focus": "rgba(99,102,241,0.6)",
      "--accent": "#818cf8", "--accent-glow": "rgba(99,102,241,0.3)", "--accent-2": "#a78bfa", "--accent-3": "#22d3ee",
      "--success": "#34d399", "--warning": "#fbbf24", "--danger": "#f87171",
      "--text-primary": "#f1f5f9", "--text-secondary": "#94a3b8", "--text-muted": "#475569",
      "--glass": "rgba(15,17,32,0.85)", "--glass-border": "rgba(255,255,255,0.06)",
      "--shadow": "0 8px 32px rgba(0,0,0,0.5)", "--shadow-glow": "0 0 30px rgba(99,102,241,0.25)",
      "--canvas-bg": "#0d0e1a", "--canvas-grid": "rgba(255,255,255,0.03)",
      "--node-bg": "#1a1f35", "--node-border": "rgba(255,255,255,0.1)", "--node-text": "#f1f5f9", "--node-notes": "rgba(255,255,255,0.55)",
      "--minimap-bg": "rgba(10,11,20,0.9)",
    },
  },

  cyber: {
    name: "Cyber",
    emoji: "⚡",
    desc: "Neon cyberpunk",
    swatches: [
      "#1a0033", "#0d1a2e", "#001a1a", "#1a001a",
      "#002b1a", "#2b0014", "#0a1628", "#14002b",
      "#001f33", "#1f0033", "#0a2920", "#2b1a00",
      "#0d0d2e", "#1a2b00", "#2e0a1a", "#002e2e",
    ],
    vars: {
      "--bg-deep": "#0b0014", "--bg-surface": "#110022", "--bg-card": "#1a0033",
      "--bg-card-hover": "#220044", "--bg-modal": "#130026",
      "--border": "rgba(0,255,200,0.12)", "--border-focus": "rgba(0,255,200,0.6)",
      "--accent": "#00ffc8", "--accent-glow": "rgba(0,255,200,0.25)", "--accent-2": "#ff00ff", "--accent-3": "#00ccff",
      "--success": "#00ff88", "--warning": "#ffcc00", "--danger": "#ff3366",
      "--text-primary": "#e0ffe8", "--text-secondary": "#88ccaa", "--text-muted": "#447766",
      "--glass": "rgba(11,0,20,0.85)", "--glass-border": "rgba(0,255,200,0.1)",
      "--shadow": "0 8px 32px rgba(0,0,0,0.6)", "--shadow-glow": "0 0 40px rgba(0,255,200,0.2)",
      "--canvas-bg": "#080012", "--canvas-grid": "rgba(0,255,200,0.04)",
      "--node-bg": "#1a0033", "--node-border": "rgba(0,255,200,0.2)", "--node-text": "#e0ffe8", "--node-notes": "rgba(0,255,200,0.5)",
      "--minimap-bg": "rgba(11,0,20,0.9)",
    },
  },

  ocean: {
    name: "Ocean",
    emoji: "🌊",
    desc: "Dype blå havet",
    swatches: [
      "#dceefb", "#bfdbfe", "#a5d8ff", "#cce5ff",
      "#b2d8ea", "#d0ebff", "#c3dafe", "#bae6fd",
      "#a7f3d0", "#e0f2fe", "#dbeafe", "#cff4fc",
      "#b2f5ea", "#c7d2fe", "#d5f5f6", "#e0e7ff",
    ],
    vars: {
      "--bg-deep": "#f0f7ff", "--bg-surface": "#ffffff", "--bg-card": "#ffffff",
      "--bg-card-hover": "#e8f0fe", "--bg-modal": "#ffffff",
      "--border": "rgba(14,80,140,0.12)", "--border-focus": "rgba(14,116,203,0.6)",
      "--accent": "#0e74cb", "--accent-glow": "rgba(14,116,203,0.15)", "--accent-2": "#0ea5e9", "--accent-3": "#0369a1",
      "--success": "#06b6d4", "--warning": "#f59e0b", "--danger": "#ef4444",
      "--text-primary": "#0c2d48", "--text-secondary": "#3a6d8c", "--text-muted": "#7da3be",
      "--glass": "rgba(240,247,255,0.9)", "--glass-border": "rgba(14,80,140,0.08)",
      "--shadow": "0 4px 24px rgba(14,80,140,0.1)", "--shadow-glow": "0 8px 30px rgba(14,116,203,0.18)",
      "--canvas-bg": "#e6f0fa", "--canvas-grid": "rgba(14,80,140,0.06)",
      "--node-bg": "#dceefb", "--node-border": "rgba(14,116,203,0.2)", "--node-text": "#0c2d48", "--node-notes": "#3a6d8c",
      "--minimap-bg": "#eaf4fd",
    },
  },

  sunset: {
    name: "Sunset",
    emoji: "🌅",
    desc: "Varme solnedgang",
    swatches: [
      "#fde8d8", "#fed7aa", "#fecaca", "#fef08a",
      "#fde68a", "#fbcfe8", "#fecdd3", "#ffd8a8",
      "#ffe4c4", "#fce7f3", "#fff7ed", "#fef9c3",
      "#ffedd5", "#fee2e2", "#fff1f2", "#fefce8",
    ],
    vars: {
      "--bg-deep": "#fef7f0", "--bg-surface": "#ffffff", "--bg-card": "#ffffff",
      "--bg-card-hover": "#fef0e4", "--bg-modal": "#ffffff",
      "--border": "rgba(180,80,30,0.1)", "--border-focus": "rgba(234,88,12,0.5)",
      "--accent": "#ea580c", "--accent-glow": "rgba(234,88,12,0.15)", "--accent-2": "#dc2626", "--accent-3": "#b45309",
      "--success": "#16a34a", "--warning": "#ca8a04", "--danger": "#dc2626",
      "--text-primary": "#431407", "--text-secondary": "#9a3412", "--text-muted": "#c2714e",
      "--glass": "rgba(254,247,240,0.9)", "--glass-border": "rgba(180,80,30,0.08)",
      "--shadow": "0 4px 24px rgba(180,80,30,0.08)", "--shadow-glow": "0 8px 30px rgba(234,88,12,0.15)",
      "--canvas-bg": "#fdf0e5", "--canvas-grid": "rgba(180,80,30,0.05)",
      "--node-bg": "#fde8d8", "--node-border": "rgba(234,88,12,0.2)", "--node-text": "#431407", "--node-notes": "#9a3412",
      "--minimap-bg": "#fef5ee",
    },
  },

  bold: {
    name: "Bold",
    emoji: "🔥",
    desc: "Sterke kontraster",
    swatches: [
      "#222222", "#2a1515", "#1a2a1a", "#15152a",
      "#2a2a15", "#2a151f", "#1f2a15", "#152a2a",
      "#331a1a", "#1a331a", "#1a1a33", "#33331a",
      "#331a2a", "#1a332a", "#2a1a33", "#333333",
    ],
    vars: {
      "--bg-deep": "#111111", "--bg-surface": "#1a1a1a", "--bg-card": "#222222",
      "--bg-card-hover": "#2a2a2a", "--bg-modal": "#1e1e1e",
      "--border": "rgba(255,255,255,0.1)", "--border-focus": "rgba(255,60,60,0.6)",
      "--accent": "#ff3c3c", "--accent-glow": "rgba(255,60,60,0.25)", "--accent-2": "#ff8800", "--accent-3": "#ffcc00",
      "--success": "#00dd55", "--warning": "#ff8800", "--danger": "#ff3c3c",
      "--text-primary": "#ffffff", "--text-secondary": "#bbbbbb", "--text-muted": "#666666",
      "--glass": "rgba(17,17,17,0.9)", "--glass-border": "rgba(255,255,255,0.08)",
      "--shadow": "0 8px 32px rgba(0,0,0,0.6)", "--shadow-glow": "0 0 30px rgba(255,60,60,0.2)",
      "--canvas-bg": "#141414", "--canvas-grid": "rgba(255,255,255,0.04)",
      "--node-bg": "#222222", "--node-border": "rgba(255,60,60,0.25)", "--node-text": "#ffffff", "--node-notes": "#bbbbbb",
      "--minimap-bg": "rgba(17,17,17,0.9)",
    },
  },
};

// localStorage kaster SecurityError når nettleseren blokkerer site data.
// Det skal gi standardtema, ikke krasje appen til en blank side.
function safeGetItem(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Lagring blokkert — temaet gjelder bare denne økten
  }
}

export function applyTheme(themeKey) {
  const theme = themes[themeKey];
  if (!theme) return;
  const root = document.documentElement;
  Object.entries(theme.vars).forEach(([prop, value]) => {
    root.style.setProperty(prop, value);
  });
  safeSetItem("gigamap-theme", themeKey);
}

export function getSavedTheme() {
  return safeGetItem("gigamap-theme") || "soft";
}

export function getSwatches(themeKey) {
  const key = themeKey || getSavedTheme();
  return themes[key]?.swatches || themes.soft.swatches;
}

export function getThemeList() {
  return Object.entries(themes).map(([key, t]) => ({
    key,
    name: t.name,
    emoji: t.emoji,
    desc: t.desc,
    accent: t.vars["--accent"],
    bg: t.vars["--bg-deep"],
    text: t.vars["--text-primary"],
  }));
}

export default themes;

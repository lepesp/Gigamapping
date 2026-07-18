// Én kilde til sannhet for nodetyper, farger og ikoner. Lå tidligere
// duplisert i GigaNode og NodeModal, og hadde alt driftet fra hverandre:
// modalen lovte farger for Idé/Generell som lerretet aldri viste.
export const NODE_TYPES = [
  "Generell",
  "Avdeling",
  "System",
  "Prosess",
  "Person",
  "Mål",
  "Problem",
  "Idé",
];

// Generell og Idé har bevisst ingen fast farge — de følger temaets accent
export const TYPE_COLORS = {
  Avdeling: "#7c3aed",
  System: "#0284c7",
  Prosess: "#059669",
  Person: "#d97706",
  Mål: "#dc2626",
  Problem: "#b45309",
};

export const TYPE_ICONS = {
  Avdeling: "🏢",
  System: "⚙️",
  Prosess: "🔄",
  Person: "👤",
  Mål: "🎯",
  Problem: "⚠️",
  Idé: "💡",
  Generell: "📌",
};

// Nodefarger lagres som absolutt hex fra ett temas palett, mens tekst
// følger aktivt tema. Uten dette ble en pastellnode fra Soft-temaet
// nesten uleselig i Dark. Velger tekstfarge ut fra bakgrunnens luminans.
export function readableTextColors(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 140
    ? { "--node-text": "#1e293b", "--node-notes": "#475569" }
    : { "--node-text": "#f1f5f9", "--node-notes": "rgba(241,245,249,0.75)" };
}

export const CATEGORY_META = {
  konferencja: { label: "Konferencja", bg: "#fef3d4", fg: "#8a6d1d" },
  hr: { label: "HR", bg: "#e8f3f8", fg: "#1a5c7f" },
  sponsorzy: { label: "Sponsorzy", bg: "#f5e8e8", fg: "#6b2c3a" },
  administracja: { label: "Administracja", bg: "#e8f0f8", fg: "#1a4a70" },
  inne: { label: "Inne", bg: "#f2e8ed", fg: "#5a3a48" },
};

export const TYPE_META = {
  spotkanie: { label: "Spotkanie", color: "#4d3658" },
  zadanie: { label: "Zadanie", color: "#C5E548" },
};

export const USER_COLOR_PALETTE = [
  "#4d3658", "#9cb49a", "#C5E548", "#5a7f9c", "#a85c6b", "#7fa8d1", "#f5d966", "#8a6d9c",
];
export function colorForIndex(i){
  return USER_COLOR_PALETTE[i % USER_COLOR_PALETTE.length];
}

export const inputStyle = { fontFamily: "'Nunito', sans-serif", fontSize: 15, border: "1px solid #d4c4b0", borderRadius: 8, padding: "9px 11px", background: "#fff", width: "100%" };
export const labelStyle = { fontSize: 13, fontWeight: 800, color: "#8b6b5a", marginBottom: -6, display: "block" };
export const saveBtn = { fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: 14.5, background: "#4d3658", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", cursor: "pointer", transition: "background 0.2s" };
export const cancelBtn = { fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: 14.5, background: "#fff", color: "#8b6b5a", border: "1px solid #d4c4b0", borderRadius: 8, padding: "9px 16px", cursor: "pointer" };
export const addBtn = { display: "flex", alignItems: "center", fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: 14.5, background: "#C5E548", color: "#33401a", border: "none", borderRadius: 8, padding: "9px 16px", cursor: "pointer", transition: "background 0.2s" };
export const iconBtn = { display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "#8b6b5a", cursor: "pointer", padding: 4 };
export const tabStyle = (active) => ({
  display: "flex", alignItems: "center",
  fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: 14.5,
  padding: "9px 16px", borderRadius: 10, border: "1px solid #d4c4b0",
  background: active ? "#4d3658" : "#fff", color: active ? "#fff" : "#3a2a1f", cursor: "pointer",
});
export const card = { background: "#fff", borderRadius: 16, padding: 18, border: "1px solid #d4c4b0" };
export const pageWrap = { fontFamily: "'Nunito', sans-serif", fontSize: 16, background: "#faf8f5", minHeight: "100vh", color: "#3a2a1f" };

// Pastylkowy przycisk akcji (checklista / komentarze / przypomnienia) — z opisem tekstowym i licznikiem
export const pillBtn = (accentColor) => ({
  display: "flex", alignItems: "center", gap: 6,
  fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: 12.5,
  background: "#fff", border: `1.5px solid ${accentColor || "#d4c4b0"}`, borderRadius: 20,
  padding: "6px 12px", cursor: "pointer", color: "#3a2a1f",
});
export const pillCount = (accentColor) => ({
  background: accentColor, color: "#fff", borderRadius: 10,
  fontSize: 11, fontWeight: 800, padding: "1px 7px", minWidth: 18, textAlign: "center",
});
export const deleteBtn = {
  display: "flex", alignItems: "center", gap: 6,
  fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: 12.5,
  background: "#fdeceb", border: "1.5px solid #d94a38", borderRadius: 20,
  padding: "6px 12px", cursor: "pointer", color: "#d94a38",
};

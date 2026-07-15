export const CATEGORY_META = {
  konferencja: { label: "Konferencja", bg: "#fef3d4", fg: "#8a6d1d" },
  hr: { label: "HR", bg: "#e8f3f8", fg: "#1a5c7f" },
  sponsorzy: { label: "Sponsorzy", bg: "#f5e8e8", fg: "#6b2c3a" },
  administracja: { label: "Administracja", bg: "#e8f0f8", fg: "#1a4a70" },
  inne: { label: "Inne", bg: "#f2e8ed", fg: "#5a3a48" },
};

export const TYPE_META = {
  spotkanie: { label: "Spotkanie", color: "#8b2e4a" },
  zadanie: { label: "Zadanie", color: "#f0c300" },
};

export const USER_COLOR_PALETTE = [
  "#8b2e4a", "#6b9fc9", "#f0c300", "#5a7f9c", "#a85c6b", "#7fa8d1", "#f5d966", "#8a6d9c",
];
export function colorForIndex(i){
  return USER_COLOR_PALETTE[i % USER_COLOR_PALETTE.length];
}

export const inputStyle = { fontFamily: "'Nunito', sans-serif", border: "1px solid #d4c4b0", borderRadius: 8, padding: "8px 10px", fontSize: 13, background: "#fff", width: "100%" };
export const labelStyle = { fontSize: 11.5, fontWeight: 700, color: "#8b6b5a", marginBottom: -6, display: "block" };
export const saveBtn = { fontFamily: "'Nunito', sans-serif", fontWeight: 700, fontSize: 13, background: "#8b2e4a", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", cursor: "pointer", transition: "background 0.2s" };
export const cancelBtn = { fontFamily: "'Nunito', sans-serif", fontWeight: 700, fontSize: 13, background: "#fff", color: "#8b6b5a", border: "1px solid #d4c4b0", borderRadius: 8, padding: "8px 14px", cursor: "pointer" };
export const addBtn = { display: "flex", alignItems: "center", fontFamily: "'Nunito', sans-serif", fontWeight: 700, fontSize: 13, background: "#f0c300", color: "#6b5a1a", border: "none", borderRadius: 8, padding: "8px 14px", cursor: "pointer", transition: "background 0.2s" };
export const iconBtn = { display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "#8b6b5a", cursor: "pointer", padding: 4 };
export const tabStyle = (active) => ({
  display: "flex", alignItems: "center",
  fontFamily: "'Nunito', sans-serif", fontWeight: 700, fontSize: 13,
  padding: "8px 14px", borderRadius: 10, border: "1px solid #d4c4b0",
  background: active ? "#8b2e4a" : "#fff", color: active ? "#fff" : "#3a2a1f", cursor: "pointer",
});
export const card = { background: "#fff", borderRadius: 16, padding: 18, border: "1px solid #d4c4b0" };
export const pageWrap = { fontFamily: "'Nunito', sans-serif", background: "#faf8f5", minHeight: "100vh", color: "#3a2a1f" };

export const CATEGORY_META = {
  konferencja: { label: "Konferencja", bg: "#e7efe9", fg: "#1a5c38" },
  hr: { label: "HR", bg: "#eee7f5", fg: "#5a3d8f" },
  sponsorzy: { label: "Sponsorzy", bg: "#f5eed9", fg: "#8a6d1d" },
  administracja: { label: "Administracja", bg: "#e4eef5", fg: "#2a5f80" },
  inne: { label: "Inne", bg: "#f0ede2", fg: "#6b6a5e" },
};

export const TYPE_META = {
  spotkanie: { label: "Spotkanie", color: "#1a5c38" },
  zadanie: { label: "Zadanie", color: "#8a6d1d" },
};

export const USER_COLOR_PALETTE = [
  "#c0435a", "#2a6fa8", "#c9a84c", "#6a4a9c", "#3d8f6a", "#a85c2a", "#4a7c9c", "#8f5a7c",
];
export function colorForIndex(i){
  return USER_COLOR_PALETTE[i % USER_COLOR_PALETTE.length];
}

export const inputStyle = { fontFamily: "'Nunito', sans-serif", border: "1px solid #e2ded1", borderRadius: 8, padding: "8px 10px", fontSize: 13, background: "#fff", width: "100%" };
export const labelStyle = { fontSize: 11.5, fontWeight: 700, color: "#8b8f86", marginBottom: -6, display: "block" };
export const saveBtn = { fontFamily: "'Nunito', sans-serif", fontWeight: 700, fontSize: 13, background: "#1a5c38", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", cursor: "pointer" };
export const cancelBtn = { fontFamily: "'Nunito', sans-serif", fontWeight: 700, fontSize: 13, background: "#fff", color: "#8b8f86", border: "1px solid #e2ded1", borderRadius: 8, padding: "8px 14px", cursor: "pointer" };
export const addBtn = { display: "flex", alignItems: "center", fontFamily: "'Nunito', sans-serif", fontWeight: 700, fontSize: 13, background: "#c9a84c", color: "#3a2f0f", border: "none", borderRadius: 8, padding: "7px 12px", cursor: "pointer" };
export const iconBtn = { display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "#8b8f86", cursor: "pointer", padding: 4 };
export const tabStyle = (active) => ({
  display: "flex", alignItems: "center",
  fontFamily: "'Nunito', sans-serif", fontWeight: 700, fontSize: 13,
  padding: "8px 14px", borderRadius: 10, border: "1px solid #ece7d8",
  background: active ? "#1a5c38" : "#fff", color: active ? "#fff" : "#22301f", cursor: "pointer",
});
export const card = { background: "#fff", borderRadius: 16, padding: 18, border: "1px solid #ece7d8" };
export const pageWrap = { fontFamily: "'Nunito', sans-serif", background: "#f7f4ee", minHeight: "100vh", color: "#22301f" };

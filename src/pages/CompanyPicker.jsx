import React from "react";
import { pageWrap, card } from "../theme";
import { Building2, LogOut, LayoutGrid } from "lucide-react";

export default function CompanyPicker({ memberships, onPick, onPickAll, onLogout }){
  return (
    <div style={{ ...pageWrap, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ ...card, width: "100%", maxWidth: 420 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 20, color: "#1a5c38" }}>Wybierz firmę</div>
          <button onClick={onLogout} style={{ background: "none", border: "none", color: "#8b8f86", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 12.5 }}>
            <LogOut size={14} /> Wyloguj
          </button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button onClick={onPickAll}
            style={{ display: "flex", alignItems: "center", gap: 10, textAlign: "left", border: "1px solid #1a5c38", borderRadius: 10, padding: "12px 14px", background: "#e7efe9", cursor: "pointer" }}>
            <LayoutGrid size={16} color="#1a5c38" />
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#1a5c38" }}>Wszystkie firmy razem</div>
              <div style={{ fontSize: 11.5, color: "#4a6f57" }}>Wspólny kalendarz ze wszystkich Twoich firm</div>
            </div>
          </button>
          {memberships.map(m => (
            <button key={m.company_id} onClick={() => onPick(m.company_id)}
              style={{ display: "flex", alignItems: "center", gap: 10, textAlign: "left", border: "1px solid #ece7d8", borderRadius: 10, padding: "12px 14px", background: "#fbf9f3", cursor: "pointer" }}>
              <Building2 size={16} color="#1a5c38" />
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{m.companies?.name || "Firma"}</div>
                <div style={{ fontSize: 11.5, color: "#8b8f86", textTransform: "capitalize" }}>{m.role}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

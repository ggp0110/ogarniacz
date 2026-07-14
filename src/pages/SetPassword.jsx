import React, { useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import { inputStyle, labelStyle, saveBtn, pageWrap } from "../theme";
import { Lock } from "lucide-react";

export default function SetPassword({ onDone }){
  const passRef = useRef(null);
  const pass2Ref = useRef(null);
  const nameRef = useRef(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(){
    const p1 = passRef.current?.value || "";
    const p2 = pass2Ref.current?.value || "";
    const fullName = (nameRef.current?.value || "").trim();
    if (p1.length < 8) { setError("Hasło musi mieć co najmniej 8 znaków."); return; }
    if (p1 !== p2) { setError("Hasła nie są identyczne."); return; }
    setError(""); setLoading(true);
    const updates = { password: p1 };
    if (fullName) updates.data = { full_name: fullName };
    const { error: err } = await supabase.auth.updateUser(updates);
    if (!err && fullName) {
      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user?.id) {
        await supabase.from("profiles").update({ full_name: fullName }).eq("id", userData.user.id);
      }
    }
    setLoading(false);
    if (err) setError(err.message);
    else onDone();
  }

  return (
    <div style={{ ...pageWrap, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #ece7d8", padding: 28, width: "100%", maxWidth: 360, display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#1a5c38" }}>
          <Lock size={18} />
          <span style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 20 }}>Ustaw hasło</span>
        </div>
        <div style={{ fontSize: 12.5, color: "#8b8f86" }}>To pierwsze logowanie — ustaw swoje hasło do konta.</div>

        <label style={labelStyle}>Imię i nazwisko</label>
        <input ref={nameRef} placeholder="np. Jan Kowalski" style={inputStyle} />

        <label style={labelStyle}>Nowe hasło</label>
        <input ref={passRef} type="password" placeholder="min. 8 znaków" style={inputStyle} />

        <label style={labelStyle}>Powtórz hasło</label>
        <input ref={pass2Ref} type="password" placeholder="powtórz hasło" style={inputStyle}
          onKeyDown={e => { if (e.key === "Enter") handleSubmit(); }} />

        {error && <div style={{ color: "#9a3b34", fontSize: 12.5 }}>{error}</div>}

        <button type="button" onClick={handleSubmit} disabled={loading} style={{ ...saveBtn, padding: "10px 14px", fontSize: 14 }}>
          {loading ? "Zapisywanie…" : "Zapisz i przejdź dalej"}
        </button>
      </div>
    </div>
  );
}

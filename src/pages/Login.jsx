import React, { useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import { inputStyle, labelStyle, saveBtn, pageWrap } from "../theme";
import { Lock } from "lucide-react";

export default function Login(){
  const emailRef = useRef(null);
  const passRef = useRef(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState("login"); // login | forgot
  const [info, setInfo] = useState("");

  async function handleLogin(){
    const email = (emailRef.current?.value || "").trim();
    const password = passRef.current?.value || "";
    if (!email || !password) { setError("Podaj e-mail i hasło."); return; }
    setError(""); setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (err) setError(err.message === "Invalid login credentials" ? "Nieprawidłowy e-mail lub hasło." : err.message);
  }

  async function handleForgot(){
    const email = (emailRef.current?.value || "").trim();
    if (!email) { setError("Podaj e-mail, na który wyślemy link do resetu hasła."); return; }
    setError(""); setLoading(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    setLoading(false);
    if (err) setError(err.message);
    else setInfo("Jeśli to konto istnieje, wysłaliśmy link do ustawienia nowego hasła na podany e-mail.");
  }

  return (
    <div style={{ ...pageWrap, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #ece7d8", padding: 28, width: "100%", maxWidth: 360, display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#1a5c38" }}>
          <Lock size={18} />
          <span style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 20 }}>Kalendarz zespołu</span>
        </div>

        <label style={labelStyle}>E-mail</label>
        <input ref={emailRef} type="email" autoComplete="email" placeholder="ty@firma.pl" style={inputStyle} />

        {mode === "login" && (
          <>
            <label style={labelStyle}>Hasło</label>
            <input ref={passRef} type="password" autoComplete="current-password" placeholder="Hasło" style={inputStyle}
              onKeyDown={e => { if (e.key === "Enter") handleLogin(); }} />
          </>
        )}

        {error && <div style={{ color: "#9a3b34", fontSize: 12.5 }}>{error}</div>}
        {info && <div style={{ color: "#1a5c38", fontSize: 12.5 }}>{info}</div>}

        {mode === "login" ? (
          <>
            <button type="button" onClick={handleLogin} disabled={loading} style={{ ...saveBtn, padding: "10px 14px", fontSize: 14 }}>
              {loading ? "Logowanie…" : "Zaloguj się"}
            </button>
            <button type="button" onClick={() => { setMode("forgot"); setError(""); setInfo(""); }}
              style={{ background: "none", border: "none", color: "#8b8f86", fontSize: 12.5, cursor: "pointer", textAlign: "left" }}>
              Nie pamiętasz hasła?
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={handleForgot} disabled={loading} style={{ ...saveBtn, padding: "10px 14px", fontSize: 14 }}>
              {loading ? "Wysyłanie…" : "Wyślij link do resetu hasła"}
            </button>
            <button type="button" onClick={() => { setMode("login"); setError(""); setInfo(""); }}
              style={{ background: "none", border: "none", color: "#8b8f86", fontSize: 12.5, cursor: "pointer", textAlign: "left" }}>
              Wróć do logowania
            </button>
          </>
        )}

        <div style={{ fontSize: 11.5, color: "#a3a698" }}>
          Nowe konto zakładasz przez zaproszenie e-mailowe od administratora — nie ma tu rejestracji.
        </div>
      </div>
    </div>
  );
}

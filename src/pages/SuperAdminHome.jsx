import React, { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "../supabaseClient";
import { pageWrap, card, inputStyle, saveBtn, addBtn, tabStyle, USER_COLOR_PALETTE } from "../theme";
import { Building2, Plus, LogOut, UserPlus, ArrowRight, Loader2, Mail, LayoutGrid } from "lucide-react";

export default function SuperAdminHome({ profile, onEnterCompany, onEnterAll, onLogout }){
  const [companies, setCompanies] = useState([]);
  const [memberships, setMemberships] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAddCompany, setShowAddCompany] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const newCompanyRef = useRef(null);
  const assignProfileRef = useRef(null);
  const assignCompanyRef = useRef(null);
  const assignRoleRef = useRef(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError("");
    const [{ data: comp, error: e1 }, { data: mem, error: e2 }, { data: profs, error: e3 }] = await Promise.all([
      supabase.from("companies").select("*").order("name"),
      supabase.from("memberships").select("id, role, color, company_id, profile_id, profiles ( id, full_name, email )"),
      supabase.from("profiles").select("*").order("email"),
    ]);
    if (e1 || e2 || e3) setError((e1||e2||e3).message);
    setCompanies(comp || []);
    setMemberships(mem || []);
    setProfiles(profs || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  async function addCompany(){
    const name = (newCompanyRef.current?.value || "").trim();
    if (!name) return;
    const { error: err } = await supabase.from("companies").insert({ name, created_by: profile.id });
    if (err) { setError(err.message); return; }
    if (newCompanyRef.current) newCompanyRef.current.value = "";
    setShowAddCompany(false);
    loadAll();
  }

  async function assignMembership(){
    const profileId = assignProfileRef.current?.value;
    const companyId = assignCompanyRef.current?.value;
    const role = assignRoleRef.current?.value;
    if (!profileId || !companyId || !role) return;
    const { error: err } = await supabase.from("memberships").upsert(
      { profile_id: profileId, company_id: companyId, role },
      { onConflict: "profile_id,company_id" }
    );
    if (err) { setError(err.message); return; }
    setShowAssign(false);
    loadAll();
  }

  async function removeMembership(id){
    if (!window.confirm("Usunąć tę osobę z firmy?")) return;
    await supabase.from("memberships").delete().eq("id", id);
    loadAll();
  }

  async function setMemberColor(id, color){
    await supabase.from("memberships").update({ color }).eq("id", id);
    loadAll();
  }

  if (loading) {
    return <div style={{ ...pageWrap, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: "#8b8f86" }}><Loader2 size={18} /> Wczytywanie…</div>;
  }

  return (
    <div style={pageWrap}>
      <div className="app-shell" style={{ maxWidth: 900, margin: "0 auto", padding: "28px 18px 60px" }}>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 26, color: "#1a5c38" }}>Panel administratora</div>
            <div style={{ fontSize: 12.5, color: "#8b8f86" }}>{profile.full_name || profile.email}</div>
          </div>
          <button onClick={onLogout} style={{ background: "none", border: "1px solid #e2ded1", borderRadius: 8, padding: "8px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}>
            <LogOut size={14} /> Wyloguj
          </button>
        </header>

        {error && <div style={{ background: "#fdeceb", color: "#d94a38", padding: "8px 12px", borderRadius: 8, fontSize: 13, marginBottom: 14 }}>{error}</div>}

        <div style={{ ...card, marginBottom: 20, background: "#fbf7ec" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 13, color: "#7a5c12", marginBottom: 4 }}>
            <Mail size={14} /> Jak dodać nową osobę
          </div>
          <div style={{ fontSize: 12.5, color: "#5c4a1a" }}>
            W Supabase: Authentication → Add user → Invite. Po tym, jak dana osoba ustawi hasło, pojawi się poniżej na liście „Przypisz pracownika do firmy”.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
          <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 18 }}>Firmy</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onEnterAll} style={tabStyle(false)}><LayoutGrid size={15} style={{ marginRight: 6 }} /> Wszystkie razem</button>
            <button onClick={() => setShowAddCompany(s => !s)} style={addBtn}><Plus size={15} style={{ marginRight: 4 }} /> Dodaj firmę</button>
          </div>
        </div>

        {showAddCompany && (
          <div style={{ ...card, marginBottom: 14, display: "flex", gap: 8 }}>
            <input ref={newCompanyRef} placeholder="Nazwa firmy" style={inputStyle} onKeyDown={e => { if (e.key === "Enter") addCompany(); }} />
            <button onClick={addCompany} style={saveBtn}>Dodaj</button>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
          {companies.length === 0 && <div style={{ color: "#8b8f86", fontSize: 13 }}>Brak firm — dodaj pierwszą powyżej.</div>}
          {companies.map(c => {
            const members = memberships.filter(m => m.company_id === c.id);
            return (
              <div key={c.id} style={card}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Building2 size={16} color="#1a5c38" />
                    <span style={{ fontWeight: 700 }}>{c.name}</span>
                  </div>
                  <button onClick={() => onEnterCompany(c.id)} style={{ ...tabStyle(false), display: "flex", alignItems: "center" }}>
                    Kalendarz <ArrowRight size={14} style={{ marginLeft: 6 }} />
                  </button>
                </div>
                {members.length === 0 ? (
                  <div style={{ fontSize: 12.5, color: "#8b8f86" }}>Brak przypisanych osób.</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {members.map(m => (
                      <div key={m.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13, flexWrap: "wrap", gap: 6 }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ width: 9, height: 9, borderRadius: "50%", background: m.color || "#6b6a5e", display: "inline-block" }} />
                          {m.profiles?.full_name || m.profiles?.email} <span style={{ color: "#8b8f86", fontSize: 11 }}>({m.role})</span>
                        </span>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                          <div style={{ display: "flex", gap: 3 }}>
                            {USER_COLOR_PALETTE.map(c => (
                              <button key={c} onClick={() => setMemberColor(m.id, c)} title={c}
                                style={{
                                  width: 16, height: 16, borderRadius: "50%", background: c, cursor: "pointer",
                                  border: (m.color || "#6b6a5e") === c ? "2px solid #22301f" : "1px solid #fff",
                                  padding: 0,
                                }} />
                            ))}
                          </div>
                          <button onClick={() => removeMembership(m.id)} style={{ background: "none", border: "none", color: "#d94a38", cursor: "pointer", fontSize: 11.5 }}>Usuń</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 18 }}>Przypisz pracownika do firmy</div>
          <button onClick={() => setShowAssign(s => !s)} style={addBtn}><UserPlus size={15} style={{ marginRight: 4 }} /> Przypisz</button>
        </div>
        {showAssign && (
          <div style={{ ...card, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <select ref={assignProfileRef} defaultValue="" style={{ ...inputStyle, flex: "2 1 200px" }}>
              <option value="" disabled>Wybierz osobę…</option>
              {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name || p.email}</option>)}
            </select>
            <select ref={assignCompanyRef} defaultValue="" style={{ ...inputStyle, flex: "1 1 160px" }}>
              <option value="" disabled>Wybierz firmę…</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select ref={assignRoleRef} defaultValue="pracownik" style={{ ...inputStyle, flex: "1 1 120px" }}>
              <option value="pracownik">Pracownik</option>
              <option value="szef">Szef</option>
            </select>
            <button onClick={assignMembership} style={saveBtn}>Zapisz</button>
          </div>
        )}
      </div>
    </div>
  );
}

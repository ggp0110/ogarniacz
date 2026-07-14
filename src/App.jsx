import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "./supabaseClient";
import { pageWrap } from "./theme";
import Login from "./pages/Login.jsx";
import SetPassword from "./pages/SetPassword.jsx";
import SuperAdminHome from "./pages/SuperAdminHome.jsx";
import CompanyPicker from "./pages/CompanyPicker.jsx";
import Calendar from "./pages/Calendar.jsx";
import { Loader2 } from "lucide-react";

// Sprawdzamy hash URL NATYCHMIAST (zanim Supabase go przetworzy i wyczyści),
// żeby niezawodnie wykryć link z zaproszenia lub resetu hasła.
const initialHash = typeof window !== "undefined" ? window.location.hash : "";
const cameFromInviteOrRecovery = /type=invite|type=recovery/.test(initialHash);

export default function App(){
  const [session, setSession] = useState(undefined); // undefined = jeszcze nie wiadomo, null = brak
  const [needsPassword, setNeedsPassword] = useState(cameFromInviteOrRecovery);
  const [profile, setProfile] = useState(null);
  const [memberships, setMemberships] = useState([]);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [activeCompanyId, setActiveCompanyId] = useState(null); // null = ekran wyboru / panel admina
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((event, sess) => {
      if (event === "PASSWORD_RECOVERY") setNeedsPassword(true);
      setSession(sess ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const loadProfileAndMemberships = useCallback(async (userId) => {
    setLoadingProfile(true);
    setErrorMsg("");
    try {
      const { data: prof, error: profErr } = await supabase
        .from("profiles").select("*").eq("id", userId).single();
      if (profErr) throw profErr;
      setProfile(prof);

      const { data: mem, error: memErr } = await supabase
        .from("memberships")
        .select("id, role, color, company_id, companies ( id, name )")
        .eq("profile_id", userId);
      if (memErr) throw memErr;
      setMemberships(mem || []);
    } catch (e) {
      setErrorMsg("Nie udało się wczytać danych konta: " + (e.message || "nieznany błąd"));
    } finally {
      setLoadingProfile(false);
    }
  }, []);

  useEffect(() => {
    if (session && session.user) {
      loadProfileAndMemberships(session.user.id);
    } else {
      setProfile(null);
      setMemberships([]);
      setActiveCompanyId(null);
    }
  }, [session, loadProfileAndMemberships]);

  if (session === undefined) {
    return <CenteredLoader text="Wczytywanie…" />;
  }

  if (needsPassword) {
    if (!session) {
      return <CenteredLoader text="Finalizowanie zaproszenia…" />;
    }
    return <SetPassword onDone={() => setNeedsPassword(false)} />;
  }

  if (!session) {
    return <Login />;
  }

  if (loadingProfile || !profile) {
    return <CenteredLoader text="Wczytywanie konta…" />;
  }

  if (errorMsg) {
    return (
      <div style={{ ...pageWrap, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ maxWidth: 420, textAlign: "center", color: "#9a3b34" }}>{errorMsg}</div>
      </div>
    );
  }

  const handleLogout = () => supabase.auth.signOut();

  if (profile.is_super_admin) {
    if (activeCompanyId) {
      return (
        <Calendar
          companyId={activeCompanyId}
          role="szef"
          profile={profile}
          onExit={() => setActiveCompanyId(null)}
          onLogout={handleLogout}
        />
      );
    }
    return (
      <SuperAdminHome
        profile={profile}
        onEnterCompany={(id) => setActiveCompanyId(id)}
        onLogout={handleLogout}
      />
    );
  }

  if (memberships.length === 0) {
    return (
      <div style={{ ...pageWrap, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ maxWidth: 420, textAlign: "center" }}>
          <p>Twoje konto nie jest jeszcze przypisane do żadnej firmy.</p>
          <p style={{ color: "#8b8f86", fontSize: 13 }}>Skontaktuj się z administratorem, żeby dodał Cię do zespołu.</p>
          <button onClick={handleLogout} style={{ marginTop: 12, background: "none", border: "1px solid #e2ded1", borderRadius: 8, padding: "8px 14px", cursor: "pointer" }}>Wyloguj</button>
        </div>
      </div>
    );
  }

  if (!activeCompanyId) {
    if (memberships.length === 1) {
      return (
        <Calendar
          companyId={memberships[0].company_id}
          role={memberships[0].role}
          profile={profile}
          onExit={memberships.length > 1 ? () => setActiveCompanyId(null) : null}
          onLogout={handleLogout}
        />
      );
    }
    return (
      <CompanyPicker
        memberships={memberships}
        onPick={(id) => setActiveCompanyId(id)}
        onLogout={handleLogout}
      />
    );
  }

  const membership = memberships.find(m => m.company_id === activeCompanyId);
  return (
    <Calendar
      companyId={activeCompanyId}
      role={membership?.role || "pracownik"}
      profile={profile}
      onExit={() => setActiveCompanyId(null)}
      onLogout={handleLogout}
    />
  );
}

function CenteredLoader({ text }){
  return (
    <div style={{ ...pageWrap, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: "#8b8f86" }}>
      <Loader2 size={18} /> {text}
    </div>
  );
}

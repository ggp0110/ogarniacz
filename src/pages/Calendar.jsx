import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { supabase } from "../supabaseClient";
import { pageWrap, card, inputStyle, saveBtn, cancelBtn, addBtn, tabStyle, iconBtn, CATEGORY_META, TYPE_META, colorForIndex, USER_COLOR_PALETTE } from "../theme";
import {
  ChevronLeft, ChevronRight, Plus, X, MessageCircle, Check, Users, CalendarDays,
  ListChecks, Loader2, LogOut, Star, Lock, Building2, Settings, ArrowLeft, LayoutGrid
} from "lucide-react";

function pad(n){ return n.toString().padStart(2,"0"); }
function toKey(d){ return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
function sameDay(a,b){ return toKey(a)===toKey(b); }
function buildMonthGrid(year, month){
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7;
  const gridStart = new Date(year, month, 1 - startOffset);
  const cells = [];
  for(let i=0;i<42;i++){ const d = new Date(gridStart); d.setDate(gridStart.getDate()+i); cells.push(d); }
  return cells;
}
const MONTHS_PL = ["Styczeń","Luty","Marzec","Kwiecień","Maj","Czerwiec","Lipiec","Sierpień","Wrzesień","Październik","Listopad","Grudzień"];
const DAYS_PL = ["Pon","Wt","Śr","Czw","Pt","Sob","Nd"];

export default function Calendar({ companyId, role, profile, onExit, onLogout }){
  const isAll = companyId === "ALL";

  const [companyName, setCompanyName] = useState("");
  const [team, setTeam] = useState([]); // tryb pojedynczej firmy: memberships + profiles
  const [companiesMeta, setCompaniesMeta] = useState({}); // tryb "wszystkie": {companyId: nazwa}
  const [teamByCompany, setTeamByCompany] = useState({}); // tryb "wszystkie": {companyId: [membership...]}
  const [events, setEvents] = useState(null);
  const [error, setError] = useState("");
  const [cursor, setCursor] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [view, setView] = useState("miesiac");
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState("");
  const [showTeamPanel, setShowTeamPanel] = useState(false);
  const [openComments, setOpenComments] = useState({});
  const [commentsByEvent, setCommentsByEvent] = useState({});
  const [filterAssignee, setFilterAssignee] = useState("wszyscy");
  const [filterCompany, setFilterCompany] = useState("wszystkie");
  const [formCompanyId, setFormCompanyId] = useState("");

  const titleRef = useRef(null);
  const typeRef = useRef(null);
  const categoryRef = useRef(null);
  const timeRef = useRef(null);
  const assigneeRef = useRef(null);
  const privateRef = useRef(null);

  const isBossOrAdmin = role === "szef";

  useEffect(() => {
    if (isAll) {
      const ids = Object.keys(companiesMeta);
      if (ids.length > 0 && !ids.includes(formCompanyId)) setFormCompanyId(ids[0]);
    }
  }, [isAll, companiesMeta, formCompanyId]);

  // --- kolory i nazwy: tryb pojedynczej firmy (po osobie) ---
  const colorFor = useCallback((profileId) => {
    if (!profileId) return "#1a5c38";
    const t = team.find(t => t.profile_id === profileId);
    if (t?.color) return t.color;
    const idx = team.findIndex(t => t.profile_id === profileId);
    return idx >= 0 ? colorForIndex(idx) : "#6b6a5e";
  }, [team]);
  const nameFor = useCallback((profileId) => {
    if (!profileId) return "Cały zespół";
    const t = team.find(t => t.profile_id === profileId);
    return t?.profiles?.full_name || t?.profiles?.email || "—";
  }, [team]);

  // --- kolory: tryb "wszystkie firmy" (po firmie) ---
  const companyColor = useCallback((cid) => {
    const ids = Object.keys(companiesMeta);
    const idx = ids.indexOf(cid);
    return idx >= 0 ? colorForIndex(idx) : "#6b6a5e";
  }, [companiesMeta]);

  // --- funkcje uniwersalne używane przy renderowaniu zdarzeń (przyjmują CAŁY event) ---
  const eventColor = useCallback((ev) => (isAll ? companyColor(ev.company_id) : colorFor(ev.assignee_id)), [isAll, companyColor, colorFor]);
  const eventAssigneeName = useCallback((ev) => {
    if (!ev.assignee_id) return "Cały zespół";
    if (isAll) {
      const roster = teamByCompany[ev.company_id] || [];
      const t = roster.find(t => t.profile_id === ev.assignee_id);
      return t?.profiles?.full_name || t?.profiles?.email || "—";
    }
    return nameFor(ev.assignee_id);
  }, [isAll, teamByCompany, nameFor]);

  // czy użytkownik jest szefem/adminem w KTÓREJKOLWIEK firmie (dotyczy trybu "wszystkie")
  const isBossSomewhere = isAll
    ? (profile.is_super_admin || Object.values(teamByCompany).some(list => list.some(m => m.profile_id === profile.id && m.role === "szef")))
    : isBossOrAdmin;
  // czy użytkownik jest szefem w konkretnej firmie wybranej w formularzu (dotyczy trybu "wszystkie")
  const canPrivateForForm = isAll
    ? (profile.is_super_admin || (teamByCompany[formCompanyId] || []).some(m => m.profile_id === profile.id && m.role === "szef"))
    : isBossOrAdmin;

  const loadMeta = useCallback(async () => {
    if (isAll) {
      const { data: comps } = await supabase.from("companies").select("id, name").order("name");
      const list = comps || [];
      const metaMap = {};
      list.forEach(c => { metaMap[c.id] = c.name; });
      setCompaniesMeta(metaMap);
      const ids = list.map(c => c.id);
      if (ids.length === 0) { setTeamByCompany({}); return; }
      const { data: mem } = await supabase
        .from("memberships")
        .select("id, role, color, profile_id, company_id, profiles ( id, full_name, email )")
        .in("company_id", ids);
      const grouped = {};
      (mem || []).forEach(m => { grouped[m.company_id] = grouped[m.company_id] || []; grouped[m.company_id].push(m); });
      setTeamByCompany(grouped);
    } else {
      const { data: comp } = await supabase.from("companies").select("name").eq("id", companyId).single();
      setCompanyName(comp?.name || "");
      const { data: mem } = await supabase
        .from("memberships")
        .select("id, role, color, profile_id, profiles ( id, full_name, email )")
        .eq("company_id", companyId);
      setTeam(mem || []);
    }
  }, [companyId, isAll]);

  const loadEvents = useCallback(async () => {
    let query = supabase.from("events").select("*").order("event_date");
    if (isAll) {
      const ids = Object.keys(companiesMeta);
      if (ids.length === 0) { setEvents([]); return; }
      query = query.in("company_id", ids);
    } else {
      query = query.eq("company_id", companyId);
    }
    const { data, error: err } = await query;
    if (err) setError(err.message);
    else setEvents(data || []);
  }, [companyId, isAll, companiesMeta]);

  useEffect(() => { loadMeta(); }, [loadMeta]);
  useEffect(() => { loadEvents(); }, [loadEvents]);

  useEffect(() => {
    const channelName = isAll ? "all-companies-events" : `company-events-${companyId}`;
    const channel = supabase.channel(channelName)
      .on("postgres_changes", { event: "*", schema: "public", table: "events", ...(isAll ? {} : { filter: `company_id=eq.${companyId}` }) }, () => loadEvents())
      .on("postgres_changes", { event: "*", schema: "public", table: "event_comments" }, (payload) => {
        const evId = payload.new?.event_id || payload.old?.event_id;
        if (evId && openComments[evId]) loadComments(evId);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, isAll]);

  async function loadComments(eventId){
    const { data } = await supabase
      .from("event_comments")
      .select("id, body, created_at, author_id, profiles ( full_name, email )")
      .eq("event_id", eventId)
      .order("created_at");
    setCommentsByEvent(prev => ({ ...prev, [eventId]: data || [] }));
  }

  function toggleCommentsPanel(eventId){
    setOpenComments(o => {
      const next = { ...o, [eventId]: !o[eventId] };
      if (next[eventId] && !commentsByEvent[eventId]) loadComments(eventId);
      return next;
    });
  }

  async function addComment(eventId, text){
    const trimmed = (text || "").trim();
    if (!trimmed) return;
    await supabase.from("event_comments").insert({ event_id: eventId, author_id: profile.id, body: trimmed });
    loadComments(eventId);
  }

  const visibleEvents = useMemo(() => {
    let list = events || [];
    if (isAll) {
      if (filterCompany !== "wszystkie") list = list.filter(ev => ev.company_id === filterCompany);
    } else {
      if (filterAssignee !== "wszyscy") list = list.filter(ev => ev.assignee_id === filterAssignee || ev.assignee_id === null);
    }
    return list;
  }, [events, filterAssignee, filterCompany, isAll]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const grid = useMemo(() => buildMonthGrid(year, month), [year, month]);

  const eventsByDay = useMemo(() => {
    const map = {};
    visibleEvents.forEach(ev => { map[ev.event_date] = map[ev.event_date] || []; map[ev.event_date].push(ev); });
    Object.values(map).forEach(list => list.sort((a,b) => (b.starred?1:0)-(a.starred?1:0) || (a.event_time||"").localeCompare(b.event_time||"")));
    return map;
  }, [visibleEvents]);

  const selectedKey = toKey(selectedDate);
  const dayEvents = eventsByDay[selectedKey] || [];

  const upcoming = useMemo(() => {
    const today = toKey(new Date());
    return [...visibleEvents].filter(e => e.event_date >= today && !e.completed)
      .sort((a,b) => a.event_date.localeCompare(b.event_date) || (a.event_time||"").localeCompare(b.event_time||"")).slice(0, 12);
  }, [visibleEvents]);

  async function addEvent(){
    const title = (titleRef.current?.value || "").trim();
    if (!title) { setFormError("Wpisz nazwę zadania lub spotkania."); return; }
    const targetCompanyId = isAll ? formCompanyId : companyId;
    if (!targetCompanyId) { setFormError("Wybierz firmę."); return; }
    setFormError("");
    const payload = {
      company_id: targetCompanyId,
      title,
      type: typeRef.current?.value || "zadanie",
      category: categoryRef.current?.value || "inne",
      event_date: selectedKey,
      event_time: timeRef.current?.value || null,
      assignee_id: assigneeRef.current?.value || null,
      created_by: profile.id,
      is_private: canPrivateForForm ? !!privateRef.current?.checked : false,
    };
    const { data, error: err } = await supabase.from("events").insert(payload).select().single();
    if (err) { setFormError(err.message); return; }
    // pokazujemy nowe zadanie natychmiast, bez czekania na realtime
    setEvents(prev => [...(prev || []), data]);
    if (titleRef.current) titleRef.current.value = "";
    if (timeRef.current) timeRef.current.value = "";
    if (privateRef.current) privateRef.current.checked = false;
    setShowForm(false);
  }

  async function toggleComplete(ev){
    setEvents(prev => (prev || []).map(e => e.id === ev.id ? { ...e, completed: !ev.completed } : e));
    const { error: err } = await supabase.from("events").update({ completed: !ev.completed }).eq("id", ev.id);
    if (err) { setError(err.message); loadEvents(); }
  }
  async function toggleStarred(ev){
    setEvents(prev => (prev || []).map(e => e.id === ev.id ? { ...e, starred: !ev.starred } : e));
    const { error: err } = await supabase.from("events").update({ starred: !ev.starred }).eq("id", ev.id);
    if (err) { setError(err.message); loadEvents(); }
  }
  async function removeEvent(id){
    setEvents(prev => (prev || []).filter(e => e.id !== id));
    const { error: err } = await supabase.from("events").delete().eq("id", id);
    if (err) { setError(err.message); loadEvents(); }
  }

  if (events === null) {
    return <div style={{ ...pageWrap, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: "#8b8f86" }}><Loader2 size={18} /> Wczytywanie…</div>;
  }

  const rosterForForm = isAll ? (teamByCompany[formCompanyId] || []) : team;

  return (
    <div style={pageWrap}>
      <div className="app-shell" style={{ maxWidth: 980, margin: "0 auto", padding: "24px 16px 60px" }}>
        <header className="top-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {onExit && <button onClick={onExit} style={iconBtn} title="Wróć"><ArrowLeft size={16} /></button>}
              {isAll ? <LayoutGrid size={16} color="#1a5c38" /> : <Building2 size={16} color="#1a5c38" />}
              <span className="top-header-title" style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 22, color: "#1a5c38" }}>
                {isAll ? "Wszystkie firmy" : (companyName || "Kalendarz")}
              </span>
            </div>
            <div style={{ fontSize: 12, color: "#8b8f86", marginTop: 2, display: "flex", alignItems: "center", gap: 6 }}>
              <Users size={12} /> {profile.full_name || profile.email}
              {isBossSomewhere && <span style={{ fontSize: 10, fontWeight: 800, color: "#1a5c38", background: "#e7efe9", padding: "1px 7px", borderRadius: 20 }}>SZEF</span>}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {!isAll && isBossOrAdmin && (
              <button onClick={() => setShowTeamPanel(s => !s)} style={tabStyle(showTeamPanel)}><Settings size={15} style={{ marginRight: 6 }} /> Zespół</button>
            )}
            <button onClick={() => setView("miesiac")} style={tabStyle(view === "miesiac")}><CalendarDays size={15} style={{ marginRight: 6 }} /> Miesiąc</button>
            <button onClick={() => setView("lista")} style={tabStyle(view === "lista")}><ListChecks size={15} style={{ marginRight: 6 }} /> Lista</button>
            <button onClick={onLogout} style={{ ...iconBtn, border: "1px solid #e2ded1", borderRadius: 8 }} title="Wyloguj"><LogOut size={15} /></button>
          </div>
        </header>

        {error && <div style={{ background: "#fdeceb", color: "#9a3b34", padding: "8px 12px", borderRadius: 8, fontSize: 13, marginBottom: 14 }}>{error}</div>}

        {isAll ? (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
            {Object.entries(companiesMeta).map(([id, name]) => (
              <span key={id} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "#8b8f86" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: companyColor(id), display: "inline-block" }} />
                {name}
              </span>
            ))}
          </div>
        ) : (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
            {team.map(t => (
              <span key={t.profile_id} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "#8b8f86" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: colorFor(t.profile_id), display: "inline-block" }} />
                {(t.profiles?.full_name || t.profiles?.email || "").split(" ")[0]}
              </span>
            ))}
          </div>
        )}

        {isAll ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12.5, color: "#8b8f86", fontWeight: 700 }}>Pokaż firmę:</span>
            <select value={filterCompany} onChange={e => setFilterCompany(e.target.value)} style={{ ...inputStyle, maxWidth: 220 }}>
              <option value="wszystkie">Wszystkie firmy</option>
              {Object.entries(companiesMeta).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          </div>
        ) : isBossOrAdmin && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12.5, color: "#8b8f86", fontWeight: 700 }}>Pokaż zadania:</span>
            <select value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)} style={{ ...inputStyle, maxWidth: 220 }}>
              <option value="wszyscy">Cały zespół</option>
              {team.map(t => <option key={t.profile_id} value={t.profile_id}>{t.profiles?.full_name || t.profiles?.email}</option>)}
            </select>
          </div>
        )}

        {!isAll && showTeamPanel && isBossOrAdmin && (
          <TeamPanel companyId={companyId} team={team} onChanged={loadMeta} />
        )}

        {view === "miesiac" ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 20 }}>
            <div style={card}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <button onClick={() => setCursor(new Date(year, month - 1, 1))} style={iconBtn}><ChevronLeft size={18} /></button>
                <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 17 }}>{MONTHS_PL[month]} {year}</div>
                <button onClick={() => setCursor(new Date(year, month + 1, 1))} style={iconBtn}><ChevronRight size={18} /></button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4, marginBottom: 6 }}>
                {DAYS_PL.map(d => <div key={d} style={{ textAlign: "center", fontSize: 10.5, color: "#8b8f86", fontWeight: 700 }}>{d}</div>)}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
                {grid.map((d, i) => {
                  const key = toKey(d);
                  const dayList = eventsByDay[key] || [];
                  const inMonth = d.getMonth() === month;
                  const isSelected = sameDay(d, selectedDate);
                  const isToday = sameDay(d, new Date());
                  const allDone = dayList.length > 0 && dayList.every(e => e.completed);
                  const hasStarred = dayList.some(e => e.starred && !e.completed);
                  return (
                    <button key={i} onClick={() => setSelectedDate(d)} className="day-grid-cell" style={{
                      border: isSelected ? "2px solid #1a5c38" : "1px solid #ece7d8",
                      background: isToday ? "#fbf7ec" : "#fff", borderRadius: 9, minHeight: 56, padding: 5,
                      textAlign: "left", cursor: "pointer", opacity: inMonth ? 1 : 0.35, display: "flex", flexDirection: "column", gap: 3,
                    }}>
                      <span style={{ fontSize: 12, fontWeight: isToday ? 800 : 600, color: isToday ? "#1a5c38" : "#22301f" }}>{d.getDate()}</span>
                      {allDone && <Check size={10} color="#1a5c38" />}
                      {hasStarred && <Star size={9} fill="#c9a84c" color="#c9a84c" />}
                      <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                        {dayList.slice(0,3).map(ev => (
                          <span key={ev.id} style={{ width: 5, height: 5, borderRadius: "50%", background: eventColor(ev), opacity: ev.completed ? 0.3 : 1 }} />
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <DayPanel
              date={selectedDate} dayEvents={dayEvents} showForm={showForm} setShowForm={setShowForm}
              titleRef={titleRef} typeRef={typeRef} categoryRef={categoryRef} timeRef={timeRef} assigneeRef={assigneeRef} privateRef={privateRef}
              team={rosterForForm} canPrivate={canPrivateForForm} formError={formError} addEvent={addEvent}
              toggleComplete={toggleComplete} toggleStarred={toggleStarred} removeEvent={removeEvent}
              openComments={openComments} toggleCommentsPanel={toggleCommentsPanel}
              commentsByEvent={commentsByEvent} addComment={addComment} colorFor={eventColor} nameFor={eventAssigneeName}
              isAll={isAll} companiesMeta={companiesMeta} formCompanyId={formCompanyId} setFormCompanyId={setFormCompanyId}
              showCompanyBadge={isAll}
            />
          </div>
        ) : (
          <div style={card}>
            <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 18, marginBottom: 12 }}>Nadchodzące (niezakończone)</div>
            {upcoming.length === 0 ? <div style={{ color: "#8b8f86", fontSize: 13 }}>Brak nadchodzących zadań.</div> : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {upcoming.map(ev => (
                  <EventRow key={ev.id} ev={ev} showDate
                    toggleComplete={toggleComplete} toggleStarred={toggleStarred} removeEvent={removeEvent}
                    isOpen={!!openComments[ev.id]} onToggleComments={() => toggleCommentsPanel(ev.id)}
                    comments={commentsByEvent[ev.id] || []} addComment={addComment}
                    colorFor={eventColor} nameFor={eventAssigneeName}
                    companyBadge={isAll ? companiesMeta[ev.company_id] : null}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function DayPanel({ date, dayEvents, showForm, setShowForm, titleRef, typeRef, categoryRef, timeRef, assigneeRef, privateRef,
  team, canPrivate, formError, addEvent, toggleComplete, toggleStarred, removeEvent, openComments, toggleCommentsPanel,
  commentsByEvent, addComment, colorFor, nameFor, isAll, companiesMeta, formCompanyId, setFormCompanyId, showCompanyBadge }){
  const label = date.toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long" });
  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 17, textTransform: "capitalize" }}>{label}</div>
        <button onClick={() => setShowForm(s => !s)} style={addBtn}><Plus size={15} style={{ marginRight: 4 }} /> Dodaj</button>
      </div>

      {showForm && (
        <div style={{ background: "#fbf9f3", borderRadius: 10, padding: 12, marginBottom: 14, display: "flex", flexDirection: "column", gap: 8 }}>
          {isAll && (
            <select value={formCompanyId} onChange={e => setFormCompanyId(e.target.value)} style={inputStyle}>
              {Object.entries(companiesMeta).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          )}
          <input ref={titleRef} autoFocus placeholder="Nazwa zadania lub spotkania" style={inputStyle} />
          <div className="form-row" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <select ref={typeRef} defaultValue="zadanie" style={{ ...inputStyle, flex: "1 1 120px" }}>
              <option value="zadanie">Zadanie</option><option value="spotkanie">Spotkanie</option>
            </select>
            <select ref={categoryRef} defaultValue="inne" style={{ ...inputStyle, flex: "1 1 140px" }}>
              {Object.entries(CATEGORY_META).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <input ref={timeRef} type="time" style={{ ...inputStyle, flex: "1 1 100px" }} />
          </div>
          <select ref={assigneeRef} defaultValue="" style={inputStyle} key={formCompanyId /* reset przy zmianie firmy */}>
            <option value="">Cały zespół</option>
            {team.map(t => <option key={t.profile_id} value={t.profile_id}>{t.profiles?.full_name || t.profiles?.email}</option>)}
          </select>
          {canPrivate && (
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#5c4a1a" }}>
              <input ref={privateRef} type="checkbox" /> Prywatne — niewidoczne dla zespołu
            </label>
          )}
          {formError && <div style={{ color: "#9a3b34", fontSize: 12.5 }}>{formError}</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={addEvent} style={saveBtn}>Zapisz</button>
            <button type="button" onClick={() => setShowForm(false)} style={cancelBtn}>Anuluj</button>
          </div>
        </div>
      )}

      {dayEvents.length === 0 ? <div style={{ color: "#8b8f86", fontSize: 13 }}>Nic nie zaplanowano na ten dzień.</div> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {dayEvents.map(ev => (
            <EventRow key={ev.id} ev={ev}
              toggleComplete={toggleComplete} toggleStarred={toggleStarred} removeEvent={removeEvent}
              isOpen={!!openComments[ev.id]} onToggleComments={() => toggleCommentsPanel(ev.id)}
              comments={commentsByEvent[ev.id] || []} addComment={addComment}
              colorFor={colorFor} nameFor={nameFor}
              companyBadge={showCompanyBadge ? companiesMeta[ev.company_id] : null}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function EventRow({ ev, showDate, toggleComplete, toggleStarred, removeEvent, isOpen, onToggleComments, comments, addComment, colorFor, nameFor, companyBadge }){
  const meta = TYPE_META[ev.type] || TYPE_META.zadanie;
  const cat = CATEGORY_META[ev.category] || CATEGORY_META.inne;
  const userColor = colorFor(ev);
  const commentRef = useRef(null);

  function submitComment(){
    const val = commentRef.current?.value || "";
    addComment(ev.id, val);
    if (commentRef.current) commentRef.current.value = "";
  }

  return (
    <div className="event-row" style={{ border: "1px solid #ece7d8", borderLeft: `3px solid ${userColor}`, borderRadius: 10, padding: "10px 12px" }}>
      <div className="event-row-head" style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <button onClick={() => toggleComplete(ev)} style={{ background: "none", border: "none", cursor: "pointer", marginTop: 2, flexShrink: 0 }}>
          {ev.completed
            ? <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#1a5c38", display: "flex", alignItems: "center", justifyContent: "center" }}><Check size={12} color="#fff" /></div>
            : <div style={{ width: 18, height: 18, borderRadius: "50%", border: "2px solid #cfcabb" }} />}
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 700, fontSize: 14, textDecoration: ev.completed ? "line-through" : "none", color: ev.completed ? "#a3a698" : "#22301f" }}>{ev.title}</span>
            {companyBadge && <span style={{ fontSize: 10.5, fontWeight: 700, color: "#fff", background: colorFor(ev), padding: "2px 7px", borderRadius: 20 }}>{companyBadge}</span>}
            <span style={{ fontSize: 10.5, fontWeight: 700, color: meta.color, background: "#f0ede2", padding: "2px 7px", borderRadius: 20 }}>{meta.label}</span>
            <span style={{ fontSize: 10.5, fontWeight: 700, color: cat.fg, background: cat.bg, padding: "2px 7px", borderRadius: 20 }}>{cat.label}</span>
            {ev.is_private && <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10.5, fontWeight: 700, color: "#6b6a5e", background: "#f0ede2", padding: "2px 7px", borderRadius: 20 }}><Lock size={9} /> Prywatne</span>}
          </div>
          <div style={{ fontSize: 12, color: "#8b8f86", marginTop: 2, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {showDate && <span>{ev.event_date}</span>}
            {ev.event_time && <span>{ev.event_time.slice(0,5)}</span>}
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: userColor }} />{nameFor(ev)}</span>
          </div>
        </div>
        <button onClick={() => toggleStarred(ev)} style={iconBtn} title="Oznacz jako ważne">
          <Star size={15} fill={ev.starred ? "#c9a84c" : "none"} color={ev.starred ? "#c9a84c" : "#8b8f86"} />
        </button>
        <button onClick={onToggleComments} style={iconBtn}><MessageCircle size={14} /> {comments.length > 0 && <span style={{ fontSize: 11 }}>{comments.length}</span>}</button>
        <button onClick={() => removeEvent(ev.id)} style={iconBtn}><X size={14} /></button>
      </div>
      {isOpen && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #f0ede2", display: "flex", flexDirection: "column", gap: 8 }}>
          {comments.map(c => (
            <div key={c.id} style={{ fontSize: 13, background: "#fbf9f3", borderRadius: 8, padding: "6px 10px" }}>
              <span style={{ fontWeight: 700 }}>{c.profiles?.full_name || c.profiles?.email}</span>
              <span style={{ color: "#8b8f86", fontSize: 11, marginLeft: 6 }}>{new Date(c.created_at).toLocaleString("pl-PL",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}</span>
              <div>{c.body}</div>
            </div>
          ))}
          <div style={{ display: "flex", gap: 6 }}>
            <input ref={commentRef} placeholder="Dodaj komentarz…" style={{ ...inputStyle, flex: 1 }} onKeyDown={e => { if (e.key === "Enter") submitComment(); }} />
            <button type="button" onClick={submitComment} style={saveBtn}>Wyślij</button>
          </div>
        </div>
      )}
    </div>
  );
}

function TeamPanel({ companyId, team, onChanged }){
  async function changeRole(membershipId, role){
    await supabase.from("memberships").update({ role }).eq("id", membershipId);
    onChanged();
  }
  async function changeColor(membershipId, color){
    await supabase.from("memberships").update({ color }).eq("id", membershipId);
    onChanged();
  }
  async function removeMember(membershipId){
    if (!window.confirm("Usunąć tę osobę z zespołu?")) return;
    await supabase.from("memberships").delete().eq("id", membershipId);
    onChanged();
  }
  return (
    <div style={{ ...card, marginBottom: 14 }}>
      <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 16, marginBottom: 10 }}>Zespół</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {team.map(t => (
          <div key={t.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: t.color || "#6b6a5e" }} />
              {t.profiles?.full_name || t.profiles?.email}
            </span>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: 3 }}>
                {USER_COLOR_PALETTE.map(c => (
                  <button key={c} onClick={() => changeColor(t.id, c)} title={c}
                    style={{ width: 15, height: 15, borderRadius: "50%", background: c, cursor: "pointer", padding: 0,
                      border: (t.color || "#6b6a5e") === c ? "2px solid #22301f" : "1px solid #fff" }} />
                ))}
              </div>
              <select value={t.role} onChange={e => changeRole(t.id, e.target.value)} style={{ ...inputStyle, width: "auto" }}>
                <option value="pracownik">Pracownik</option>
                <option value="szef">Szef</option>
              </select>
              <button onClick={() => removeMember(t.id)} style={{ background: "none", border: "none", color: "#9a3b34", cursor: "pointer", fontSize: 12 }}>Usuń</button>
            </div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11.5, color: "#a3a698", marginTop: 10 }}>
        Nowe osoby dodaje administrator (zaproszenie e-mailem), potem przypisuje je do tej firmy.
      </div>
    </div>
  );
}

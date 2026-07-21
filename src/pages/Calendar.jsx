import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { supabase } from "../supabaseClient";
import { pageWrap, card, inputStyle, saveBtn, cancelBtn, addBtn, tabStyle, iconBtn, CATEGORY_META, TYPE_META, colorForIndex, USER_COLOR_PALETTE, pillBtn, pillCount, deleteBtn } from "../theme";
import { isPushSupported, subscribeToPush, unsubscribeFromPush, getCurrentPushSubscription } from "../pushNotifications";
import CompanyTodoList from "../components/CompanyTodoList.jsx";
import {
  ChevronLeft, ChevronRight, Plus, X, MessageCircle, Check, Users, CalendarDays,
  ListChecks, Loader2, LogOut, Star, Lock, Building2, Settings, ArrowLeft, LayoutGrid, Bell, ListTodo, BellRing, ClipboardList, Pencil
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

function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - (day === 0 ? 6 : day - 1);
  return new Date(d.setDate(diff));
}

function buildWeekGrid(date) {
  const start = getWeekStart(date);
  const week = [];
  for(let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    week.push(d);
  }
  return week;
}

const MONTHS_PL = ["Styczeń","Luty","Marzec","Kwiecień","Maj","Czerwiec","Lipiec","Sierpień","Wrzesień","Październik","Listopad","Grudzień"];
const DAYS_PL = ["Pon","Wt","Śr","Czw","Pt","Sob","Nd"];

const REMINDER_OPTIONS = [
  { value: "15min", label: "15 minut przed" },
  { value: "1hour", label: "1 godzinę przed" },
  { value: "1day", label: "1 dzień przed" },
];

export default function Calendar({ companyId, role, profile, onExit, onLogout }){
  const isAll = companyId === "ALL";

  const [companyName, setCompanyName] = useState("");
  const [team, setTeam] = useState([]);
  const [companiesMeta, setCompaniesMeta] = useState({});
  const [teamByCompany, setTeamByCompany] = useState({});
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
  const [openReminders, setOpenReminders] = useState({});
  const [badgeCounts, setBadgeCounts] = useState({ comments: {}, checklist: {}, reminders: {} });
  const [remindersByEvent, setRemindersByEvent] = useState({});
  const [openChecklist, setOpenChecklist] = useState({});
  const [checklistByEvent, setChecklistByEvent] = useState({});

  const titleRef = useRef(null);
  const typeRef = useRef(null);
  const categoryRef = useRef(null);
  const timeRef = useRef(null);
  const endDateRef = useRef(null);
  const assigneeRef = useRef(null);
  const privateRef = useRef(null);

  const isBossOrAdmin = role === "szef";

  useEffect(() => {
    if (isAll) {
      const ids = Object.keys(companiesMeta);
      if (ids.length > 0 && !ids.includes(formCompanyId)) setFormCompanyId(ids[0]);
    }
  }, [isAll, companiesMeta, formCompanyId]);

  const colorFor = useCallback((profileId) => {
    if (!profileId) return "#4d3658";
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

  const companyColor = useCallback((cid) => {
    const ids = Object.keys(companiesMeta);
    const idx = ids.indexOf(cid);
    return idx >= 0 ? colorForIndex(idx) : "#6b6a5e";
  }, [companiesMeta]);

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

  const isBossSomewhere = isAll
    ? (profile.is_super_admin || Object.values(teamByCompany).some(list => list.some(m => m.profile_id === profile.id && m.role === "szef")))
    : isBossOrAdmin;
  
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

  const loadBadgeCounts = useCallback(async (eventIds) => {
    if (!eventIds || eventIds.length === 0) { setBadgeCounts({ comments: {}, checklist: {}, reminders: {} }); return; }
    const [{ data: c }, { data: ch }, { data: r }] = await Promise.all([
      supabase.from("event_comments").select("event_id").in("event_id", eventIds),
      supabase.from("checklist_items").select("event_id, done").in("event_id", eventIds),
      supabase.from("reminders").select("event_id").in("event_id", eventIds),
    ]);
    const comments = {};
    (c || []).forEach(row => { comments[row.event_id] = (comments[row.event_id] || 0) + 1; });
    const checklist = {};
    (ch || []).forEach(row => {
      checklist[row.event_id] = checklist[row.event_id] || { done: 0, total: 0 };
      checklist[row.event_id].total++;
      if (row.done) checklist[row.event_id].done++;
    });
    const reminders = {};
    (r || []).forEach(row => { reminders[row.event_id] = (reminders[row.event_id] || 0) + 1; });
    setBadgeCounts({ comments, checklist, reminders });
  }, []);

  const eventIdsKey = (events || []).map(e => e.id).join(",");
  useEffect(() => {
    loadBadgeCounts(eventIdsKey ? eventIdsKey.split(",") : []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventIdsKey]);
  const loadBadgeCountsRef = useRef(() => loadBadgeCounts(eventIdsKey ? eventIdsKey.split(",") : []));
  useEffect(() => { loadBadgeCountsRef.current = () => loadBadgeCounts(eventIdsKey ? eventIdsKey.split(",") : []); }, [loadBadgeCounts, eventIdsKey]);

  useEffect(() => { loadMeta(); }, [loadMeta]);
  useEffect(() => { loadEvents(); }, [loadEvents]);

  const loadEventsRef = useRef(loadEvents);
  useEffect(() => { loadEventsRef.current = loadEvents; }, [loadEvents]);
  const openCommentsRef = useRef(openComments);
  useEffect(() => { openCommentsRef.current = openComments; }, [openComments]);
  const openChecklistRef = useRef(openChecklist);
  useEffect(() => { openChecklistRef.current = openChecklist; }, [openChecklist]);

  useEffect(() => {
    const channelName = isAll ? "all-companies-events" : `company-events-${companyId}`;
    const channel = supabase.channel(channelName)
      .on("postgres_changes", { event: "*", schema: "public", table: "events", ...(isAll ? {} : { filter: `company_id=eq.${companyId}` }) }, () => loadEventsRef.current())
      .on("postgres_changes", { event: "*", schema: "public", table: "event_comments" }, (payload) => {
        const evId = payload.new?.event_id || payload.old?.event_id;
        if (evId && openCommentsRef.current[evId]) loadComments(evId);
        loadBadgeCountsRef.current();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "checklist_items" }, (payload) => {
        const evId = payload.new?.event_id || payload.old?.event_id;
        if (evId && openChecklistRef.current[evId]) loadChecklist(evId);
        loadBadgeCountsRef.current();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "reminders" }, () => {
        loadBadgeCountsRef.current();
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

  async function loadReminders(eventId){
    const { data } = await supabase
      .from("reminders")
      .select("*")
      .eq("event_id", eventId);
    setRemindersByEvent(prev => ({ ...prev, [eventId]: data || [] }));
  }

  async function loadChecklist(eventId){
    const { data } = await supabase
      .from("checklist_items")
      .select("*")
      .eq("event_id", eventId)
      .order("position")
      .order("created_at");
    setChecklistByEvent(prev => ({ ...prev, [eventId]: data || [] }));
  }

  function toggleChecklistPanel(eventId){
    setOpenChecklist(o => {
      const next = { ...o, [eventId]: !o[eventId] };
      if (next[eventId] && !checklistByEvent[eventId]) loadChecklist(eventId);
      return next;
    });
  }

  async function addChecklistItem(eventId, text){
    const trimmed = (text || "").trim();
    if (!trimmed) return;
    const currentCount = (checklistByEvent[eventId] || []).length;
    await supabase.from("checklist_items").insert({
      event_id: eventId, text: trimmed, position: currentCount, created_by: profile.id,
    });
    loadChecklist(eventId);
  }

  async function toggleChecklistItem(eventId, item){
    setChecklistByEvent(prev => ({
      ...prev,
      [eventId]: (prev[eventId] || []).map(i => i.id === item.id ? { ...i, done: !item.done } : i),
    }));
    await supabase.from("checklist_items").update({ done: !item.done }).eq("id", item.id);
  }

  async function removeChecklistItem(eventId, itemId){
    setChecklistByEvent(prev => ({ ...prev, [eventId]: (prev[eventId] || []).filter(i => i.id !== itemId) }));
    await supabase.from("checklist_items").delete().eq("id", itemId);
  }

  function toggleCommentsPanel(eventId){
    setOpenComments(o => {
      const next = { ...o, [eventId]: !o[eventId] };
      if (next[eventId] && !commentsByEvent[eventId]) loadComments(eventId);
      return next;
    });
  }

  function toggleRemindersPanel(eventId){
    setOpenReminders(o => {
      const next = { ...o, [eventId]: !o[eventId] };
      if (next[eventId] && !remindersByEvent[eventId]) loadReminders(eventId);
      return next;
    });
  }

  // Kliknięcie w nazwę zadania rozwija od razu komentarze i checklistę (bez osobnych kliknięć)
  function expandTaskDetails(eventId){
    const opening = !(openComments[eventId] && openChecklist[eventId]);
    setOpenComments(o => ({ ...o, [eventId]: opening }));
    setOpenChecklist(o => ({ ...o, [eventId]: opening }));
    if (opening) {
      if (!commentsByEvent[eventId]) loadComments(eventId);
      if (!checklistByEvent[eventId]) loadChecklist(eventId);
    }
  }

  async function addComment(eventId, text){
    const trimmed = (text || "").trim();
    if (!trimmed) return;
    await supabase.from("event_comments").insert({ event_id: eventId, author_id: profile.id, body: trimmed });
    loadComments(eventId);
  }

  async function addReminder(eventId, reminderType, eventDate, eventTime, eventTitle){
    if (!reminderType) return;
    try {
      const eventDateTime = new Date(`${eventDate}T${eventTime || "09:00"}`);
      const sendAt = new Date(eventDateTime);

      if (reminderType === "15min") {
        sendAt.setMinutes(sendAt.getMinutes() - 15);
      } else if (reminderType === "1hour") {
        sendAt.setHours(sendAt.getHours() - 1);
      } else if (reminderType === "1day") {
        sendAt.setDate(sendAt.getDate() - 1);
      }

      if (sendAt < new Date()) {
        setError("Ten czas już minął!");
        return;
      }

      const userEmail = profile.email;
      const { error: err } = await supabase.from("reminders").upsert({
        event_id: eventId,
        user_id: profile.id,
        user_email: userEmail,
        event_title: eventTitle,
        event_date: eventDate,
        event_time: eventTime,
        reminder_type: reminderType,
        send_at: sendAt.toISOString(),
        sent: false,
      }, { onConflict: "event_id,reminder_type" });

      if (err) throw err;
      await loadReminders(eventId);
    } catch (err) {
      setError(err.message);
    }
  }

  async function removeReminder(eventId, reminderId){
    setRemindersByEvent(prev => ({ ...prev, [eventId]: (prev[eventId] || []).filter(r => r.id !== reminderId) }));
    const { error: err } = await supabase.from("reminders").delete().eq("id", reminderId);
    if (err) { setError(err.message); loadReminders(eventId); }
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
  const week = useMemo(() => buildWeekGrid(cursor), [cursor]);

  const eventsByDay = useMemo(() => {
    const map = {};
    visibleEvents.forEach(ev => {
      const start = ev.event_date;
      const end = ev.event_end_date && ev.event_end_date > ev.event_date ? ev.event_end_date : ev.event_date;
      let cursorDate = new Date(start + "T00:00:00");
      const endDate = new Date(end + "T00:00:00");
      let guard = 0;
      while (cursorDate <= endDate && guard < 366) { // zabezpieczenie przed nieskończoną pętlą
        const key = toKey(cursorDate);
        map[key] = map[key] || [];
        map[key].push(ev);
        cursorDate.setDate(cursorDate.getDate() + 1);
        guard++;
      }
    });
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
    const endDateVal = endDateRef.current?.value || "";
    const payload = {
      company_id: targetCompanyId,
      title,
      type: typeRef.current?.value || "zadanie",
      category: categoryRef.current?.value || "inne",
      event_date: selectedKey,
      event_end_date: endDateVal && endDateVal > selectedKey ? endDateVal : null,
      event_time: timeRef.current?.value || null,
      assignee_id: assigneeRef.current?.value || null,
      created_by: profile.id,
      is_private: canPrivateForForm ? !!privateRef.current?.checked : false,
    };
    const { data, error: err } = await supabase.from("events").insert(payload).select().single();
    if (err) { setFormError(err.message); return; }
    setEvents(prev => [...(prev || []), data]);
    if (titleRef.current) titleRef.current.value = "";
    if (timeRef.current) timeRef.current.value = "";
    if (endDateRef.current) endDateRef.current.value = "";
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

  async function updateEvent(id, patch){
    const fullPatch = { ...patch, updated_by: profile.id, updated_at: new Date().toISOString() };
    setEvents(prev => (prev || []).map(e => e.id === id ? { ...e, ...fullPatch } : e));
    const { error: err } = await supabase.from("events").update(fullPatch).eq("id", id);
    if (err) { setError(err.message); loadEvents(); }
  }

  // Nazwa osoby po jej profile_id - do podpisu "kto edytował" (przeszukuje właściwy zestaw osób
  // zależnie od trybu: pojedyncza firma albo widok "wszystkie firmy")
  function profileNameById(profileId, companyId){
    if (!profileId) return null;
    const roster = isAll ? (teamByCompany[companyId] || []) : team;
    const t = roster.find(m => m.profile_id === profileId);
    if (t) return t.profiles?.full_name || t.profiles?.email;
    if (profileId === profile.id) return profile.full_name || profile.email;
    return null;
  }

  // Po wybraniu dnia: zadania, które już mają komentarze albo checklistę,
  // rozwijają się od razu - bez potrzeby dodatkowego klikania.
  useEffect(() => {
    dayEvents.forEach(ev => {
      const hasComments = (badgeCounts.comments?.[ev.id] || 0) > 0;
      const hasChecklist = (badgeCounts.checklist?.[ev.id]?.total || 0) > 0;
      if (hasComments && !openComments[ev.id]) {
        setOpenComments(o => ({ ...o, [ev.id]: true }));
        if (!commentsByEvent[ev.id]) loadComments(ev.id);
      }
      if (hasChecklist && !openChecklist[ev.id]) {
        setOpenChecklist(o => ({ ...o, [ev.id]: true }));
        if (!checklistByEvent[ev.id]) loadChecklist(ev.id);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey, badgeCounts, dayEvents.length]);

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
              {isAll ? <LayoutGrid size={16} color="#4d3658" /> : <Building2 size={16} color="#4d3658" />}
              <span className="top-header-title" style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 26, color: "#4d3658" }}>
                {isAll ? "Wszystkie firmy" : (companyName || "Kalendarz")}
              </span>
            </div>
            <div style={{ fontSize: 12, color: "#8b8f86", marginTop: 2, display: "flex", alignItems: "center", gap: 6 }}>
              <Users size={12} /> {profile.full_name || profile.email}
              {isBossSomewhere && <span style={{ fontSize: 10, fontWeight: 800, color: "#fff", background: "#4d3658", padding: "1px 7px", borderRadius: 20 }}>SZEF</span>}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <PushNotificationButton profile={profile} />
            {!isAll && isBossOrAdmin && (
              <button onClick={() => setShowTeamPanel(s => !s)} style={tabStyle(showTeamPanel)}><Settings size={15} style={{ marginRight: 6 }} /> Zespół</button>
            )}
            <button onClick={() => setView("miesiac")} style={tabStyle(view === "miesiac")}><CalendarDays size={15} style={{ marginRight: 6 }} /> Miesiąc</button>
            <button onClick={() => setView("tydzien")} style={tabStyle(view === "tydzien")}><CalendarDays size={15} style={{ marginRight: 6 }} /> Tydzień</button>
            <button onClick={() => setView("lista")} style={tabStyle(view === "lista")}><ListChecks size={15} style={{ marginRight: 6 }} /> Lista</button>
            {!isAll && (
              <button onClick={() => setView("zadania_ogolne")} style={tabStyle(view === "zadania_ogolne")}><ClipboardList size={15} style={{ marginRight: 6 }} /> Zadania ogólne</button>
            )}
            <button onClick={onLogout} style={{ ...iconBtn, border: "1px solid #d4c4b0", borderRadius: 8 }} title="Wyloguj"><LogOut size={15} /></button>
          </div>
        </header>

        {error && <div style={{ background: "#fdeceb", color: "#d94a38", padding: "8px 12px", borderRadius: 8, fontSize: 13, marginBottom: 14 }}>{error}</div>}

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

        {view === "zadania_ogolne" ? (
          <CompanyTodoList companyId={companyId} profile={profile} />
        ) : view === "miesiac" ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 20 }}>
            <div style={card}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <button onClick={() => setCursor(new Date(year, month - 1, 1))} style={iconBtn}><ChevronLeft size={18} /></button>
                <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 800, fontSize: 19 }}>{MONTHS_PL[month]} {year}</div>
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
                      border: isSelected ? "2px solid #4d3658" : "1px solid #d4c4b0",
                      background: isToday ? "#fef3d4" : "#fff", borderRadius: 9, minHeight: 56, padding: 5,
                      textAlign: "left", cursor: "pointer", opacity: inMonth ? 1 : 0.35, display: "flex", flexDirection: "column", gap: 3,
                    }}>
                      <span style={{ fontSize: 12, fontWeight: isToday ? 800 : 600, color: isToday ? "#C5E548" : "#22301f" }}>{d.getDate()}</span>
                      {allDone && <Check size={10} color="#4d3658" />}
                      {hasStarred && <Star size={9} fill="#C5E548" color="#C5E548" />}
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
              titleRef={titleRef} typeRef={typeRef} categoryRef={categoryRef} timeRef={timeRef} endDateRef={endDateRef} assigneeRef={assigneeRef} privateRef={privateRef}
              team={rosterForForm} canPrivate={canPrivateForForm} formError={formError} addEvent={addEvent}
              toggleComplete={toggleComplete} toggleStarred={toggleStarred} removeEvent={removeEvent} updateEvent={updateEvent} profileNameById={profileNameById}
              openComments={openComments} toggleCommentsPanel={toggleCommentsPanel}
              commentsByEvent={commentsByEvent} addComment={addComment} colorFor={eventColor} nameFor={eventAssigneeName}
              isAll={isAll} companiesMeta={companiesMeta} formCompanyId={formCompanyId} setFormCompanyId={setFormCompanyId}
              showCompanyBadge={isAll}
              openReminders={openReminders} toggleRemindersPanel={toggleRemindersPanel}
              remindersByEvent={remindersByEvent} addReminder={addReminder} removeReminder={removeReminder}
              openChecklist={openChecklist} toggleChecklistPanel={toggleChecklistPanel}
              checklistByEvent={checklistByEvent} addChecklistItem={addChecklistItem}
              toggleChecklistItem={toggleChecklistItem} removeChecklistItem={removeChecklistItem}
              profile={profile} badgeCounts={badgeCounts} expandTaskDetails={expandTaskDetails}
            />
          </div>
        ) : view === "tydzien" ? (
          <div style={card}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <button onClick={() => setCursor(new Date(cursor.getTime() - 7 * 24 * 60 * 60 * 1000))} style={iconBtn}><ChevronLeft size={18} /></button>
              <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 800, fontSize: 19 }}>
                Tydzień: {toKey(week[0])} – {toKey(week[6])}
              </div>
              <button onClick={() => setCursor(new Date(cursor.getTime() + 7 * 24 * 60 * 60 * 1000))} style={iconBtn}><ChevronRight size={18} /></button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8, marginBottom: 14 }}>
              {week.map((d, i) => {
                const key = toKey(d);
                const dayList = eventsByDay[key] || [];
                const isToday = sameDay(d, new Date());
                return (
                  <div key={i} style={{ background: isToday ? "#fef3d4" : "#fff", border: `1px solid ${isToday ? "#C5E548" : "#d4c4b0"}`, borderRadius: 10, padding: 12, minHeight: 200 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: isToday ? "#C5E548" : "#8b8f86", marginBottom: 8, textTransform: "uppercase" }}>
                      {DAYS_PL[d.getDay() === 0 ? 6 : d.getDay() - 1]} {d.getDate()}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {dayList.length === 0 ? (
                        <div style={{ color: "#b0a89a", fontSize: 12, fontStyle: "italic" }}>Brak zdarzeń</div>
                      ) : (
                        dayList.map(ev => (
                          <div key={ev.id} onClick={() => { setSelectedDate(d); setView("miesiac"); }} style={{
                            background: "#f9f6f0", border: `2px solid ${eventColor(ev)}`, borderRadius: 8, padding: 8, cursor: "pointer",
                            fontSize: 11.5, color: ev.completed ? "#a3a698" : "#22301f", textDecoration: ev.completed ? "line-through" : "none",
                            opacity: ev.completed ? 0.6 : 1
                          }}>
                            <div style={{ fontWeight: 700, marginBottom: 2 }}>{ev.title}</div>
                            {ev.event_time && <div style={{ fontSize: 10.5, color: "#8b8f86" }}>{ev.event_time.slice(0,5)}</div>}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <button onClick={() => { setSelectedDate(new Date()); setShowForm(true); setView("miesiac"); }} style={addBtn}>
              <Plus size={15} style={{ marginRight: 4 }} /> Dodaj zdarzenie
            </button>
          </div>
        ) : (
          <div style={card}>
            <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 800, fontSize: 20, marginBottom: 12 }}>Nadchodzące (niezakończone)</div>
            {upcoming.length === 0 ? <div style={{ color: "#8b8f86", fontSize: 13 }}>Brak nadchodzących zadań.</div> : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {upcoming.map(ev => (
                  <EventRow key={ev.id} ev={ev} showDate
                    toggleComplete={toggleComplete} toggleStarred={toggleStarred} removeEvent={removeEvent} updateEvent={updateEvent} profileNameById={profileNameById}
                    isOpen={!!openComments[ev.id]} onToggleComments={() => toggleCommentsPanel(ev.id)}
                    comments={commentsByEvent[ev.id] || []} addComment={addComment}
                    colorFor={eventColor} nameFor={eventAssigneeName}
                    companyBadge={isAll ? companiesMeta[ev.company_id] : null}
                    isOpenReminders={!!openReminders[ev.id]} onToggleReminders={() => toggleRemindersPanel(ev.id)}
                    reminders={remindersByEvent[ev.id] || []} addReminder={addReminder} removeReminder={removeReminder}
                    isOpenChecklist={!!openChecklist[ev.id]} onToggleChecklist={() => toggleChecklistPanel(ev.id)} onExpand={() => expandTaskDetails(ev.id)}
                    checklist={checklistByEvent[ev.id] || []} addChecklistItem={addChecklistItem}
                    toggleChecklistItem={toggleChecklistItem} removeChecklistItem={removeChecklistItem}
                    profile={profile} badgeCounts={badgeCounts}
                    roster={isAll ? (teamByCompany[ev.company_id] || []) : team}
                    canPrivate={isAll ? (profile.is_super_admin || (teamByCompany[ev.company_id] || []).some(m => m.profile_id === profile.id && m.role === "szef")) : isBossOrAdmin}
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

function DayPanel({ date, dayEvents, showForm, setShowForm, titleRef, typeRef, categoryRef, timeRef, endDateRef, assigneeRef, privateRef,
  team, canPrivate, formError, addEvent, toggleComplete, toggleStarred, removeEvent, openComments, toggleCommentsPanel,
  commentsByEvent, addComment, colorFor, nameFor, isAll, companiesMeta, formCompanyId, setFormCompanyId, showCompanyBadge,
  openReminders, toggleRemindersPanel, remindersByEvent, addReminder, removeReminder,
  openChecklist, toggleChecklistPanel, checklistByEvent, addChecklistItem, toggleChecklistItem, removeChecklistItem, profile, badgeCounts, expandTaskDetails, updateEvent, profileNameById }){
  const label = date.toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long" });
  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 800, fontSize: 19, textTransform: "capitalize" }}>{label}</div>
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
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <label style={{ fontSize: 11.5, color: "#8b6b5a" }}>Data zakończenia (opcjonalnie — dla wydarzeń trwających kilka dni, np. konferencji)</label>
            <input ref={endDateRef} type="date" min={toKey(date)} style={inputStyle} />
          </div>
          <select ref={assigneeRef} defaultValue="" style={inputStyle} key={formCompanyId}>
            <option value="">Cały zespół</option>
            {team.map(t => <option key={t.profile_id} value={t.profile_id}>{t.profiles?.full_name || t.profiles?.email}</option>)}
          </select>
          {canPrivate && (
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#5c4a1a" }}>
              <input ref={privateRef} type="checkbox" /> Prywatne — niewidoczne dla zespołu
            </label>
          )}
          {formError && <div style={{ color: "#d94a38", fontSize: 12.5 }}>{formError}</div>}
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
              toggleComplete={toggleComplete} toggleStarred={toggleStarred} removeEvent={removeEvent} updateEvent={updateEvent} profileNameById={profileNameById}
              isOpen={!!openComments[ev.id]} onToggleComments={() => toggleCommentsPanel(ev.id)}
              comments={commentsByEvent[ev.id] || []} addComment={addComment}
              colorFor={colorFor} nameFor={nameFor}
              companyBadge={showCompanyBadge ? companiesMeta[ev.company_id] : null}
              isOpenReminders={!!openReminders[ev.id]} onToggleReminders={() => toggleRemindersPanel(ev.id)}
              reminders={remindersByEvent[ev.id] || []} addReminder={addReminder} removeReminder={removeReminder}
              isOpenChecklist={!!openChecklist[ev.id]} onToggleChecklist={() => toggleChecklistPanel(ev.id)} onExpand={() => expandTaskDetails(ev.id)}
              checklist={checklistByEvent[ev.id] || []} addChecklistItem={addChecklistItem}
              toggleChecklistItem={toggleChecklistItem} removeChecklistItem={removeChecklistItem}
              profile={profile} badgeCounts={badgeCounts} roster={team} canPrivate={canPrivate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function EventRow({ ev, showDate, toggleComplete, toggleStarred, removeEvent, updateEvent, isOpen, onToggleComments, comments, addComment, colorFor, nameFor, companyBadge,
  isOpenReminders, onToggleReminders, reminders, addReminder, removeReminder,
  isOpenChecklist, onToggleChecklist, checklist, addChecklistItem, toggleChecklistItem, removeChecklistItem, profile, onExpand, badgeCounts, profileNameById, roster, canPrivate }){
  const meta = TYPE_META[ev.type] || TYPE_META.zadanie;
  const cat = CATEGORY_META[ev.category] || CATEGORY_META.inne;
  const userColor = colorFor(ev);
  const commentRef = useRef(null);
  const checklistInputRef = useRef(null);
  const [selectedReminder, setSelectedReminder] = React.useState("");
  const [isEditing, setIsEditing] = React.useState(false);
  const [editError, setEditError] = React.useState("");
  const editTitleRef = useRef(null);
  const editTypeRef = useRef(null);
  const editCategoryRef = useRef(null);
  const editTimeRef = useRef(null);
  const editEndDateRef = useRef(null);
  const editAssigneeRef = useRef(null);
  const editPrivateRef = useRef(null);

  const editorName = ev.updated_by ? profileNameById?.(ev.updated_by, ev.company_id) : null;

  // Liczniki-znaczniki widoczne OD RAZU (bez otwierania panelu) - pobrane zbiorczo dla wszystkich zadań.
  // Gdy panel jest już otwarty i wczytany, korzystamy z dokładnych danych z niego.
  const badgeChecklist = badgeCounts?.checklist?.[ev.id];
  const checklistCount = isOpenChecklist ? checklist.length : (badgeChecklist?.total || 0);
  const checklistDone = isOpenChecklist ? checklist.filter(i => i.done).length : (badgeChecklist?.done || 0);
  const commentCount = isOpen ? comments.length : (badgeCounts?.comments?.[ev.id] || 0);
  const reminderCount = isOpenReminders ? reminders.length : (badgeCounts?.reminders?.[ev.id] || 0);

  function submitComment(){
    const val = commentRef.current?.value || "";
    addComment(ev.id, val);
    if (commentRef.current) commentRef.current.value = "";
  }

  function submitReminder(){
    if (selectedReminder) {
      addReminder(ev.id, selectedReminder, ev.event_date, ev.event_time, ev.title);
      setSelectedReminder("");
    }
  }

  function deleteReminder(reminderId){
    removeReminder(ev.id, reminderId);
  }

  function submitChecklistItem(){
    const val = checklistInputRef.current?.value || "";
    addChecklistItem(ev.id, val);
    if (checklistInputRef.current) checklistInputRef.current.value = "";
  }

  function saveEdit(){
    const title = (editTitleRef.current?.value || "").trim();
    if (!title) { setEditError("Nazwa nie może być pusta."); return; }
    const endDateVal = editEndDateRef.current?.value || "";
    updateEvent(ev.id, {
      title,
      type: editTypeRef.current?.value || "zadanie",
      category: editCategoryRef.current?.value || "inne",
      event_time: editTimeRef.current?.value || null,
      event_end_date: endDateVal && endDateVal > ev.event_date ? endDateVal : null,
      assignee_id: editAssigneeRef.current?.value || null,
      is_private: canPrivate ? !!editPrivateRef.current?.checked : ev.is_private,
    });
    setIsEditing(false);
    setEditError("");
  }

  const doneCount = checklist.filter(i => i.done).length;

  if (isEditing) {
    return (
      <div className="event-row" style={{ border: "1px solid #d4c4b0", borderLeft: `3px solid ${userColor}`, borderRadius: 10, padding: "12px 14px", background: "#fbf9f3" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <input ref={editTitleRef} defaultValue={ev.title} autoFocus placeholder="Nazwa zadania lub spotkania" style={inputStyle} />
          <div className="form-row" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <select ref={editTypeRef} defaultValue={ev.type} style={{ ...inputStyle, flex: "1 1 120px" }}>
              <option value="zadanie">Zadanie</option><option value="spotkanie">Spotkanie</option>
            </select>
            <select ref={editCategoryRef} defaultValue={ev.category} style={{ ...inputStyle, flex: "1 1 140px" }}>
              {Object.entries(CATEGORY_META).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <input ref={editTimeRef} type="time" defaultValue={ev.event_time ? ev.event_time.slice(0,5) : ""} style={{ ...inputStyle, flex: "1 1 100px" }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <label style={{ fontSize: 11.5, color: "#8b6b5a" }}>Data zakończenia (dla wydarzeń wielodniowych)</label>
            <input ref={editEndDateRef} type="date" min={ev.event_date} defaultValue={ev.event_end_date || ""} style={inputStyle} />
          </div>
          <select ref={editAssigneeRef} defaultValue={ev.assignee_id || ""} style={inputStyle}>
            <option value="">Cały zespół</option>
            {(roster || []).map(t => <option key={t.profile_id} value={t.profile_id}>{t.profiles?.full_name || t.profiles?.email}</option>)}
          </select>
          {canPrivate && (
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#5c4a1a" }}>
              <input ref={editPrivateRef} type="checkbox" defaultChecked={ev.is_private} /> Prywatne — niewidoczne dla zespołu
            </label>
          )}
          {editError && <div style={{ color: "#d94a38", fontSize: 12.5 }}>{editError}</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={saveEdit} style={saveBtn}>Zapisz</button>
            <button type="button" onClick={() => { setIsEditing(false); setEditError(""); }} style={cancelBtn}>Anuluj</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="event-row" style={{ border: "1px solid #d4c4b0", borderLeft: `3px solid ${userColor}`, borderRadius: 10, padding: "12px 14px" }}>
      <div className="event-row-head" style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <button onClick={() => toggleComplete(ev)} style={{ background: "none", border: "none", cursor: "pointer", marginTop: 2, flexShrink: 0 }}>
          {ev.completed
            ? <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#4d3658", display: "flex", alignItems: "center", justifyContent: "center" }}><Check size={13} color="#fff" /></div>
            : <div style={{ width: 20, height: 20, borderRadius: "50%", border: "2px solid #cfcabb" }} />}
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span onClick={onExpand} style={{ cursor: "pointer", fontWeight: 800, fontSize: 16.5, textDecoration: ev.completed ? "line-through" : "none", color: ev.completed ? "#a3a698" : "#3a2a1f" }}>{ev.title}</span>
            <button onClick={() => toggleStarred(ev)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }} title="Oznacz jako ważne">
              <Star size={16} fill={ev.starred ? "#C5E548" : "none"} color={ev.starred ? "#C5E548" : "#c3bfae"} />
            </button>
            <button onClick={() => setIsEditing(true)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }} title="Edytuj zadanie">
              <Pencil size={14} color="#8b6b5a" />
            </button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
            {companyBadge && <span style={{ fontSize: 11.5, fontWeight: 800, color: "#fff", background: colorFor(ev), padding: "3px 9px", borderRadius: 20 }}>{companyBadge}</span>}
            <span style={{ fontSize: 11.5, fontWeight: 800, color: meta.color, background: "#f0ede2", padding: "3px 9px", borderRadius: 20 }}>{meta.label}</span>
            <span style={{ fontSize: 11.5, fontWeight: 800, color: cat.fg, background: cat.bg, padding: "3px 9px", borderRadius: 20 }}>{cat.label}</span>
            {ev.is_private && <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11.5, fontWeight: 800, color: "#6b6a5e", background: "#f0ede2", padding: "3px 9px", borderRadius: 20 }}><Lock size={10} /> Prywatne</span>}
          </div>
          <div style={{ fontSize: 13, color: "#8b8f86", marginTop: 5, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {showDate && <span>{ev.event_date}{ev.event_end_date && ev.event_end_date > ev.event_date ? ` – ${ev.event_end_date}` : ""}</span>}
            {!showDate && ev.event_end_date && ev.event_end_date > ev.event_date && <span>do {ev.event_end_date}</span>}
            {ev.event_time && <span>{ev.event_time.slice(0,5)}</span>}
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: userColor }} />{nameFor(ev)}</span>
          </div>
          {editorName && (
            <div style={{ fontSize: 11, color: "#a3a698", fontStyle: "italic", marginTop: 2 }}>
              {editorName} wprowadził(a) zmianę {ev.updated_at ? new Date(ev.updated_at).toLocaleString("pl-PL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10, paddingLeft: 30 }}>
        <button onClick={onToggleChecklist} style={pillBtn(checklistCount > 0 ? "#4d3658" : "#d4c4b0")}>
          <ListTodo size={14} color={checklistCount > 0 ? "#4d3658" : "#8b6b5a"} />
          Checklista
          {checklistCount > 0 && <span style={pillCount("#4d3658")}>{checklistDone}/{checklistCount}</span>}
        </button>
        <button onClick={onToggleComments} style={pillBtn(commentCount > 0 ? "#9cb49a" : "#d4c4b0")}>
          <MessageCircle size={14} color={commentCount > 0 ? "#5f7a68" : "#8b6b5a"} />
          Komentarze
          {commentCount > 0 && <span style={pillCount("#9cb49a")}>{commentCount}</span>}
        </button>
        <button onClick={onToggleReminders} style={pillBtn(reminderCount > 0 ? "#33401a" : "#d4c4b0")}>
          <Bell size={14} color={reminderCount > 0 ? "#8a9c1a" : "#8b6b5a"} />
          Przypomnienia
          {reminderCount > 0 && <span style={pillCount("#C5E548")}>{reminderCount}</span>}
        </button>
        <button onClick={() => removeEvent(ev.id)} style={{ ...deleteBtn, marginLeft: "auto" }}>
          <X size={14} /> Usuń
        </button>
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
      {isOpenReminders && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #f0ede2", background: "#fef3d4", borderRadius: 8, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: "#22301f", display: "flex", alignItems: "center", gap: 6 }}><Bell size={16} color="#C5E548" /> Przypomnienia</div>
          
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <select value={selectedReminder} onChange={e => setSelectedReminder(e.target.value)} style={{ ...inputStyle, flex: 1, minWidth: 180 }}>
              <option value="">Wybierz typ przypomnienia...</option>
              {REMINDER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <button onClick={submitReminder} style={saveBtn}>Dodaj</button>
          </div>

          {reminders.length === 0 ? (
            <div style={{ color: "#8b8f86", fontSize: 12 }}>Brak ustawionych przypomnień</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {reminders.map((r) => {
                const opt = REMINDER_OPTIONS.find((o) => o.value === r.reminder_type);
                return (
                  <div
                    key={r.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      background: "#fff",
                      padding: "8px 10px",
                      borderRadius: 8,
                      fontSize: 12,
                      border: "1px solid #d4c4b0",
                    }}
                  >
                    <span style={{ color: "#22301f" }}>⏰ {opt?.label}</span>
                    <button
                      onClick={() => deleteReminder(r.id)}
                      style={{ ...iconBtn, padding: 0, color: "#8b8f86" }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ fontSize: 11, color: "#8b8f86", fontStyle: "italic" }}>
            ✓ {ev.assignee_id
              ? `Wysyłane (mail + push) do: ${nameFor(ev)}`
              : "Wysyłane (mail + push) do całego zespołu tej firmy"}
          </div>
        </div>
      )}
      {isOpenChecklist && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #f0ede2", display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: "#2a2530", display: "flex", alignItems: "center", gap: 6 }}>
            <ListTodo size={15} color="#4d3658" /> Checklista {checklist.length > 0 && `(${doneCount}/${checklist.length})`}
          </div>
          {checklist.length === 0 ? (
            <div style={{ color: "#8b8f86", fontSize: 12 }}>Brak punktów listy.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {checklist.map(item => (
                <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 8, background: "#fbf9f3", borderRadius: 8, padding: "6px 10px" }}>
                  <button onClick={() => toggleChecklistItem(ev.id, item)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, flexShrink: 0 }}>
                    {item.done
                      ? <div style={{ width: 16, height: 16, borderRadius: 4, background: "#4d3658", display: "flex", alignItems: "center", justifyContent: "center" }}><Check size={11} color="#fff" /></div>
                      : <div style={{ width: 16, height: 16, borderRadius: 4, border: "2px solid #cfcabb" }} />}
                  </button>
                  <span style={{ flex: 1, fontSize: 13, textDecoration: item.done ? "line-through" : "none", color: item.done ? "#a3a698" : "#2a2530" }}>{item.text}</span>
                  <button onClick={() => removeChecklistItem(ev.id, item.id)} style={{ ...iconBtn, padding: 0 }}><X size={12} /></button>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: "flex", gap: 6 }}>
            <input ref={checklistInputRef} placeholder="Nowy punkt listy…" style={{ ...inputStyle, flex: 1 }} onKeyDown={e => { if (e.key === "Enter") submitChecklistItem(); }} />
            <button type="button" onClick={submitChecklistItem} style={saveBtn}>Dodaj</button>
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
      <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 800, fontSize: 18, marginBottom: 10 }}>Zespół</div>
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
              <button onClick={() => removeMember(t.id)} style={{ background: "none", border: "none", color: "#d94a38", cursor: "pointer", fontSize: 12 }}>Usuń</button>
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

function PushNotificationButton({ profile }){
  const [status, setStatus] = useState("checking"); // checking | unsupported | off | on | error
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!isPushSupported()) { setStatus("unsupported"); return; }
    getCurrentPushSubscription().then(sub => setStatus(sub ? "on" : "off")).catch(() => setStatus("off"));
  }, []);

  async function handleClick(){
    if (status === "on") {
      setStatus("checking");
      try {
        await unsubscribeFromPush(profile.id);
        setStatus("off");
      } catch (e) {
        setStatus("on");
      }
      return;
    }
    setStatus("checking");
    setErrorMsg("");
    try {
      await subscribeToPush(profile.id);
      setStatus("on");
    } catch (e) {
      setStatus("error");
      setErrorMsg(e.message || "Nie udało się włączyć powiadomień.");
    }
  }

  if (status === "unsupported") {
    return (
      <span style={{ fontSize: 11.5, color: "#8b6b5a" }} title="Ta przeglądarka/urządzenie nie wspiera powiadomień push">
        Powiadomienia niedostępne tutaj
      </span>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
      <button onClick={handleClick} disabled={status === "checking"} style={tabStyle(status === "on")}>
        {status === "on" ? <BellRing size={15} style={{ marginRight: 6 }} /> : <Bell size={15} style={{ marginRight: 6 }} />}
        {status === "checking" ? "Chwila…" : status === "on" ? "Powiadomienia wł." : "Włącz powiadomienia"}
      </button>
      {status === "error" && <span style={{ fontSize: 11, color: "#d94a38", maxWidth: 220, textAlign: "right" }}>{errorMsg}</span>}
    </div>
  );
}

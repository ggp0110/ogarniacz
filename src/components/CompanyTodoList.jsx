import React, { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "../supabaseClient";
import { card, inputStyle, saveBtn, cancelBtn, addBtn, iconBtn } from "../theme";
import { Plus, X, Lock, Loader2, ClipboardList, ArrowLeft } from "lucide-react";

export default function CompanyTodoList({ companyId, profile }){
  const [lists, setLists] = useState(null);
  const [activeListId, setActiveListId] = useState(null);
  const [items, setItems] = useState({});
  const [error, setError] = useState("");
  const [showNewList, setShowNewList] = useState(false);
  const titleRef = useRef(null);
  const listPrivateRef = useRef(null);
  const itemTextRef = useRef(null);

  const loadLists = useCallback(async () => {
    const { data, error: err } = await supabase
      .from("todo_lists")
      .select("*")
      .eq("company_id", companyId)
      .order("position")
      .order("created_at");
    if (err) setError(err.message);
    else setLists(data || []);
  }, [companyId]);

  useEffect(() => { loadLists(); }, [loadLists]);

  useEffect(() => {
    const channel = supabase.channel(`company-todo-lists-${companyId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "todo_lists", filter: `company_id=eq.${companyId}` }, () => loadLists())
      .on("postgres_changes", { event: "*", schema: "public", table: "todo_items" }, (payload) => {
        const listId = payload.new?.list_id || payload.old?.list_id;
        if (listId) loadItems(listId);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  async function loadItems(listId){
    const { data, error: err } = await supabase
      .from("todo_items")
      .select("*")
      .eq("list_id", listId)
      .order("position")
      .order("created_at");
    if (err) { setError(err.message); return; }
    setItems(prev => ({ ...prev, [listId]: data || [] }));
  }

  useEffect(() => { if (activeListId) loadItems(activeListId); }, [activeListId]);

  async function addList(){
    const title = (titleRef.current?.value || "").trim();
    if (!title) return;
    const isPrivate = !!listPrivateRef.current?.checked;
    const currentCount = (lists || []).length;
    const { error: err } = await supabase.from("todo_lists").insert({
      company_id: companyId, title, is_private: isPrivate, position: currentCount, created_by: profile.id,
    });
    if (err) { setError(err.message); return; }
    if (titleRef.current) titleRef.current.value = "";
    if (listPrivateRef.current) listPrivateRef.current.checked = false;
    setShowNewList(false);
  }

  async function removeList(id){
    if (!window.confirm("Usunąć tę listę razem ze wszystkimi punktami?")) return;
    setLists(prev => (prev || []).filter(l => l.id !== id));
    if (activeListId === id) setActiveListId(null);
    const { error: err } = await supabase.from("todo_lists").delete().eq("id", id);
    if (err) { setError(err.message); loadLists(); }
  }

  async function addItem(){
    const text = (itemTextRef.current?.value || "").trim();
    if (!text || !activeListId) return;
    const currentCount = (items[activeListId] || []).length;
    const { error: err } = await supabase.from("todo_items").insert({
      list_id: activeListId, text, position: currentCount, created_by: profile.id,
    });
    if (err) { setError(err.message); return; }
    if (itemTextRef.current) itemTextRef.current.value = "";
  }

  async function toggleDone(item){
    setItems(prev => ({ ...prev, [item.list_id]: (prev[item.list_id] || []).map(i => i.id === item.id ? { ...i, done: !item.done } : i) }));
    const { error: err } = await supabase.from("todo_items").update({ done: !item.done }).eq("id", item.id);
    if (err) { setError(err.message); loadItems(item.list_id); }
  }

  async function removeItem(item){
    setItems(prev => ({ ...prev, [item.list_id]: (prev[item.list_id] || []).filter(i => i.id !== item.id) }));
    const { error: err } = await supabase.from("todo_items").delete().eq("id", item.id);
    if (err) { setError(err.message); loadItems(item.list_id); }
  }

  if (lists === null) {
    return <div style={{ ...card, display: "flex", alignItems: "center", gap: 8, color: "#8b6b5a" }}><Loader2 size={16} /> Wczytywanie…</div>;
  }

  const activeList = lists.find(l => l.id === activeListId);

  // Widok pojedynczej listy
  if (activeList) {
    const list = items[activeListId] || [];
    const doneCount = list.filter(i => i.done).length;
    return (
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <button onClick={() => setActiveListId(null)} style={iconBtn} title="Wróć do listy list"><ArrowLeft size={16} /></button>
          <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 800, fontSize: 20, flex: 1 }}>{activeList.title}</div>
          {activeList.is_private && (
            <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: "#6b6a5e", background: "#f0ede2", padding: "3px 9px", borderRadius: 20 }}>
              <Lock size={10} /> Prywatna
            </span>
          )}
          {list.length > 0 && <span style={{ fontSize: 12.5, color: "#8b6b5a" }}>{doneCount}/{list.length}</span>}
        </div>

        {error && <div style={{ background: "#fdeceb", color: "#d94a38", padding: "8px 12px", borderRadius: 8, fontSize: 13, marginBottom: 12 }}>{error}</div>}

        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <input ref={itemTextRef} placeholder="Nowy punkt…" style={{ ...inputStyle, flex: 1 }} onKeyDown={e => { if (e.key === "Enter") addItem(); }} />
          <button type="button" onClick={addItem} style={saveBtn}><Plus size={14} style={{ marginRight: 4 }} /> Dodaj</button>
        </div>

        {list.length === 0 ? (
          <div style={{ color: "#8b6b5a", fontSize: 13 }}>Brak punktów — dodaj pierwszy powyżej.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {list.map(item => (
              <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 10, border: "1px solid #d4c4b0", borderRadius: 8, padding: "8px 12px" }}>
                <button onClick={() => toggleDone(item)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, flexShrink: 0 }}>
                  {item.done
                    ? <div style={{ width: 18, height: 18, borderRadius: 5, background: "#4d3658", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12 }}>✓</div>
                    : <div style={{ width: 18, height: 18, borderRadius: 5, border: "2px solid #cfcabb" }} />}
                </button>
                <span style={{ flex: 1, fontSize: 14.5, textDecoration: item.done ? "line-through" : "none", color: item.done ? "#a3a698" : "#3a2a1f" }}>
                  {item.text}
                </span>
                <button onClick={() => removeItem(item)} style={iconBtn}><X size={14} /></button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Widok listy list
  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "'Fraunces', serif", fontWeight: 800, fontSize: 20 }}>
          <ClipboardList size={18} color="#4d3658" /> Zadania ogólne
        </div>
        <button onClick={() => setShowNewList(s => !s)} style={addBtn}><Plus size={15} style={{ marginRight: 4 }} /> Nowa lista</button>
      </div>

      {error && <div style={{ background: "#fdeceb", color: "#d94a38", padding: "8px 12px", borderRadius: 8, fontSize: 13, marginBottom: 12 }}>{error}</div>}

      {showNewList && (
        <div style={{ background: "#fbf9f3", borderRadius: 10, padding: 12, marginBottom: 14, display: "flex", flexDirection: "column", gap: 8 }}>
          <input ref={titleRef} autoFocus placeholder="Nazwa listy (np. Zakupy biurowe, Pomysły)" style={inputStyle} onKeyDown={e => { if (e.key === "Enter") addList(); }} />
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#5c4a1a" }}>
            <input ref={listPrivateRef} type="checkbox" /> Prywatna — niewidoczna dla zespołu
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={addList} style={saveBtn}>Utwórz</button>
            <button type="button" onClick={() => setShowNewList(false)} style={cancelBtn}>Anuluj</button>
          </div>
        </div>
      )}

      {lists.length === 0 ? (
        <div style={{ color: "#8b6b5a", fontSize: 13 }}>Brak list — utwórz pierwszą powyżej.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {lists.map(list => (
            <div key={list.id} style={{ display: "flex", alignItems: "center", gap: 10, border: "1px solid #d4c4b0", borderRadius: 10, padding: "12px 14px" }}>
              <button onClick={() => setActiveListId(list.id)} style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0 }}>
                <span style={{ fontWeight: 700, fontSize: 14.5, color: "#3a2a1f" }}>{list.title}</span>
                {list.is_private && (
                  <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10.5, fontWeight: 700, color: "#6b6a5e", background: "#f0ede2", padding: "2px 8px", borderRadius: 20 }}>
                    <Lock size={9} /> Prywatna
                  </span>
                )}
              </button>
              <button onClick={() => removeList(list.id)} style={iconBtn}><X size={14} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

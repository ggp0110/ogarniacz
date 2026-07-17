import React, { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "../supabaseClient";
import { card, inputStyle, saveBtn, iconBtn } from "../theme";
import { Plus, X, Lock, Loader2, ClipboardList } from "lucide-react";

export default function CompanyTodoList({ companyId, profile }){
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  const textRef = useRef(null);
  const privateRef = useRef(null);

  const loadItems = useCallback(async () => {
    const { data, error: err } = await supabase
      .from("todo_items")
      .select("*")
      .eq("company_id", companyId)
      .order("position")
      .order("created_at");
    if (err) setError(err.message);
    else setItems(data || []);
  }, [companyId]);

  useEffect(() => { loadItems(); }, [loadItems]);

  useEffect(() => {
    const channel = supabase.channel(`company-todo-${companyId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "todo_items", filter: `company_id=eq.${companyId}` }, () => loadItems())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [companyId, loadItems]);

  async function addItem(){
    const text = (textRef.current?.value || "").trim();
    if (!text) return;
    const isPrivate = !!privateRef.current?.checked;
    const currentCount = (items || []).length;
    const { error: err } = await supabase.from("todo_items").insert({
      company_id: companyId, text, is_private: isPrivate, position: currentCount, created_by: profile.id,
    });
    if (err) { setError(err.message); return; }
    if (textRef.current) textRef.current.value = "";
    if (privateRef.current) privateRef.current.checked = false;
  }

  async function toggleDone(item){
    setItems(prev => (prev || []).map(i => i.id === item.id ? { ...i, done: !item.done } : i));
    const { error: err } = await supabase.from("todo_items").update({ done: !item.done }).eq("id", item.id);
    if (err) { setError(err.message); loadItems(); }
  }

  async function removeItem(id){
    setItems(prev => (prev || []).filter(i => i.id !== id));
    const { error: err } = await supabase.from("todo_items").delete().eq("id", id);
    if (err) { setError(err.message); loadItems(); }
  }

  if (items === null) {
    return <div style={{ ...card, display: "flex", alignItems: "center", gap: 8, color: "#8b6b5a" }}><Loader2 size={16} /> Wczytywanie…</div>;
  }

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "'Fraunces', serif", fontWeight: 800, fontSize: 20, marginBottom: 14 }}>
        <ClipboardList size={18} color="#4d3658" /> Zadania ogólne
      </div>

      {error && <div style={{ background: "#fdeceb", color: "#d94a38", padding: "8px 12px", borderRadius: 8, fontSize: 13, marginBottom: 12 }}>{error}</div>}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        <input ref={textRef} placeholder="Nowy punkt…" style={{ ...inputStyle, flex: "1 1 220px" }} onKeyDown={e => { if (e.key === "Enter") addItem(); }} />
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#5c4a1a", whiteSpace: "nowrap" }}>
          <input ref={privateRef} type="checkbox" /> Prywatne
        </label>
        <button type="button" onClick={addItem} style={saveBtn}><Plus size={14} style={{ marginRight: 4 }} /> Dodaj</button>
      </div>

      {items.length === 0 ? (
        <div style={{ color: "#8b6b5a", fontSize: 13 }}>Brak punktów — dodaj pierwszy powyżej.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {items.map(item => (
            <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 10, border: "1px solid #d4c4b0", borderRadius: 8, padding: "8px 12px" }}>
              <button onClick={() => toggleDone(item)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, flexShrink: 0 }}>
                {item.done
                  ? <div style={{ width: 18, height: 18, borderRadius: 5, background: "#4d3658", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12 }}>✓</div>
                  : <div style={{ width: 18, height: 18, borderRadius: 5, border: "2px solid #cfcabb" }} />}
              </button>
              <span style={{ flex: 1, fontSize: 14.5, textDecoration: item.done ? "line-through" : "none", color: item.done ? "#a3a698" : "#3a2a1f" }}>
                {item.text}
              </span>
              {item.is_private && (
                <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 700, color: "#6b6a5e", background: "#f0ede2", padding: "2px 8px", borderRadius: 20 }}>
                  <Lock size={9} /> Prywatne
                </span>
              )}
              <button onClick={() => removeItem(item.id)} style={iconBtn}><X size={14} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

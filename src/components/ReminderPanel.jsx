import React, { useState, useRef } from "react";
import { supabase } from "../supabaseClient";
import { card, inputStyle, saveBtn, cancelBtn, iconBtn } from "../theme";
import { X, Bell } from "lucide-react";

const REMINDER_OPTIONS = [
  { value: "15min", label: "15 minut przed" },
  { value: "1hour", label: "1 godzinę przed" },
  { value: "1day", label: "1 dzień przed" },
];

export default function ReminderPanel({ eventId, eventDate, eventTime, userEmail, userId, onClose, onReminderAdded }) {
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const selectedRef = useRef(null);

  React.useEffect(() => {
    loadReminders();
  }, [eventId]);

  async function loadReminders() {
    const { data, error: err } = await supabase
      .from("reminders")
      .select("*")
      .eq("event_id", eventId)
      .eq("user_id", userId);
    if (err) setError(err.message);
    else setReminders(data || []);
  }

  async function addReminder() {
    const reminderType = selectedRef.current?.value;
    if (!reminderType) {
      setError("Wybierz typ przypomnienia");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Oblicz kiedy wysłać maila
      const eventDateTime = new Date(`${eventDate}T${eventTime || "09:00"}Z`);
      const sendAt = new Date(eventDateTime);

      if (reminderType === "15min") {
        sendAt.setMinutes(sendAt.getMinutes() - 15);
      } else if (reminderType === "1hour") {
        sendAt.setHours(sendAt.getHours() - 1);
      } else if (reminderType === "1day") {
        sendAt.setDate(sendAt.getDate() - 1);
      }

      // Jeśli czas już minął, nie dodawaj
      if (sendAt < new Date()) {
        setError("Ten czas już minął!");
        setLoading(false);
        return;
      }

      const { error: err } = await supabase.from("reminders").insert({
        event_id: eventId,
        user_id: userId,
        user_email: userEmail,
        event_title: "Zdarzenie", // To będzie potrzebne, ale można pobrać z eventu
        event_date: eventDate,
        event_time: eventTime,
        reminder_type: reminderType,
        send_at: sendAt.toISOString(),
      });

      if (err) throw err;

      // Odśwież listę
      await loadReminders();
      onReminderAdded?.();
      selectedRef.current.value = "";
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function removeReminder(reminderId) {
    const { error: err } = await supabase.from("reminders").delete().eq("id", reminderId);
    if (err) {
      setError(err.message);
    } else {
      await loadReminders();
    }
  }

  return (
    <div style={{ ...card, background: "#fbf9f3", borderLeft: "4px solid #f0c300" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Bell size={16} color="#f0c300" />
          <span style={{ fontWeight: 700, fontSize: 14, color: "#22301f" }}>Przypomnienia</span>
        </div>
        <button onClick={onClose} style={iconBtn}>
          <X size={14} />
        </button>
      </div>

      {error && <div style={{ color: "#9a3b34", fontSize: 12, marginBottom: 8 }}>{error}</div>}

      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <select ref={selectedRef} style={{ ...inputStyle, flex: 1, minWidth: 180 }}>
          <option value="">Wybierz typ przypomnienia...</option>
          {REMINDER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <button onClick={addReminder} disabled={loading} style={{ ...saveBtn, opacity: loading ? 0.6 : 1 }}>
          {loading ? "..." : "Dodaj"}
        </button>
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
                  onClick={() => removeReminder(r.id)}
                  style={{ ...iconBtn, padding: 0, color: "#8b8f86" }}
                >
                  <X size={12} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ marginTop: 10, fontSize: 11, color: "#8b8f86", fontStyle: "italic" }}>
        ✓ Maile będą wysłane automatycznie na: {userEmail}
      </div>
    </div>
  );
}

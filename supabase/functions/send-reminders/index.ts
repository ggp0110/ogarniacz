// Supabase Edge Function
// Tworzysz w: Supabase Dashboard -> Edge Functions -> Create function -> "send-reminders"
// Wklej zawartość poniżej

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";
import { Resend } from "https://esm.sh/resend@2.0.0";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL"),
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
);

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

export default async (req) => {
  if (req.method === "POST") {
    try {
      const now = new Date().toISOString();

      // Pobierz wszystkie przesłane przesłania, które się zdarzają teraz
      const { data: reminders, error: fetchError } = await supabase
        .from("reminders")
        .select("*")
        .eq("sent", false)
        .lte("send_at", now)
        .limit(50); // Przetwarzaj max 50 na raz

      if (fetchError) {
        return new Response(JSON.stringify({ error: fetchError.message }), {
          status: 500,
        });
      }

      let sent = 0;
      let failed = 0;

      for (const reminder of reminders || []) {
        try {
          // Oblicz czas do wydarzenia
          const eventDateTime = reminder.event_time
            ? `${reminder.event_date} ${reminder.event_time}`
            : reminder.event_date;

          const reminderLabel = {
            "15min": "za 15 minut",
            "1hour": "za 1 godzinę",
            "1day": "jutro o tej samej godzinie",
          }[reminder.reminder_type] || reminder.reminder_type;

          // Wyślij email
          const emailResult = await resend.emails.send({
            from: "przypomnienie@ogarniacz.pl",
            to: reminder.user_email,
            subject: `📅 Przypomnienie: ${reminder.event_title}`,
            html: `
              <div style="font-family: 'Nunito', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: linear-gradient(135deg, #8b2e4a 0%, #6b9fc9 100%); padding: 30px; border-radius: 12px; color: white; margin-bottom: 20px;">
                  <h1 style="margin: 0; font-size: 24px;">⏰ Przypomnienie</h1>
                  <p style="margin: 8px 0 0 0; opacity: 0.95;">Twoje zdarzenie rozpoczyna się ${reminderLabel}</p>
                </div>

                <div style="background: #faf8f5; padding: 20px; border-radius: 12px; border-left: 4px solid #f0c300; margin-bottom: 20px;">
                  <h2 style="margin: 0 0 12px 0; color: #22301f; font-size: 18px;">${reminder.event_title}</h2>
                  <p style="margin: 0; color: #8b8f86; font-size: 14px;">
                    📅 ${reminder.event_date}${
              reminder.event_time ? ` | ⏰ ${reminder.event_time}` : ""
            }
                  </p>
                </div>

                <div style="text-align: center; padding-top: 20px; border-top: 1px solid #d4c4b0;">
                  <p style="color: #8b8f86; font-size: 12px; margin: 0;">
                    Wiadomość wysłana przez <strong>Ogarniacz</strong>
                  </p>
                </div>
              </div>
            `,
          });

          if (emailResult.error) {
            console.error(`Failed to send email to ${reminder.user_email}:`, emailResult.error);
            failed++;
          } else {
            // Oznacz jako wysłane
            await supabase.from("reminders").update({ sent: true }).eq("id", reminder.id);
            sent++;
          }
        } catch (err) {
          console.error(`Error processing reminder ${reminder.id}:`, err);
          failed++;
        }
      }

      return new Response(
        JSON.stringify({
          message: `Processed reminders: ${sent} sent, ${failed} failed`,
          sent,
          failed,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
      });
    }
  }

  return new Response("Method not allowed", { status: 405 });
};

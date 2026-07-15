// Migracja bazy danych - SQL do wykonania w Supabase Console
// Przejdź do: SQL Editor -> New Query i wklej poniższy kod

-- 1. Tabela na przechowywanie przypomnień
CREATE TABLE IF NOT EXISTS reminders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  event_title TEXT NOT NULL,
  event_date DATE NOT NULL,
  event_time TIME,
  reminder_type TEXT NOT NULL, -- '15min', '1hour', '1day'
  send_at TIMESTAMP NOT NULL, -- kiedy wysłać maila
  sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- 2. Indeksy dla wydajności
CREATE INDEX idx_reminders_send_at ON reminders(send_at) WHERE sent = FALSE;
CREATE INDEX idx_reminders_event_id ON reminders(event_id);
CREATE INDEX idx_reminders_user_id ON reminders(user_id);

-- 3. Trigger - automatycznie aktualizuj updated_at
CREATE OR REPLACE FUNCTION update_reminders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER reminders_update_timestamp
BEFORE UPDATE ON reminders
FOR EACH ROW
EXECUTE FUNCTION update_reminders_updated_at();

-- 4. RLS Policies - bezpieczeństwo
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own reminders" ON reminders
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own reminders" ON reminders
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own reminders" ON reminders
FOR DELETE USING (auth.uid() = user_id);

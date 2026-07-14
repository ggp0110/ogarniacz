import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("Brak VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — sprawdź plik .env.local (lokalnie) lub ustawienia Environment Variables w Vercel.");
}

export const supabase = createClient(url, key);

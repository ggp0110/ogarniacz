# Kalendarz zespołu — instrukcja uruchomienia

## 1. Baza danych (Supabase) — jeśli jeszcze nie zrobione
1. Supabase → Twój projekt → **SQL Editor** → New query
2. Wklej całą zawartość pliku `schema.sql` (z tej samej rozmowy) → **Run**
3. Ustaw siebie jako super-admina — **ale najpierw musisz mieć konto**:
   - Zaproś samą siebie: Supabase → **Authentication** → **Add user** → **Invite**, podaj swój e-mail
   - Sprawdź maila, kliknij link, ustaw hasło (aplikacja Cię o to poprosi)
   - Wróć do Supabase → **SQL Editor** i uruchom (zamień e-mail na swój):
     ```sql
     update profiles set is_super_admin = true where email = 'twoj@email.pl';
     ```

## 2. Wgranie kodu na GitHub
1. Wejdź na github.com → **New repository** → nazwij np. `kalendarz-zespolu` → Create
2. Na stronie repo kliknij **uploading an existing file**
3. Przeciągnij **wszystkie pliki i foldery** z tego projektu (poza folderem `node_modules`, jeśli powstał) → Commit changes

   *(Jeśli wolisz działać z terminala: `git init && git add . && git commit -m "start" && git remote add origin <adres repo> && git push -u origin main`)*

## 3. Publikacja na Vercel
1. vercel.com → **Add New → Project**
2. Wybierz repozytorium `kalendarz-zespolu` z GitHub
3. W sekcji **Environment Variables** dodaj dwie zmienne (wartości masz w pliku `.env.local`):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Kliknij **Deploy**
5. Po chwili dostaniesz adres typu `kalendarz-zespolu.vercel.app` — to jest Wasza strona, działa na komputerze i telefonie

## 4. Ustawienie adresu przekierowań w Supabase (ważne dla logowania/resetu hasła)
1. Supabase → **Authentication** → **URL Configuration**
2. W **Site URL** wpisz adres z Vercel (np. `https://kalendarz-zespolu.vercel.app`)
3. W **Redirect URLs** dodaj ten sam adres

## 5. Dodawanie kolejnych osób
1. Supabase → **Authentication** → **Add user** → **Invite** (podaj e-mail osoby)
2. Osoba dostaje maila, klika link, ustawia hasło i imię i nazwisko
3. Ty (jako super-admin) w aplikacji → **Panel administratora** → **Przypisz pracownika do firmy** → wybierz osobę, firmę, rolę (Szef / Pracownik)

## Role w skrócie
- **Super-admin (Ty)** — widzi i zarządza wszystkimi firmami, dodaje firmy, przypisuje ludzi
- **Szef** (w danej firmie) — widzi cały kalendarz firmy, może oznaczać zadania jako prywatne, zarządza rolami/usuwaniem w swoim zespole (zakładka „Zespół”)
- **Pracownik** — widzi kalendarz firmy poza zadaniami oznaczonymi jako prywatne

## Praca lokalna (opcjonalnie, do testów przed wgraniem)
```
npm install
npm run dev
```
Otworzy się na `http://localhost:5173`

## Czego jeszcze nie ma (możliwe kolejne kroki)
- Samoobsługowe zapraszanie pracowników bezpośrednio z panelu szefa (obecnie robi to admin przez Supabase) — wymaga dodatkowej funkcji serwerowej (Supabase Edge Function)
- Powiadomienia e-mail o zbliżających się terminach
- Własna domena zamiast adresu *.vercel.app

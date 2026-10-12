# Wdrożenie (GitHub + Vercel)

## Jak to działa
- **Edycja**: `https://<projekt>.vercel.app` → ekran tytułowy → LOGIN (hasło z `ADMIN_PASSWORD`).
  Sesja trwa godzinę od ostatniej aktywności; po 60 min bezczynności aplikacja sama wylogowuje.
- **Podgląd**: `https://<projekt>.vercel.app/p/<PREVIEW_TOKEN>` — tylko odczyt, odświeża się co 30 s.
  Nieobecności bez typu (L4 itp. → „Nieobecność”), notatnik bez edycji. Link skopiujesz w Ustawieniach.
  Nowy token = stary link przestaje działać.
- **Dane**: jeden dokument JSON w Upstash Redis (`api/state.ts`). Przeglądarka trzyma tylko kopię roboczą
  i wysyła zmiany ~1 s po edycji (kropka przy numerze wersji: zielona = zapisano).
- **Aktualizacje**: każdy push na `main` → Vercel sam buduje i podmienia wersję pod tym samym adresem.

## Pierwsze wdrożenie
1. GitHub: nowe **prywatne** repo (bez README), wypchnięcie kodu (`git push -u origin main`).
2. Vercel → Add New → Project → import repo (framework: Vite — wykrywa sam).
3. Vercel → projekt → Storage → Upstash (Redis) → Create/Connect (dodaje `KV_REST_API_*`).
4. Vercel → Settings → Environment Variables: `ADMIN_PASSWORD`, `SESSION_SECRET`, `PREVIEW_TOKEN` (patrz `.env.example`).
5. Deployments → Redeploy (żeby zmienne weszły w życie).

## Lokalnie
`npm run dev` — API działa w serwerze Vite (`vite.config.ts`), dane w `.data/store.json`, zmienne z `.env.local`.

## Grafiki
`public/sprites`, `public/lands`, `public/sfx`, `public/art` są w repo (gotowe pliki).
Źródła paczek leżą w `assets-src/` (poza repo) — skrypty w `scripts/` odtwarzają z nich grafiki.

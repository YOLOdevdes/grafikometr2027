# Pipolator — specyfikacja v0.1

Narzędzie do planowania ludzi w dziale design i wczesnego wykrywania potrzeby rekrutacji.
Jeden użytkownik (head of design). Stylistyka: pixel art + gra karciana.

## 1. Słownik

| Pojęcie w grze | Pojęcie biznesowe |
|---|---|
| Bohater / karta | Designer (osoba, którą planujemy) |
| Klasa | Rola: Medior PD, Senior PD, UX Researcher |
| Quest | Projekt (jedna faza = jeden projekt) |
| Zlecenie | Zapotrzebowanie — slot designerski w projekcie, pusty lub obsadzony |
| Najemnik | Rola symulowana: QA, BA, Dev, APM, APE (tylko wizualizacja składu) |
| Odpoczynek | Nieobecność (urlop, L4, szkolenie) |
| Kronika | Historia projektów osoby |

## 2. Model danych

```
Designer      { id, name, class: MEDIOR_PD | SENIOR_PD | UX_RESEARCHER,
                baseFte (domyślnie 1.0), illustration?, createdAt, archivedAt? }

Absence       { id, designerId, from, to (daty dzienne, włącznie),
                type: VACATION | SICK | TRAINING | OTHER, note? }

Project       { id, name, client?, phase: PRESALES | DISCOVERY | DELIVERY,
                from, to (daty dzienne), upcoming: bool, color,
                parentGroup? (opcjonalne spięcie faz tego samego klienta),
                archivedAt? }

Demand        { id, projectId, class, fte: 0.5 | 1.0, from, to,
                assignedDesignerId?, overtimeFte? (np. +0.2) }   // zlecenie

Mercenary     { id, projectId, role: QA | BA | DEV | APM | APE, count, fte? }  // tylko wizualnie

HistoryEvent  { id, at, designerId?, projectId?, type, snapshot }  // append-only
```

Zasady:
- Fazy nie są zagnieżdżone — każda faza to osobny projekt. `parentGroup` służy tylko do grupowania wizualnego (np. „ACME: Presales → Discovery → Delivery”).
- Daty przechowywane z dokładnością do dnia. Widok agreguje do tygodnia/miesiąca/roku.
- Zaangażowanie: 0.5 lub 1.0 FTE (+ opcjonalne nadgodziny). Suma > baseFte = przeciążenie.
- Pusty Demand = popyt niepokryty → wchodzi do prognozy rekrutacyjnej.

## 3. Walidacja przypisania (serce narzędzia)

Przy obsadzaniu zlecenia aplikacja liczy dla każdego kandydata danej klasy, dzień po dniu w zakresie zlecenia:

```
wolne(dzień) = baseFte − (nieobecność ? baseFte : 0) − Σ inne przypisania(dzień)
```

Statusy kandydata:
- ✅ **Wolny** — `wolne ≥ fte` przez cały zakres.
- ⚠️ **Częściowo** — konflikty w części dni; lista konfliktów („urlop 12–16.11”, „ACME Delivery 1.0 do 20.11”).
- ⏳ **Wolny od DD.MM** — najwcześniejsza data, od której ma wystarczająco czasu do końca zlecenia.
- ❌ **Niedostępny** — brak wolnego czasu w zakresie.

Kandydaci sortowani: wolni → wolni od najwcześniej → częściowo → niedostępni.
Można przypisać mimo konfliktu (świadomie) — wtedy karta dostaje status przeciążenia.

Klasa zlecenia jest preferencją: można przypisać osobę innej klasy (np. Senior na slot Mediora) z ostrzeżeniem.

## 4. Prognoza rekrutacyjna („Kuźnia”)

Per klasa, per tydzień:
- **Podaż** = Σ baseFte − nieobecności
- **Popyt pewny** = Σ zleceń w projektach bez flagi `upcoming`
- **Popyt z nadchodzącymi** = popyt pewny + zlecenia w projektach `upcoming`

Alert rekrutacyjny, gdy popyt > podaż przez ≥ N kolejnych tygodni (N konfigurowalne, domyślnie 4):
„Brakuje 1.5 FTE Senior PD od 03.11 (z nadchodzącymi) / od 12.01 (pewne)”.

## 5. Historia („Kronika”)

- Nic nie jest usuwane twardo — projekty i osoby są archiwizowane.
- Każda zmiana przypisania zapisuje `HistoryEvent` ze snapshotem (nazwa projektu, faza, daty, FTE) — historia przeżyje późniejszą edycję lub archiwizację projektu.
- Karta designera ma zakładkę Kronika: lista projektów, w których był, z datami i rolą. Za rok dostępna bez dodatkowej pracy.

## 6. Ekrany

1. **Mapa** (ekran startowy) — oś czasu: wiersze = bohaterowie, paski = przypisania w kolorze projektu, kreskowane bloki = nieobecności, linia „dziś”. Po lewej **Tablica zleceń** — nieobsadzone zapotrzebowania. Na górze HUD: obłożenie zespołu, liczba otwartych zleceń, alert rekrutacyjny. Przełącznik zoomu D / T / M / R.
2. **Questy** — lista/plansza projektów: faza, daty, flaga nadchodzący, sloty designerskie (karty) + najemnicy (żetony). Tu tworzysz projekt i jego zapotrzebowanie.
3. **Drużyna** — galeria kart. Klik → pełnoekranowa karta z ilustracją fantasy (flip, holo), aktualny projekt, Kronika, nieobecności.
4. **Kuźnia** — wykres popytu i podaży per klasa + lista alertów rekrutacyjnych.
5. **Odpoczynek** — kalendarz nieobecności (wprowadzanie nadrzędne, niezależne od projektów).

Karta modalna **Obsadź zlecenie** — lista kandydatów z walidacją z sekcji 3.

## 6a. Mapa — widok Questów (domyślny)

Wiersz = quest (faza). Tło = kraina wg kontynentu klienta, widok z boku (parallax):
Europa → las · Ameryka Płn. → Dziki Zachód · Ameryka Płd. → dżungla · Bliski Wschód → pustynia ·
Afryka → sawanna · Azja → mgliste góry · Oceania → wybrzeże · inne → równiny.
Kraj klienta zapisywany dowolnie (pole tekstowe), kraina tylko z kontynentu.
Każdy slot = ścieżka w kolorze roli; bohater stoi w miejscu „dziś”; pusty slot = duch z czerwoną plakietką;
mgła poza czasem trwania questu; ⚑ start, ♜ meta. Widok „Bohaterowie” (wiersz = osoba) jako alternatywa.
Tła są tymczasowe (SVG w kodzie) — docelowo paski parallax z paczki assetów w widoku z boku.

## 7. Kolory i rzadkość kart

| Rola | Kolor | Rzadkość |
|---|---|---|
| Senior PD | złoty | Legendarna (holo) |
| UX Researcher | fioletowy | Legendarna (holo) |
| Medior PD | niebieski | Rzadka |
| QA | zielony | Zwykła |
| BA | pomarańczowy | Zwykła |
| Dev | szary/stalowy | Zwykła |
| APM | turkusowy | Zwykła |
| APE | różowy | Zwykła |

## 7a. Styl wizualny — dwie warstwy

1. **Świat (UI, mapa, sprite'y)** — pixel art w stylu SNES/GBA JRPG (ref: „Pixel Paladins”, Adam Moore, ArtStation).
   Okna dialogowe jak w JRPG (granatowy gradient + jasna ramka), stonowana ciepła paleta.
   Sprite'y ról jako arkusze klatek, skalowane tylko całkowicie (2×/3×/4×), animowane `steps()`.
   Stany animacji = stany osoby: idle (wolny), praca (przypisany), zmęczony (>1.0 FTE), śpi przy ognisku (urlop).
2. **Karta bohatera (zbliżenie po kliknięciu)** — komiksowa ilustracja cartoon (ref: karty „Fantasy Craft”):
   grube czarne kontury, płaskie nasycone kolory, raster/kreskowanie, humor, dominujący kolor klasy.
   Układ karty: nagłówek „Pipolator · №”, ikona klasy, tytuł-pseudonim, ilustracja, 3 statystyki + serce.

Statystyki karty: ⚔ aktywne projekty · 📜 projekty w kronice · ⏳ tygodnie do zwolnienia · ❤ wolne FTE w tym tygodniu.

### Szablon promptu ilustracji

```
Trading card game illustration, bold cartoon comic style: thick uneven black brush outlines,
flat saturated colors, halftone dot and cross-hatching shading like vintage comic print,
humorous quirky character with strong facial expression.
Character: <POSTAĆ + atrybuty designera>. Dynamic pose.
Simple background: <TŁO> . Dominant color: <KOLOR KLASY>.
Centered full character, no text, no letters, no card frame, no border.
```
Placeholder: `public/art/senior-pd-placeholder.png` (gpt-image przez Figma AI). Docelowe ilustracje — na końcu projektu.

## 8. Technologia

- Vite + React + TypeScript, aplikacja lokalna.
- Dane: IndexedDB (Dexie) + eksport/import JSON jako backup.
- Drag & drop: dnd-kit. Daty: date-fns.
- Pixel art: czcionka Pixelify Sans (UI) + Press Start 2P (nagłówki), ramki CSS, `image-rendering: pixelated`.
- Ilustracje: upload per osoba + domyślna ilustracja klasy.
- Później opcjonalnie: przeniesienie na Vercel + baza, jeśli narzędzie ma trafić do zespołu.

## 9. Poza zakresem v1

Logowanie, wielu użytkowników, zarządzanie osobami spoza designu, prawdopodobieństwa projektów, integracje (Jira, HR, kalendarz).

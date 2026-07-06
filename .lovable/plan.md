
# Balíček UX vylepšení

Pět malých, ale viditelných zlepšení, která zpříjemní každodenní práci s aplikací. Žádná změna business logiky ani databáze — jen frontend.

## 1. Indikátor aktivního světa v hlavičce

Přes všechny stránky přidat malý pruh nahoře (nad obsah v `<main>` v `src/App.tsx`), který zobrazí:

- název aktivního světa (`activeWorld.name`)
- ikonu 🌍 / `Globe` z lucide
- badge s rolí uživatele ve světě (Vlastník / Editor / Viewer)

Když je aktivních víc světů, název bude klikací a otevře `/svety`. Když neexistuje žádný svět, zobrazí se výzva „Vytvoř si první svět →".

**Soubor:** `src/App.tsx` (přidat komponentu `WorldHeader` nad `<Routes>`).

## 2. Prázdný stav pro nové uživatele

Když se přihlásí uživatel, který není členem/vlastníkem žádného světa:

- `WorldContext` už vrací `worlds: []`
- Místo prázdné stránky zobrazit uvítací obrazovku s dvěma tlačítky:
  - „Vytvořit vlastní svět" → `/svety`
  - „Požádat o pozvání" (text s vysvětlením, koho kontaktovat)

**Soubor:** nová komponenta `src/components/EmptyWorldsState.tsx`, použitá v `App.tsx` mezi kontrolou `user` a routes.

## 3. Klávesové zkratky v kronice

V `ChronicleBook` přidat `useEffect` s `window.addEventListener('keydown')`:

- `←` / `→` — předchozí / další strana (ignorovat když je fokus v inputu/textarea)
- `/` — fokus na vyhledávací input (`preventDefault` na `/`)
- `Esc` — vyčistit hledání a odfokusovat

Malá nápověda „← → listování · / hledání" pod paginací šedivým textem.

**Soubor:** `src/pages/ChroniclePage.tsx`.

## 4. Zvýraznění hledaného textu v kronice

Když je vyplněné `search`, obalit každý match v `e.content` a `e.author_name` do `<mark className="bg-primary/30 text-foreground rounded px-0.5">`.

Pomocná funkce `highlight(text, query)` — split přes regex escapovaný query, insensitively.

**Soubor:** `src/pages/ChroniclePage.tsx` (jen render, žádná změna dat).

## 5. Loading skeletony

Nahradit textové „Načítání..." skutečnými skeletony (shadcn `Skeleton` už existuje):

- `App.tsx` — celostránkový skeleton s pruhem hlavičky + sidebarem + kartami
- `ChroniclePage` — když `entries` ještě neexistuje: 3 dummy karty s `<Skeleton />`
- `CalendarWidget` — když `calendar === null`: skeleton řádku
- `BestiaryPage`, `HeroesPage`, `NPCPage` — nahoře, když se prvně načítá seznam: grid skeletonů (mimo scope pokud budeš chtít, můžu jen kroniku + kalendář + app)

Pro tento krok navrhuji rozsah: **App shell + Kronika + Kalendář** (zbytek stránek necháme na později, aby balíček zůstal malý).

## Layout diagram

```text
┌─────────────────────────────────────────────────┐
│ Sidebar  │  🌍 Hlavní svět  · Editor    [odkaz] │  ← NEW (1)
│          ├─────────────────────────────────────┤
│          │                                      │
│  ...     │   Obsah stránky                      │
│          │                                      │
└──────────┴──────────────────────────────────────┘

Kronika – kniha:
┌───────────────────────────────────────────────┐
│ Zápisky (12)                    [🔍 hledat]   │
├───────────────────────────────────────────────┤
│ 15. Jara 657                                  │
│  Gorm — bojoval s **drakem** a zvítězil...    │  ← zvýrazněný match (4)
│                                                │
├───────────────────────────────────────────────┤
│  ← Předchozí     Strana 1/12     Další →      │
│  ← → listování · / hledání                    │  ← nápověda (3)
└───────────────────────────────────────────────┘
```

## Technický přehled

- **Žádné DB změny, žádné nové migrace.**
- **Žádné nové balíčky** — vše na existujících shadcn komponentách (`Skeleton`, `Badge`) a lucide ikonách.
- Klávesové zkratky přes standardní `keydown` listener s guardem na `document.activeElement instanceof HTMLInputElement || HTMLTextAreaElement`.
- Highlight bez `dangerouslySetInnerHTML` — přes `String.split` a mapování na React fragmenty.

## Soubory

**Nové:**
- `src/components/WorldHeader.tsx`
- `src/components/EmptyWorldsState.tsx`
- `src/components/ChronicleSkeleton.tsx` (drobný wrapper nad `Skeleton`)

**Upravené:**
- `src/App.tsx` — WorldHeader + EmptyWorldsState + skeleton stav
- `src/pages/ChroniclePage.tsx` — klávesnice, highlight, skeleton
- `src/components/CalendarWidget.tsx` — skeleton stav

## Mimo rozsah (dohodneme si příště)

- Skeletony na Bestiáři / Hrdinech / NPC / Mapě
- Real-time sync boje
- Automatický zápis do kroniky z bitev
- Export celé kroniky do PDF/TXT

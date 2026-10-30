## Ceník — cenový systém per svět (pouze editor/admin)

Nový modul „Ceník" v levém panelu, viditelný **jen pro role `editor` a `admin`**. Hráč (viewer) položku ani stránku nevidí. Data jsou vždy vázaná na aktivní svět (`world_id`) — každý svět má vlastní města, předměty a ekonomiku.

### Měna

Fixní kurz: **1 zl = 10 st = 100 md**. Ceny ukládáme interně v měděných (`price_copper`, integer). UI zobrazuje ve formátu `X zl Y st Z md` a nabízí zadávání v každé jednotce.

### Datový model (per svět)

Nové tabulky, všechny s `world_id uuid` + RLS `is_world_member(world_id, auth.uid())` pro čtení a `is_world_editor(world_id, auth.uid())` pro zápis. Viewer roli funkce `is_world_editor` odmítne, viewer tak modul nemá jak číst.

- **`price_locations`** — sídla: `name`, `type` (`city` / `town` / `village` / `hamlet` / `fortress` / `market`), `price_modifier_pct` (int, výchozí 0), `note`.
- **`price_items`** — předměty / služby: `name`, `category` (např. „Nápoje", „Zbroj", „Služby"), `base_price_copper` (int), `unit` (např. „kus", „džbán", „noc"), `note`.
- **`price_item_locations`** — kde se položka vyskytuje: `item_id`, `location_id`, `override_modifier_pct` (nullable — když je vyplněné, přebíjí `price_modifier_pct` z lokace pro tuto konkrétní položku).
- **`world_economy`** — jednořádkové nastavení světové ekonomiky (unikátní `world_id`): `state` (enum: `normal`, `mobilization`, `war`, `famine`, `plague`, `festival`, `trade_boom`, `embargo`, `custom`) + `custom_modifier_pct` (int, použije se když `state = custom`).

Presety pro `state` (výchozí modifikátory, přepsatelné v UI):
- `normal` 0 %, `mobilization` +15 %, `war` +40 %, `famine` +60 %, `plague` +80 %, `festival` −10 %, `trade_boom` −20 %, `embargo` +50 %.

### Výpočet finální ceny

```text
loc_mod   = item_override ?? location.price_modifier_pct
econ_mod  = world_economy modifier (dle state / custom)
final     = round( base_price_copper * (1 + loc_mod/100) * (1 + econ_mod/100) )
```

Vypisujeme rozklad ceny do tooltipu (základ → +lokace → +ekonomika → výsledek), ať PJ vidí co se stalo.

### UI — stránka `/cenik`

Levý panel: nová položka **Ceník** (ikona `Coins`), viditelná jen když `canEdit('pricing')` (přidáme do `role_permissions` pro editor/admin) — viewer ji nikdy neuvidí.

Layout tří karet:

1. **Světová ekonomika** — select `state` + input `custom_modifier_pct`, náhled aktuálního globálního modifikátoru.
2. **Sídla** — tabulka lokací (jméno, typ, modifikátor %, poznámka), tlačítka Přidat/Upravit/Smazat.
3. **Předměty a služby** — tabulka s filtrem podle kategorie a lokace. Editor otevře modal:
   - základní údaje (název, kategorie, jednotka, poznámka)
   - základní cena — tři inputy zl/st/md, ukládá se do `price_copper`
   - checkboxy „Prodává se v" pro každou lokaci; u zaškrknuté lokace je pole `override %` (prázdné = použij modifikátor lokace)
   - náhled výsledné ceny pro každou vybranou lokaci s aktuální ekonomikou

### Bezpečnost

- RLS na všech 4 tabulkách: `SELECT` přes `is_world_member`, `INSERT/UPDATE/DELETE` přes `is_world_editor`. Grants pro `authenticated` a `service_role`, žádný `anon`.
- Do `role_permissions` přidáme řádek `page = 'pricing'`: editor/admin `can_view = can_edit = true`, viewer oba `false`. `AppSidebar` položku filtruje přes `canView('pricing')`; sama stránka navíc znovu ověří `canEdit('pricing')` a jinak zobrazí „Přístup odepřen".

### Soubory

- Migrace: `supabase/migrations/..._pricing.sql` (4 tabulky + grants + RLS + policies + `role_permissions` seed).
- Nové: `src/pages/PricingPage.tsx`, `src/components/pricing/LocationsCard.tsx`, `src/components/pricing/ItemsCard.tsx`, `src/components/pricing/EconomyCard.tsx`, `src/components/pricing/ItemEditor.tsx`, `src/lib/pricing.ts` (formát měny + výpočet).
- Upravené: `src/App.tsx` (route `/cenik`), `src/components/AppSidebar.tsx` (položka Ceník, ikona `Coins`, gated `canView('pricing')`).

### Otázka před stavbou

Presety ekonomik uvedené výše (mobilizace +15, válka +40, hlad +60, mor +80, slavnost −10, obchodní boom −20, embargo +50) — sedí, nebo je chceš mít jinak / doplnit další stavy? Můžeme také začít se všemi na 0 % a nechat tě si je nastavit sám.

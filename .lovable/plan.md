## Problém

Účet `pilar.andrej@gmail.com` má v DB roli `admin` (potvrzeno), ale frontend ho vyhodnocuje jako `viewer`. Důvod: RLS politiky volají `public.has_role()` a `public.can_write_data()`, ale tyto funkce mají odebrané právo `EXECUTE` pro roli `authenticated` (jen `postgres` a `service_role` je mají). Jakmile RLS politika nemůže funkci spustit, celý dotaz selže — včetně načtení vlastní role.

Tvůj admin účet **NEBUDU měnit** — zůstává `admin`.

## Co opravím (jedna migrace)

1. **Obnovit `EXECUTE` práva** pro roli `authenticated` (a kde potřeba `anon`) na:
   - `public.has_role(uuid, app_role)`
   - `public.can_write_data(uuid)`
   
   Funkce jsou `SECURITY DEFINER` se zafixovaným `search_path`, takže jejich zveřejnění je bezpečné — to je doporučený vzor pro role-check funkce.

2. **Ponechat omezené** (jen `service_role`) interní funkce, které nemají být volány klientem:
   - `public.assign_default_role` (volá jen trigger)
   - `public.ensure_profile_role` (trigger)

3. **Ověřit, že trigger `ensure_profile_role_trg`** na `profiles` stále existuje (po dřívější migraci by měl).

## Ověření po opravě

- Znovu načtu seznam EXECUTE práv pro výše uvedené funkce.
- Tester: SELECT do `user_roles` jako autentizovaný uživatel musí vrátit jeho roli.
- V UI: po refreshi musí `pilar.andrej@gmail.com` znovu vidět všechny položky menu včetně **Boj, Bestiář, Export, Setkání, Uživatelé**.

## Bezpečnostní dopad

Žádný negativní — `has_role` a `can_write_data` jsou `SECURITY DEFINER` s pevným `search_path` a vracejí jen boolean. Naopak **bez** těchto práv jsou RLS politiky rozbité a aplikace nefunguje. Toto je standardní Supabase vzor pro role-checking utility.

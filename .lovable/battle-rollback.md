# Návrat před redesign boje

Zdrojová kopie vytvořená před změnami v dočasné složce není trvalá záloha. Trvalý návrat zdrojů je možný přes historii verzí projektu: vybrat verzi před redesignem bojového panelu. Historie zdrojů nevrací databázové hodnoty.

Nové tabulky a funkce nemazat: `battle_actions` uchovává potvrzené útoky a brání jejich opakování. Stávající záznamy bestií, hrdinů a zkušeností zůstaly ve stejných tabulkách.

Při vracení starého zdrojového kódu zachovat změnu klíče počtů zabití na `world_id,user_id,monster_name` a přidat `world_id` ke všem upsertům `monster_kills`. Zachovat také dotazy na `battle_state` omezené aktivním světem. Starý kód bez těchto dvou adaptačních změn není kompatibilní s nynějším oddělením světů.

Neobnovovat původní klientské postupné zápisy útoků v již odehraném souboji; potvrzené útoky nadále zapisovat přes `battle_apply_action`, jinak se ztratí ochrana před duplicitním započítáním. Pro úplný návrat databázové struktury je nutné nejprve exportovat aktuální data a posoudit součty zabití v jednotlivých světech; automatické sloučení či mazání není bezpečné.

Ověřovací test `src/test/integration/battle_flow.py` vytváří izolovaný dočasný svět a na konci jej odstraňuje. Existující světy ani role nemění.
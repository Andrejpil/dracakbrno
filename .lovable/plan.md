# Redesign bojového panelu

## Co ukázala analýza

Současný Boj má samostatnou iniciativu a karty bestií. Útočník se vybírá zvlášť v každé kartě. Existující útok už počítá skutečné poškození, zkušenosti a zabití; chybí korekce HP, léčení a plošný útok.

Zápisy statistik nyní probíhají odděleně a z místně načtených hodnot. Prosté opakované volání této funkce pro plošný útok by mohlo přepsat součty nebo započítat útok dvakrát. Některé dotazy boje navíc výslovně nevybírají aktivní svět. Před rozšířením ověřit skutečné nastavení ukládání a návaznost na mapu.

## Nové rozložení podle obrázku

- **Nahoře:** název boje a předchozí/další tah; pod nimi trvale vybraný útočník v řadě tokenů. Použít skutečné hrdiny, nikoli smyšlené postavy z obrázku. Pro útočníky bez portrétu iniciály nebo ikony.
- **Vlevo:** kompaktní seznam bestií řazený sestupně podle iniciativy; jméno, iniciativa, HP, barevný pruh, stav a otevření detailu. Hrdinové a NPC zůstávají v pořadí tahů bez HP. Bestie bez iniciativy nezmizí ze seznamu.
- **Vpravo:** detail vybrané bestie s portrétem 150 × 150 px, statistikami, MP, poškozením, léčením a ruční korekcí HP. Výběr cíle nemění útočníka ani automaticky neposouvá tah.
- **Dole:** přepínatelný plošný útok s výběrem živých cílů a individuálním poškozením. Součet zadaného i skutečně započitatelného poškození, jedno potvrzení.
- Na menších obrazovkách seznam a detail pod sebou; tokeny lze vodorovně posouvat. Kompaktní řádky použijí ikony, velký obrázek bude pouze v detailu.

## Ovládání a zachování pravidel

1. Token zvolí útočníka pro jednotlivý i plošný útok. Kouzlo/Jiný umožní zaznamenat zásah bez připsání hrdinovi; při připsání konkrétnímu hráči zůstává vybraný jeho token.
2. Posuvník po jednom HP a číselné pole ukládají pouze dokončenou korekci, nikdy poškození nebo zkušenosti. Léčení také nepřidává poškození ani zabití. HP omezit na 0 až maximum.
3. Útok připíše pouze skutečně odebrané HP. Zachovat stávající výpočet zkušeností a bonus za zabití: 5 % obyčejná, 10 % unikátní bestie.
4. Plošný útok uloží všechny cíle a statistiky společně až po potvrzení. Během ukládání zablokovat opakované potvrzení; stejný potvrzený útok nesmí být zapsán podruhé ani při opakování požadavku.
5. Mrtvé bestie lze skrýt a znovu zobrazit, bez smazání dat. Zachovat přidávání s počtem a rozmezím úrovní; rychlé kopie jsou samostatné instance, nikoli sdílený stav.
6. Zachovat oprávnění čtenář/editor/admin. Administrátorský účet ani přiřazené role se nemění.

## Vzhled

Navázat na současné tmavé grafitové téma a písma Cinzel/Inter; barvy vyjádřit společnými barevnými nastaveními, aby fungoval i světlý režim a uživatelské palety. Stav HP: zelená nad 50 %, žlutá 16–50 %, červená 1–15 %, šedá při 0 HP. Vybraný cíl jasně orámovat, aktivní tah označit samostatně. Pouze krátké přechody, s respektováním omezených animací.

## Technické provedení

- Zachovat React, stávající tabulky, identifikátory bestií a návaznost Mapy na Boj. Rozdělit nové ovládání do menších částí a sdílet stejné herní výpočty pro jednotlivý i plošný zásah.
- Prověřit živé tabulky, triggery a pravidla přístupu. Pro potvrzené útoky doplnit transakční databázovou funkci se zamykáním cílových záznamů a ochranou před opakovaným zápisem; případný minimální záznam identifikátoru útoku nesmí narušit uložené souboje.
- V souvisejících dotazech a změnách výslovně použít aktivní svět. Zachovat aktualizace HP a aktivního tahu v reálném čase, včetně stávajícího skrývání bestií hráčům.
- Nedoplňovat smyšlenou kořist, kolo souboje ani destruktivní reset pouze proto, že jsou na referenčním obrázku.

## Bezpečný návrat a ověření

Před změnami uložit kopii dotčených zdrojů mimo pracovní soubory. K návratu celé aplikace lze použít předchozí verzi v historii projektu; nejde o zálohu databáze. Úpravy databáze musí být doplňující, bez mazání stávajících soubojů; připravit i způsob vrácení nových změn.

Testy pokryjí zásah 23 do 40 HP, plošný útok 8 + 15 + 23 = 46 HP při dostatečných HP, omezení přebytečného poškození, zabití, zkušenosti, dvojí potvrzení, korekci bez statistik a nezávislost kopií. V přihlášené aplikaci ověřit uložení a načtení výsledků, synchronizaci s mapou a zobrazení na desktopu i menší obrazovce.

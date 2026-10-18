# Antigravity Architecture Rules

1. **API Response Envelope:**
   Všechny REST API odpovědi musí striktně dodržovat jednotný JSON obal:
   ```json
   {
     "data": { ... } | [ ... ] | null,
     "error": { "code": string, "message": string, "details": any } | null,
     "meta": { "timestamp": string, "pagination": any } | null
   }
   ```

2. **Timezone Policy:**
   - Databáze ukládá VŠECHNA časová razítka výhradně v UTC (`TIMESTAMPTZ` / `DateTimeOffset.UtcNow`).
   - Backend operuje interně pouze s `DateTimeOffset` v UTC. Nikdy nepoužívat `DateTime.Now`.
   - Přepočet do lokálního času (`Europe/Prague`) a formátování probíhá až na klientovi.

3. **Neměnnost a auditní stopa (No Hard Delete):**
   - Žádný záznam docházky (`time_entries`) ani žádosti (`absence_requests`) se z databáze fyzicky nemaže.
   - Veškeré ruční korekce povinně nastavují `is_manual = true`, `edited_by`, `edited_at` a `edit_reason` (min. 5 znaků).

4. **Separace klientské logiky:**
   - UI komponenty v Reactu nesmí obsahovat přímé volání `fetch` / `axios` ani komplexní byznys kalkulace.
   - Veškeré API volání a správa cache musí být zapouzdřena v samostatných TanStack Query hooks v `/src/api`.

5. **Hardware Workplace Guard:**
   - `workplace_id` může být přiřazeno záznamu výhradně po kryptografickém ověření NFC karty (NTAG 424 DNA SUN / UID).
   - Všechny požadavky z webu, QR kódu nebo volby "Jsem doma" mají povinně `workplace_id = null` a `location_type = 'remote'` / `'home_office'`.

6. **Workflow, Git a kontrola pravidel:**
   - **Před každou akcí se podívat do těchto pravidel:** Vždy před zahájením práce zkontrolovat architektonická pravidla (`rules.md`) a designová pravidla (`designrules.md`).
   - **Po každé změně gitovat:** Ihned provést `git add` a `git commit` s výstižnou zprávou. Žádný funkční krok ani úprava nezůstává necommitnutá.

7. **Zákaz přepisování a zjednodušování při refaktoringu (1:1 Extrakce bez ztráty):**
   - **Striktní Copy-Paste:** Při modularizaci a vyčleňování existujícího kódu do nových komponent/souborů je PŘÍSNĚ ZAKÁZÁNO kód zjednodušovat, improvizovat nebo psát „z hlavy“.
   - **Povinnost přečíst 100 % rozsahu:** Agent MUSÍ před jakýmkoliv vyčleněním přečíst celý extrahovaný blok od první po poslední řádku (`view_file` až po koncový tag). Nikdy nesmí psát novou komponentu na základě částečného čtení.
   - **100% zachování vizuálu a funkcionality:** Každý JSX element, CSS třída, inline podmínka, ikonka, text a atribut musí být přeneseny v poměru 1:1. Změnit se smí pouze způsob předání dat (přes `props`).
   - **Ověření před smazáním:** Než agent smaže původní kód z původního souboru, musí provést ověření, že nový soubor obsahuje všechny řádky a prvky originálu.

8. **Architektura úvazků, fondů a zákaz hardcodování (FTE Single Source of Truth):**
   - V aplikaci (backend i frontend) je PŘÍSNĚ ZAKÁZÁNO hardcodovat jakákoliv čísla fondu (`8h`, `40h`, `168h`, `160h`, `152h` apod.) nebo počty dní nároků (`20`, `4`, `2`).
   - **`company_settings`**:
     - `DailyHours` (standardní denní fond plného úvazku firmy, např. 8.00).
     - `WeeklyWorkDays` (počet pracovních dní v týdnu, např. 5).
   - **`contract_types`**:
     - Obsahuje POUZE `Id`, `Code`, `Name`, `Coefficient` (`full_time = 1.0`, `half_time = 0.5`, `part_time = 0.25`). Žádné redundantní sloupce DailyHours ani WeeklyHours!
   - **`absence_types`**:
     - Obsahuje `DefaultAllowance`, `DefaultBudgetPeriod`, `MaxPerMonthLimit` a `DurationMode` (`days`, `single_day`, `hours`).
   - **Výpočet denního a týdenního fondu:**
     - `denní cíl = company_settings.DailyHours * contract_types.Coefficient`
     - `týdenní cíl = company_settings.DailyHours * company_settings.WeeklyWorkDays * contract_types.Coefficient`
   - **Výpočet měsíčního fondu:**
     - `měsíční fond = počet pracovních dnů v měsíci bez svátků * denní cíl`
     - (V říjnu 2026: 22 všedních dní - 1 svátek 28.10. = 21 pracovních dní -> plný 168h, poloviční 84h, čtvrtinový 42h).
   - **Onboarding nového zaměstnance:**
     - Výchozí nároky pro omezené absence (`DefaultBudgetPeriod != unlimited`) se počítají dynamicky jako `absence_types.DefaultAllowance * contract_types.Coefficient`.

9. **Centrální vizuální číselník sekcí (`SECTIONS` v `frontend/src/config/sectionsConfig.ts`):**
   - Jediný zdroj pravdy pro ikony a výchozí barvy entit/sekcí aplikace:
     - `requests`: `{ icon: Calendar, color: 'amber' }` (stejná ikona na Dashboardu i v Menu!)
     - `persons`: `{ icon: Users, color: 'amber' }` (Kdo je kdo / Adresář osob)
     - `attendance`: `{ icon: Clock, color: 'amber' }` (Přehled docházky)
     - `timesheets`: `{ icon: CalendarDays, color: 'amber' }` (Výkazy)
     - `closures`: `{ icon: ClipboardCheck, color: 'amber' }` (Uzávěrky)
     - `settings`: `{ icon: Settings, color: 'amber' }` (Nastavení)
   - V číselníku jsou POUZE `icon` a `color`. Žádné pevné labely ani CSS třídy – názvy si každé zobrazení řídí samo.
   - Všude, kde se pracuje s osobami, se dotazovat na `SECTIONS.persons`.
   - Všude, kde se pracuje se žádostmi, se dotazovat na `SECTIONS.requests`.

10. **Vývojářská rychlost, přísný minimalismus a zákaz balastu:**
    - **Žádné vymýšlení navíc:** Dělat striktně a přesně jen to, co uživatel zadá. Nepřidávat žádné nedomluvené sloupce do DB, žádné dodatečné interface properties, žádné pomocné funkce „co kdyby“.
    - **Žádné zbytečné potvrzovací cykly:** Neplýtvat časem na dlouhé teoretické elaboráty. Provést minimální čistý kód, spustit `dotnet build` a `npm run build`, ověřit funkčnost a commitnout.
    - **Přímočará exekuce:** Kód psát přímočaře, jednoduše a v jednom zátahu bez kouskování.

11. **Automatická synchronizace šablonových databází (`*.template.db`):**
    - Každá změna databázového schématu (nová tabulka, nový sloupec, změna indexu nebo výchozích číselníků) MUSÍ být v `DbInitializer.cs` automaticky aplikována nejen na aktivní databázi (`dochazka_dev.db` / `dochazka_clean.db`), ale současně i na šablonové databáze (`dochazka_dev.template.db` a `dochazka_clean.template.db`).
    - Uživatel tuto synchronizaci nikdy nemusí připomínat – je to automatická součást každé DB úpravy.

12. **Striktní modularita, dynamické číselníky a zákaz falešných dat (10–20s editační rychlost):**
    - **Zákaz monolitů:** Žádný soubor nesmí bobtnat do tisíců řádků. DTO objekty patří do samostatných souborů (`Models/Dtos.cs`), modaly a toolbary do samostatných komponent, opakující se synchronizační logika do hooků.
    - **Dynamické řízení přes číselníky (`absence_types`, `contract_types`):** Nikdy nepsat větvení podle natvrdo zadrátovaných kódů (`if (code == "vacation" || code == "doctor" || ...)`), pokud chování určuje vlastnost číselníku (`DurationMode == hours / single_day / days`, `DefaultBudgetPeriod != unlimited`). Přidání nového typu absence v Nastavení musí fungovat v celé aplikaci okamžitě bez zásahu do kódu.
    - **Zákaz falešných/mockovaných dat v UI:** Všechny pohledy a modaly (včetně Uzávěrek a Měsíčního výkazu) musí číst reálná data z API a databáze. Nikdy nepoužívat generované/falešné hodnoty (`idx % 3` apod.).


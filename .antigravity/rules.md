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



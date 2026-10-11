# Docházka v0.3 – Kompletní systémová a architektonická specifikace

> **Stav dokumentu:** Konsolidovaná kompletní specifikace  
> **Verze projektu:** 0.3  
> **Cílový stack:** C# / .NET 9 (Web API) | React 19 / TypeScript / Vite | Tailwind CSS / Material Design 3 | Capacitor NFC | PostgreSQL / MS SQL  

---

## Obsah dokumentu

1. [01. Architektura a technologický stack](#01-architektura-a-technologický-stack)
2. [02. Bootstrap a první spuštění instance](#02-bootstrap-a-první-spuštění-instance)
3. [03. Hardware, NFC a bezpečnost pracoviště](#03-hardware-nfc-a-bezpečnost-pracoviště)
4. [04. Role, organizační struktura a RBAC matice](#04-role-organizační-struktura-a-rbac-matice)
5. [05. Pracovní fondy, svátky a odměňování](#05-pracovní-fondy-svátky-a-odměňování)
6. [06. Absence, kapacity a dvoufázové workflow lékaře](#06-absence-kapacity-a-dvoufázové-workflow-lékaře)
7. [07. Dashboard UI a Live Radar přítomnosti](#07-dashboard-ui-a-live-radar-přítomnosti)
8. [08. Notifikace a personální údaje](#08-notifikace-a-personální-údaje)
9. [09. České skloňování jmen (7 pádů)](#09-české-skloňování-jmen-7-pádů)
10. [10. Exporty a mzdové podklady (MVP)](#10-exporty-a-mzdové-podklady-mvp)
11. [11. Kompletní datový model (Entity Framework Core)](#11-kompletní-datový-model-entity-framework-core)
12. [12. Developer workflow a API dokumentace](#12-developer-workflow-a-api-dokumentace)
13. [13. Antigravity pravidla a testovací agent](#13-antigravity-pravidla-a-testovací-agent)
14. [14. Testovací agent (Edge Cases, integrační a E2E testy)](#14-testovací-agent-edge-cases-integrační-a-e2e-testy)
15. [15. Architektonická pravidla systému (.antigravity/rules.md)](#15-architektonická-pravidla-systému-antigravityrulesmd)
16. [16. Pravidla designu a rozhraní (.antigravity/designrules.md)](#16-pravidla-designu-a-rozhraní-antigravitydesignrulesmd)

---

## 01. Architektura a technologický stack

### 1. Architektonický koncept

#### 1.1 Repozitář a struktura projektu

Monorepo architektura: Kód backendu, webové aplikace i mobilních obalů je umístěn v jediném repozitáři na GitHubu.
Adresářová struktura:
- **`/backend`** – ASP.NET Core Web API projekt.
- **`/frontend`** – React (Vite) aplikace sdílená pro web i mobilní platformy.
- **`/mobile`** – Konfigurace a nativní projekty Capacitor (Android a iOS).
- **`/.antigravity`** – Architektonická a designová pravidla pro kódové agenty.
#### 1.2 Model nasazení (Multi-instance / White-label)

Izolované instalace: Každá firemní instance běží jako samostatná aplikace s vlastní konfigurací (tenant config), vlastní URL adresou a fyzicky oddělenou databází.
Konfigurační vrstva: Instance je řízena pomocí proměnných prostředí (.env / appsettings.Production.json): název firmy, povolená Google Workspace doména, připojení k databázi, VAPID klíče a přepínače modulů.
Škálovatelnost: Kódová báze je navržena tak, aby v budoucnu umožnila přechod na plnohodnotný multi-tenant SaaS bez nutnosti refaktoringu doménových entit.
### 2. Technologický stack

#### 2.1 Backend

Platforma: C# / .NET 9 (ASP.NET Core Web API).
Architektura API: RESTful API s kontrolery, DTO modely a servisní aplikační vrstvou.
ORM & Přístup k datům: Entity Framework Core (EF Core).
Autentizace & Autorizace:
Google Workspace OAuth 2.0 (striktní ověření parametru hosted domain hd).
Vnitřní autorizace přes Bearer JWT tokeny (krátkodobý Access token + bezpečný Refresh token).
Role-Based Access Control (RBAC).
#### 2.2 Databáze

Podporované databázové enginy:
Microsoft SQL Server (nativní pro Windows Server prostředí).
PostgreSQL (alternativa přes ověřený balíček Npgsql).
Správa schématu: EF Core Migrations s verzovací systémovou tabulkou __EFMigrationsHistory.
#### 2.3 Frontend & Mobilní aplikace

Klientské jádro: React 19 + TypeScript + Vite.
Styling & UI: Tailwind CSS v moderním podnikovém stylu (Linear/Vercel standard).
Stát & Data Fetching: TanStack Query (React Query) pro cacheování a správu asynchronního stavu serveru.
Mobilní obal: Capacitor (Android a iOS).
Nativní pluginy: @capgo/capacitor-nfc pro hardwarovou obsluhu NFC čipů (čtení, zápis NDEF, zamykání heslem).
### 3. Serverové prostředí a CI/CD

#### 3.1 Provoz na Microsoft Windows Server

Nativní běh bez nutnosti Dockeru:
Backend publikován jako samostatný proces nebo hostován pod Internet Information Services (IIS) s modulem ASP.NET Core Module (ANCM).
Možnost běhu jako samostatná systémová služba Windows Service.
Docker varianta: Projekt obsahuje produkční Dockerfile a docker-compose.yml pro případ budoucí kontejnerizace.
#### 3.2 CI/CD automatizace (GitHub Actions)

Pipeline proces:
Trigger: Push do větve main nebo vytvoření release tagu.
Build & Test: Kompilace .NET backendu, spuštění xUnit testů, linting a build frontendu (Vite).
Publikace: Vytvoření release balíčku.
Deploy: Přenos na cílový Windows Server (SSH / WinRM / WebDeploy).
Databázová migrace: Spuštění dotnet ef database update při nasazení nové verze.


## 02. Bootstrap a první spuštění instance

### 1. Konfigurace prostředí (Environment Configuration)

Před prvním spuštěním aplikace správce definuje proměnné prostředí v souboru .env nebo appsettings.Production.json.
#### 1.1 Klíčové konfigurační parametry

- **`ConnectionStrings:DefaultConnection`** – připojovací řetězec k MS SQL nebo PostgreSQL databázi.
- **`GOOGLE_WORKSPACE_DOMAIN`** – povolená firemní doména (např. firma.cz). Backend striktně kontroluje parametr hd (hosted domain) v identity tokenu od Googlu. Jakýkoliv účet mimo tuto doménu je zamítnut kódem 403 Forbidden.
- **`Authentication:Google:ClientId`** – klientské ID OAuth 2.0 z Google Cloud Console.
- **`Authentication:Google:ClientSecret`** – tajný klíč aplikace z Google Cloud Console.
- **`Jwt:Secret`** – kryptografický klíč pro podepisování vnitřních JWT tokenů systému.
- **`VAPID:Subject`** – kontaktní e-mail pro Web Push protokol (mailto:admin@firma.cz).
- **`VAPID:PublicKey / VAPID:PrivateKey`** – asymetrický klíčový pár pro odesílání Web Push notifikací bez závislosti na třetích stranách. Pokud klíče v konfiguraci chybí, backend je při prvním startu automaticky vygeneruje a vypíše do logu / uloží do DB.
### 2. Inicializace serveru a databáze (Day 0)

Při prvním startu backendové služby proběhne sekvence automatické inicializace:
Aplikace schématu (EF Core Migrations):
Backend ověří existenci a verzi databáze.
Spustí Database.Migrate(), vytvoří všechny tabulky a inicializuje systémovou tabulku __EFMigrationsHistory.
Vytvoření systémových výchozích dat:
Založení výchozího záznamu v company_settings (týdenní fond 40 h, příplatky 200 % / 300 %, začátek pracovní doby 08:00).
Vytvoření virtuálního pracoviště 0 (id = 00000000-0000-0000-0000-000000000000, name = "Centrála - Setup", is_active = true).
Naplnění číselníku absencí absence_types (Dovolená, Lékař, Nemoc, Sick day, Home office, Neplacené volno) s výchozími pravidly.
Vygenerování základního kalendáře státních svátků pro aktuální rok.
### 3. Bootstrap QR kód a párování aplikace

V době prvního spuštění v systému neexistuje žádný uživatelský účet ani fyzicky nahraná NFC karta na recepci. K vyřešení problému prvotního spárování slouží jednorázový Bootstrap QR kód.
#### 3.1 Zobrazení Bootstrap QR kódu

Na webové adrese instance (např. [https://dochazka.firma.cz/setup](https://dochazka.firma.cz/setup)) se zobrazí uvítací instalační obrazovka s vygenerovaným QR kódem.
Pokud je rozhraní vypnuté nebo běží pouze API, kód je k dispozici na zabezpečeném interním endpointu /api/bootstrap/qr (nebo vypsán jako ASCII QR v konzoli/logu serveru).
#### 3.2 Obsah Bootstrap QR kódu

QR kód nese JSON payload nebo URL s parametry:
```json
{
  "action": "bootstrap_pairing",
  "base_url": "https://dochazka.firma.cz/api",
  "tenant_id": "default",
  "workplace_id": null
}
```



base_url předá čisté mobilní aplikaci adresu API serveru, se kterým má komunikovat.
workplace_id je v bootstrap QR kódu striktně nastaven na null (QR kód nesmí nikdy simulovat fyzickou přítomnost na pracovišti).
### 4. Google Workspace OAuth & Založení prvního Administrátora

#### 4.1 Uživatelský průchod

První uživatel (budoucí administrátor) nainstaluje mobilní aplikaci nebo otevře klientský web.
V čisté aplikaci zvolí volbu „Naskenovat párovací kód instance“ a naskenuje Bootstrap QR kód z obrazovky serveru.
Aplikace uloží base_url a automaticky otevře přihlašovací dialog Google Workspace OAuth 2.0.
Uživatel se přihlásí firemním účtem (např. jan.novak@firma.cz).
#### 4.2 Backendová verifikace a přidělení role

Backend přijme autorizační kód nebo ID token z Google OAuth.
Kontrola domény: Backend ověří podpis Google tokenu a porovná doménu e-mailu s GOOGLE_WORKSPACE_DOMAIN. Pokud doména nesouhlasí, požadavek je okamžitě odmítnut.
Detekce prázdného stavu (Admin Bootstrap Rule):
Backend provede dotaz: SELECT COUNT(*) FROM users WHERE role = 'admin'.
Pokud je počet administrátorů roven 0, nově příchozí uživatel je okamžitě vytvořen s rolí role = 'admin' a is_active = true.
Pravidlo pro další uživatele:
Jakmile v databázi existuje alespoň 1 uživatel s rolí admin, bootstrap režim se trvale uzamkne.
Všichni další uživatelé přihlášení přes Google OAuth automaticky získávají základní roli role = 'colleague'.
Backend vystaví standardní dvojici JWT tokenů (Access Token + Refresh Token) a odešle je zpět do aplikace.
### 5. Post-bootstrap kroky (Příprava ostrého provozu)

Jakmile je první administrátor přihlášen:
Instalační obrazovka na adrese /setup se automaticky znepřístupní (vrací přesměrování na login nebo 404).
Administrátor má ve své aplikaci plný přístup do sekce Správa systému.
Administrátor vytvoří v číselníku poboček první reálné fyzické pracoviště (např. Pobočka Praha - Palmovka).
V detailu pobočky administrátor klikne na tlačítko „Zapsat NFC kartu pobočky“, přiloží čistý NTAG čip a provede hardwarový zápis zabezpečeného Universal Linku a zamčení karty heslem PWD/PACK.
Karta je umístěna na recepci a systém je připraven k běžnému provozu pro všechny zaměstnance i OSVČ.

## 03. Hardware, NFC a bezpečnost pracoviště

### 1. Hardwarové řešení docházky (NFC čipy na recepci)

Systém využívá standardizované NFC tagy umístěné u vchodů na jednotlivých pracovištích. Zaměstnanci a OSVČ přikládají své mobilní telefony (Android i iOS) k těmto tagům pro registraci fyzické přítomnosti.
#### 1.1 Podporované NFC čipy

Primární standard (Doporučeno): NXP NTAG 424 DNA (případně NTAG 415).
Sekundární standard (Základní fallback): NXP NTAG 213 / NTAG 215.
#### 1.2 Formát zapsaných dat (Universal Link)

Data jsou na čipu uložena jako standardní NDEF URI záznam ve formátu Universal Link / App Link: [https://dochazka.firma.cz/a?w=](https://dochazka.firma.cz/a?w=)<workplace_identifier>
Chování při přiložení bez aplikace: Operační systém telefonu otevře webovou landing page s přímými odkazy ke stažení mobilní aplikace pro iOS (App Store) a Android (Google Play / firemní distribuční kanál).
Chování při přiložení s aplikací: Operační systém zachytí Universal Link, okamžitě spustí aplikaci Docházka a předá jí identifikační parametr pracoviště.
### 2. Kryptografické zabezpečení proti kopírování a podvržení

Aby nebylo možné NFC kartu vyčíst běžnou aplikací, zkopírovat její odkaz a simulovat příchod do práce z domova, implementuje systém víceúrovňovou ochranu:
#### 2.1 Dynamický podpis SUN (Secure Unique NFC Message – NTAG 424 DNA)

Při použití čipů NTAG 424 DNA je v paměti čipu bezpečně uložen šifrovací AES klíč (který nelze z čipu softwarově přečíst).
Čip při každém fyzickém přiložení telefonu dynamicky modifikuje generovanou URL adresu: [https://dochazka.firma.cz/a?w=praha1&c=000142&cmac=8A3F9C7D1E2B4A09](https://dochazka.firma.cz/a?w=praha1&c=000142&cmac=8A3F9C7D1E2B4A09)
c = interní hardwarové počítadlo pípnutí (monotónně rostoucí hodnota).
cmac = jednorázový kryptografický MAC podpis (vypočítaný čipem z klíče a aktuálního počítadla).
Backend při přijetí požadavku ověří podpis proti internímu klíči pracoviště a zkontroluje, že počítadlo c je striktně vyšší než při posledním pípnutí na této kartě.
Výsledek: URL adresu nelze přeposlat kolegovi – jakmile je jednou použita, stává se neplatnou. Replay útoky a klonování karty jsou hardwarově znemožněny.
#### 2.2 Validace továrního Hardware UID a heslo PWD/PACK (Fallback pro NTAG 213/215)

Pro základní čipy bez SUN technologie:
Mobilní aplikace při čtení přes nativní plugin @capgo/capacitor-nfc nečte pouze NDEF text, ale vyžádá si neměnné tovární 7-bajtové hardwarové UID čipu z ROM paměti.
Backend páruje konkrétní pracoviště s tímto UID. Běžný smartphone nedokáže emulovat cizí hardwarové UID.
Zámek paměti: Při zápisu karty administrátorem aplikace nastaví 32-bitové heslo PWD a PACK. Paměť karty je chráněna proti neoprávněnému přepsání cizí osobou.
#### 2.3 Správa Disaster Recovery klíčů

Šifrovací klíče a servisní PINy/hesla k odemčení karet jsou uloženy v databázi v šifrované podobě.
V administrátorském rozhraní v detailu pobočky je k dispozici funkce „Exportovat záchranný servisní PIN/klíč“ (do protokolu pro uložení do firemního trezoru), což umožňuje servisní odemčení a přeprogramování karet i při kompletní výměně IT administrátora.
### 3. Pravidla pro QR kódy vs. NFC (Ochrana integrity pobočky)

Systém podporuje skenování QR kódů fotoaparátem telefonu (např. jako nouzový fallback nebo pro párování), platí však striktní bezpečnostní pravidlo:
QR kód nesmí nikdy nést workplace_id: V žádném QR kódu vygenerovaném systémem není obsažen identifikátor fyzického pracoviště.
Backendová validace: Jakýkoliv záznam docházky vytvořený přes QR kód nebo ruční volbu na displeji má v databázi povinně nastaveno:
workplace_id = NULL
location_type = 'remote' / 'home_office'
Podmínka fyzické přítomnosti: Záznam může získat konkrétní cizí klíč workplace_id (a status práce v kanceláři) výhradně tehdy, pokud požadavek přišel přes kryptograficky ověřené NFC pípnutí. Nelze tedy QR kód ofotit, vytisknout ani poslat přes chat a předstírat přítomnost na pracovišti.
## 04. Role, organizační struktura a RBAC matice

### 1. Definice systémových rolí

Systém rozlišuje 5 pevných rolí pokrývajících všechny typy smluvních vztahů (zaměstnanci na HPP i OSVČ):
colleague (Kolega): Základní uživatelská role pro všechny pracovníky. Umožňuje evidenci vlastní docházky, žádosti o volno a náhled na Live Radar kolegů.
team_lead (Vedoucí týmu): Má pod sebou přiřazené podřízené pracovníky. Schvaluje jejich žádosti o volno, vidí jejich detailní časy docházky a provádí schvalování korekcí.
office_manager (Office Manager): Provozní role s celofiremní působností. Má kompletní přehled o docházce všech poboček, ověřuje a potvrzuje lékařské propustky a připravuje mzdové uzávěrky. Nemá plošné právo schvalovat dovolené (pokud není něčí přímý nadřízený) ani přístup k technické správě NFC a API.
manager (Manažer): Stojí v hierarchii nad vedoucími týmů. Zastupuje Team Leady ve schvalování v době jejich nepřítomnosti. Žádosti o dovolenou samotného manažera jsou systémem automaticky schvalovány.
admin (Administrátor): Plná systémová, technická a personální správa. Konfigurace firemních pravidel, zápis NFC karet, správa API integračních tokenů a přiřazování rolí.
### 2. Organizační struktura a strom řízení

#### 2.1 Vazební tabulka nadřízených (user_managers)

Pro zajištění flexibility (zástupy, maticové řízení) může mít pracovník přiřazeného jednoho nebo více nadřízených manažerů:
Vazba je realizována tabulkou user_managers (user_id, manager_id).
manager_id musí odkazovat na uživatele s rolí team_lead, manager, office_manager nebo admin.
#### 2.2 Pravidlo schvalování absencí („First to approve“)

Pokud má uživatel ve svém profilu přiřazeno více nadřízených, nová žádost o volno se zobrazí v inboxu všem těmto nadřízeným současně.
První schválení rozhoduje: Jakmile kterýkoliv z přiřazených manažerů žádost schválí, přechází okamžitě do stavu approved.
Systém k záznamu povinně uloží:
approved_by = ID manažera, který schválení provedl.
approved_at = přesný časové razítko schválení (TIMESTAMPTZ).
Auto-approve pro manažery: Uživatel s rolí manager má své vlastní žádosti o dovolenou schváleny ihned v okamžiku odeslání (status = approved, approved_by = user.id, approved_at = NOW()).
#### 2.3 Specifické postavení Office Managera

Office Manager není hierarchicky nikomu přímo podřízený.
Schvalování dovolené: Office Manager schvaluje žádosti o dovolenou pouze těm kolegům, kteří ho mají výslovně přiřazeného jako svého manažera v tabulce user_managers. Plošné právo schvalovat dovolené celé firmě nemá.
Celofiremní provozní korekce: Má právo editovat časy docházky a potvrzovat lékařské propustky všem uživatelům ve firmě bez ohledu na organizační strom.
### 3. Matice oprávnění (RBAC Matrix)

| Modul / Funkce | Kolega (`colleague`) | Vedoucí (`team_lead`) | Office Manager (`office_manager`) | Manažer (`manager`) | Administrátor (`admin`) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Vlastní píchačky & statistika** | Plný přístup | Plný přístup | Plný přístup | Plný přístup | Plný přístup |
| **Vlastní žádosti o volno** | Plný přístup | Plný přístup | Plný přístup | Plný přístup (Auto-approve) | Plný přístup (Auto-approve) |
| **Live Radar přítomnosti** | Vidí stav všech* | Vidí stav všech* | Vidí stav všech* | Vidí stav všech* | Vidí stav všech* |
| **Detailní časy docházky jiných** | Nemá přístup | Pouze svůj tým | Celá firma | Celá firma (podřízené větve) | Celá firma |
| **Schvalování dovolených** | Nemá přístup | Pouze přiřazení lidé | Pouze jemu přiřazení lidé | Podřízení a zástup za Lead | Celá firma |
| **Ověření a zápis propustky lékaře** | Nemá přístup | Svůj tým | Celá firma | Svůj tým a podřízení | Celá firma |
| **Korekce zapomenutého odchodu** | Zadá návrh | Schvaluje týmu | Schvaluje komukoliv | Schvaluje své větvi | Schvaluje komukoliv |
| **Správa uživatelů a úvazků** | Nemá přístup | Pouze čtení týmu | Pouze čtení celé firmy | Pouze čtení své větve | Plná správa (CRUD) |
| **Zápis a správa NFC karet** | Nemá přístup | Nemá přístup | Nemá přístup | Nemá přístup | Plná správa |
| **Základní měsíční mzdový export** | Pouze svůj výpis | Souhrn za tým | Celofiremní export | Souhrn za své větve | Celofiremní export |
| **Správa API klíčů a VAPID** | Nemá přístup | Nemá přístup | Nemá přístup | Nemá přístup | Plná správa |

> [!NOTE]
> Na Live Radaru vidí všichni kolegové navzájem aktuální status (V práci / HO / Lékař / Volno), nikoliv však přesný čas příchodu a odchodu z pípnutí.

## 05. Pracovní fondy, svátky a odměňování

### 1. Časový model a fond pracovní doby

#### 1.1 Model časového bloku (Start – End)

Každá směna je reprezentována samostatným záznamem v tabulce time_entries s časem příchodu start_time a časem odchodu end_time.
Přesnost dat: Všechna pípnutí se do databáze ukládají jako přesná časová razítka na sekundu v časové zóně UTC (TIMESTAMPTZ).
Zaokrouhlování: Provozní zaokrouhlování (např. na 5 nebo 15 minut) se neaplikuje na primární data, ale volitelně až při generování výstupních reportů a mzdových podkladů.
#### 1.2 Pracovní fond a rozpočty

Globální konfigurace (company_settings): Výchozí týdenní fond činí 40 hodin týdně (default_weekly_hours = 40).
Individuální rozpočet (weekly_hours_budget): U každého uživatele lze nastavit individuální fond (např. 20 h pro poloviční úvazek).
Denní bilance: Denní fond je odvozen poměrně z týdenního fondu (při 40 h týdně = 8,0 h denně). Kladný rozdíl tvoří přesčas (+), záporný tvoří deficit (-).
### 2. Příplatky za svátky a víkendy

Systém automaticky vyhodnocuje práci mimo běžnou pracovní dobu na základě globálních koeficientů definovaných v konfiguraci (company_settings):
- **`multiplier_weekend`** – příplatek za práci o víkendu (sobota, neděle): výchozí hodnota 200 %.
- **`multiplier_holiday`** – příplatek za práci ve státní svátek: výchozí hodnota 200 %.
- **`multiplier_weekend_holiday`** – příplatek za práci ve státní svátek připadající na víkend: výchozí hodnota 300 %.
Tyto koeficienty jsou plně editovatelné Administrátorem a Office Managerem v administračním rozhraní.
### 3. Výpočet a správa státních svátků

Systém kombinuje algoritmickou nezávislost, externí API aktualizace a možnost ručního zadání:
#### 3.1 Algoritmický výpočet českých svátků (C# / .NET)

Backend obsahuje vestavěný matematický algoritmus pro výpočet svátků pro jakýkoliv kalendářní rok bez nutnosti internetového připojení:
Pevné svátky: 1. 1., 1. 5., 8. 5., 5. 7., 6. 7., 28. 9., 28. 10., 17. 11., 24. 12., 25. 12., 26. 12.
Pohyblivé velikonoční svátky: Velký pátek a Velikonoční pondělí jsou dynamicky počítány pomocí Meeus/Butcher Gauss algoritmu pro výpočet data Velikonoc.
#### 3.2 Konfigurovatelné API svátků (company_settings.holidays_api_url)

V nastavení systému je uložena URL adresa externího REST API pro synchronizaci svátků.
Správce může adresu kdykoliv upravit, vyměnit za jiné API nebo synchronizaci zcela vypnout.
#### 3.3 Tabulka holidays a mimořádné firemní volno

Vygenerované nebo načtené svátky jsou uloženy v tabulce holidays (date, name, is_custom_holiday).
Office Manager nebo Admin mohou do této tabulky jedním klikem přidat mimořádné firemní volno (ředitelské volno, celofiremní dovolená), které se pro výpočet docházky a příplatků chová shodně jako státní svátek.
### 4. Finanční modely a odměňování uživatelů

Každý pracovník má v tabulce users definován svůj model odměňování:
#### 4.1 Typ odměny (compensation_type)

Hodinová sazba (hourly):
Výsledná měsíční odměna je kalkulována jako součin odpracovaných hodin a částky hourly_rate.
Na hodiny odpracované o víkendech a svátcích se aplikují příslušné násobící koeficienty (200 % / 300 %).
U pracovníků typu OSVČ je pole hourly_rate volitelné (nemusí být vyplněno, pokud si OSVČ fakturuje zcela samostatně).
Fixní měsíční paušál (fixed):
Uživatel má nastavenu pevnou měsíční částku fixed_monthly_rate.
Měsíční odměna zůstává konstantní bez ohledu na počet pracovních dnů v měsíci, čerpání dovolené či počet svátků.
## 06. Absence, kapacity a dvoufázové workflow lékaře

### 1. Číselník absencí (absence_types)

Systém eviduje typy absencí s podporou duálního názvosloví pro zaměstnance a OSVČ:
Výchozí kódy: vacation (Dovolená / Volno), doctor (Lékař), sick_day (Sick day), home_office (Práce z domova), unpaid_leave (Neplacené volno), illness (Pracovní neschopnost).
Názvosloví: Každá položka nese name_employee (např. Dovolená) a name_osvc (např. Neplacené volno / Pauza).
Jednotka trvání: duration_mode (days, hours, both).
### 2. Pravidla kapacit a časových lhůt (Offsety)

#### 2.1 Lhůty pro hlášení (Offset pravidla)

Definováno v absence_types pro jednotlivé typy absencí:
- **`submission_offset_days (INT)`** – požadovaný předstih pro zadání:
Offset 0 (v den absence): Umožňuje zadání v daný den, ale striktně do limitu definovaného v submission_deadline_hours_before před začátkem oficiální pracovní doby (např. při začátku v 08:00 a limitu 2 h lze Sick day zadat nejpozději v 06:00 ráno).
Offset 1 (den předem): Lze zadat nejpozději předchozí kalendářní den do 23:59.
Offset N: Libovolný počet dní předem (např. pro delší dovolenou).
#### 2.2 Kapacity a periody rozpočtů (user_absence_settings)

Každý uživatel má pro každý typ absence vlastní záznam:
budget_period:
weekly (Týdenní limit, např. Home Office max. 2 dny za týden).
yearly (Roční fond, např. 20 dní dovolené, 5 dní Sick days; fond se ze zákona nepřevádí do dalšího roku).
permanent (Trvalé nastavení bez čerpání fondu, např. permanentní full-remote pro vybrané vývojáře).
unlimited (Neomezené čerpání bez horního stropu).
- **`allocated_capacity`** – přidělená číselná kapacita v dnech nebo hodinách.
- **`max_per_month_limit`** – systémový nebo individuální strop za jeden kalendářní měsíc (např. u Sick days striktně max. 2 dny v jednom měsíci).
### 3. Dvoufázové workflow návštěvy lékaře (Propustky)

Protože lékařské potvrzení (propustka) je fyzický právní doklad, proces probíhá dvoufázově s manuálním ověřením v MVP fázi:
Fáze 1 – Plánování (Kolega):
Uživatel ví, že v daný den musí k lékaři. V aplikaci vybere typ Lékař a zadá předpokládané časové rozmezí (např. 09:00 – 12:00).
Žádost je vytvořena ve stavu status = 'pending' (čeká na doložení dokladu).
Fáze 2 – Zobrazení v operačním přehledu:
Na Dashboardu Office Managera se v sekci denní operativy zobrazuje widget „Lékaři k fyzickému ověření“, kde visí všichni pracovníci s lékařem ve stavu pending.
Fáze 3 – Fyzická kontrola dokladu (Office Manager):
Pracovník po návratu předloží papírové potvrzení s razítkem lékaře.
Office Manager otevře detail záznamu, porovná časy na papíru se zadaným návrhem a v případě odchylky přepíše časy na skutečné hodnoty včetně cesty (actual_start, actual_end).
Kliknutím na tlačítko „Potvrdit lékaře“ přejde žádost do konečného stavu status = 'completed'.
Auditní zápis ověření:
K záznamu se povinně uloží:
verified_by = ID Office Managera (případně vedoucího týmu).
verified_at = přesný čas verifikace (TIMESTAMPTZ).
Backlog (Budoucí fáze): Focení propustky fotoaparátem mobilního telefonu a ukládání obrazové přílohy je zařazeno do budoucího vývojového backlogu.
### 4. Řešení zapomenutého odchodu (Korekce)

Pokud pracovník při odchodu z práce nepípne kartou ani neuzavře směnu v aplikaci, záznam v time_entries zůstává otevřený (end_time = NULL).
Ranní blokace: Při dalším pokusu o příchod následující den systém detekuje neuzavřený předchozí blok. Standardní pípnutí je zablokováno a uživateli se zobrazí červené upozornění „Chybí čas včerejšího odchodu“.
Zadání korekce: Uživatel musí v aplikaci zadat navrhovaný čas odchodu a uvést textový důvod zapomenutí.
Schválení: Záznam čeká na schválení Team Leadem nebo Office Managerem. Po schválení se zapíše edited_by, edited_at a is_manual = true. Teprve poté je odemčena možnost standardního pípnutí příchodu na novou směnu.
## 07. Dashboard UI a Live Radar přítomnosti

### 1. Rozhraní hlavní obrazovky (Dashboard)

Dashboard slouží pro okamžitou denní operativu bez složitých navigačních prvků.
#### 1.1 Hlavní akční ovládací prvky

Na obrazovce dominují pouze dvě velká tlačítka:
PŘÍCHOD
ODCHOD
Interaktivní modal po kliknutí:
Kliknutí na kterékoliv z tlačítek otevře dialogové okno s vizuální animací vyzývající k přiložení NFC karty.
Patička modalu obsahuje:
Textové CTA tlačítko „Zrušit“ (zavře modal bez provedení akce).
Alternativní tlačítko „Jsem doma“ (zapíše vybranou akci – příchod nebo odchod – s příznakem location_type = 'home_office' bez vyžádání NFC čipu).
#### 1.2 Týdenní kalendářní pás

V horní části dashboardu je umístěn horizontální pás zobrazující dny aktuálního týdne v rámci měsíce.
Pás umožňuje listování (šipky vpřed / vzad) pro rychlou vizuální kontrolu odpracovaných bloků v jednotlivých dnech daného týdne.
#### 1.3 Denní role-based přehled (Widgety)

Pro vedoucí role (team_lead, manager, office_manager) se pod hlavními prvky zobrazuje kompaktní denní status panel:
Informační štítky přítomnosti: např. „Maru – dnes u lékaře“, „Petr – Home Office“, „Vladimír – ranní Sick day“.
Widget čekajících žádostí o volno vyžadujících schválení.
Widget čekajících lékařských propustek k fyzické kontrole (primárně pro Office Managera).
### 2. Odchod z Home Office a správa pauz

Pokud má pracovník aktivní směnu na Home Office a klikne na tlačítko Odchod, systém otevře dialog s volbou typu ukončení:
Volba „Konec práce pro dnešek“:
Aktuální směna se v databázi okamžitě uzavře zápisem reálného času odchodu (end_time = NOW()).
Volba „Ještě se vrátím (Pauza)“:
Systém v databázi ihned uzavře aktuální časový blok (end_time = NOW()), aby nedocházelo k chybnému započítávání nepracovní doby.
Uživatel v dialogu zadá orientační čas návratu (např. 14:30).
Tento čas se uloží do dočasného stavu uživatelského profilu (expected_return_at = 14:30).
Na Live Radaru se pro všechny ostatní kolegy zobrazí status: „Nedostupný (orientační návrat cca 14:30)“.
Návrat do práce:
Po návratu pracovník v aplikaci standardně klikne na Příchod (Jsem doma).
Příznak expected_return_at se okamžitě vymaže a v databázi se otevře nový plnohodnotný časový blok docházky.
### 3. Live Radar přítomnosti (Kdo kde je)

Live Radar slouží k rychlé týmové koordinaci a přehledu o dostupnosti pracovníků.
#### 3.1 Vzájemná viditelnost mezi kolegy

Live Radar je přístupný všem pracovníkům navzájem bez rozdílu role.
Zobrazuje aktuální stav každého kolegy v reálném čase:
Zelená: Přítomen v kanceláři (včetně názvu pobočky).
Modrá: Na Home Office.
Žlutá / Oranžová: U lékaře (včetně zobrazení plánovaného času, např. „u lékaře od 13:00“).
Šedá: Nepřítomen / Volno / Dovolená / Pauza s orientačním časem návratu.
#### 3.2 Ochrana detailních časů a historie docházky

Striktní bezpečnostní pravidlo: Detailní časy pípnutí (přesné minuty příchodů a odchodů, historie za dny a měsíce) vidí výhradně:
Daný uživatel sám sobě.
Přímý Team Lead daného uživatele.
Manažer nadřízený danému Team Leadu ve stromu řízení.
Office Manager (v rámci celofiremního provozního přehledu).
Administrátor systému.
Ostatní řadoví kolegové nemají k přesným časovým záznamům jiných osob přístup přes UI ani přes API endpointy.
## 08. Notifikace a personální údaje

### 1. Systém notifikací a doručovací kanály

Aplikace podporuje 3 nezávislé notifikační kanály navržené s ohledem na nulové licenční náklady a nezávislost na placených cloudových službách:
#### 1.1 In-App notifikační centrum

Ikona zvonečku v záhlaví aplikace s číselným odznakem (badge) nepřečtených zpráv.
Ukládáno v interní databázové tabulce notifications pro každého uživatele.
#### 1.2 Firemní E-mail

Odesílání transakčních e-mailů přes firemní SMTP server nebo Google Workspace API.
Využívá se pro souhrnná oznámení a důležité systémové výzvy.
#### 1.3 Nezávislý Web Push protokol (VAPID klíče)

Princip fungování: Využívá nativní standard W3C Push API / Web Push.
Nulová závislost na účtech: Každá instalace serveru si při prvním spuštění sama vygeneruje asymetrický kryptografický pár VAPID klíčů (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY). Server podepisuje požadavky přímo pro push servery Googlu (FCM endpoint), Applu (APNs endpoint) a Mozilly.
Není vyžadován žádný projekt ve Firebase, Google Cloud účet ani platební karta provozovatele.
Funguje na desktopovém webu, na Androidu i na iOS (přes Capacitor Web Push).
### 2. Uživatelské preference notifikací (user_notification_preferences)

Každý uživatel si v profilu v sekci Nastavení oznámení může individuálně konfigurovat, které notifikace a jakým kanálem chce přijímat.
#### 2.1 Konfigurační přepínače (Togglem)

Kanály: channel_in_app, channel_email, channel_push (vše výchozí true).
Typy událostí:
- **`notify_leave_approval`** – Schválení nebo zamítnutí vlastní žádosti o volno.
- **`notify_pending_approval`** – (Pro vedoucí) Upozornění na novou žádost podřízeného ke schválení.
- **`notify_doctor_verified`** – Upozornění na potvrzení lékařské propustky Office Managerem.
- **`notify_forgotten_clockout`** – Ranní výzva k doplnění zapomenutého odchodu z předchozího dne.
Synchronizace: Změny jsou okamžitě ukládány na server (PATCH /api/users/me/notifications) a zároveň cachovány v lokálním úložišti zařízení.
### 3. Personální údaje a telefonní kontakty

V tabulce users jsou evidovány rozšířené kontaktní údaje:
phone_number (VARCHAR, Nullable) – telefonní číslo s mezinárodní předvolbou (např. +420 777 123 456).
Zobrazení: Telefonní číslo se zobrazuje v detailu profilu kolegy a na Live Radaru. Na mobilním zařízení je zobrazeno s interaktivní ikonou sluchátka umožňující okamžité vytočení hovoru (protokol tel:).
## 09. České skloňování jmen (7 pádů)

### 1. Struktura jména a české skloňování

V tabulce users jsou jméno a příjmení uloženy striktně odděleně:
first_name (Jméno, např. Petr)
last_name (Příjmení, např. Kulhánek)
display_name (Generovaný náhledový tvar, např. Petr Kulhánek)
### 2. Číselník skloňování (name_declensions)

Pro generování přirozených českých textů v osloveních, notifikacích a systémových zprávách (např. „Schválit volno Petrovi“, „Ahoj Petře!“) obsahuje systém plnou deklinaci všech 7 pádů českého jazyka.
#### 2.1 Struktura tabulky name_declensions

id (UUID, PK)
nominative (VARCHAR, Unique, Lowercase Index) – 1. pád (např. petr)
genitive (VARCHAR, Nullable) – 2. pád: Bez koho, čeho? (Petra)
dative (VARCHAR, Nullable) – 3. pád: Ke komu, čemu? (Petrovi)
accusative (VARCHAR, Nullable) – 4. pád: Vidím koho, co? (Petra)
vocative (VARCHAR, Nullable) – 5. pád: Oslovujeme, voláme! (Petře)
locative (VARCHAR, Nullable) – 6. pád: O kom, o čem? (Petrovi)
instrumental (VARCHAR, Nullable) – 7. pád: S kým, čím? (Petrem)
is_ignored (BOOLEAN, Default: false)
### 3. Modální workflow při neznámém jménu

Při vytvoření nového uživatele (nebo při prvním přihlášení přes Google OAuth) provede backend kontrolu existence záznamu v tabulce name_declensions podle first_name:
Detekce chybějícího záznamu:
Pokud jméno v tabulce dosud neexistuje a nemá nastaveno is_ignored = true, systém zobrazí správci / zadavateli modální okno pro doplnění skloňování.
Podoba modálního okna:
Formulář obsahuje všech 7 textových polí s pomocnými pádovými otázkami:
### 1. pád (Kdo, co?): Předvyplněno jménem.

### 2. pád (Bez koho, čeho?)

### 3. pád (Ke komu, čemu?)

### 4. pád (Vidím koho, co?)

### 5. pád (Oslovujeme / voláme!)

### 6. pád (O kom, o čem?)

### 7. pád (S kým, čím?)

Dostupné akce v modalu:
Uložit: Uloží všech 7 tvarů do tabulky name_declensions. Systém od této chvíle zná skloňování tohoto jména pro celou firmu.
Zavřít (Křížek): Zavře dialog pro aktuální relaci bez uložení (při další editaci profilu se může dialog připomenout).
Ignorovat: Vytvoří v tabulce záznam pro dané jméno s prázdnými pády a příznakem is_ignored = true. Systém výzvu pro toto jméno již nikdy znovu nezobrazí.
Manuální správa: V detailu uživatele i v systémové administraci je kdykoliv k dispozici tlačítko „Upravit skloňování jména“ pro dodatečnou opravu či doplnění tvarů.
## 10. Exporty a mzdové podklady (MVP)

### 1. Rozsah exportů pro MVP fázi

Pro první fázi (MVP) systém neimplementuje komplexní grafické tiskové sestavy ani složité PDF formuláře. Rozsah je zaměřen na Základní měsíční sumář docházky, který slouží jako podklad pro interní účetní, externí mzdovou kancelář i samostatné fakturace pracovníků na OSVČ.
### 2. Struktura základního měsíčního sumáře

Měsíční report je dostupný v administraci pro Administrátora a Office Managera (celofiremně) a pro Vedoucího týmu (za jeho tým). Lze jej filtrovat podle pobočky, týmu a kalendářního měsíce.
#### 2.1 Exportované datové sloupce (CSV / XLSX / Tabulkový náhled)

Identifikace: Osobní číslo, Příjmení, Jméno, Firemní e-mail.
Smluvní model: Smluvní vztah (employee / osvc), Typ úvazku (full_time / half_time / part_time).
Pracovní fond: Předepsaný měsíční fond hodin (např. 160 h), Reálně odpracované hodiny celkem.
Saldo přesčasů: Rozdíl oproti fondu (+ / - hodiny).
Rozpad příplatkových hodin:
Práce o víkendu (hodiny s koeficientem 200 %).
Práce ve státní svátek v pracovní den (hodiny s koeficientem 200 %).
Práce ve státní svátek o víkendu (hodiny s koeficientem 300 %).
Absence a neodpracovaná doba:
Dovolená (vyčerpané dny / hodiny).
Lékař (potvrzené hodiny z propustek).
Sick days (vyčerpané dny).
Neplacené volno / Překážky v práci (hodiny).
Nemocenská (dny).
Finanční vyhodnocení (Dle modelu):
Typ odměny: hourly / fixed.
U hodinové sazby: Celková částka k proplacení (základní hodiny × sazba + příplatky).
U fixního paušálu: Základní paušální částka (beze změn vlivem svátků či fondu).
U OSVČ bez vyplněné sazby: Pouze sumář hodin pro vystavení vlastní faktury.
## 11. Kompletní datový model (Entity Framework Core)

Schéma relační databáze (Entity Framework Core modely). Všechna časová razítka jsou typu TIMESTAMPTZ (UTC).
### 1. Tabulka: `users` (Uživatelé)

- `id` (`UUID, PK`)
- `email` (`VARCHAR(255), Unique, Not Null`)
- `google_id` (`VARCHAR(255), Nullable`)
- `first_name` (`VARCHAR(100), Not Null`)
- `last_name` (`VARCHAR(100), Not Null`)
- `display_name` (`VARCHAR(200), Not Null`)
- `phone_number` (`VARCHAR(50), Nullable`)
- `avatar_url` (`VARCHAR(500), Nullable`)
- `role` (`ENUM: colleague, team_lead, office_manager, manager, admin, Default: colleague`)
- `contract_kind` (`ENUM: employee, osvc, Default: employee`)
- `contract_type` (`ENUM: full_time, half_time, part_time, Default: full_time`)
- `compensation_type` (`ENUM: hourly, fixed, Default: hourly`)
- `hourly_rate` (`DECIMAL(10,2), Nullable`)
- `fixed_monthly_rate` (`DECIMAL(10,2), Nullable`)
- `weekly_hours_budget` (`DECIMAL(5,2), Default: 40.00`)
- `expected_return_at` (`TIMESTAMPTZ, Nullable`) – dočasný stav při pauze na HO
- `is_active` (`BOOLEAN, Default: true`)
- `created_at / updated_at` (`TIMESTAMPTZ, Not Null`)
### 2. Tabulka: `user_managers` (Organizační vazby N:M)

- `id` (`UUID, PK`)
- `user_id` (`UUID, FK -> users.id, Index`)
- `manager_id` (`UUID, FK -> users.id, Index`)
- `created_at` (`TIMESTAMPTZ, Not Null`)
### 3. Tabulka: `name_declensions` (České skloňování)

- `id` (`UUID, PK`)
- `nominative` (`VARCHAR(100), Unique, Index, Lowercase`)
- `genitive` (`VARCHAR(100), Nullable`)
- `dative` (`VARCHAR(100), Nullable`)
- `accusative` (`VARCHAR(100), Nullable`)
- `vocative` (`VARCHAR(100), Nullable`)
- `locative` (`VARCHAR(100), Nullable`)
- `instrumental` (`VARCHAR(100), Nullable`)
- `is_ignored` (`BOOLEAN, Default: false`)
### 4. Tabulka: `workplaces` (Pobočky a pracoviště)

- `id` (`UUID, PK`)
- `name` (`VARCHAR(150), Not Null`)
- `nfc_identifier` (`VARCHAR(100), Unique, Not Null`)
- `nfc_hardware_uid` (`VARCHAR(50), Nullable`)
- `nfc_key_encrypted` (`TEXT, Nullable`) – šifrovaný klíč karty
- `address` (`VARCHAR(255), Nullable`)
- `is_active` (`BOOLEAN, Default: true`)
### 5. Tabulka: `time_entries` (Záznamy docházky)

- `id` (`UUID, PK`)
- `user_id` (`UUID, FK -> users.id, Index`)
- `workplace_id` (`UUID, FK -> workplaces.id, Nullable`)
- `start_time` (`TIMESTAMPTZ, Not Null`)
- `end_time` (`TIMESTAMPTZ, Nullable`) – NULL indikuje otevřenou směnu
- `location_type` (`ENUM: office, home_office, remote, Not Null`)
- `is_manual` (`BOOLEAN, Default: false`)
- `edited_by` (`UUID, FK -> users.id, Nullable`)
- `edited_at` (`TIMESTAMPTZ, Nullable`)
- `edit_reason` (`TEXT, Nullable`)
### 6. Tabulka: `absence_types` (Číselník typů absencí)

- `id` (`UUID, PK`)
- `code` (`VARCHAR(50), Unique, Not Null`)
- `name_employee` (`VARCHAR(100), Not Null`)
- `name_osvc` (`VARCHAR(100), Not Null`)
- `duration_mode` (`ENUM: days, hours, both, Default: days`)
- `submission_offset_days` (`INT, Default: 0`)
- `submission_deadline_hours_before` (`INT, Nullable`)
- `max_per_month_limit` (`INT, Nullable`)
- `default_budget_period` (`ENUM: weekly, yearly, permanent, unlimited, Default: yearly`)
- `is_active` (`BOOLEAN, Default: true`)
### 7. Tabulka: `user_absence_settings` (Individuální pravidla absencí)

- `id` (`UUID, PK`)
- `user_id` (`UUID, FK -> users.id, Index`)
- `absence_type_id` (`UUID, FK -> absence_types.id, Index`)
- `budget_period` (`ENUM: weekly, yearly, permanent, unlimited`)
- `allocated_capacity` (`DECIMAL(6,2), Nullable`)
- `max_per_month_override` (`INT, Nullable`)
- `is_paid` (`BOOLEAN, Default: true`)
### 8. Tabulka: `absence_requests` (Žádosti o volno a lékař)

- `id` (`UUID, PK`)
- `user_id` (`UUID, FK -> users.id, Index`)
- `absence_type_id` (`UUID, FK -> absence_types.id, Index`)
- `status` (`ENUM: pending, completed, rejected, cancelled, Default: pending`)
- `planned_start` (`TIMESTAMPTZ, Not Null`)
- `planned_end` (`TIMESTAMPTZ, Not Null`)
- `actual_start` (`TIMESTAMPTZ, Nullable`) – vyplňuje Office Manager/vedoucí
- `actual_end` (`TIMESTAMPTZ, Nullable`) – vyplňuje Office Manager/vedoucí
- `approved_by` (`UUID, FK -> users.id, Nullable`)
- `approved_at` (`TIMESTAMPTZ, Nullable`)
- `verified_by` (`UUID, FK -> users.id, Nullable`) – ověření propustky
- `verified_at` (`TIMESTAMPTZ, Nullable`)
- `note` (`TEXT, Nullable`)
- `rejection_reason` (`TEXT, Nullable`)
### 9. Tabulka: `company_settings` (Firemní konfigurace)

- `id` (`UUID, PK`)
- `default_weekly_hours` (`DECIMAL(5,2), Default: 40.00`)
- `multiplier_holiday` (`INT, Default: 200`)
- `multiplier_weekend` (`INT, Default: 200`)
- `multiplier_weekend_holiday` (`INT, Default: 300`)
- `workday_start_time` (`VARCHAR(5), Default: "08:00"`)
- `holidays_api_url` (`VARCHAR(500), Nullable`)
- `vapid_public_key` (`TEXT, Nullable`)
- `vapid_private_key` (`TEXT, Nullable`)
### 10. Tabulka: `holidays` (Státní a firemní svátky)

- `id` (`UUID, PK`)
- `date` (`DATE, Unique, Index`)
- `name` (`VARCHAR(150), Not Null`)
- `is_custom_holiday` (`BOOLEAN, Default: false`)
### 11. Tabulka: `user_notification_preferences` (Oznámení)

- `user_id` (`UUID, PK, FK -> users.id`)
- `channel_in_app` (`BOOLEAN, Default: true`)
- `channel_email` (`BOOLEAN, Default: true`)
- `channel_push` (`BOOLEAN, Default: true`)
- `notify_leave_approval` (`BOOLEAN, Default: true`)
- `notify_pending_approval` (`BOOLEAN, Default: true`)
- `notify_doctor_verified` (`BOOLEAN, Default: true`)
- `notify_forgotten_clockout` (`BOOLEAN, Default: true`)
## 12. Developer workflow a API dokumentace

### 1. Lokální vývojové prostředí

Vývojové prostředí je navrženo pro okamžitý start vývojáře po naklonování repozitáře bez nutnosti složité ruční konfigurace.
#### 1.1 Lokální běh databáze

Varianta A (Docker): V kořenu projektu je k dispozici minimalistický docker-compose.dev.yml:
```yaml
version: '3.8'
services:
  db:
    image: postgres:16-alpine
    ports:
      - "5432:5432"
    environment:
      POSTGRES_DB: dochazka_dev
      POSTGRES_USER: dev
      POSTGRES_PASSWORD: devpassword
```

Spuštění: docker compose -f docker-compose.dev.yml up -d.
Varianta B (MS SQL LocalDB): Na Windows lze využít přímé připojení na (localdb)\mssqllocaldb definované v appsettings.Development.json.
#### 1.2 Automatické migrace a Seeder při startu

V režimu Development backend při startu aplikace (Program.cs) automaticky provede:
- **`context.Database.Migrate()`** – zkontroluje stav schématu a aplikuje všechny chybějící migrace.
DbInitializer.SeedAsync(context):
Pokud v tabulce users není žádný záznam, vytvoří kompletní testovací sadu:
Virtuální pobočku 0 a testovací pobočku Praha 1.
Testovacího administrátora (admin@firma.cz).
Vzorového vedoucího (lead@firma.cz), Office Managera (office@firma.cz), zaměstnance a OSVČ vývojáře.
Vzájemné vazby v user_managers.
Předvyplněné vzorové záznamy docházky, otevřenou směnu a žádost o návštěvu lékaře ve stavu pending.
Předvyplněný testovací API klíč pro integrační testy.
#### 1.3 Běh frontendu (React + Vite)

Spuštění v /frontend: npm install && npm run dev.
Běží na http://localhost:5173.
V souboru vite.config.ts je předkonfigurována reverzní proxy:
```typescript
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:5000',
      changeOrigin: true
    }
  }
}
```

Tím je zajištěn vývoj bez jakýchkoliv CORS restrikcí.
### 2. Automatická dokumentace API (OpenAPI / Swagger / Scalar)

Veškerá dokumentace REST API je generována plně automaticky ze zdrojového kódu C# kontrolerů a DTO modelů.
#### 2.1 Interaktivní portál

Při běhu backendu je dokumentace dostupná na URL /swagger nebo moderním rozhraní /scalar/v1.
Umožňuje přímé testování endpointů v prohlížeči:
Tlačítko Authorize pro zadání Bearer JWT tokenu nebo API klíče.
Zobrazení všech validačních pravidel, povinných parametrů a návratových chybových stavů (400, 401, 403, 404, 500).
#### 2.2 Strojová specifikace pro SDK generátory

Na adrese /swagger/v1/swagger.json je vystavena validní OpenAPI 3.0 specifikace.
Umožňuje externím týmům automaticky vygenerovat typově bezpečné klientské SDK pro TypeScript, C#, Python nebo PHP pomocí nástroje openapi-generator-cli.
#### 2.3 Externí integrace a API klíče

Pro přístup k API ze systémů třetích stran (Jira, účetní software Helios apod.) systém podporuje generování Personal Access Tokenů (PAT) v administraci.
Každý token má přiřazeno pole oprávnění (scopes, např. attendance:read, users:read, export:payroll).
## 13. Antigravity pravidla a testovací agent

### 1. Architektonická pravidla (.antigravity/rules.md)

Tento soubor je agentem povinně čten před zahájením implementace:
> **Antigravity Architecture Rules**


### 1. API Response Envelope:

   Všechny REST API odpovědi musí striktně dodržovat jednotný JSON obal:
```json
   {
     "data": T | null,
     "error": { "code": string, "message": string, "details": any } | null,
     "meta": { "timestamp": string, "pagination": any } | null
   }
```


### 2. Timezone Policy:

   - Databáze ukládá VŠECHNA časová razítka výhradně v UTC (TIMESTAMPTZ).
   - Backend operuje interně pouze s DateTimeOffset v UTC.
   - Přepočet do lokálního času (Europe/Prague) a formátování probíhá až na klientovi.

### 3. Neměnnost a auditní stopa:

   - Žádný záznam docházky (time_entries) se z databáze fyzicky nemaže (Hard Delete zakázán).
   - Veškeré ruční korekce povinně nastavují is_manual = true, edited_by, edited_at a edit_reason.

### 4. Separace klientské logiky:

   - UI komponenty v Reactu nesmí obsahovat přímé volání fetch / axios ani komplexní byznys kalkulace.
   - Veškeré API volání a správa cache musí být zapouzdřena v samostatných TanStack Query (React Query) hooks v adresáři /src/api.


### 2. Pravidla designu a rozhraní (.antigravity/designrules.md)

Tento soubor definuje vzhled a ergonomii aplikace:
> **Antigravity Design Rules**


### 1. Vizuální směr:

   - Moderní podnikové rozhraní (Linear / Vercel style) postavené na Tailwind CSS.
   - Čisté linie, vysoký kontrast, minimální vizuální šum.

### 2. Barevná paleta:

   - Neutrální pozadí: Slate / Zinc odstíny (dark mode ready).
   - Akcentní barva: Definována přes CSS proměnnou --brand-primary (umožňuje jednoduchý white-labeling).
   - Sémantické barvy:
     - Zelená (Emerald-500): Přítomen na pracovišti, schválená žádost.
     - Modrá (Sky-500): Home Office.
     - Žlutá/Oranžová (Amber-500): Lékař, čeká na schválení, dočasná pauza.
     - Červená (Rose-500): Zapomenutý odchod, zamítnuto, zablokováno.

### 3. Dotyková ergonomie (Mobile-First touch targets):

   - Minimální klikací plocha interaktivních prvků a tlačítek na mobilu je 48x48 px.
   - Dvě hlavní akční tlačítka (Příchod / Odchod) dominují obrazovce s výrazným poloměrem (rounded-xl) a jasnou haptickou/vizuální odezvou.

### 4. Responzivní chování:

   - Mobilní zobrazení: Spodní navigační lišta (Bottom Tab Bar), swipe gesta pro listování týdnem, kartový přehled.
   - Desktopové zobrazení: Postranní rozbalovací menu (Sidebar), plnohodnotné datové tabulky s řazením a pokročilým filtrováním.


### 3. Instrukce pro Testovacího Agenta

Po vygenerování kódu spustí Antigravity autonomního testovacího agenta pro ověření spolehlivosti:
#### 3.1 Backend integrační testy (xUnit + WebApplicationFactory)

Testovací agent ověřuje tyto kritické hraniční stavy:
MissingClockOutException (Zapomenutý odchod):
- **Scénář:** Uživatel má včerejší záznam s end_time = NULL. Pokusí se dnes ráno odeslat příchod.
- **Očekávaný výsledek:** Backend odmítne požadavek kódem 400 Bad Request se specifickým chybovým kódem ERR_MISSING_CLOCK_OUT a zablokuje další zápis.
Dvoufázový lékař:
- **Scénář:** Vytvoření žádosti ve stavu pending. Office Manager pošle požadavek na verifikaci se změnou času.
- **Očekávaný výsledek:** Záznam přejde do completed, časy jsou aktualizovány a pole verified_by a verified_at jsou správně vyplněna.
Pravidlo First-to-Approve:
- **Scénář:** Uživatel má manažery A a B. Manažer A schválí volno.
- **Očekávaný výsledek:** Žádost má status approved, approved_by = A. Následný pokus manažera B o schválení vrací informaci o již schválené žádosti.
RBAC Security Guard:
- **Scénář:** Běžný uživatel s rolí colleague se pokusí zavolat endpoint pro schválení volna nebo zápis NFC karty.
- **Očekávaný výsledek:** Návratový kód 403 Forbidden.
#### 3.2 Frontend NFC simulátor pro vývojové prostředí

Protože běžný desktopový prohlížeč nedisponuje hardwarem pro čtení NFC, frontend v režimu Development obsahuje plovoucí nástroj „NFC Debug Simulator“.
Umožňuje vývojáři jedním kliknutím simulovat:
Přiložení karty Pobočka Praha.
Přiložení karty Pobočka Brno.
Přiložení neznámého / neautorizovaného NFC tagu.
Tím je zajištěno plnohodnotné automatizované i manuální testování celého NFC toku bez nutnosti fyzických čipů.

## 14. Testovací agent (Edge Cases, integrační a E2E testy)

### 1. Úloha a rozsah Testovacího Agenta (Antigravity Test Runner)

Testovací agent je autonomní validační subsystém spouštěný po každém vygenerování nebo úpravě kódu. Jeho primárním cílem je garantovat integritu databázových transakcí, striktní dodržování bezpečnostních pravidel (RBAC, NFC validace), správnost mzdových kalkulací a bezchybný běh uživatelských toků.
#### 1.1 Technologický testovací stack

Backend (.NET 9):
- **`xUnit`** – primární testovací framework.
- **`Microsoft.AspNetCore.Mvc.Testing (WebApplicationFactory<Program>)`** – integrační in-memory testování celého HTTP pipeline.
- **`FluentAssertions`** – čitelné aserce výsledků.
Testcontainers (PostgreSQL / MS SQL) – izolované databázové prostředí pro integrační testy transakcí a časových zón.
Frontend (React + Vite):
- **`Vitest + React Testing Library`** – jednotkové a integrační testy komponent a custom hooks.
- **`MSW (Mock Service Worker)`** – mockování REST API odpovědí s jednotným envelope.
- **`Playwright`** – end-to-end (E2E) testování klíčových scénářů (příchod, odchod, schválení).
### 2. Kritické integrační testy backendu (Edge Cases & Business Rules)

Testovací agent musí povinně sestavit a spustit následující testovací sady:
#### 2.1 Testovací sada: Životní cyklus směny a zapomenutý odchod

##### Test `TC-ATT-01`: StandardClockInAndClockOut_Success

- **Akce:** Uživatel odešle platný příchod a následně odchod.
- **Ověření:** Záznam v time_entries má korektní start_time, end_time, is_manual = false a status kód 200 OK.
##### Test `TC-ATT-02`: ForgottenClockOut_BlocksNextMorningClockIn

- **Příprava:** Uživatel má záznam z předchozího dne s end_time = NULL.
- **Akce:** Uživatel se pokusí dnes ráno pípnout nový příchod.
- **Ověření:** Požadavek selže s 400 Bad Request, error kód ERR_MISSING_CLOCK_OUT. Nový záznam se nevytvoří.
##### Test `TC-ATT-03`: ForgottenClockOut_CorrectionWorkflow

- **Akce:** Uživatel zadá korekci včerejšího odchodu (17:30) s povinným důvodem Zapomněl jsem pípnout při spěchu na vlak. Team Lead korekci schválí.
- **Ověření:** Předchozí záznam má end_time = 17:30, is_manual = true, edited_by = LeadId, edited_at = UtcNow. Následný pokus o dnešní ranní příchod projde s 200 OK.
##### Test `TC-ATT-04`: HomeOfficePause_ClosesShiftImmediately

- **Akce:** Uživatel na Home Office zvolí Odchod s volbou Ještě se vrátím (pauza do 14:30).
- **Ověření:** Aktuální časový blok v time_entries se ihned uzavře (end_time = UtcNow). Do profilu uživatele se zapíše expected_return_at = 14:30. Žádný otevřený časový blok nezůstává viset.
#### 2.2 Testovací sada: Dvoufázové workflow lékaře (Propustky)

##### Test `TC-MED-01`: DoctorRequest_CreatedAsPending

- **Akce:** Uživatel vytvoří žádost o lékaře na dnešní den (09:00–12:00).
- **Ověření:** Záznam v absence_requests je vytvořen se stavem status = 'pending', actual_start = NULL, actual_end = NULL.
##### Test `TC-MED-02`: DoctorVerification_OfficeManagerOverridesTime

- **Akce:** Office Manager ověří fyzickou propustku a potvrdí skutečný čas 08:30–12:45.
- **Ověření:** Záznam přejde do stavu status = 'completed', pole actual_start a actual_end obsahují reálný čas, verified_by = OfficeManagerId, verified_at = UtcNow.
##### Test `TC-MED-03`: DoctorVerification_UnauthorizedUser_Forbidden

- **Akce:** Běžný kolega (colleague) se pokusí zavolat verifikační endpoint lékaře pro jiného pracovníka.
- **Ověření:** Systém vrátí 403 Forbidden.
#### 2.3 Testovací sada: Organizační hierarchie a First-to-Approve

##### Test `TC-MGR-01`: MultipleManagers_FirstToApprove_Wins

- **Příprava:** Uživatel má v tabulce user_managers přiřazeny dva vedoucí (Manažer A a Manažer B).
- **Akce 1:** Manažer A schválí žádost o dovolenou.
- **Ověření 1:** Žádost má status = 'approved', approved_by = ManagerAId, approved_at = UtcNow.
- **Akce 2:** Manažer B se pokusí stejnou žádost následně schválit nebo zamítnout.
- **Ověření 2:** API vrátí informaci o již uzavřeném stavu žádosti (ERR_ALREADY_RESOLVED), stav a schvalovatel se nezmění.
##### Test `TC-MGR-02`: ManagerSelfLeave_AutoApproved

- **Akce:** Uživatel s rolí manager odešle svou vlastní žádost o dovolenou.
- **Ověření:** Žádost je vytvořena rovnou se stavem status = 'approved', approved_by = ManagerId, bez nutnosti externího schválení.
##### Test `TC-MGR-03`: TeamLead_CannotApproveOutsideTeam

- **Akce:** Team Lead 1 se pokusí schválit volno pracovníkovi, který spadá výhradně pod Team Lead 2.
- **Ověření:** Backend ověří strom řízení v user_managers a vrátí 403 Forbidden (ERR_NOT_SUBORDINATE_MANAGER).
#### 2.4 Testovací sada: Hardwarová bezpečnost NFC a QR integrity

##### Test `TC-SEC-01`: QRCodeClockIn_ForcesWorkplaceNull

- **Akce:** Klient pošle požadavek na příchod přes QR kód nebo bezpečný bootstrap endpoint s tělem obsahujícím workplace_id.
- **Ověření:** Backend striktně ignoruje zaslané ID pracoviště a uloží záznam s workplace_id = NULL a location_type = 'remote'.
##### Test `TC-SEC-02`: NTAG424_CMAC_Verification_Success

- **Akce:** Klient pošle platnou dynamickou SUN URL zprávu (validní počítadlo c a korektní CMAC podpis odpovídající klíči pobočky).
- **Ověření:** Záznam získá reálné workplace_id, location_type = 'office' a uloží se nové interní počítadlo čipu.
##### Test `TC-SEC-03`: NTAG424_ReplayAttack_Rejected

- **Akce:** Útočník znovu odešle stejnou URL zprávu se stejným počítadlem c nebo nižším.
- **Ověření:** Backend detekuje replay útok a vrátí 400 Bad Request (ERR_INVALID_NFC_SIGNATURE).
#### 2.5 Testovací sada: České svátky, příplatky a kalkulace fondů

##### Test `TC-CALC-01`: EasterHolidays_CalculationAccuracy

- **Akce:** Výpočet pohyblivých svátků pro rok 2026.
- **Ověření:** Algoritmus Meeus/Gauss vrátí Velký pátek (3. 4. 2026) a Velikonoční pondělí (6. 4. 2026).
##### Test `TC-CALC-02`: WeekendAndHolidayMultipliers

- **Akce:** Výpočet odměny pro uživatele s hodinovou sazbou 500 Kč/h:
8 hodin běžný pracovní den (100 %) = 4 000 Kč.
8 hodin sobota (200 %) = 8 000 Kč.
8 hodin svátek připadající na neděli (300 %) = 12 000 Kč.
- **Ověření:** Měsíční souhrn přesně odpovídá součtu 24 000 Kč.
##### Test `TC-CALC-03`: FixedMonthlyCompensation_IgnoresHours

- **Akce:** Uživatel s modelem compensation_type = 'fixed' a částkou 80 000 Kč odpracuje 120 h z fondu 160 h kvůli čerpání dovolené.
- **Ověření:** Mzdový report eviduje reálné hodiny, ale výsledná částka k proplacení zůstává přesně 80 000 Kč.
#### 2.6 Testovací sada: České skloňování (7 pádů)

##### Test `TC-LANG-01`: MissingDeclension_TriggersModalEvent

- **Akce:** Založení uživatele se jménem Ctirad (které není v číselníku name_declensions).
- **Ověření:** Backend vrátí v odpovědi příznak declension_required = true.
##### Test `TC-LANG-02`: IgnoredDeclension_NeverPromptsAgain

- **Akce:** Uživatel zvolí pro jméno Alex volbu Ignorovat. V databázi se vytvoří záznam s is_ignored = true.
- **Ověření:** Další dotaz na uživatele se jménem Alex vrací declension_required = false.
### 3. Frontend vývojový NFC Debug Simulator

Protože desktopové prohlížeče nemají fyzickou čtečku NFC, frontend obsahuje integrovaný simulátor pro plnohodnotné testování celého toku příchodu/odchodu.
#### 3.1 Specifikace komponenty NfcDebugSimulator.tsx

Podmínka zobrazení: Aktivní výhradně v režimu import.meta.env.DEV === true (v produkčním sestavení je kód simulátoru zcela eliminován přes Tree-Shaking).
Umístění v UI: Plovoucí akční prvek v levém dolním rohu obrazovky s možností minimalizace.
Dostupné akce v simulátoru:
Tlačítko „Pípnout: Centrála Praha (Valid NTAG 424 DNA)“: Vygeneruje syntetický Universal Link s inkrementovaným počítadlem a validním CMAC hashem a předá jej do aplikace jako nativní NFC událost.
Tlačítko „Pípnout: Pobočka Brno (Valid NTAG 213 UID)“: Simuluje přiložení karty s továrním hardware UID.
Tlačítko „Pípnout: Neznámý / Neautorizovaný čip“: Vygeneruje náhodné cizí UID; ověří zobrazení červené chybové Toast notifikace.
Tlačítko „Simulovat Replay útok (Staré počítadlo)“: Pošle již dříve použité počítadlo; ověří bezpečnostní odmítnutí.
### 4. Spouštění testů a automatizovaná kontrola (CLI & CI Pipeline)

Před odevzdáním kódu nebo vytvořením commitu musí testovací agent úspěšně projít následující sekvenci příkazů:
```bash
# 1. Kontrola a formátování C# backendu
dotnet format --verify-no-changes
dotnet build --configuration Release

# 2. Spuštění backend jednotkových a integračních testů
dotnet test --configuration Release --verbosity normal --collect:"XPlat Code Coverage"

# 3. Linting a typová kontrola frontendu
cd frontend
npm run lint
npm run typecheck

# 4. Spuštění frontend testů
npm run test:run

# 5. E2E kouřový test (Smoke Test)
npx playwright test tests/smoke-attendance.spec.ts


```

Kritérium úspěchu: 100 % testů musí projít bez chyb (0 failed). Jakékoliv selhání testu okamžitě zastaví proces nasazení a vyžaduje automatickou opravu kódu agentem.

## 15. Architektonická pravidla systému (.antigravity/rules.md)

### 1. C# / .NET Backend Architecture Standards

#### 1.1 Layer Separation

Controllers: Slouží výhradně jako tenká vrstva pro příjem HTTP požadavků, validaci DTO a předání do aplikačních služeb. V kontrolerech nesmí být žádná byznys logika.
Services (Aplikační vrstva): Veškerá byznys logika, výpočty fondů, validace offsetů absencí a ověřování hierarchie manažerů musí být zapouzdřena v samostatných službách (např. AttendanceService, AbsenceService, HolidayService).
DbContext / Data Access: Přímý přístup k databázi je povolen výhradně v aplikačních službách nebo repository vrstvě. Zákaz přímého volání DbContext z kontrolerů.
#### 1.2 DTO Strictness & Entity Protection

Zákaz vracení entit: Žádný kontroler ani endpoint nesmí do odpovědi serializovat přímo EF Core entity.
Jednoúčelové DTO: Pro každý vstup i výstup musí existovat explicitní DTO modely (např. CreateTimeEntryRequestDto, TimeEntryResponseDto).
Zákaz over-postingu: Vstupní DTO nesmí obsahovat pole, která má nastavovat systém (např. userId, isManual, createdAt). Tato pole se dosazují výhradně z ověřeného JWT tokenu.
#### 1.3 Uniform API Response Envelope

Veškeré API endpointy musí vracet jednotnou JSON strukturu:
```json
{
  "data": { ... } | [ ... ] | null,
  "error": {
    "code": "STRING_ERROR_CODE",
    "message": "Uživatelsky čitelná zpráva",
    "details": null | [ ... ]
  } | null,
  "meta": {
    "timestamp": "2026-10-10T14:19:00.000Z",
    "pagination": null | {
      "page": 1,
      "pageSize": 20,
      "totalCount": 150
    }
  } | null
}
```



#### 1.4 Structured Error Handling & Status Codes

Chyby se vyhazují pomocí doménových výjimek (např. MissingClockOutException, UnauthorizedManagerActionException).
Globální Exception Filter (ExceptionHandlingMiddleware) převádí tyto výjimky na standardizovaný chybový envelope:
400 Bad Request: ERR_VALIDATION_FAILED, ERR_MISSING_CLOCK_OUT, ERR_OFFSET_EXCEEDED
401 Unauthorized: ERR_INVALID_TOKEN, ERR_TOKEN_EXPIRED
403 Forbidden: ERR_FORBIDDEN_SCOPE, ERR_NOT_SUBORDINATE_MANAGER
404 Not Found: ERR_RESOURCE_NOT_FOUND
409 Conflict: ERR_OVERLAPPING_TIME_ENTRY
500 Internal Server Error: ERR_INTERNAL_SERVER_ERROR
### 2. Database & EF Core Integrity Rules

#### 2.1 Neměnnost a Audit docházky (No Hard Delete)

Zákaz DELETE: Záznamy v tabulkách time_entries a absence_requests se z databáze nikdy fyzicky nemažou.
Auditní stopa při manuální korekci: Jakákoliv úprava existujícího záznamu docházky musí povinně nastavit:
is_manual = true
edited_by = currentUserId
edited_at = DateTimeOffset.UtcNow
edit_reason = textOdůvodnění (povinné neprázdné pole o délce min. 5 znaků).
#### 2.2 Migrace a Seeder

Všechny změny databáze musí být verzovány v EF Core migracích (dotnet ef migrations add).
V Development módu spouští backend automaticky Database.Migrate() a DbInitializer.SeedAsync().
Seeder musí být idempotentní (před vložením dat ověří existenci záznamů, aby nedocházelo k duplicitním PK).
### 3. Timezone, DateTime & Precision Policy

#### 3.1 Striktní UTC standard

Databáze ukládá všechna časová razítka výhradně jako TIMESTAMPTZ (PostgreSQL) nebo DATETIMEOFFSET (MS SQL).
V C# kódu se smí používat pouze typ DateTimeOffset inicializovaný přes DateTimeOffset.UtcNow. Použití DateTime.Now je přísně zakázáno.
Backend neprovádí žádný posun do lokální časové zóny – odpovědi vrací vždy v ISO 8601 UTC formátu s příznakem Z.
Přepočet do časové zóny Europe/Prague probíhá výhradně na klientské straně (React).
#### 3.2 Přesnost záznamů

Pípnutí a odchody se ukládají v plné sekundové přesnosti.
Žádné zaokrouhlování na 5, 10 či 15 minut se nesmí ukládat do databáze – zaokrouhlovací filtry se uplatňují výhradně ve výstupních mzdových souhrnech.
### 4. Security, RBAC & Hierarchical Isolation

#### 4.1 Kontextově závislá autorizace (Hierarchy Check)

Ověření role (např. [Authorize(Roles = "team_lead")]) je nutná, ale nikoliv postačující podmínka.
Každý endpoint přistupující k datům podřízeného musí provést kontrolu:
Je volající uživatel přímým nadřízeným dotazované osoby v tabulce user_managers?
Pokud ne, je volající uživatel manager stojící nad tímto team_lead?
Pokud ne a uživatel nemá globální roli admin nebo office_manager, dotaz musí okamžitě selhat s 403 Forbidden.
#### 4.2 Zabezpečení pracoviště (Hardware Workplace Guard)

Hodnota workplace_id může být přiřazena záznamu v time_entries pouze a výhradně po úspěšném ověření kryptografického NFC podpisu (NTAG 424 DNA SUN zpráva nebo hardwarové UID čipu).
Všechny požadavky přicházející z webového prohlížeče, ručních tlačítek (Jsem doma) nebo skenování QR kódu musí mít v backendu vynuceně nastaveno:
workplace_id = NULL
location_type = 'home_office' nebo 'remote'
### 5. Frontend Client Architecture (React + Vite)

#### 5.1 Striktní separace vrstev

Zákaz přímého volání API z komponent: V souborech komponent (.tsx) je přísně zakázáno volat fetch, axios nebo klientskou instanci API přímo v useEffect či v event handlerech.
TanStack Query (React Query) vrstva:
Veškeré čtení dat je zabaleno v custom hooks umístěných v /src/api/queries (např. useAttendanceToday(), usePendingAbsences()).
Veškeré zápisy jsou zabaleny v custom hooks v /src/api/mutations (např. useClockIn(), useVerifyDoctor()).
Každá mutace musí mít definovanou invalidaci příslušných query klíčů (queryClient.invalidateQueries(...)).
#### 5.2 Typová bezpečnost a formuláře

Formuláře musí používat React Hook Form ve spojení se schématy Zod.
Zod schéma musí striktně validovat povinná pole před odesláním na server (např. délka důvodu úpravy docházky, správné vyplnění všech 7 pádů skloňování).
#### 5.3 Offline stav a citlivost UI

Frontend musí ošetřovat stavy výpadku spojení.
Tlačítka pro pípnutí docházky musí mít ochranu proti vícenásobnému kliknutí (optimistický lock / zakázání tlačítka po dobu odesílání požadavku).

## 16. Pravidla designu a rozhraní (.antigravity/designrules.md)

### 1. Filozofie designu a Material Design 3 (M3 / Material You)

#### 1.1 Principy M3

Závazný standard: Rozhraní striktně vychází z oficiálních specifikací Material Design 3 (M3).
Tonal Elevation místo stínů: Úrovně zanoření a hierarchie povrchů nejsou řešeny těžkými vrženými stíny (box-shadow), ale pomocí jemných tónových posunů barvy povrchu (M3 Tonal Palette / Surface Tint).
Čistota a absence vizuálního šumu:
Žádné záře (glow efekty), gradientové odlesky ani skleněné efekty (glassmorphism).
Pozadí je vždy čisté, ploché a jednobarevné.
#### 1.2 Přepínání témat (Light & Dark Mode)

Systémový i manuální režim: Aplikace plně podporuje světlý i tmavý režim. Výchozí stav se řídí systémovou preferencí OS (prefers-color-scheme), s možností manuálního přepnutí v profilu (Light / Dark / Systém).
Tónové vrstvy povrchů (M3 Surface Containers):
Světlý režim:
Základní pozadí (surface): #f8fafc (Slate 50).
Karty a kontejnery (surface-container-low): #ffffff.
Zvýrazněné bloky (surface-container-high): #f1f5f9 (Slate 100).
Tmavý režim:
Základní pozadí (surface): #09090b (Zinc 950).
Karty a kontejnery (surface-container-low): #18181b (Zinc 900).
Zvýrazněné bloky (surface-container-high): #27272a (Zinc 800).
### 2. Povrchy, karty a vzdušnost layoutu

#### 2.1 Pravidla pro karty a kontejnery

Zákaz ohraničení karet (No Borders): Karty nemají žádné viditelné rámečky (border: none). Oddělení od pozadí je zajištěno výhradně přirozeným kontrastem tónových ploch (surface-container).
Vysoká vzdušnost a štědré paddingy:
Vnitřní odsazení karet na mobilu: minimálně p-6 (24 px).
Vnitřní odsazení na tabletu a desktopu: p-8 (32 px).
Mezi jednotlivými sekcemi a kartami se udržuje vzdušný rozestup minimálně gap-6 (24 px) až gap-8 (32 px).
Zákaz vícenásobného zanořování (No Nested Cards): Přísný zákaz vkládání karet do jiných karet. Hierarchie uvnitř karty se řeší vzdušným vertikálním prostorem (space-y-4), typografií nebo jemným oddělovačem s nízkým kontrastem (divider s opacitou 10 %).
#### 2.2 Zaoblení rohů (Shape System)

Karty a dialogy: rounded-3xl (24 px dle M3 specifikace pro Surface Container).
Tlačítka a chipy: rounded-full (plně zaoblené / stadium shape) nebo rounded-2xl (16 px).
Vstupní pole: rounded-xl (12 px).
### 3. Pohyb, animace a přirozená haptika

#### 3.1 Plynulé a svižné animace (M3 Motion Tokens)

Časování a křivky: Všechny animace musí být svižné a přirozené bez pocitu prodlevy.
Standardní interakce (kliknutí, rozbalení): trvání 150–200 ms s křivkou cubic-bezier(0.2, 0.0, 0, 1.0) (M3 Standard Decelerate).
Přechody celých obrazovek a modální dialogy: trvání 250 ms.
Zakázáno: Žádné zpomalené, skákavé (bouncy) ani těžkopádné animace přesahující 300 ms.
#### 3.2 Přirozená haptická odezva

Každá klíčová uživatelská akce na mobilním zařízení (Capacitor) spouští jemnou haptickou odezvu:
Pípnutí / Příchod / Odchod: Haptics.impact({ style: ImpactStyle.Medium }).
Přepínače, filtry týdnů, kliknutí na tlačítka: Haptics.impact({ style: ImpactStyle.Light }).
Chyba, nevalidní formulář: Haptics.notification({ type: NotificationType.Error }).
Úspěšné uložení / schválení: Haptics.notification({ type: NotificationType.Success }).
### 4. Datový životní cyklus, tiché načítání a indikátory progresu

#### 4.1 Tiché stahování na pozadí (Silent Revalidation)

Aplikace využívá strategii Stale-While-Revalidate (TanStack Query).
Při přechodu mezi obrazovkami nebo návratu do aplikace se nikdy nezobrazuje celoobrazovkový prázdný loading, pokud jsou k dispozici data z cache.
Data se tiše ověří a stáhnou na pozadí; po doručení nových dat se obsah jemně aktualizuje.
#### 4.2 Animace změn a progresu (Žádné přepisování celých bloků)

Zákaz trhání DOMu: Pokud se mění číselné hodnoty (odpracované hodiny, stav fondů, stopky), nesmí dojít k přebliknutí celého bloku.
Hodnoty se plynule animují (animovaný čítač / micro-transition), grafické progress bary plynule dojedou na novou hodnotu pomocí CSS transition: transition: width 300ms ease-out.
#### 4.3 Stavy načítání a indikátory

Prvotní načítání komponenty: Zobrazí se jemný skeleton loader v tónu povrchu (bg-slate-200/60 dark:bg-zinc-800/60 animate-pulse rounded-xl).
Akce na pozadí a odesílání požadavku:
Přímo v tlačítku se zobrazí kompaktní kruhový spinner (CircularProgressIndicator o velikosti 20 px).
Tlačítko se zneaktivní proti dvojkliku (disabled).
Dlouhotrvající operace (exporty, synchronizace): Zobrazí se tenký lineární indikátor progresu (LinearProgressIndicator) na horním okraji karty nebo stránky.
### 5. Systém zpětné vazby a Toast notifikace (Snackbars)

Veškerá průběžná oznámení a výsledky operací se zobrazují pomocí plovoucích Toast zpráv (M3 Snackbar) s pevnou tříbarevnou sémantikou.
#### 5.1 Tříbarevná sémantika zpráv

Zelená (Úspěch / Uloženo):
Význam: Úspěšné zapsání příchodu/odchodu, uložení nastavení, úspěšné schválení žádosti, vygenerování exportu.
Vzhled: Tónový podklad bg-emerald-600 text-white dark:bg-emerald-500 dark:text-zinc-950, ikona zatržítka (CheckCircle2).
Oranžová (Oznamující / Varování / Vyžaduje pozornost):
Význam: Žádost byla zamítnuta, záznam byl smazán, vyčerpán měsíční limit Sick days, odchod na pauzu s orientačním časem.
Vzhled: Tónový podklad bg-amber-500 text-zinc-950 dark:bg-amber-400 dark:text-zinc-950, ikona varování (AlertTriangle).
Červená (Chyba / Selhání):
Význam: Server nekomunikuje, síťový výpadek, pokus o zápis docházky při chybějícím včerejším odchodu, zamítnutí neautorizované NFC karty.
Vzhled: Tónový podklad bg-rose-600 text-white dark:bg-rose-500 dark:text-zinc-950, ikona chyby (AlertOctagon).
#### 5.2 Ergonomie zobrazení Toastů

Umístění: Plovoucí prvek ve spodní části displeje (na mobilu nad spodním tab barem, na desktopu v pravém dolním rohu).
Zobrazení: Maximálně 1 aktivní toast naráz. Nový toast plynule nahradí předchozí.
Časování: Automatické skrytí po 3,5 sekundách. Možnost okamžitého zavření tažením prstu (swipe to dismiss).
### 6. Specifikace klíčových obrazovek dle M3

#### 6.1 Dashboard (Hlavní obrazovka)

Dominantní akční blok (Pouze 2 akce):
Tlačítko PŘÍCHOD: Plně zaoblený velký prvek (h-16 rounded-full font-medium text-lg bg-emerald-600 hover:bg-emerald-700 text-white).
Tlačítko ODCHOD: Plně zaoblený velký prvek (h-16 rounded-full font-medium text-lg bg-rose-600 hover:bg-rose-700 text-white).
Dotyková plocha odpovídá maximální ergonomii pro palec.
Týdenní kalendářní pás:
Plovoucí pás se 7 segmenty dnů aktuálního týdne bez rámečků.
Aktivní zvolený den má plné zaoblení a tónové zvýraznění povrchu.
Pod dny jsou drobné stavové indikátory (barevné tečky přítomnosti).
#### 6.2 Modální dialog pípnutí karty

Otevírá se zespodu na mobilu (M3 Bottom Sheet) nebo uprostřed na desktopu.
Plynulá vektorová animace přiložení karty.
Patička dialogu:
Textové tlačítko Zrušit (Text Button bez pozadí).
Tlačítko Jsem doma (Tonal Button: bg-slate-200 text-slate-800 dark:bg-zinc-800 dark:text-zinc-200 rounded-full px-6 py-3).
#### 6.3 Modální dialog odchodu z Home Office

Dvě vzdušné tónové volby:
Konec práce pro dnešek (definitivní uzavření směny).
Ještě se vrátím (Pauza) – otevře výběr času orientačního návratu, uloží stav a kolegům na Radaru zobrazí nedostupnost.
#### 6.4 Live Radar přítomnosti

Vzdušný seznam kolegů bez vnitřních rámečků.
Každý záznam obsahuje:
Avatar se stavovým tónovým odznakem.
Jméno a pracovní zařazení.
Jednobarevný chip s aktuálním statusem (Kancelář Praha, Home Office, U lékaře od 13:00, Pauza do 14:30).
Akční tlačítko pro vytočení telefonního hovoru (pokud je vyplněn telefon).
#### 6.5 Správa skloňování jména (7 pádů)

M3 Form dialog obsahující vertikální přehled všech 7 pádů s pomocnými otázkami.
Všechna textová pole využívají styl M3 Filled Text Field s plovoucím popiskem.
Patička obsahuje tlačítko Ignorovat pro toto jméno, Zavřít a primární tlačítko Uložit skloňování.


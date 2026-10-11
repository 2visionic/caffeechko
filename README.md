# caffeechko ☕ (instance: magicware)

Moderní firemní docházkový systém navržený podle kompletní 16-kapitolové specifikace ([dochazka-v0.3-kompletni-specifikace.md](dochazka-v0.3-kompletni-specifikace.md)).

---

## 📌 Rychlý přehled technologie a portů

- **Backend:** .NET 9 (C# 13, ASP.NET Core Web API, EF Core 9)
  - URL: **`http://localhost:5000`**
  - Interaktivní API dokumentace: **`http://localhost:5000/scalar/v1`**
  - Databáze: SQLite dev databáze `backend/dochazka_dev.db` (ihned funkční bez instalace), s možností přepnutí na PostgreSQL 16 přes Docker (`docker-compose.dev.yml`).
- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS v4 (Material Design 3)
  - URL: **`http://localhost:5200`**
  - Přísné pravidlo portů: Porty `5172`, `5173`, `5174` jsou uživatelsky vyhrazené a aplikace je nikdy nepoužívá.

---

## 🚀 Jak aplikaci spustit po stažení repozitáře

### 1. Požadavky (Prerequisites)
- [.NET 9 SDK](https://dotnet.microsoft.com/download/dotnet/9.0)
- [Node.js](https://nodejs.org/) (v18+)
- *(Volitelně)* Docker Desktop (pokud chcete běh proti PostgreSQL místo vestavěné SQLite)

### 2. Spuštění přes npm skript v kořenové složce (Doporučeno)
V kořenové složce projektu stačí spustit:
```bash
npm run dev
```
Tento příkaz díky balíčku `concurrently` spustí **současně .NET backend na portu 5000 i React frontend na portu 5200** v jediném terminálu s přehlednými barevnými logy!

K dispozici jsou i jednotlivé npm příkazy:
- `npm run dev:backend` – spustí pouze .NET 9 Web API (:5000)
- `npm run dev:frontend` – spustí pouze React/Vite aplikaci (:5200)
- `npm run build` – zkompiluje backend i frontend

---

### 3. Spuštění na 1 kliknutí (Windows bat / ps1)
Můžete také v kořenové složce poklepat na:
```cmd
start-dev.bat
```
nebo v PowerShellu:
```powershell
.\start-dev.ps1
```
Tento skript otevře dvě samostatná okna – jedno pro backend a druhé pro frontend.

---

### 4. Ruční spuštění ve dvou terminálech (bez npm v kořenu)

**Terminál 1 – Backend (.NET 9):**
```powershell
cd backend
dotnet run --urls "http://localhost:5000"
```
*Při prvním spuštění se automaticky vytvoří SQLite databáze a naplní se výchozími daty (5 zaměstnanců, pobočka Praha 1, české svátky, skloňování jmen).*

**Terminál 2 – Frontend (React + Vite):**
```powershell
cd frontend
npm install    # pouze při prvním stažení
npm run dev
```
*Frontend se spustí na portu `5200` s nakonfigurovanou proxy na backend (`/api` -> `http://localhost:5000`).*

---

## 🧪 Jak si otestovat backend?

Máte k dispozici dvě velmi snadné cesty:

### Možnost A: Interaktivní webové rozhraní Scalar (Doporučeno)
Otevřete v prohlížeči:
👉 **[http://localhost:5000/scalar/v1](http://localhost:5000/scalar/v1)**

Ve Scalaru uvidíte všechny vystavené endpointy a můžete přímo v prohlížeči kliknout na **"Test Request"**:
1. `GET /api/attendance/status?userId=...` – zjistí stav příchodu vybraného uživatele.
2. `POST /api/attendance/clock-in` – zaeviduje příchod do práce (v kanceláři nebo Home Office).
3. `POST /api/attendance/clock-out` – zaeviduje odchod nebo přerušení (např. oběd s plánovaným návratem).
4. `GET /api/attendance/who-is-where` – živý přehled kolegů „Kdo je kde“ (alias `/team-presence` a `/radar`).
5. `GET /api/attendance/week?userId=...` – souhrn odpracovaných hodin za aktuální týden.

### Možnost B: Pomocí PowerShellu nebo curl
V PowerShellu můžete poslat rychlý dotaz přímo do API:

```powershell
# 1. Zjistit přehled kolegů (Kdo je kde)
Invoke-RestMethod http://localhost:5000/api/attendance/who-is-where

# 2. Pípnutí příchodu na Home Office pro Petra Kulhánka:
$body = @{
    userId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
    type = "home_office"
    comment = "Zahajeni prace na projektu caffeechko"
} | ConvertTo-Json

Invoke-RestMethod -Uri http://localhost:5000/api/attendance/clock-in -Method Post -Body $body -ContentType "application/json"
```

### Seznam předpřipravených uživatelů (Seed):
| Jméno | ID (GUID) | Role | Smlouva |
| :--- | :--- | :--- | :--- |
| **Petr Kulhánek** | `aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa` | `admin` | HPP |
| **Jana Nováková** | `bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb` | `team_lead` | HPP |
| **Martina Svobodová** | `cccccccc-cccc-cccc-cccc-cccccccccccc` | `office_manager` | HPP |
| **Tomáš Dvořák** | `dddddddd-dddd-dddd-dddd-dddddddddddd` | `colleague` | HPP |
| **Lukáš Černý** | `eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee` | `colleague` | OSVČ |

---

## 💻 Jak si otestovat frontend a nové funkce?

Otevřete v prohlížeči:
👉 **[http://localhost:5200](http://localhost:5200)**

Na úvodní obrazovce naleznete:
1. **DEV MÓD (Žlutá horní lišta):**
   - Přepínejte mezi jednotlivými osobami jedním kliknutím (`Petr`, `Jana`, `Martina`, `Tomáš`, `Lukáš`).
   - Pozorujte, jak se mění oprávnění (např. Martina jako Office Manager a Jana jako Team Lead vidí widget schvalování absencí a lékařů, zatímco běžný kolega nikoli).
2. **Přepínač Světlého a Tmavého režimu (🌙 / ☀️):**
   - V pravém horním rohu hlavičky.
   - Plynule přepíná barvy pozadí, karet, textů i tlačítek a volbu si ukládá do `localStorage`.
3. **Celořádkový timeline pás & Dnešní přítomnost:**
   - **Horní řádek:** Vlevo informace kde jsem a stavový indikátor; vpravo metrika **Celkově odpracováno** s přepočtem na hodiny a minuty (např. `3h 45m`).
   - **Denní časová osa (Timeline):** Pokrývá pracovní den 06:00–20:00 s hodinovými ryskami. Zobrazuje barevně spojené bloky příchodů a odchodů (kancelář vs. Home Office).
   - **Běžící indikátor aktuálního času:** Vertikální ryska s pulzujícím odznakem reálného času (např. *Nyní 12:45*).
   - **Material Design hover popup:** Po najetí myši na blok se zobrazí plovoucí popup s přesnými časy, délkou směny, pobočkou a způsobem autorizace (NFC terminál vs. web).
4. **Dominantní tlačítka PŘÍCHOD a ODCHOD:**
   - Podle pravidel Material Design 3 (výška 64px, zaoblení `rounded-full`, zřetelný stav).
   - Kliknutím na "PÍPNOUT PŘÍCHOD" můžete zvolit buď fyzické pípnutí čipem, nebo "Jsem doma" (Home Office).
5. **„Kdo je kde ☕“ (dříve Live Radar):**
   - Přátelský a neinvazivní přehled celého týmu.
   - **Přepínač zobrazení (Kartičky / Řádky):** Umožňuje přepnout mezi vzdušným kartičkovým gridem a kompaktním řádkovým zobrazením.
6. **NFC Debug simulátor (Plovoucí panel vpravo dole):**
   - Umožňuje testovat hardware NFC chování:
     - NTAG 424 DNA (Praha terminál)
     - Mifare Classic (Brno UID)
     - Neautorizovaný čip (HTTP 403)
     - Replay attack (HTTP 400 zneplatněný čítač)
7. **7 pádů skloňování:**
   - Tlačítko v záhlaví otevře modální okno s ukázkou vyskloňovaného jména aktuálně přihlášeného uživatele ve všech 7 pádech podle české gramatiky.

---

## 🐳 Běh s PostgreSQL v Dockeru (Volitelné)

Pokud chcete testovat chování proti PostgreSQL:
```powershell
# 1. Spustit PostgreSQL 16 kontejner
docker compose -f docker-compose.dev.yml up -d

# 2. V backend/appsettings.json prepnout UsePostgres na true (nebo zmenit connection string)
```
Pro běžný vývoj a testování je výchozí **SQLite** ideální, protože nevyžaduje běžící Docker.

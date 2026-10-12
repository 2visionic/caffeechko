# Antigravity Design Rules

1. **Vizuální směr (Material Design 3 - M3):**
   - Moderní podnikové rozhraní postavené na principech M3 a Tailwind CSS.
   - **Tonal Elevation místo stínů:** Úrovně zanoření nejsou řešeny stíny, ale tónovými barvami ploch (`surface-container-low`, `surface-container-high`).
   - **Zákaz ohraničení karet (No Borders):** Karty nemají žádné viditelné rámečky (`border: none`).
   - **Zákaz vnořených karet (No Nested Cards):** Žádné karty uvnitř jiných karet.

2. **Barevná paleta & Témata:**
   - **Světlý režim:**
     - Základní pozadí (`surface`): `#f8fafc` (Slate 50)
     - Karty a kontejnery (`surface-container-low`): `#ffffff`
     - Zvýrazněné bloky (`surface-container-high`): `#f1f5f9` (Slate 100)
   - **Tmavý režim:**
     - Základní pozadí (`surface`): `#09090b` (Zinc 950)
     - Karty a kontejnery (`surface-container-low`): `#18181b` (Zinc 900)
     - Zvýrazněné bloky (`surface-container-high`): `#27272a` (Zinc 800)
   - **Sémantické akcenty:**
     - Zelená (`Emerald-600`): Přítomen na pracovišti, tlačítko Příchod, úspěch.
     - Červená (`Rose-600`): Tlačítko Odchod, zapomenutý odchod, chyba.
     - Modrá (`Sky-500`): Home Office.
     - Žlutá/Oranžová (`Amber-500`): Lékař, čeká na schválení, pauza.

3. **Dotyková ergonomie (Mobile-First):**
   - Minimální klikací plocha interaktivních prvků: 48x48 px.
   - Dominantní akční tlačítka (Příchod / Odchod): `h-16 rounded-full font-medium text-lg`.
   - Karty a dialogy: `rounded-3xl` (24 px dle M3 specifikace).

4. **Tříbarevná sémantika Toastů (M3 Snackbars):**
   - Zelená (Úspěch): `bg-emerald-600`
   - Oranžová (Varování / Pozor): `bg-amber-500`
   - Červená (Chyba): `bg-rose-600`
   - Maximálně 1 aktivní toast, automatické skrytí po 3.5 s.

5. **Jednotná tlačítka (Button Component & Varianty):**
   - Všechna tlačítka v aplikaci musí používat komponentu `Button` (`frontend/src/components/ui/Button.tsx`).
   - Zákaz psaní ad-hoc stylů na `<button>`.
   - **Varianty:**
     - `filled`: Plné syté tlačítko pro primární akce (zelená pro příchod, červená pro odchod, jantarová pro uložení/potvrzení). Bílý/kontrastní text.
     - `surface`: Tónové pozadí kontejneru (`surface-container-high` / `bg-slate-100 dark:bg-zinc-800`), text výchozí dle tématu.
     - `outline`: Jemný rámeček bez plného pozadí, hover surface efekt.
     - `default`: Neutrální šedé pozadí (`bg-slate-100 dark:bg-zinc-800`), ikona přebírá barvu z číselníku (`colorKey`), text výchozí dle tématu.
     - `ghost`: Transparentní pozadí pro čisté ikony a méně výrazné akce.
   - **Velikosti:** `xs`, `sm`, `md` (výchozí), `lg`, `hero` (dominantní příchod/odchod `h-16 rounded-full`), `icon` (čtvercové ikony).


import { useState } from 'react';
import {
  Settings,
  Clock,
  Calendar,
  Radio,
  ShieldCheck,
  Building,
  Check,
  Key,
  RotateCcw,
  Trash2,
  Save
} from 'lucide-react';
import type { DevConfig, DatabaseMode } from '../api';
import { Box, Button, StatusBadge, SegmentedControl } from './ui';


interface SettingsViewProps {
  devConfig: DevConfig;
  dbMode: DatabaseMode;
  onOpenDevModal?: () => void;
  onSwitchDbMode?: (mode: DatabaseMode) => void;
  onResetDevDb?: () => void;
  onWipeCleanDb?: () => void;
  isResettingDevDb?: boolean;
  isWipingCleanDb?: boolean;
}

type SettingsSectionId = 'worktime' | 'absences' | 'hardware' | 'approval' | 'system';

export function SettingsView({
  devConfig,
  dbMode,
  onOpenDevModal,
  onSwitchDbMode,
  onResetDevDb,
  onWipeCleanDb,
  isResettingDevDb = false,
  isWipingCleanDb = false
}: SettingsViewProps) {
  const [activeSection, setActiveSection] = useState<SettingsSectionId>('worktime');

  // Pracovní doba
  const [weeklyFund, setWeeklyFund] = useState(40);
  const [coreTimeFrom, setCoreTimeFrom] = useState('09:00');
  const [coreTimeTo, setCoreTimeTo] = useState('14:00');
  const [autoBreakEnabled, setAutoBreakEnabled] = useState(true);
  const [autoClockoutEnabled, setAutoClockoutEnabled] = useState(true);

  // Absence
  const [annualVacationDays, setAnnualVacationDays] = useState(25);
  const [annualSickDays, setAnnualSickDays] = useState(3);
  const [doctorMaxHours, setDoctorMaxHours] = useState(4);
  const [doctorReceiptRequired, setDoctorReceiptRequired] = useState(true);
  const [homeOfficeMonthlyLimit, setHomeOfficeMonthlyLimit] = useState(10);

  // Hardware & NFC
  const [nfcVariant, setNfcVariant] = useState<'variant_a' | 'kiosk'>('variant_a');
  const [nfcEncryptionKey, setNfcEncryptionKey] = useState('caffeechko-aes-256-master-key');
  const [mobileWebNfcEnabled, setMobileWebNfcEnabled] = useState(true);

  // Schvalování & Notifikace
  const [approvalLevels, setApprovalLevels] = useState<'single' | 'two_step'>('single');
  const [autoApproveDoctor, setAutoApproveDoctor] = useState(true);
  const [autoApproveHomeOffice, setAutoApproveHomeOffice] = useState(false);
  const [notifyOnNewRequest, setNotifyOnNewRequest] = useState(true);
  const [notifyOnApproved, setNotifyOnApproved] = useState(true);

  // UI state pro zobrazení úspěšného uložení
  const [isSaved, setIsSaved] = useState(false);

  const handleSaveSettings = () => {
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  const sections = [
    {
      id: 'worktime' as SettingsSectionId,
      label: 'Pracovní doba & Fond',
      icon: Clock,
      desc: 'Týdenní fond, jádrový čas a pravidla přestávek'
    },
    {
      id: 'absences' as SettingsSectionId,
      label: 'Absence & Roční nároky',
      icon: Calendar,
      desc: 'Limity dovolených, sick days a propustek k lékaři'
    },
    {
      id: 'hardware' as SettingsSectionId,
      label: 'Terminál & NFC Karty',
      icon: Radio,
      desc: 'Varianta A bez kiosku, čtení čipů a klíče'
    },
    {
      id: 'approval' as SettingsSectionId,
      label: 'Schvalování & Notifikace',
      icon: ShieldCheck,
      desc: 'Workflow vedoucích a e-mailová upozornění'
    },
    {
      id: 'system' as SettingsSectionId,
      label: 'Systém & Režim databáze',
      icon: Settings,
      desc: 'Testovací SQLite DB, Google oAuth a exporty'
    }
  ];

  return (
    <div className="space-y-6">
      {/* 1. HLAVIČKA NASTAVENÍ */}
      <Box
        header={{
          icon: Settings,
          title: 'Nastavení systému',
          subtitle: 'Konfigurace docházkových pravidel, absencí, schvalovacího řádu a NFC terminálu',
          actions: (
            <Button
              variant="filled"
              colorKey={isSaved ? 'emerald' : 'primary'}
              size="md"
              icon={isSaved ? Check : Save}
              onClick={handleSaveSettings}
            >
              {isSaved ? 'Uloženo!' : 'Uložit změny'}
            </Button>
          )

        }}
        className="space-y-4"
      >
        {/* Přepínač sekcí nastavení (Pills bar bez rámečků) */}
        <SegmentedControl
          value={activeSection}
          onChange={(val) => setActiveSection(val as SettingsSectionId)}
          className="overflow-x-auto max-w-full"
          options={sections.map((sec) => ({
            id: sec.id,
            label: sec.label,
            icon: sec.icon
          }))}
        />
      </Box>

      {/* 2. OBSAH ZVOLENÉ SEKCE */}

      {/* SEKCE 1: PRACOVNÍ DOBA & FOND */}
      {activeSection === 'worktime' && (
        <Box
          header={{
            icon: Clock,
            title: 'Pracovní doba & Týdenní fond',
            subtitle: 'Definice základních časových norem dle zákoníku práce a firemního řádu'
          }}
          className="space-y-6"
        >

          <div className="space-y-4">
            {/* Týdenní fond */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  Základní týdenní fond (HPP 100%)
                </span>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                  Počet pracovních hodin v jednom standardním týdnu (obvykle 40.0 h)
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="10"
                  max="60"
                  value={weeklyFund}
                  onChange={(e) => setWeeklyFund(Number(e.target.value))}
                  className="w-20 px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-700 text-xs font-bold text-center text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
                <span className="text-xs text-slate-500 font-semibold">hodin / týden</span>
              </div>
            </div>

            {/* Jádrová pracovní doba */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  Jádrová flexibilní doba
                </span>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                  Časové rozmezí, kdy jsou zaměstnanci povinni být přítomni na pracovišti nebo na Home Office
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  value={coreTimeFrom}
                  onChange={(e) => setCoreTimeFrom(e.target.value)}
                  className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-zinc-700 text-xs font-bold text-slate-900 dark:text-white focus:outline-none"
                />
                <span className="text-xs text-slate-400">až</span>
                <input
                  type="time"
                  value={coreTimeTo}
                  onChange={(e) => setCoreTimeTo(e.target.value)}
                  className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-zinc-700 text-xs font-bold text-slate-900 dark:text-white focus:outline-none"
                />
              </div>
            </div>

            {/* Automatická přestávka */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/40 flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  Automatická zákonná přestávka na oběd (30 min)
                </span>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                  Po 6 hodinách souvislé práce automaticky odečte 30 minut, pokud zaměstnanec nezadal přestávku manuálně
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoBreakEnabled}
                  onChange={(e) => setAutoBreakEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 dark:bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500" />
              </label>
            </div>

            {/* Automatické ukončení směny */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/40 flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  Automatické ukončení směny (Auto-clockout ve 23:59 UTC)
                </span>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                  Při zapomenutém odchodu automaticky uzavře denní směnu a označí záznam k dodatečnému schválení
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoClockoutEnabled}
                  onChange={(e) => setAutoClockoutEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 dark:bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500" />
              </label>
            </div>
          </div>
        </Box>
      )}

      {/* SEKCE 2: ABSENCE & NÁROKY */}
      {activeSection === 'absences' && (
        <Box
          header={{
            icon: Calendar,
            title: 'Absence & Roční nároky',
            subtitle: 'Nastavení základních balíčků volných dnů pro nově vzniklé pracovní smlouvy'
          }}
          className="space-y-6"
        >

          <div className="space-y-4">
            {/* Roční dovolená */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  Základní roční výměra dovolené
                </span>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                  Standardní zákonný nebo benefitní nárok (obvykle 20 nebo 25 dnů)
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="20"
                  max="40"
                  value={annualVacationDays}
                  onChange={(e) => setAnnualVacationDays(Number(e.target.value))}
                  className="w-20 px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-700 text-xs font-bold text-center text-slate-900 dark:text-white focus:outline-none"
                />
                <span className="text-xs text-slate-500 font-semibold">dní / rok</span>
              </div>
            </div>

            {/* Sick Days */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  Zdravotní volno (Sick days)
                </span>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                  Benefit placených dnů indispozice bez nutnosti neschopenky
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="15"
                  value={annualSickDays}
                  onChange={(e) => setAnnualSickDays(Number(e.target.value))}
                  className="w-20 px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-700 text-xs font-bold text-center text-slate-900 dark:text-white focus:outline-none"
                />
                <span className="text-xs text-slate-500 font-semibold">dní / rok</span>
              </div>
            </div>

            {/* Návštěva lékaře */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  Propustka k lékaři (limit na jednu návštěvu)
                </span>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                  Maximální zákonný rozsah uznaný jako placená překážka v práci na jedno vyšetření
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="8"
                  value={doctorMaxHours}
                  onChange={(e) => setDoctorMaxHours(Number(e.target.value))}
                  className="w-20 px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-700 text-xs font-bold text-center text-slate-900 dark:text-white focus:outline-none"
                />
                <span className="text-xs text-slate-500 font-semibold">hodin / návštěva</span>
              </div>
            </div>

            {/* Nutnost nahrát razítko od lékaře */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/40 flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  Vyžadovat fotku / potvrzení propustky s razítkem
                </span>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                  Zaměstnanec musí při ukončení návštěvy nahrát fotku potvrzení pro HR
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={doctorReceiptRequired}
                  onChange={(e) => setDoctorReceiptRequired(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 dark:bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500" />
              </label>
            </div>

            {/* Home Office měsíční limit */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  Měsíční limit na Home Office
                </span>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                  Doporučený počet dnů práce na dálku v kalendářním měsíci
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="31"
                  value={homeOfficeMonthlyLimit}
                  onChange={(e) => setHomeOfficeMonthlyLimit(Number(e.target.value))}
                  className="w-20 px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-700 text-xs font-bold text-center text-slate-900 dark:text-white focus:outline-none"
                />
                <span className="text-xs text-slate-500 font-semibold">dní / měsíc</span>
              </div>
            </div>
          </div>
        </Box>
      )}

      {/* SEKCE 3: HARDWARE & NFC TERMINÁL */}
      {activeSection === 'hardware' && (
        <Box
          header={{
            icon: Radio,
            title: 'Terminál & NFC Karty (Hardware)',
            subtitle: 'Konfigurace podle dohodnuté architektury pro identifikaci zaměstnanců fyzickou čipovou kartou'
          }}
          className="space-y-6"
        >

          <div className="space-y-4">
            {/* Architektonická varianta A vs Kiosk */}
            <div className="p-5 rounded-2xl bg-amber-500/10 dark:bg-amber-950/20 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2.5">
                  <Radio className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span className="text-xs font-bold text-amber-900 dark:text-amber-300">
                    Architektura terminálu
                  </span>
                </div>
                <div className="flex items-center gap-1 p-1 bg-white/70 dark:bg-zinc-800 rounded-xl text-[11px] font-semibold">
                  <button
                    type="button"
                    onClick={() => setNfcVariant('variant_a')}
                    className={`px-2.5 py-1 rounded-lg transition-all ${
                      nfcVariant === 'variant_a'
                        ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                        : 'text-slate-600 dark:text-zinc-300'
                    }`}
                  >
                    Varianta A (Bez kiosku)
                  </button>
                  <button
                    type="button"
                    onClick={() => setNfcVariant('kiosk')}
                    className={`px-2.5 py-1 rounded-lg transition-all ${
                      nfcVariant === 'kiosk'
                        ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                        : 'text-slate-600 dark:text-zinc-300'
                    }`}
                  >
                    Kioskový tablet
                  </button>
                </div>
              </div>
              <p className="text-xs text-amber-800/90 dark:text-amber-400/90 leading-relaxed">
                {nfcVariant === 'variant_a' ? (
                  <>
                    V systému je aktivní <strong>Varianta A (Bez dedikovaného tabletu / kiosek terminálu)</strong>.
                    Zaměstnanci mohou používat NFC kartu přiložením k mobilnímu telefonu s WebNFC, USB čtečce u počítače nebo kliknutím v klientském rozhraní.
                  </>
                ) : (
                  <>
                    V systému je aktivní <strong>Dedikovaný kiosek</strong>. Nástěnný tablet u vstupu do kanceláře trvale zobrazuje pípací obrazovku pro čipové karty.
                  </>
                )}
              </p>
            </div>

            {/* WebNFC čtení v mobilu */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/40 flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  Povolit WebNFC čtení v Android Chrome
                </span>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                  Umožní přiložit fyzickou kartu přímo k zádům telefonu zaměstnance bez instalace nativní appky
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={mobileWebNfcEnabled}
                  onChange={(e) => setMobileWebNfcEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 dark:bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500" />
              </label>
            </div>

            {/* Bezpečnostní kryptografický klíč */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/40 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  Kryptografický podpis NFC čipů (Anti-cloning key)
                </span>
                <span className="text-[10px] font-mono text-slate-400">AES-256</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                Tento klíč se zapisuje do chráněného sektoru NFC čipu pro zamezení kopírování UID karty
              </p>
              <input
                type="password"
                value={nfcEncryptionKey}
                onChange={(e) => setNfcEncryptionKey(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-zinc-700 text-xs font-mono text-slate-900 dark:text-white focus:outline-none"
              />
            </div>
          </div>
        </Box>
      )}

      {/* SEKCE 4: SCHVALOVÁNÍ & NOTIFIKACE */}
      {activeSection === 'approval' && (
        <Box
          header={{
            icon: ShieldCheck,
            title: 'Schvalovací workflow & Notifikace',
            subtitle: 'Řízení toků žádostí o dovolené, home office a automatických upozornění'
          }}
          className="space-y-6"
        >

          <div className="space-y-4">
            {/* Úrovně schvalování */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  Úrovně schvalování žádostí o dovolenou
                </span>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                  Jednostupňové (pouze přímý nadřízený) nebo dvoustupňové (+ HR / vedení)
                </p>
              </div>
              <div className="flex items-center gap-1.5 p-1 bg-white dark:bg-zinc-700 rounded-xl text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setApprovalLevels('single')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    approvalLevels === 'single'
                      ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                      : 'text-slate-600 dark:text-zinc-300'
                  }`}
                >
                  1 stupeň (Manažer)
                </button>
                <button
                  type="button"
                  onClick={() => setApprovalLevels('two_step')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    approvalLevels === 'two_step'
                      ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                      : 'text-slate-600 dark:text-zinc-300'
                  }`}
                >
                  2 stupně (+ HR)
                </button>
              </div>
            </div>

            {/* Automatické schvalování lékaře */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/40 flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  Automaticky schvalovat návštěvy lékaře do 4 hodin
                </span>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                  Zákonné propustky nevyžadují ruční zásah manažera, rovnou se započtou do odpracovaného fondu
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoApproveDoctor}
                  onChange={(e) => setAutoApproveDoctor(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 dark:bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500" />
              </label>
            </div>

            {/* Automatické schvalování Home Office */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/40 flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  Automaticky schvalovat žádosti o Home Office
                </span>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                  Práce z domova se schválí ihned po odeslání bez nutnosti zásahu vedoucího
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoApproveHomeOffice}
                  onChange={(e) => setAutoApproveHomeOffice(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 dark:bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500" />
              </label>
            </div>

            {/* Notifikace žadateli o schválení */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/40 flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  E-mailová notifikace žadateli při schválení nebo zamítnutí
                </span>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                  Zaměstnanec obdrží okamžitou informaci o výsledku své žádosti
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifyOnApproved}
                  onChange={(e) => setNotifyOnApproved(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 dark:bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500" />
              </label>
            </div>

            {/* Notifikace manažerovi o nové žádosti */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/40 flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  E-mailová notifikace vedoucímu při vytvoření nové žádosti
                </span>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                  Zašle okamžité upozornění příslušnému manažerovi týmu
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifyOnNewRequest}
                  onChange={(e) => setNotifyOnNewRequest(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 dark:bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500" />
              </label>
            </div>
          </div>
        </Box>
      )}

      {/* SEKCE 5: SYSTÉM & REŽIM DATABÁZE */}
      {activeSection === 'system' && (
        <Box
          header={{
            icon: Settings,
            title: 'Systém & Databázový režim',
            subtitle: 'Přepínání testovacích prostředí, správa SQLite databáze a firemní Google OAuth'
          }}
          className="space-y-6"
        >

          <div className="space-y-4">
            {/* Instance & Doména */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/40 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  Identita firmy a Google Workspace doména
                </span>
                {onOpenDevModal && (
                  <button
                    type="button"
                    onClick={onOpenDevModal}
                    className="text-xs text-amber-700 dark:text-amber-400 font-semibold hover:underline"
                  >
                    Upravit v průvodci
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-white dark:bg-zinc-700/60">
                  <span className="text-[10px] uppercase font-mono text-slate-400 block">Název firmy</span>
                  <span className="font-bold text-slate-900 dark:text-white">{devConfig.companyName || 'caffeechko s.r.o.'}</span>
                </div>
                <div className="p-3 rounded-xl bg-white dark:bg-zinc-700/60">
                  <span className="text-[10px] uppercase font-mono text-slate-400 block">Povolená Google doména</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">@{devConfig.googleWorkspaceDomain || 'firma.cz'}</span>
                </div>
              </div>
            </div>

            {/* Databázový režim přepínač */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/40 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  Aktivní SQLite databáze
                </span>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-lg bg-yellow-400 text-slate-950">
                  {dbMode === 'dev' ? 'dochazka_dev.db' : 'dochazka_clean.db'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                Můžete přepínat mezi testovací databází se seedovanými uživateli a čistou databází pro ověření prvotní instalace.
              </p>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                {onSwitchDbMode && (
                  <div className="flex items-center p-1 bg-white dark:bg-zinc-700 rounded-xl text-xs">
                    <button
                      type="button"
                      onClick={() => onSwitchDbMode('dev')}
                      className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                        dbMode === 'dev'
                          ? 'bg-slate-950 text-white shadow-xs'
                          : 'text-slate-600 dark:text-zinc-300'
                      }`}
                    >
                      Testovací DB (Dev)
                    </button>
                    <button
                      type="button"
                      onClick={() => onSwitchDbMode('clean')}
                      className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                        dbMode === 'clean'
                          ? 'bg-slate-950 text-white shadow-xs'
                          : 'text-slate-600 dark:text-zinc-300'
                      }`}
                    >
                      Čistá instalace (Clean)
                    </button>
                  </div>
                )}

                {dbMode === 'dev' && onResetDevDb && (
                  <Button
                    variant="surface"
                    size="sm"
                    icon={RotateCcw}
                    loading={isResettingDevDb}
                    onClick={onResetDevDb}
                  >
                    Obnovit šablonu
                  </Button>
                )}

                {dbMode === 'clean' && onWipeCleanDb && (
                  <Button
                    variant="filled"
                    colorKey="rose"
                    size="sm"
                    icon={Trash2}
                    loading={isWipingCleanDb}
                    onClick={onWipeCleanDb}
                  >
                    Resetovat čistou DB
                  </Button>
                )}
              </div>
            </div>

            {/* Synchronizace státních svátků */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/40 flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  Automatická synchronizace státních svátků ČR
                </span>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                  Připojeno k externímu REST API (svátky jsou v kalendáři automaticky nepracovní)
                </p>
              </div>
              <StatusBadge status="active" />
            </div>

          </div>
        </Box>
      )}
    </div>
  );
}

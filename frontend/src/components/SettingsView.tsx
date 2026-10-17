import { useState, useEffect } from 'react';
import {
  Settings,
  Clock,
  Calendar,
  Building,
  Check,
  RotateCcw,
  Trash2,
  Save,
  Plus
} from 'lucide-react';
import type { DevConfig, DatabaseMode, CompanySettingDto, AbsenceTypeConfigDto } from '../api';
import { DEFAULT_ABSENCE_TYPES } from '../api';
import { SECTIONS } from '../config/sectionsConfig';
import { Box, Button, StatusBadge, SegmentedControl } from './ui';

interface SettingsViewProps {
  devConfig: DevConfig;
  dbMode: DatabaseMode;
  companySettings?: CompanySettingDto | null;
  absenceTypesMap?: Record<string, AbsenceTypeConfigDto>;
  onSaveCompanySettings?: (settings: Partial<CompanySettingDto>) => Promise<void> | void;
  onSaveAbsenceTypes?: (types: AbsenceTypeConfigDto[]) => Promise<void> | void;
  onOpenDevModal?: () => void;
  onSwitchDbMode?: (mode: DatabaseMode) => void;
  onResetDevDb?: () => void;
  onWipeCleanDb?: () => void;
  isResettingDevDb?: boolean;
  isWipingCleanDb?: boolean;
}

type SettingsSectionId = 'worktime' | 'absences' | 'system';

export function SettingsView({
  devConfig,
  dbMode,
  companySettings,
  absenceTypesMap = DEFAULT_ABSENCE_TYPES,
  onSaveCompanySettings,
  onSaveAbsenceTypes,
  onOpenDevModal,
  onSwitchDbMode,
  onResetDevDb,
  onWipeCleanDb,
  isResettingDevDb = false,
  isWipingCleanDb = false
}: SettingsViewProps) {
  const [activeSection, setActiveSection] = useState<SettingsSectionId>('absences');

  // Pracovní doba (reálné hodnoty z company_settings)
  const [dailyHours, setDailyHours] = useState<number>(companySettings?.dailyHours ?? 8);
  const [weeklyWorkDays, setWeeklyWorkDays] = useState<number>(companySettings?.weeklyWorkDays ?? 5);

  // Číselník absencí (reálné hodnoty z absence_types včetně DefaultAllowance)
  const [editableTypes, setEditableTypes] = useState<AbsenceTypeConfigDto[]>(() =>
    Object.values(absenceTypesMap)
  );

  // Formulář pro přidání nové absence
  const [isAddingNewType, setIsAddingNewType] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newBudgetPeriod, setNewBudgetPeriod] = useState<'yearly' | 'weekly' | 'unlimited'>('yearly');
  const [newDefaultAllowance, setNewDefaultAllowance] = useState<string>('5');
  const [newDurationMode, setNewDurationMode] = useState<'days' | 'single_day' | 'hours'>('days');
  const [newAllowOsvc, setNewAllowOsvc] = useState<boolean>(false);

  useEffect(() => {
    if (companySettings) {
      setDailyHours(companySettings.dailyHours ?? 8);
      setWeeklyWorkDays(companySettings.weeklyWorkDays ?? 5);
    }
  }, [companySettings]);

  useEffect(() => {
    setEditableTypes(Object.values(absenceTypesMap));
  }, [absenceTypesMap]);

  const [isSaved, setIsSaved] = useState(false);

  const handleUpdateTypeField = <K extends keyof AbsenceTypeConfigDto>(
    code: string,
    field: K,
    value: AbsenceTypeConfigDto[K]
  ) => {
    setEditableTypes((prev) =>
      prev.map((t) => {
        if (t.code !== code) return t;
        const updated = { ...t, [field]: value };
        if (field === 'defaultBudgetPeriod' && value === 'unlimited') {
          updated.defaultAllowance = null;
        }
        return updated;
      })
    );
  };

  const handleAddNewAbsenceType = () => {
    const cleanCode = newCode
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_');
    const cleanName = newName.trim();
    if (!cleanCode || !cleanName) return;
    if (editableTypes.some((t) => t.code === cleanCode)) return;

    const allowanceVal =
      newBudgetPeriod === 'unlimited'
        ? null
        : newDefaultAllowance.trim() === ''
        ? null
        : Math.max(0, Number(newDefaultAllowance));

    const created: AbsenceTypeConfigDto = {
      code: cleanCode,
      nameEmployee: cleanName,
      allowOsvc: newAllowOsvc,
      defaultBudgetPeriod: newBudgetPeriod,
      defaultAllowance: allowanceVal,
      durationMode: newDurationMode,
      submissionOffsetDays: 0,
      submissionDeadlineTime: null,
      maxPerMonthLimit: null,
      isActive: true
    };

    setEditableTypes((prev) => [...prev, created]);
    setNewCode('');
    setNewName('');
    setNewBudgetPeriod('yearly');
    setNewDefaultAllowance('5');
    setNewDurationMode('days');
    setNewAllowOsvc(false);
    setIsAddingNewType(false);
  };

  const handleSaveSettings = async () => {
    if (onSaveCompanySettings) {
      await onSaveCompanySettings({
        dailyHours: Number(dailyHours) || 8,
        weeklyWorkDays: Number(weeklyWorkDays) || 5
      });
    }
    if (onSaveAbsenceTypes) {
      await onSaveAbsenceTypes(editableTypes);
    }
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  const sections = [
    {
      id: 'absences' as SettingsSectionId,
      label: 'Absence & Výchozí nároky',
      icon: Calendar
    },
    {
      id: 'worktime' as SettingsSectionId,
      label: 'Pracovní doba & Fond',
      icon: Clock
    },
    {
      id: 'system' as SettingsSectionId,
      label: 'Systém & Režim databáze',
      icon: Settings
    }
  ];

  return (
    <div className="space-y-6">
      {/* 1. HLAVIČKA NASTAVENÍ */}
      <Box
        header={{
          icon: SECTIONS.settings.icon,
          title: 'Nastavení systému',
          subtitle: 'Konfigurace číselníku absencí, výchozích nároků, pracovního fondu a databáze',
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

      {/* SEKCE 1: ABSENCE & ČÍSELNÍK ABSENCÍ (PRÍMO V TABULCE ABSENCE_TYPES) */}
      {activeSection === 'absences' && (
        <Box
          header={{
            icon: Calendar,
            title: 'Číselník absencí & Výchozí nároky',
            subtitle: 'Výchozí limity (DefaultAllowance) jsou uloženy přímo u jednotlivých typů absencí v databázi',
            actions: (
              <Button
                variant="surface"
                size="sm"
                icon={Plus}
                onClick={() => setIsAddingNewType((v) => !v)}
              >
                Přidat novou absenci
              </Button>
            )
          }}
          className="space-y-4"
        >
          {isAddingNewType && (
            <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-800/40 space-y-3">
              <div className="text-xs font-bold text-slate-900 dark:text-white">
                Nový typ absence v číselníku
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Kód (ID)
                  </label>
                  <input
                    type="text"
                    placeholder="např. study_leave"
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Název absence
                  </label>
                  <input
                    type="text"
                    placeholder="např. Studijní volno"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-800 text-xs font-bold text-slate-900 dark:text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Období rozpočtu
                  </label>
                  <select
                    value={newBudgetPeriod}
                    onChange={(e) => setNewBudgetPeriod(e.target.value as 'yearly' | 'weekly' | 'unlimited')}
                    className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-800 text-xs font-bold text-slate-900 dark:text-white focus:outline-none"
                  >
                    <option value="yearly">Roční limit (dní/rok)</option>
                    <option value="weekly">Týdenní limit (dní/týden)</option>
                    <option value="unlimited">Neomezeno</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Výchozí nárok (Default)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="365"
                    disabled={newBudgetPeriod === 'unlimited'}
                    value={newBudgetPeriod === 'unlimited' ? '' : newDefaultAllowance}
                    placeholder={newBudgetPeriod === 'unlimited' ? 'Neomezeno' : '0'}
                    onChange={(e) => setNewDefaultAllowance(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-800 text-xs font-bold text-center text-slate-900 dark:text-white disabled:opacity-50 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Režim zadání
                  </label>
                  <select
                    value={newDurationMode}
                    onChange={(e) => setNewDurationMode(e.target.value as 'days' | 'single_day' | 'hours')}
                    className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-800 text-xs font-bold text-slate-900 dark:text-white focus:outline-none"
                  >
                    <option value="days">Datum Od – Do</option>
                    <option value="single_day">Pouze 1 den</option>
                    <option value="hours">Čas Od – Do</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center justify-between pt-1">
                <label className="inline-flex items-center gap-2 text-xs text-slate-700 dark:text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newAllowOsvc}
                    onChange={(e) => setNewAllowOsvc(e.target.checked)}
                    className="rounded"
                  />
                  <span>Povoleno i pro externisty (OSVČ)</span>
                </label>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setIsAddingNewType(false)}>
                    Zrušit
                  </Button>
                  <Button variant="filled" colorKey="primary" size="sm" onClick={handleAddNewAbsenceType}>
                    Přidat do číselníku
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {editableTypes.map((absType) => {
              const isUnlimited = absType.defaultBudgetPeriod === 'unlimited';
              const isYearly = absType.defaultBudgetPeriod === 'yearly' || absType.defaultBudgetPeriod === 'annual';
              const unitLabel = isYearly
                ? 'dní / rok'
                : absType.defaultBudgetPeriod === 'weekly'
                ? 'dní / týden'
                : 'bez limitu';

              return (
                <div
                  key={absType.code}
                  className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/40 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        {absType.nameEmployee}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-200/70 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300">
                        {absType.code}
                      </span>
                      {absType.allowOsvc && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300">
                          I pro OSVČ
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                      Režim:{' '}
                      {absType.durationMode === 'days' || absType.durationMode === '1'
                        ? 'Více dnů (Od–Do)'
                        : absType.durationMode === 'single_day' || absType.durationMode === '2'
                        ? 'Jednodenní (1 den)'
                        : 'Hodinový (Čas Od–Do)'}
                      {absType.maxPerMonthLimit ? ` • Max. ${absType.maxPerMonthLimit}× za měsíc` : ''}
                      {absType.submissionDeadlineTime
                        ? ` • Uzávěrka v daný den do ${absType.submissionDeadlineTime}`
                        : ''}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-500 dark:text-zinc-400">Období:</span>
                      <select
                        value={isYearly ? 'yearly' : absType.defaultBudgetPeriod}
                        onChange={(e) =>
                          handleUpdateTypeField(
                            absType.code,
                            'defaultBudgetPeriod',
                            e.target.value
                          )
                        }
                        className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-zinc-700 text-xs font-bold text-slate-900 dark:text-white focus:outline-none"
                      >
                        <option value="yearly">Roční limit</option>
                        <option value="weekly">Týdenní limit</option>
                        <option value="unlimited">Neomezeno</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-500 dark:text-zinc-400">Výchozí nárok:</span>
                      <input
                        type="number"
                        min="0"
                        max="365"
                        disabled={isUnlimited}
                        value={isUnlimited ? '' : (absType.defaultAllowance ?? '')}
                        placeholder={isUnlimited ? '—' : '0'}
                        onChange={(e) => {
                          const raw = e.target.value;
                          handleUpdateTypeField(
                            absType.code,
                            'defaultAllowance',
                            raw === '' ? null : Math.max(0, Number(raw))
                          );
                        }}
                        className="w-20 px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-700 text-xs font-bold text-center text-slate-900 dark:text-white disabled:opacity-50 focus:outline-none"
                      />
                      <span className="text-xs text-slate-500 font-semibold min-w-[72px]">
                        {unitLabel}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Box>
      )}

      {/* SEKCE 2: PRACOVNÍ DOBA & FOND */}
      {activeSection === 'worktime' && (
        <Box
          header={{
            icon: Clock,
            title: 'Pracovní doba & Týdenní fond',
            subtitle: 'Definice základní denní a týdenní normy pro výpočet fondu pracovní doby v databázi'
          }}
          className="space-y-6"
        >
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  Základní denní úvazek (Plný úvazek)
                </span>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                  Počet pracovních hodin na jeden pracovní den při plném úvazku (standardně 8 h)
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="12"
                  step="0.5"
                  value={dailyHours}
                  onChange={(e) => setDailyHours(Number(e.target.value))}
                  className="w-20 px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-700 text-xs font-bold text-center text-slate-900 dark:text-white focus:outline-none"
                />
                <span className="text-xs text-slate-500 font-semibold">hodin / den</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  Počet pracovních dnů v týdnu
                </span>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                  Standardní týdenní rozvrh (celkový týdenní fond: {(dailyHours * weeklyWorkDays).toFixed(1)} h / týden)
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="7"
                  value={weeklyWorkDays}
                  onChange={(e) => setWeeklyWorkDays(Number(e.target.value))}
                  className="w-20 px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-700 text-xs font-bold text-center text-slate-900 dark:text-white focus:outline-none"
                />
                <span className="text-xs text-slate-500 font-semibold">dnů / týden</span>
              </div>
            </div>
          </div>
        </Box>
      )}

      {/* SEKCE 3: SYSTÉM & REŽIM DATABÁZE */}
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

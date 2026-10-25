import { useState, useEffect, useMemo, useRef, useCallback, type ComponentType } from 'react';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  TrendingUp,
  Layers,
  AlertTriangle,
  Check,
  X,
  Pencil,
  Trash2,
  History,
  FileCheck2,
  FileDown,
  Download,
  ArrowRight,
  ArrowLeft,
  Sliders,
  Lock,
  Sparkles,
  Info,
  Building2,
  type LucideProps
} from 'lucide-react';
import type { Persona } from '../App';
import {
  formatHoursMinutes,
  formatOvertime,
  formatContractLabel
} from '../types/attendance';
import { RoleBadge } from './RoleBadge';
import { PresenceBadge } from './PresenceBadge';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import {
  Box,
  Button,
  UserAvatar,
  SegmentedControl,
  Modal
} from './ui';
import {
  api,
  formatRecordEditLog,
  getAbsenceTypeLabel,
  type AbsenceTypeConfigDto,
  type MonthlyClosuresOverviewDto,
  type PersonMonthlyClosureItemDto,
  type TimeEntryDetailDto
} from '../api';
import {
  getStatusConfig,
  getColorClasses,
  type StatusType,
  type ColorKey
} from '../config/presenceConfig';

interface ClosuresViewProps {
  personasList: Persona[];
  activePersona: Persona;
  baseDailyHours?: number;
  absenceTypesMap?: Record<string, AbsenceTypeConfigDto>;
  addToast?: (type: 'success' | 'warning' | 'error', title: string, message: string) => void;
  onClosuresChanged?: () => void;
  onOpenMonthlyDetail?: (persona: Persona, year: number, monthIndex0: number) => void;
}

type ClosureMainTab = 'monthly' | 'yearly';
type PersonListFilter = 'unclosed' | 'closed';
type WizardStep = 1 | 2 | 3 | 4;

interface ClosureSummaryRowProps {
  activityType?: StatusType;
  icon?: ComponentType<LucideProps>;
  colorKey?: ColorKey;
  label: string;
  value: string | number;
  total?: string | number;
  unit?: string;
  valueColorClass?: string;
}

function ClosureSummaryRow({
  activityType,
  icon: customIcon,
  colorKey: customColorKey,
  label,
  value,
  total,
  unit,
  valueColorClass
}: ClosureSummaryRowProps) {
  const cfg = activityType ? getStatusConfig(activityType) : null;
  const Icon = customIcon || cfg?.icon;
  const activeColorKey = customColorKey || cfg?.colorKey || 'amber';
  const colors = getColorClasses(activeColorKey);
  const iconBg = cfg?.statIconBgClass || colors.bg;

  return (
    <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-white/80 dark:bg-zinc-900/50">
      <div className="flex items-center gap-2.5 min-w-0">
        {Icon && (
          <div
            className={`w-8 h-8 rounded-full ${iconBg} flex items-center justify-center shrink-0 shadow-2xs`}
          >
            <Icon className="w-4 h-4" />
          </div>
        )}
        <span className="text-xs font-medium text-slate-600 dark:text-zinc-300 truncate">
          {label}
        </span>
      </div>

      <div className="flex items-baseline gap-0.5 shrink-0 font-mono leading-none">
        <span
          className={`text-xs sm:text-sm font-bold tracking-tight ${
            valueColorClass || 'text-slate-900 dark:text-white'
          }`}
        >
          {value}
        </span>
        {total !== undefined && (
          <span className="text-[11px] sm:text-xs font-normal text-slate-400 dark:text-zinc-500">
            /{total}
          </span>
        )}
        {unit && (
          <span className="text-[10px] sm:text-[11px] font-normal text-slate-400 dark:text-zinc-500 ml-0.5">
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}

const MONTH_NAMES = [
  'Leden',
  'Únor',
  'Březen',
  'Duben',
  'Květen',
  'Červen',
  'Červenec',
  'Srpen',
  'Září',
  'Říjen',
  'Listopad',
  'Prosinec'
];

const DAY_NAMES_SHORT = ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So'];

function hoursToHM(val: number): { h: number; m: number } {
  const absMins = Math.round(Math.abs(val) * 60);
  return {
    h: Math.floor(absMins / 60),
    m: absMins % 60
  };
}

function hmToHours(h: number, m: number): number {
  const safeH = Math.max(0, Math.floor(Number.isFinite(h) ? h : 0));
  const safeM = Math.max(0, Math.min(59, Math.floor(Number.isFinite(m) ? m : 0)));
  return +((safeH * 60 + safeM) / 60).toFixed(2);
}

function formatDateCz(isoDate: string): string {
  if (!isoDate) return '';
  const parts = isoDate.slice(0, 10).split('-').map(Number);
  if (parts.length < 3 || !parts[0] || !parts[1] || !parts[2]) return isoDate;
  return `${parts[2]}. ${parts[1]}. ${parts[0]}`;
}

export function ClosuresView({
  personasList,
  activePersona,
  absenceTypesMap,
  addToast,
  onClosuresChanged
}: ClosuresViewProps) {
  const canPerformClosure =
    activePersona.role === 'office_manager' || activePersona.role === 'admin';

  const [mainTab, setMainTab] = useState<ClosureMainTab>('monthly');
  const [overview, setOverview] = useState<MonthlyClosuresOverviewDto | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const [requestedYear, setRequestedYear] = useState<number | undefined>(undefined);
  const [requestedMonth, setRequestedMonth] = useState<number | undefined>(undefined);

  const [personFilter, setPersonFilter] = useState<PersonListFilter>('unclosed');
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState<boolean>(false);
  const pickerRef = useRef<HTMLDivElement | null>(null);

  // 4-step modal state for a selected person
  const [activePersonUserId, setActivePersonUserId] = useState<string | null>(null);
  const [wizardStep, setWizardStep] = useState<WizardStep>(1);

  // Step 1 inline editing state (design of Výkazy)
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editStartTime, setEditStartTime] = useState<string>('08:00');
  const [editEndTime, setEditEndTime] = useState<string>('16:30');
  const [editLocationType, setEditLocationType] = useState<'office' | 'home_office'>('office');
  const [isSavingEntryId, setIsSavingEntryId] = useState<string | null>(null);
  const [openHistoryLogIds, setOpenHistoryLogIds] = useState<Record<string, boolean>>({});
  const [pendingDeleteEntry, setPendingDeleteEntry] = useState<{
    id: string;
    description: string;
  } | null>(null);

  // Step 2 checklist state (absence ID -> checked)
  const [checkedAbsenceIds, setCheckedAbsenceIds] = useState<Record<string, boolean>>({});

  // Step 3 Saldo & Overtime transfers state
  const [saldoUsedH, setSaldoUsedH] = useState<number>(0);
  const [saldoUsedM, setSaldoUsedM] = useState<number>(0);
  const [overtimeToSaldoH, setOvertimeToSaldoH] = useState<number>(0);
  const [overtimeToSaldoM, setOvertimeToSaldoM] = useState<number>(0);

  // Step 4 saving state
  const [isSavingClosure, setIsSavingClosure] = useState<boolean>(false);

  // Smazání existující uzávěrky osoby (bod 6)
  const [pendingDeleteClosure, setPendingDeleteClosure] = useState<{
    closureId: string;
    fullName: string;
  } | null>(null);
  const [isDeletingClosure, setIsDeletingClosure] = useState<boolean>(false);

  // Automatická uzávěrka měsíce (bod 8)
  const [isAutoCloseModalOpen, setIsAutoCloseModalOpen] = useState<boolean>(false);
  const [isAutoClosing, setIsAutoClosing] = useState<boolean>(false);

  // Yearly closures state
  const [selectedYearlyYear, setSelectedYearlyYear] = useState<number | null>(null);

  const loadOverview = useCallback(
    async (y?: number, m?: number, silent = false) => {
      if (!silent) setIsLoading(true);
      try {
        const res = await api.getClosuresOverview(y, m);
        if (res?.data) {
          setOverview(res.data);
          setRequestedYear(res.data.selectedYear);
          setRequestedMonth(res.data.selectedMonth);
        }
      } finally {
        if (!silent) setIsLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    void loadOverview(requestedYear, requestedMonth);
  }, [loadOverview, activePersona.id]);

  // Zavření popupu výběru měsíce při kliknutí mimo
  useEffect(() => {
    if (!isMonthPickerOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setIsMonthPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [isMonthPickerOpen]);

  const activePerson = useMemo<PersonMonthlyClosureItemDto | null>(() => {
    if (!activePersonUserId || !overview) return null;
    return (
      overview.people.find(
        (p) => p.userId.toLowerCase() === activePersonUserId.toLowerCase()
      ) ?? null
    );
  }, [activePersonUserId, overview]);

  // Otevření modálu uzávěrky pro osobu a inicializace kroků
  const handleOpenPersonClosure = (person: PersonMonthlyClosureItemDto) => {
    setActivePersonUserId(person.userId);
    setEditingEntryId(null);

    // Inicializace checklistu z existující uzávěrky (nebo prázdné, pokud ještě nebyla uzavřena)
    const nextChecked: Record<string, boolean> = {};
    for (const item of person.absencesForChecklist) {
      if (item.requiresChecklist) {
        nextChecked[item.id] = Boolean(person.isClosed || item.isVerified);
      } else {
        nextChecked[item.id] = true;
      }
    }
    setCheckedAbsenceIds(nextChecked);

    // Inicializace 3. kroku (Konto salda a přesčasy)
    if (person.closureRecord) {
      const usedHm = hoursToHM(person.closureRecord.saldoUsedHours);
      const toSaldoHm = hoursToHM(person.closureRecord.overtimeToSaldoHours);
      setSaldoUsedH(usedHm.h);
      setSaldoUsedM(usedHm.m);
      setOvertimeToSaldoH(toSaldoHm.h);
      setOvertimeToSaldoM(toSaldoHm.m);
    } else {
      // Výchozí návrh: pokud má osoba záporný balance a dostupné saldo, nabídneme 0 (officer může 1 klikem pokrýt ze salda)
      setSaldoUsedH(0);
      setSaldoUsedM(0);
      setOvertimeToSaldoH(0);
      setOvertimeToSaldoM(0);
    }

    // Pokud má neověřené přítomnosti, začneme na 1. kroku; jinak rovnou na 1. kroku s přehledem stavu
    setWizardStep(1);
  };

  const handleClosePersonModal = () => {
    setActivePersonUserId(null);
    setEditingEntryId(null);
  };

  // Navigace mezi měsíci (pouze v rámci availableMonths <= první neuzavřená)
  const availableMonths = overview?.availableMonths ?? [];
  const currentMonthIdx = useMemo(() => {
    if (!overview) return -1;
    return availableMonths.findIndex(
      (m) => m.year === overview.selectedYear && m.month === overview.selectedMonth
    );
  }, [availableMonths, overview]);

  const canGoPrevMonth = currentMonthIdx > 0;
  const canGoNextMonth =
    currentMonthIdx >= 0 && currentMonthIdx < availableMonths.length - 1;

  const handlePrevMonth = () => {
    if (!canGoPrevMonth) return;
    const prev = availableMonths[currentMonthIdx - 1];
    setPersonFilter('unclosed');
    void loadOverview(prev.year, prev.month);
  };

  const handleNextMonth = () => {
    if (!canGoNextMonth) return;
    const next = availableMonths[currentMonthIdx + 1];
    setPersonFilter('unclosed');
    void loadOverview(next.year, next.month);
  };

  const peopleInMonth = overview?.people ?? [];
  const unclosedPeople = useMemo(
    () => peopleInMonth.filter((p) => !p.isClosed),
    [peopleInMonth]
  );
  const closedPeople = useMemo(
    () => peopleInMonth.filter((p) => p.isClosed),
    [peopleInMonth]
  );

  const displayedPeople = useMemo(() => {
    if (personFilter === 'closed') return closedPeople;
    return unclosedPeople;
  }, [personFilter, unclosedPeople, closedPeople]);

  // ==========================================
  // KROK 1: Ověření, úprava nebo smazání neověřené přítomnosti
  // ==========================================
  const handleVerifyOfficeEntry = async (entry: TimeEntryDetailDto) => {
    setIsSavingEntryId(entry.id);
    try {
      const res = await api.updateTimeEntry(entry.id, {
        startTime: entry.startTime,
        endTime: entry.endTime || undefined,
        locationType: 'office',
        verifyOffice: true,
        editedByUserId: activePersona.id,
        editedByUserName: activePersona.name
      });
      if (!res?.error) {
        addToast?.(
          'success',
          'Přítomnost ověřena',
          `Záznam přítomnosti (${formatDateCz(entry.date)}, ${entry.startTime} – ${entry.endTime || 'probíhá'}) byl ověřen.`
        );
        await loadOverview(overview?.selectedYear, overview?.selectedMonth, true);
        onClosuresChanged?.();
      } else {
        addToast?.(
          'error',
          'Chyba při ověřování',
          res.error.message || 'Nepodařilo se ověřit přítomnost.'
        );
      }
    } finally {
      setIsSavingEntryId(null);
    }
  };

  const handleStartEditEntry = (entry: TimeEntryDetailDto) => {
    setEditingEntryId(entry.id);
    setEditStartTime(entry.startTime || '08:00');
    setEditEndTime(entry.isSuspicious && entry.endTime === '05:00' ? '17:00' : entry.endTime || '');
    setEditLocationType(entry.locationType === 'home_office' ? 'home_office' : 'office');
  };

  const handleSaveEditedEntry = async (entryId: string) => {
    if (!editStartTime) return;
    setIsSavingEntryId(entryId);
    try {
      const res = await api.updateTimeEntry(entryId, {
        startTime: editStartTime,
        endTime: editEndTime || undefined,
        locationType: editLocationType,
        verifyOffice: editLocationType === 'office',
        editedByUserId: activePersona.id,
        editedByUserName: activePersona.name
      });
      if (!res?.error) {
        setEditingEntryId(null);
        addToast?.(
          'success',
          'Záznam upraven a ověřen',
          `Změna času (${editStartTime} – ${editEndTime || 'probíhá'}) byla uložena.`
        );
        await loadOverview(overview?.selectedYear, overview?.selectedMonth, true);
        onClosuresChanged?.();
      } else {
        addToast?.(
          'error',
          'Chyba při ukládání',
          res.error.message || 'Nepodařilo se uložit úpravu záznamu.'
        );
      }
    } finally {
      setIsSavingEntryId(null);
    }
  };

  const handleDeleteEntry = async (entryId: string) => {
    setIsSavingEntryId(entryId);
    try {
      const res = await api.deleteTimeEntry(entryId, activePersona.id);
      if (!res?.error) {
        if (editingEntryId === entryId) setEditingEntryId(null);
        addToast?.(
          'warning',
          'Neověřená přítomnost smazána',
          'Záznam přítomnosti byl přesunut do koše.'
        );
        await loadOverview(overview?.selectedYear, overview?.selectedMonth, true);
        onClosuresChanged?.();
      } else {
        addToast?.(
          'error',
          'Chyba při mazání',
          res.error.message || 'Nepodařilo se smazat záznam.'
        );
      }
    } finally {
      setIsSavingEntryId(null);
      setPendingDeleteEntry(null);
    }
  };

  // ==========================================
  // KROK 2 & 3: Validace a výpočty převodů salda a přesčasů
  // ==========================================
  const step1Complete = activePerson ? activePerson.unverifiedPresencesCount === 0 : false;

  const requiredChecklistItems = useMemo(
    () => (activePerson?.absencesForChecklist ?? []).filter((a) => a.requiresChecklist),
    [activePerson]
  );

  const infoAbsenceItems = useMemo(
    () => (activePerson?.absencesForChecklist ?? []).filter((a) => !a.requiresChecklist),
    [activePerson]
  );

  const step2Complete = useMemo(() => {
    return requiredChecklistItems.every((item) => Boolean(checkedAbsenceIds[item.id]));
  }, [requiredChecklistItems, checkedAbsenceIds]);

  const availableSaldoHours = activePerson?.incomingSaldoHours ?? 0;
  const rawOvertimeBalanceHours = activePerson?.overtimeBalanceHours ?? 0;

  const requestedSaldoUsedHours = useMemo(() => {
    const raw = hmToHours(saldoUsedH, saldoUsedM);
    return Math.min(availableSaldoHours, Math.max(0, raw));
  }, [saldoUsedH, saldoUsedM, availableSaldoHours]);

  const effectiveBalanceAfterSaldoUsed = useMemo(() => {
    return +(rawOvertimeBalanceHours + requestedSaldoUsedHours).toFixed(2);
  }, [rawOvertimeBalanceHours, requestedSaldoUsedHours]);

  const maxOvertimeToSaldoHours = useMemo(() => {
    return Math.max(0, effectiveBalanceAfterSaldoUsed);
  }, [effectiveBalanceAfterSaldoUsed]);

  const requestedOvertimeToSaldoHours = useMemo(() => {
    const raw = hmToHours(overtimeToSaldoH, overtimeToSaldoM);
    return Math.min(maxOvertimeToSaldoHours, Math.max(0, raw));
  }, [overtimeToSaldoH, overtimeToSaldoM, maxOvertimeToSaldoHours]);

  const resultingNewSaldoHours = useMemo(() => {
    return Math.max(
      0,
      +(availableSaldoHours - requestedSaldoUsedHours + requestedOvertimeToSaldoHours).toFixed(2)
    );
  }, [availableSaldoHours, requestedSaldoUsedHours, requestedOvertimeToSaldoHours]);

  const resultingPaidOvertimeHours = useMemo(() => {
    return +(
      rawOvertimeBalanceHours +
      requestedSaldoUsedHours -
      requestedOvertimeToSaldoHours
    ).toFixed(2);
  }, [rawOvertimeBalanceHours, requestedSaldoUsedHours, requestedOvertimeToSaldoHours]);

  const applySaldoUsedHours = (hoursVal: number) => {
    const clamped = Math.max(0, Math.min(availableSaldoHours, hoursVal));
    const hm = hoursToHM(clamped);
    setSaldoUsedH(hm.h);
    setSaldoUsedM(hm.m);
  };

  const applyOvertimeToSaldoHours = (hoursVal: number) => {
    const clamped = Math.max(0, Math.min(maxOvertimeToSaldoHours, hoursVal));
    const hm = hoursToHM(clamped);
    setOvertimeToSaldoH(hm.h);
    setOvertimeToSaldoM(hm.m);
  };

  // ==========================================
  // KROK 4: Uložení uzávěrky osoby do DB
  // ==========================================
  const handleSavePersonClosure = async () => {
    if (!activePerson || !overview) return;
    setIsSavingClosure(true);
    try {
      const verifiedIds = Object.entries(checkedAbsenceIds)
        .filter(([, checked]) => checked)
        .map(([id]) => id);

      const res = await api.saveMonthlyClosure({
        userId: activePerson.userId,
        year: overview.selectedYear,
        month: overview.selectedMonth,
        saldoUsedHours: requestedSaldoUsedHours,
        overtimeToSaldoHours: requestedOvertimeToSaldoHours,
        verifiedAbsenceIds: verifiedIds,
        closedByUserId: activePersona.id
      });

      if (res?.error) {
        addToast?.(
          'error',
          'Nelze uložit uzávěrku',
          res.error.message || 'Při ukládání měsíční uzávěrky došlo k chybě.'
        );
        return;
      }

      addToast?.(
        'success',
        'Měsíční uzávěrka uložena',
        `Uzávěrka pro ${activePerson.fullName} (${MONTH_NAMES[overview.selectedMonth - 1]} ${overview.selectedYear}) byla uložena do databáze.`
      );
      setActivePersonUserId(null);
      await loadOverview(overview.selectedYear, overview.selectedMonth, true);
      onClosuresChanged?.();
    } finally {
      setIsSavingClosure(false);
    }
  };

  // ==========================================
  // VYMAZÁNÍ ZÁZNAMU UZÁVĚRKY OSOBY (bod 6)
  // ==========================================
  const handleDeletePersonClosure = async () => {
    if (!pendingDeleteClosure || !overview || isDeletingClosure) return;
    setIsDeletingClosure(true);
    try {
      const res = await api.deleteMonthlyClosure(
        pendingDeleteClosure.closureId,
        activePersona.id
      );
      if (res?.error) {
        addToast?.(
          'error',
          'Chyba při mazání uzávěrky',
          res.error.message || 'Nepodařilo se vymazat záznam uzávěrky.'
        );
        return;
      }
      addToast?.(
        'warning',
        'Záznam uzávěrky vymazán',
        `Měsíční uzávěrka pro ${pendingDeleteClosure.fullName} byla vymazána a osoba byla vrácena mezi neuzavřené.`
      );
      setPendingDeleteClosure(null);
      await loadOverview(overview.selectedYear, overview.selectedMonth, true);
      onClosuresChanged?.();
    } finally {
      setIsDeletingClosure(false);
    }
  };

  // ==========================================
  // AUTOMATICKÁ UZÁVĚRKA MĚSÍCE (bod 8)
  // ==========================================
  const handleConfirmAutoCloseMonth = async () => {
    if (!overview || isAutoClosing) return;
    setIsAutoClosing(true);
    try {
      const res = await api.autoCloseMonth(
        overview.selectedYear,
        overview.selectedMonth,
        activePersona.id
      );
      if (res?.error) {
        addToast?.(
          'error',
          'Automatická uzávěrka selhala',
          res.error.message || 'Nepodařilo se provést automatickou uzávěrku.'
        );
        return;
      }
      const closedCount = res?.data?.length ?? unclosedPeople.length;
      addToast?.(
        'success',
        'Automatická uzávěrka dokončena',
        `Bylo automaticky uzavřeno ${closedCount} osob v měsíci ${MONTH_NAMES[overview.selectedMonth - 1]} ${overview.selectedYear}.`
      );
      setIsAutoCloseModalOpen(false);
      await loadOverview(overview.selectedYear, overview.selectedMonth, true);
      onClosuresChanged?.();
    } finally {
      setIsAutoClosing(false);
    }
  };

  // ==========================================
  // ROČNÍ UZÁVĚRKY (Logika výběru prvního neuzavřeného roku, kde jsou uzavřeny všechny měsíce s aktivitou)
  // ==========================================
  const readyYears = useMemo(() => {
    return (overview?.availableYears ?? []).filter((y) => y.isReadyForYearlyClosure);
  }, [overview]);

  const firstUnclosedYearly = useMemo(() => {
    return (
      readyYears.find((y) => !y.isYearlyClosed) ??
      readyYears[readyYears.length - 1] ??
      null
    );
  }, [readyYears]);

  useEffect(() => {
    if (firstUnclosedYearly && selectedYearlyYear === null) {
      setSelectedYearlyYear(firstUnclosedYearly.year);
    }
  }, [firstUnclosedYearly, selectedYearlyYear]);

  const selectedMonthName = overview
    ? MONTH_NAMES[overview.selectedMonth - 1] || 'Měsíc'
    : 'Měsíc';
  const selectedYearNum = overview?.selectedYear ?? new Date().getFullYear();
  const isViewingFirstUnclosedMonth = Boolean(
    overview &&
      overview.selectedYear === overview.firstUnclosedYear &&
      overview.selectedMonth === overview.firstUnclosedMonth
  );

  return (
    <div className="space-y-6">
      {/* HORNÍ PŘEPÍNAČ TABŮ: MĚSÍČNÍ vs ROČNÍ UZÁVĚRKY */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <SegmentedControl
          value={mainTab}
          onChange={(v) => setMainTab(v as ClosureMainTab)}
          options={[
            {
              id: 'monthly',
              label: 'Měsíční uzávěrky',
              icon: CalendarDays,
              badge: unclosedPeople.length > 0 ? unclosedPeople.length : undefined
            },
            {
              id: 'yearly',
              label: 'Roční uzávěrky',
              icon: Sparkles,
              badge: readyYears.filter((y) => !y.isYearlyClosed).length || undefined
            }
          ]}
        />

        {!canPerformClosure && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-300 text-xs font-medium">
            <Lock className="w-3.5 h-3.5 shrink-0" />
            <span>Uzávěrky provádí pouze Office Manager</span>
          </div>
        )}
      </div>

      {/* ================================================================= */}
      {/* TAB 1: MĚSÍČNÍ UZÁVĚRKY                                           */}
      {/* ================================================================= */}
      {mainTab === 'monthly' && (
        <Box
          header={{
            title: `${selectedMonthName} ${selectedYearNum}`,
            icon: CalendarDays,
            subtitle: overview ? (
              <span
                className={`font-semibold ${
                  unclosedPeople.length === 0 && peopleInMonth.length > 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-amber-600 dark:text-amber-400'
                }`}
              >
                {unclosedPeople.length === 0 && peopleInMonth.length > 0
                  ? 'Měsíc uzavřen'
                  : `Zbývá uzavřít: ${unclosedPeople.length} z ${peopleInMonth.length}`}
              </span>
            ) : undefined,
            actions: (
              <div className="relative self-start sm:self-auto" ref={pickerRef}>
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-zinc-800/80 p-1 rounded-2xl">
                  <Button
                    variant="surface"
                    size="icon-sm"
                    icon={ChevronLeft}
                    disabled={!canGoPrevMonth}
                    onClick={handlePrevMonth}
                    title={
                      canGoPrevMonth
                        ? 'Předchozí uzavřený měsíc (historie)'
                        : 'Žádná starší uzávěrka v historii'
                    }
                  />

                  <button
                    type="button"
                    onClick={() => setIsMonthPickerOpen((prev) => !prev)}
                    className="px-3 py-1 rounded-xl text-xs font-bold text-slate-900 dark:text-white min-w-[116px] text-center hover:bg-white/80 dark:hover:bg-zinc-700/80 transition-colors cursor-pointer select-none"
                    title="Výběr z historie uzavřených měsíců nebo aktuální neuzavřené uzávěrky"
                  >
                    {selectedMonthName} {selectedYearNum}
                  </button>

                  <Button
                    variant="surface"
                    size="icon-sm"
                    icon={ChevronRight}
                    disabled={!canGoNextMonth}
                    onClick={handleNextMonth}
                    title={
                      canGoNextMonth
                        ? 'Následující měsíc'
                        : 'Nelze přejít do vyšší uzávěrky, dokud není uzavřen tento měsíc'
                    }
                  />
                </div>

                {isMonthPickerOpen && (
                  <div className="absolute right-0 top-full mt-2 w-64 rounded-2xl bg-white dark:bg-zinc-900 shadow-xl p-3 z-50 space-y-2 border border-slate-100 dark:border-zinc-800">
                    <div className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 px-1">
                      Dostupné měsíční uzávěrky
                    </div>
                    <div className="space-y-1 max-h-60 overflow-y-auto">
                      {availableMonths.map((mItem) => {
                        const isSelected =
                          overview?.selectedYear === mItem.year &&
                          overview?.selectedMonth === mItem.month;
                        const isFirstOpen =
                          overview?.firstUnclosedYear === mItem.year &&
                          overview?.firstUnclosedMonth === mItem.month;

                        return (
                          <button
                            key={`${mItem.year}-${mItem.month}`}
                            type="button"
                            onClick={() => {
                              setIsMonthPickerOpen(false);
                              setPersonFilter('unclosed');
                              void loadOverview(mItem.year, mItem.month);
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-amber-500 text-slate-950 font-bold'
                                : 'hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-200'
                            }`}
                          >
                            <span>
                              {MONTH_NAMES[mItem.month - 1]} {mItem.year}
                            </span>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                                isSelected
                                  ? 'bg-slate-950/15 text-slate-950'
                                  : mItem.isFullyClosed
                                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                  : isFirstOpen
                                  ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                                  : 'bg-slate-200 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300'
                              }`}
                            >
                              {mItem.isFullyClosed
                                ? 'Uzavřeno'
                                : `Otevřeno (${mItem.unclosedUsersCount})`}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          }}
        >
          {/* Vlastní řádek filtru: Neuzavřené / Uzavřené */}
          <div className="w-full">
            <SegmentedControl
              full
              value={personFilter}
              onChange={(v) => setPersonFilter(v as PersonListFilter)}
              options={[
                {
                  id: 'unclosed',
                  label: 'Neuzavřené',
                  badge: unclosedPeople.length,
                  badgeClass:
                    unclosedPeople.length > 0
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'bg-slate-200 dark:bg-zinc-700 text-slate-700 dark:text-zinc-200'
                },
                {
                  id: 'closed',
                  label: 'Uzavřené',
                  badge: closedPeople.length,
                  badgeClass: 'bg-slate-200 dark:bg-zinc-700 text-slate-700 dark:text-zinc-200'
                }
              ]}
            />
          </div>

          {/* Informační lišta pravidel uzávěrky */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-zinc-800/45 text-xs text-slate-600 dark:text-zinc-400">
            <div className="flex items-center gap-2">
              {overview?.isSelectedMonthLocked ? (
                <Lock className="w-4 h-4 text-amber-500 shrink-0" />
              ) : (
                <Info className="w-4 h-4 text-amber-500 shrink-0" />
              )}
              <span>
                {overview?.isSelectedMonthLocked ? (
                  <>
                    Uzávěrka za <strong>{selectedMonthName} {selectedYearNum}</strong> je již{' '}
                    <strong>automaticky uzamčena (obměsíc)</strong> a nelze ji měnit ani mazat.
                  </>
                ) : isViewingFirstUnclosedMonth ? (
                  <>
                    Zobrazena <strong>první neuzavřená měsíční uzávěrka</strong> (
                    {selectedMonthName} {selectedYearNum}). Do vyššího měsíce se lze posunout až po
                    uzavření všech osob v tomto měsíci.
                  </>
                ) : (
                  <>
                    Prohlížíte <strong>historii uzavřeného měsíce</strong> ({selectedMonthName}{' '}
                    {selectedYearNum}). Uzávěrku bezprostředně předchozího měsíce můžete dodatečně
                    upravit.
                  </>
                )}
              </span>
            </div>
            {!isViewingFirstUnclosedMonth && overview && (
              <Button
                variant="surface"
                colorKey="amber"
                size="xs"
                onClick={() => {
                  setPersonFilter('unclosed');
                  void loadOverview(overview.firstUnclosedYear, overview.firstUnclosedMonth);
                }}
              >
                Zpět na neuzavřený ({MONTH_NAMES[overview.firstUnclosedMonth - 1]}{' '}
                {overview.firstUnclosedYear})
              </Button>
            )}
          </div>

          {/* Velké tlačítko Automatická uzávěrka na vlastním řádku nad seznamem osob (vycentrované s odsazením jako Nahrát na kartu) */}
          {overview?.canCloseSelectedMonth &&
            !overview?.isSelectedMonthLocked &&
            unclosedPeople.length > 0 &&
            personFilter === 'unclosed' && (
              <div className="flex justify-center w-full pt-2 sm:pt-4">
                <div className="w-full max-w-xl">
                  <Button
                    variant="filled"
                    colorKey="emerald"
                    size="hero"
                    width="full"
                    icon={Sparkles}
                    iconClassName="text-white"
                    disabled={!canPerformClosure}
                    onClick={() => setIsAutoCloseModalOpen(true)}
                    className="justify-center shadow-lg"
                  >
                    AUTOMATICKÁ UZÁVĚRKA
                  </Button>
                </div>
              </div>
            )}

          {isLoading ? (
            <div className="py-12 text-center text-sm text-slate-400 dark:text-zinc-500">
              Načítání dat měsíční uzávěrky…
            </div>
          ) : !overview?.canCloseSelectedMonth ? (
            <div className="py-10 text-center space-y-2 rounded-2xl bg-slate-50/70 dark:bg-zinc-800/35 p-6">
              <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
              <div className="text-sm font-semibold text-slate-900 dark:text-white">
                Měsíční uzávěrku za {selectedMonthName.toLowerCase()} {selectedYearNum} zatím nelze
                provést
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-md mx-auto">
                Měsíční uzávěrku daného měsíce lze provést až poté, co daný měsíc skončil a existuje
                v něm alespoň 1 přítomnost nebo 1 absence.
              </p>
            </div>
          ) : displayedPeople.length === 0 ? (
            <div className="py-10 text-center space-y-5 rounded-2xl bg-slate-50/70 dark:bg-zinc-800/35 p-6">
              <div className="space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                <div className="text-sm font-semibold text-slate-900 dark:text-white">
                  {personFilter === 'unclosed'
                    ? `Všechny osoby v měsíci ${selectedMonthName} ${selectedYearNum} mají uzavřenou docházku!`
                    : 'Žádné záznamy pro zvolený filtr.'}
                </div>
              </div>

              {personFilter === 'unclosed' &&
                peopleInMonth.length > 0 &&
                unclosedPeople.length === 0 && (
                  <div className="flex justify-center w-full pt-2 sm:pt-4">
                    <div className="w-full max-w-xl">
                      <Button
                        variant="filled"
                        colorKey="emerald"
                        size="hero"
                        width="full"
                        icon={Download}
                        iconClassName="text-white"
                        className="justify-center shadow-lg"
                        onClick={() =>
                          addToast?.(
                            'warning',
                            'Hromadný export',
                            'Hromadný export měsíční uzávěrky bude implementován v další fázi.'
                          )
                        }
                      >
                        HROMADNÝ EXPORT
                      </Button>
                    </div>
                  </div>
                )}
            </div>
          ) : (
            <div className="space-y-3">
              {displayedPeople.map((person) => {
                const isOsvc = person.contract === 'OSVČ';
                const hasUnverified = person.unverifiedPresencesCount > 0;
                const overtimeNeg = person.overtimeBalanceHours < 0;
                const isPersonLocked = Boolean(person.isLocked || overview?.isSelectedMonthLocked);

                return (
                  <div
                    key={person.userId}
                    onClick={() => canPerformClosure && !isPersonLocked && handleOpenPersonClosure(person)}
                    className={`rounded-2xl p-4 sm:p-5 bg-slate-50/80 dark:bg-zinc-800/40 hover:bg-slate-100/80 dark:hover:bg-zinc-800/70 transition-all ${
                      canPerformClosure && !isPersonLocked ? 'cursor-pointer' : ''
                    }`}
                  >
                    {/* Horní řádek karty osoby: Jméno, role, úvazek + stav / akční tlačítko */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200/50 dark:border-zinc-700/40">
                      <div className="flex items-center gap-3 min-w-0">
                        <UserAvatar
                          name={person.fullName}
                          size="md"
                          isPermanentHomeOffice={person.isPermanentHomeOffice}
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-slate-900 dark:text-white truncate">
                              {person.fullName}
                            </span>
                            <RoleBadge
                              role={person.role as Persona['role']}
                              roleLabel={person.roleLabel}
                            />
                            <span className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-200/70 text-slate-700 dark:bg-zinc-700 dark:text-zinc-200">
                              {formatContractLabel(
                                person.contract as 'HPP' | 'OSVČ',
                                person.contractType as any,
                                person.contractTypeName || undefined
                              )}
                            </span>
                          </div>
                          {person.isClosed && person.closureRecord && (
                            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5 flex items-center gap-2 flex-wrap">
                              <span>
                                Uzavřeno ({person.closureRecord.closedByName || 'Office Manager'})
                              </span>
                              <span>•</span>
                              <span>
                                K proplacení:{' '}
                                <strong className="font-mono">
                                  {formatOvertime(person.closureRecord.paidOvertimeHours)}
                                </strong>
                              </span>
                              {Math.abs(person.closureRecord.netSaldoChangeHours) >= 0.02 && (
                                <>
                                  <span>•</span>
                                  <span>
                                    Změna salda:{' '}
                                    <strong className="font-mono">
                                      {formatOvertime(person.closureRecord.netSaldoChangeHours)}
                                    </strong>
                                  </span>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 flex-wrap">
                        {hasUnverified && !person.isClosed && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-500/15 text-rose-700 dark:text-rose-300 text-[11px] font-semibold">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>{person.unverifiedPresencesCount} neověřené</span>
                          </span>
                        )}

                        {person.isClosed ? (
                          <>
                            {isPersonLocked ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-200/80 dark:bg-zinc-700/80 text-slate-600 dark:text-zinc-300 text-[11px] font-semibold">
                                <Lock className="w-3.5 h-3.5" />
                                <span>Uzamčeno (obměsíc)</span>
                              </span>
                            ) : (
                              <>
                                <Button
                                  variant="surface"
                                  colorKey="emerald"
                                  size="xs"
                                  icon={Pencil}
                                  disabled={!canPerformClosure}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenPersonClosure(person);
                                  }}
                                >
                                  Upravit
                                </Button>
                                {person.closureRecord && (
                                  <Button
                                    variant="surface"
                                    colorKey="rose"
                                    size="xs"
                                    icon={Trash2}
                                    disabled={!canPerformClosure || isDeletingClosure}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setPendingDeleteClosure({
                                        closureId: person.closureRecord!.id,
                                        fullName: person.fullName
                                      });
                                    }}
                                  >
                                    Vymazat záznam
                                  </Button>
                                )}
                              </>
                            )}
                            <Button
                              variant="surface"
                              size="icon-sm"
                              icon={FileDown}
                              onClick={(e) => {
                                e.stopPropagation();
                                addToast?.(
                                  'warning',
                                  'Stažení PDF',
                                  `Export PDF uzávěrky pro ${person.fullName} je připraven pro další fázi.`
                                );
                              }}
                              title="Stáhnout PDF uzávěrky"
                            />
                          </>
                        ) : isPersonLocked ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-200/80 dark:bg-zinc-700/80 text-slate-600 dark:text-zinc-300 text-[11px] font-semibold">
                            <Lock className="w-3.5 h-3.5" />
                            <span>Uzamčeno (obměsíc)</span>
                          </span>
                        ) : (
                          <Button
                            variant="filled"
                            colorKey="amber"
                            size="xs"
                            icon={FileCheck2}
                            disabled={!canPerformClosure}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenPersonClosure(person);
                            }}
                          >
                            Vyřešit uzávěrku
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Bod 5: Dolní část karty osoby: 1 položka = 1 řádek, 3 sloupce na desktopu, 2 na tabletu, 1 na mobilu */}
                    <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      {/* 1. Odpracováno / Fond */}
                      <ClosureSummaryRow
                        icon={CalendarDays}
                        colorKey="emerald"
                        label="Odpracováno"
                        value={formatHoursMinutes(person.workedHours)}
                        total={formatHoursMinutes(person.fundHours)}
                      />

                      {/* 2. Přesčasový balance (mínusový i plusový) */}
                      <ClosureSummaryRow
                        icon={TrendingUp}
                        colorKey={overtimeNeg ? 'rose' : 'sky'}
                        label="Přesčas"
                        value={formatOvertime(person.overtimeBalanceHours)}
                        valueColorClass={
                          overtimeNeg
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-emerald-600 dark:text-emerald-400'
                        }
                      />

                      {/* 3. Saldo k danému měsíci (součet předchozích < měsíc + aktuální měsíc) */}
                      <ClosureSummaryRow
                        icon={Layers}
                        colorKey="indigo"
                        label="Saldo"
                        value={formatOvertime(person.carriedOverSaldoHours)}
                        valueColorClass={
                          person.carriedOverSaldoHours > 0
                            ? 'text-indigo-600 dark:text-indigo-400'
                            : undefined
                        }
                      />

                      {/* 4. Neověřené přítomnosti */}
                      <ClosureSummaryRow
                        icon={hasUnverified ? AlertTriangle : Building2}
                        colorKey={hasUnverified ? 'rose' : 'emerald'}
                        label="Neověřené přítomnosti"
                        value={person.unverifiedPresencesCount}
                        valueColorClass={
                          hasUnverified
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-emerald-600 dark:text-emerald-400'
                        }
                      />

                      {/* 5. Počet dnů nemoci */}
                      <ClosureSummaryRow
                        activityType="illness"
                        label={getAbsenceTypeLabel('illness', absenceTypesMap, isOsvc)}
                        value={person.illnessDays}
                        unit="d"
                      />

                      {/* 6. Počet dnů OČR */}
                      <ClosureSummaryRow
                        activityType="ocr"
                        label={getAbsenceTypeLabel('ocr', absenceTypesMap, isOsvc)}
                        value={person.ocrDays}
                        unit="d"
                      />

                      {/* 7. Počet dnů dovolených */}
                      <ClosureSummaryRow
                        activityType="vacation"
                        label={getAbsenceTypeLabel('vacation', absenceTypesMap, isOsvc)}
                        value={person.vacationDays}
                        unit="d"
                      />

                      {/* 8. Počet dnů sickday */}
                      <ClosureSummaryRow
                        activityType="sick_day"
                        label={getAbsenceTypeLabel('sick_day', absenceTypesMap, isOsvc)}
                        value={person.sickDays}
                        unit="d"
                      />

                      {/* 9. Počet hodin lékaře */}
                      <ClosureSummaryRow
                        activityType="doctor"
                        label={getAbsenceTypeLabel('doctor', absenceTypesMap, isOsvc)}
                        value={formatHoursMinutes(person.doctorHours)}
                      />

                      {/* 10. Počet dnů neplaceného volna */}
                      <ClosureSummaryRow
                        activityType="unpaid_leave"
                        label={getAbsenceTypeLabel('unpaid_leave', absenceTypesMap, isOsvc)}
                        value={person.unpaidLeaveDays}
                        unit="d"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Box>
      )}

      {/* ================================================================= */}
      {/* TAB 2: ROČNÍ UZÁVĚRKY                                             */}
      {/* ================================================================= */}
      {mainTab === 'yearly' && (
        <Box
          header={{
            title: firstUnclosedYearly
              ? `Roční uzávěrka ${selectedYearlyYear ?? firstUnclosedYearly.year}`
              : 'Roční uzávěrky',
            icon: Sparkles
          }}
        >
          {readyYears.length === 0 ? (
            <div className="py-10 text-center space-y-3 rounded-2xl bg-slate-50/80 dark:bg-zinc-800/40 p-6">
              <Lock className="w-8 h-8 text-amber-500 mx-auto" />
              <div className="text-sm font-bold text-slate-900 dark:text-white">
                Žádný rok zatím nemá uzavřeny všechny aktivní měsíce
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-lg mx-auto">
                Aby se zobrazila roční uzávěrka daného roku, musí být nejprve uzavřeny všechny
                měsíce v daném roce, které mají uzávěrku podle pravidel měsíčních uzávěrek.
              </p>
              {(overview?.availableYears ?? []).length > 0 && (
                <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
                  {(overview?.availableYears ?? []).map((yr) => (
                    <span
                      key={yr.year}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-900 text-xs font-medium text-slate-700 dark:text-zinc-300 shadow-2xs"
                    >
                      <span>Rok {yr.year}:</span>
                      <strong className="font-mono text-amber-600 dark:text-amber-400">
                        {yr.closedMonthsCount} / {yr.eligibleMonthsCount} měsíců uzavřeno
                      </strong>
                    </span>
                  ))}
                </div>
              )}
              <div className="pt-2">
                <Button
                  variant="filled"
                  colorKey="amber"
                  size="sm"
                  onClick={() => setMainTab('monthly')}
                >
                  Přejít na měsíční uzávěrky
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="px-4 py-3 rounded-2xl bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 text-xs flex items-center justify-between flex-wrap gap-2">
                <span>
                  Všechny aktivní měsíce v roce{' '}
                  <strong>{selectedYearlyYear ?? firstUnclosedYearly?.year}</strong> jsou uzavřeny.
                  Roční uzávěrka je připravena.
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {personasList
                  .filter((p) => p.isActive !== false && p.isApproved !== false)
                  .map((p) => (
                    <div
                      key={p.id}
                      className="p-4 rounded-2xl bg-slate-50/80 dark:bg-zinc-800/40 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <UserAvatar name={p.name} size="sm" />
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                            {p.name}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-zinc-400">
                            {p.roleLabel}
                          </div>
                        </div>
                      </div>
                      <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                        Připraveno k roční uzávěrce
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </Box>
      )}

      {/* ================================================================= */}
      {/* 4KROKOVÝ MODÁL ŘEŠENÍ MĚSÍČNÍ UZÁVĚRKY OSOBY                      */}
      {/* ================================================================= */}
      {activePerson && overview && (
        <Modal
          isOpen={Boolean(activePerson)}
          onClose={handleClosePersonModal}
          title={`Uzávěrka: ${activePerson.fullName} • ${selectedMonthName} ${selectedYearNum}`}
          subtitle={`${activePerson.roleLabel} • ${formatContractLabel(
            activePerson.contract as 'HPP' | 'OSVČ',
            activePerson.contractType as any,
            activePerson.contractTypeName || undefined
          )}`}
          icon={FileCheck2}
          size="3xl"
          footer={
            <div className="w-full flex items-center justify-between gap-2 flex-wrap">
              <div>
                {wizardStep > 1 ? (
                  <Button
                    variant="surface"
                    size="sm"
                    icon={ArrowLeft}
                    onClick={() => setWizardStep((s) => Math.max(1, s - 1) as WizardStep)}
                  >
                    Předchozí krok
                  </Button>
                ) : (
                  <Button variant="ghost" size="sm" onClick={handleClosePersonModal}>
                    Zavřít
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-2">
                {wizardStep === 1 && (
                  <Button
                    variant="filled"
                    colorKey="amber"
                    size="sm"
                    icon={ArrowRight}
                    iconPosition="right"
                    disabled={!step1Complete}
                    onClick={() => setWizardStep(2)}
                  >
                    Pokračovat na 2. krok
                  </Button>
                )}

                {wizardStep === 2 && (
                  <Button
                    variant="filled"
                    colorKey="amber"
                    size="sm"
                    icon={ArrowRight}
                    iconPosition="right"
                    disabled={!step2Complete}
                    onClick={() => setWizardStep(3)}
                  >
                    Pokračovat na 3. krok
                  </Button>
                )}

                {wizardStep === 3 && (
                  <Button
                    variant="filled"
                    colorKey="amber"
                    size="sm"
                    icon={ArrowRight}
                    iconPosition="right"
                    onClick={() => setWizardStep(4)}
                  >
                    Pokračovat k sumarizaci (4. krok)
                  </Button>
                )}

                {wizardStep === 4 && (
                  <>
                    <Button
                      variant="surface"
                      size="sm"
                      icon={Sliders}
                      onClick={() => setWizardStep(3)}
                    >
                      Opravit převody
                    </Button>
                    <Button
                      variant="filled"
                      colorKey="emerald"
                      size="sm"
                      icon={Check}
                      disabled={isSavingClosure || !step1Complete || !step2Complete}
                      onClick={handleSavePersonClosure}
                    >
                      {isSavingClosure
                        ? 'Ukládám…'
                        : activePerson.isClosed
                        ? 'Uložit změny uzávěrky'
                        : 'Uložit uzávěrku'}
                    </Button>
                  </>
                )}
              </div>
            </div>
          }
        >
          <div className="space-y-5">
            {/* 4kroková navigace (stepper) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(
                [
                  {
                    step: 1 as WizardStep,
                    label: '1. Neověřené přítomnosti',
                    done: step1Complete
                  },
                  {
                    step: 2 as WizardStep,
                    label: '2. Doklady absencí',
                    done: step1Complete && step2Complete
                  },
                  {
                    step: 3 as WizardStep,
                    label: '3. Konto salda a přesčasy',
                    done: wizardStep > 3
                  },
                  {
                    step: 4 as WizardStep,
                    label: '4. Sumarizace a uložení',
                    done: activePerson.isClosed
                  }
                ] as const
              ).map((st) => {
                const isActive = wizardStep === st.step;
                const canClickStep =
                  st.step === 1 ||
                  (st.step === 2 && step1Complete) ||
                  (st.step >= 3 && step1Complete && step2Complete);

                return (
                  <button
                    key={st.step}
                    type="button"
                    disabled={!canClickStep}
                    onClick={() => canClickStep && setWizardStep(st.step)}
                    className={`px-3 py-2 rounded-xl text-left text-xs font-semibold transition-all flex items-center justify-between gap-1.5 ${
                      isActive
                        ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                        : st.done
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 cursor-pointer'
                        : canClickStep
                        ? 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 cursor-pointer'
                        : 'bg-slate-100/60 dark:bg-zinc-800/40 text-slate-400 dark:text-zinc-600 cursor-not-allowed'
                    }`}
                  >
                    <span className="truncate">{st.label}</span>
                    {st.done && !isActive && <Check className="w-3.5 h-3.5 shrink-0" />}
                  </button>
                );
              })}
            </div>

            {/* ============================================================= */}
            {/* KROK 1: VYŘEŠENÍ NEOVĚŘENÝCH PŘÍTOMNOSTÍ (V DESIGNU VÝKAZŮ)   */}
            {/* ============================================================= */}
            {wizardStep === 1 && (
              <div className="space-y-4">
                <div className="px-4 py-3 rounded-2xl bg-slate-50 dark:bg-zinc-800/50 text-xs text-slate-600 dark:text-zinc-300 space-y-1">
                  <div className="font-bold text-slate-900 dark:text-white">
                    1. krok: Vyřešení neověřených přítomností a podezřelého logování
                  </div>
                  <p>
                    Zde jsou načteny neověřené přítomnosti v kanceláři (bez ověření NFC čipem) a
                    diagnostikované podezřelé logování (přítomnost trvající přes půlnoc, která nebyla
                    řádně ukončena a byla automaticky ukončena v 05:00). Každý záznam můžete{' '}
                    <strong>Ověřit</strong>, <strong>Upravit</strong> (čas / Home Office), nebo{' '}
                    <strong>Smazat</strong>.
                  </p>
                </div>

                {activePerson.unverifiedPresences.length === 0 ? (
                  <div className="py-8 px-4 rounded-2xl bg-emerald-500/10 text-center space-y-2">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                    <div className="text-sm font-bold text-emerald-800 dark:text-emerald-200">
                      Všechny přítomnosti v tomto měsíci jsou ověřené
                    </div>
                    <p className="text-xs text-emerald-700/80 dark:text-emerald-300/80">
                      Osoba {activePerson.fullName} nemá žádné neověřené přítomnosti. Můžete
                      pokračovat na 2. krok.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {activePerson.unverifiedPresences.map((entry) => {
                      const dObj = new Date(`${entry.date}T00:00:00`);
                      const dayNum = dObj.getDate() || Number(entry.date.slice(8, 10));
                      const dow = Number.isNaN(dObj.getDay()) ? 1 : dObj.getDay();
                      const dayShort = DAY_NAMES_SHORT[dow] || 'Po';
                      const isEditing = editingEntryId === entry.id;
                      const isBusy = isSavingEntryId === entry.id;
                      const editLogs = entry.editLogs || [];
                      const isHistOpen = Boolean(openHistoryLogIds[entry.id]);

                      return (
                        <div
                          key={entry.id}
                          className="rounded-2xl bg-slate-50/90 dark:bg-zinc-800/50 p-3 space-y-2"
                        >
                          <div className="flex items-center justify-between gap-3 flex-wrap">
                            {/* Vlevo: Kalendářík (stejný design jako Výkazy) + PresenceBadge */}
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-11 h-11 rounded-2xl bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 shadow-2xs flex flex-col items-center justify-center shrink-0 text-center">
                                <span className="text-[10px] uppercase font-bold leading-none">
                                  {dayShort}
                                </span>
                                <span className="text-sm font-bold font-mono leading-tight mt-0.5">
                                  {dayNum}
                                </span>
                              </div>

                              <div className="flex items-center gap-2 flex-wrap">
                                <PresenceBadge
                                  type={entry.locationType === 'home_office' ? 'home_office' : 'office'}
                                  customLabel={
                                    entry.isSuspicious
                                      ? 'Podezřelé logování (do 05:00)'
                                      : 'Kancelář (bez ověření)'
                                  }
                                  size="sm"
                                />
                                {entry.isSuspicious && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-700 dark:text-rose-300 text-[10px] font-bold">
                                    <AlertTriangle className="w-3 h-3" />
                                    <span>Přes půlnoc • utnuto v 05:00</span>
                                  </span>
                                )}
                                {editLogs.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setOpenHistoryLogIds((prev) => ({
                                        ...prev,
                                        [entry.id]: !prev[entry.id]
                                      }))
                                    }
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-200/80 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 text-[10px] font-mono cursor-pointer"
                                  >
                                    <History className="w-3 h-3" />
                                    <span>{editLogs.length}</span>
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Vpravo: Čas od–do, počet hodin a akce (Ověřit / Upravit / Smazat) */}
                            {!isEditing && (
                              <div className="flex items-center gap-3 sm:gap-4 shrink-0">
                                <div className="text-right font-mono text-xs text-slate-600 dark:text-zinc-300">
                                  {entry.startTime} – {entry.endTime || 'probíhá'}
                                </div>
                                <div className="min-w-[60px] text-right font-mono text-sm font-bold text-slate-900 dark:text-white">
                                  {formatHoursMinutes(entry.hours)}
                                </div>
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="filled"
                                    colorKey="emerald"
                                    size="xs"
                                    icon={Check}
                                    disabled={isBusy}
                                    onClick={() => handleVerifyOfficeEntry(entry)}
                                    title="Ověřit přítomnost v kanceláři"
                                  >
                                    Ověřit
                                  </Button>
                                  <button
                                    type="button"
                                    onClick={() => handleStartEditEntry(entry)}
                                    disabled={isBusy}
                                    title="Upravit čas nebo režim (Kancelář / Home Office)"
                                    className="p-1.5 rounded-lg hover:bg-slate-200/70 dark:hover:bg-zinc-700 text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors cursor-pointer"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setPendingDeleteEntry({
                                        id: entry.id,
                                        description: `Neověřená přítomnost • ${activePerson.fullName} • ${formatDateCz(entry.date)} (${entry.startTime} – ${entry.endTime || 'probíhá'})`
                                      })
                                    }
                                    disabled={isBusy}
                                    title="Smazat záznam přítomnosti"
                                    className="p-1.5 rounded-lg hover:bg-rose-500/15 text-slate-400 hover:text-rose-600 dark:text-zinc-500 dark:hover:text-rose-400 transition-colors cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Inline editace záznamu (stejný design jako Výkazy) */}
                          {isEditing && (
                            <div className="pt-2 border-t border-slate-200/60 dark:border-zinc-700/50 flex flex-wrap items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <select
                                  value={editLocationType}
                                  onChange={(e) =>
                                    setEditLocationType(
                                      e.target.value === 'home_office' ? 'home_office' : 'office'
                                    )
                                  }
                                  className="px-2.5 py-1 rounded-lg bg-white dark:bg-zinc-900 text-xs font-semibold text-slate-900 dark:text-white border border-slate-200 dark:border-zinc-700"
                                >
                                  <option value="office">V kanceláři (ověřit)</option>
                                  <option value="home_office">Home Office</option>
                                </select>
                                <input
                                  type="time"
                                  value={editStartTime}
                                  onChange={(e) => setEditStartTime(e.target.value)}
                                  className="px-2 py-1 rounded-lg bg-white dark:bg-zinc-900 text-xs font-mono text-slate-900 dark:text-white border border-slate-200 dark:border-zinc-700"
                                />
                                <span className="text-slate-400">–</span>
                                <input
                                  type="time"
                                  value={editEndTime}
                                  onChange={(e) => setEditEndTime(e.target.value)}
                                  className="px-2 py-1 rounded-lg bg-white dark:bg-zinc-900 text-xs font-mono text-slate-900 dark:text-white border border-slate-200 dark:border-zinc-700"
                                />
                              </div>

                              <div className="flex items-center gap-1.5">
                                <Button
                                  variant="filled"
                                  colorKey="emerald"
                                  size="xs"
                                  icon={Check}
                                  disabled={isBusy}
                                  onClick={() => handleSaveEditedEntry(entry.id)}
                                >
                                  Uložit a ověřit
                                </Button>
                                <Button
                                  variant="outline"
                                  colorKey="rose"
                                  size="xs"
                                  icon={X}
                                  disabled={isBusy}
                                  onClick={() => setEditingEntryId(null)}
                                >
                                  Zrušit
                                </Button>
                              </div>
                            </div>
                          )}

                          {isHistOpen && editLogs.length > 0 && (
                            <div className="pt-1 pl-14 space-y-0.5 text-[11px] text-slate-500 dark:text-zinc-400">
                              {editLogs.map((l) => (
                                <div key={l.id}>{formatRecordEditLog(l)}</div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ============================================================= */}
            {/* KROK 2: VYŘEŠENÍ ABSENCÍ V KOMPETENCI OFFICERA (CHECKLIST)    */}
            {/* ============================================================= */}
            {wizardStep === 2 && (
              <div className="space-y-4">
                <div className="px-4 py-3 rounded-2xl bg-slate-50 dark:bg-zinc-800/50 text-xs text-slate-600 dark:text-zinc-300 space-y-1">
                  <div className="font-bold text-slate-900 dark:text-white">
                    2. krok: Kontrola dokladů k absencím v kompetenci Office Managera
                  </div>
                  <p>
                    Potvrďte doložení povinných dokladů u absencí za {selectedMonthName.toLowerCase()}{' '}
                    {selectedYearNum} (<strong>eNeschopenka doložena</strong> u nemoci,{' '}
                    <strong>Propustka doložena</strong> u lékaře,{' '}
                    <strong>Žádost o ošetřovné doložena</strong> u OČR). Bez odškrtnutí všech
                    povinných dokladů nelze pokračovat na další krok.
                  </p>
                </div>

                {/* Povinný checklist absencí (Nemoc, Lékař, OČR) */}
                {requiredChecklistItems.length === 0 ? (
                  <div className="py-6 px-4 rounded-2xl bg-emerald-500/10 text-center space-y-1.5">
                    <CheckCircle2 className="w-7 h-7 text-emerald-500 mx-auto" />
                    <div className="text-sm font-bold text-emerald-800 dark:text-emerald-200">
                      Žádné absence vyžadující doložení dokladu v tomto měsíci
                    </div>
                    <p className="text-xs text-emerald-700/80 dark:text-emerald-300/80">
                      Osoba v tomto měsíci nečerpala nemoc, lékaře ani OČR.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                        Absence vyžadující kontrolu dokladu ({requiredChecklistItems.length})
                      </span>
                      {requiredChecklistItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const next: Record<string, boolean> = { ...checkedAbsenceIds };
                            requiredChecklistItems.forEach((it) => {
                              next[it.id] = true;
                            });
                            setCheckedAbsenceIds(next);
                          }}
                          className="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                        >
                          Označit vše jako doložené
                        </button>
                      )}
                    </div>

                    {requiredChecklistItems.map((item) => {
                      const isChecked = Boolean(checkedAbsenceIds[item.id]);
                      const dateText =
                        item.startDate === item.endDate
                          ? formatDateCz(item.startDate)
                          : `${formatDateCz(item.startDate)} – ${formatDateCz(item.endDate)}`;
                      const timeText =
                        item.startTime && item.endTime
                          ? ` (${item.startTime} – ${item.endTime}, ${item.hoursCount} h)`
                          : ` (${item.daysCount} d)`;

                      return (
                        <label
                          key={item.id}
                          className={`flex items-center justify-between gap-3 p-3.5 rounded-2xl cursor-pointer transition-all select-none ${
                            isChecked
                              ? 'bg-emerald-500/10 dark:bg-emerald-500/15'
                              : 'bg-slate-50 dark:bg-zinc-800/50 hover:bg-slate-100 dark:hover:bg-zinc-800'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-wrap">
                            <PresenceBadge
                              type={item.typeCode as StatusType}
                              customLabel={item.typeName}
                              size="sm"
                            />
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-slate-900 dark:text-white">
                                {dateText}
                                <span className="font-mono font-normal text-slate-500 dark:text-zinc-400">
                                  {timeText}
                                </span>
                              </div>
                              {item.note && (
                                <div className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                                  Poznámka: {item.note}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2.5 shrink-0">
                            <span
                              className={`text-xs font-bold ${
                                isChecked
                                  ? 'text-emerald-700 dark:text-emerald-300'
                                  : 'text-amber-700 dark:text-amber-300'
                              }`}
                            >
                              {item.checklistLabel}
                            </span>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) =>
                                setCheckedAbsenceIds((prev) => ({
                                  ...prev,
                                  [item.id]: e.target.checked
                                }))
                              }
                              className="w-4 h-4 rounded accent-emerald-600 cursor-pointer"
                            />
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}

                {/* Informativní přehled ostatních absencí (Sick day, Dovolená, Neplacené volno – bez checkboxu) */}
                {infoAbsenceItems.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 px-1">
                      Ostatní absence v měsíci – informativní přehled bez dokladu (
                      {infoAbsenceItems.length})
                    </div>
                    {infoAbsenceItems.map((item) => {
                      const dateText =
                        item.startDate === item.endDate
                          ? formatDateCz(item.startDate)
                          : `${formatDateCz(item.startDate)} – ${formatDateCz(item.endDate)}`;
                      return (
                        <div
                          key={item.id}
                          className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-slate-50/70 dark:bg-zinc-800/35 text-xs"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <PresenceBadge
                              type={item.typeCode as StatusType}
                              customLabel={item.typeName}
                              size="sm"
                            />
                            <span className="font-semibold text-slate-800 dark:text-zinc-200">
                              {dateText}
                            </span>
                          </div>
                          <span className="font-mono font-semibold text-slate-600 dark:text-zinc-400">
                            {item.daysCount} d
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ============================================================= */}
            {/* KROK 3: KONTO SALDA A PŘESČASY (KOMPLETNÍ PŘEVODY TAM A ZPĚT) */}
            {/* ============================================================= */}
            {wizardStep === 3 && (
              <div className="space-y-5">
                <div className="px-4 py-3 rounded-2xl bg-slate-50 dark:bg-zinc-800/50 text-xs text-slate-600 dark:text-zinc-300 space-y-1">
                  <div className="font-bold text-slate-900 dark:text-white">
                    3. krok: Konto salda (v daném roce) a balance přesčasu
                  </div>
                  <p>
                    Zde můžete uplatnit hodiny z <strong>Konta salda</strong> (např. na pokrytí
                    chybějícího času nebo navýšení přesčasu až do plné výše salda) a v případě
                    kladného přesčasu převést hodiny <strong>do Konta salda</strong> nebo je ponechat{' '}
                    <strong>k proplacení</strong>.
                  </p>
                </div>

                {/* Vstupní stav před převodem */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-4 rounded-2xl bg-indigo-500/10 dark:bg-indigo-500/15 space-y-1">
                    <div className="text-xs font-medium text-indigo-700 dark:text-indigo-300">
                      Konto salda (z předchozích uzávěrek v roce {selectedYearNum})
                    </div>
                    <div className="text-xl font-bold font-mono text-indigo-700 dark:text-indigo-300">
                      {formatOvertime(availableSaldoHours)}
                    </div>
                    <div className="text-[11px] text-indigo-600/80 dark:text-indigo-300/70">
                      Maximálně lze ze salda čerpat: {formatHoursMinutes(availableSaldoHours)}
                    </div>
                  </div>

                  <div
                    className={`p-4 rounded-2xl space-y-1 ${
                      rawOvertimeBalanceHours < 0
                        ? 'bg-rose-500/10 dark:bg-rose-500/15'
                        : 'bg-emerald-500/10 dark:bg-emerald-500/15'
                    }`}
                  >
                    <div
                      className={`text-xs font-medium ${
                        rawOvertimeBalanceHours < 0
                          ? 'text-rose-700 dark:text-rose-300'
                          : 'text-emerald-700 dark:text-emerald-300'
                      }`}
                    >
                      Balance přesčasu za {selectedMonthName.toLowerCase()} {selectedYearNum}
                    </div>
                    <div
                      className={`text-xl font-bold font-mono ${
                        rawOvertimeBalanceHours < 0
                          ? 'text-rose-700 dark:text-rose-300'
                          : 'text-emerald-700 dark:text-emerald-300'
                      }`}
                    >
                      {formatOvertime(rawOvertimeBalanceHours)}
                    </div>
                    <div className="text-[11px] text-slate-600 dark:text-zinc-400">
                      Odpracováno {formatHoursMinutes(activePerson.workedHours)} z fondu{' '}
                      {formatHoursMinutes(activePerson.fundHours)}
                    </div>
                  </div>
                </div>

                {/* A) Čerpání z konta salda do tohoto měsíce */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/50 space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">
                        1. Uplatnit hodiny z Konta salda do tohoto měsíce
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-zinc-400">
                        Můžete pokrýt chybějící čas nebo vybrat vlastní částku ze salda (až do{' '}
                        {formatHoursMinutes(availableSaldoHours)}). Čas vybraný nad rámec mínusu se
                        zaeviduje jako kladný přesčas.
                      </div>
                    </div>
                    <span className="font-mono text-sm font-bold text-indigo-600 dark:text-indigo-400">
                      Čerpáno ze salda: {formatHoursMinutes(requestedSaldoUsedHours)}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-slate-600 dark:text-zinc-400 flex items-center gap-1.5">
                        <span>Hodiny:</span>
                        <input
                          type="number"
                          min={0}
                          max={Math.floor(availableSaldoHours)}
                          disabled={availableSaldoHours <= 0}
                          value={saldoUsedH}
                          onChange={(e) => {
                            const nextH = Math.max(0, parseInt(e.target.value || '0', 10));
                            applySaldoUsedHours(hmToHours(nextH, saldoUsedM));
                          }}
                          className="w-16 px-2.5 py-1.5 rounded-xl bg-white dark:bg-zinc-900 text-xs font-mono font-bold text-slate-900 dark:text-white border border-slate-200 dark:border-zinc-700"
                        />
                      </label>
                      <label className="text-xs text-slate-600 dark:text-zinc-400 flex items-center gap-1.5">
                        <span>Minuty:</span>
                        <input
                          type="number"
                          min={0}
                          max={59}
                          disabled={availableSaldoHours <= 0}
                          value={saldoUsedM}
                          onChange={(e) => {
                            const nextM = Math.max(
                              0,
                              Math.min(59, parseInt(e.target.value || '0', 10))
                            );
                            applySaldoUsedHours(hmToHours(saldoUsedH, nextM));
                          }}
                          className="w-16 px-2.5 py-1.5 rounded-xl bg-white dark:bg-zinc-900 text-xs font-mono font-bold text-slate-900 dark:text-white border border-slate-200 dark:border-zinc-700"
                        />
                      </label>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <Button
                        variant="surface"
                        size="xs"
                        disabled={availableSaldoHours <= 0}
                        onClick={() => applySaldoUsedHours(0)}
                      >
                        Nepoužít (0h)
                      </Button>
                      {rawOvertimeBalanceHours < 0 && availableSaldoHours > 0 && (
                        <Button
                          variant="filled"
                          colorKey="indigo"
                          size="xs"
                          onClick={() =>
                            applySaldoUsedHours(
                              Math.min(Math.abs(rawOvertimeBalanceHours), availableSaldoHours)
                            )
                          }
                        >
                          Pokrýt chybějící čas (
                          {formatHoursMinutes(
                            Math.min(Math.abs(rawOvertimeBalanceHours), availableSaldoHours)
                          )}
                          )
                        </Button>
                      )}
                      {availableSaldoHours > 0 && (
                        <Button
                          variant="surface"
                          colorKey="indigo"
                          size="xs"
                          onClick={() => applySaldoUsedHours(availableSaldoHours)}
                        >
                          Vyčerpat celé saldo ({formatHoursMinutes(availableSaldoHours)})
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                {/* B) Převod kladného přesčasu do konta salda vs k proplacení */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/50 space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">
                        2. Převést kladný přesčas do Konta salda (nebo nechat k proplacení)
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-zinc-400">
                        Dostupný kladný přesčas k rozdělení:{' '}
                        <strong>{formatHoursMinutes(maxOvertimeToSaldoHours)}</strong>. Část, kterou
                        nepřevedete do salda, zůstane evidována jako přesčas k proplacení.
                      </div>
                    </div>
                    <span className="font-mono text-sm font-bold text-emerald-600 dark:text-emerald-400">
                      Do salda: {formatHoursMinutes(requestedOvertimeToSaldoHours)}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-slate-600 dark:text-zinc-400 flex items-center gap-1.5">
                        <span>Hodiny:</span>
                        <input
                          type="number"
                          min={0}
                          max={Math.floor(maxOvertimeToSaldoHours)}
                          disabled={maxOvertimeToSaldoHours <= 0}
                          value={overtimeToSaldoH}
                          onChange={(e) => {
                            const nextH = Math.max(0, parseInt(e.target.value || '0', 10));
                            applyOvertimeToSaldoHours(hmToHours(nextH, overtimeToSaldoM));
                          }}
                          className="w-16 px-2.5 py-1.5 rounded-xl bg-white dark:bg-zinc-900 text-xs font-mono font-bold text-slate-900 dark:text-white border border-slate-200 dark:border-zinc-700"
                        />
                      </label>
                      <label className="text-xs text-slate-600 dark:text-zinc-400 flex items-center gap-1.5">
                        <span>Minuty:</span>
                        <input
                          type="number"
                          min={0}
                          max={59}
                          disabled={maxOvertimeToSaldoHours <= 0}
                          value={overtimeToSaldoM}
                          onChange={(e) => {
                            const nextM = Math.max(
                              0,
                              Math.min(59, parseInt(e.target.value || '0', 10))
                            );
                            applyOvertimeToSaldoHours(hmToHours(overtimeToSaldoH, nextM));
                          }}
                          className="w-16 px-2.5 py-1.5 rounded-xl bg-white dark:bg-zinc-900 text-xs font-mono font-bold text-slate-900 dark:text-white border border-slate-200 dark:border-zinc-700"
                        />
                      </label>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <Button
                        variant="surface"
                        size="xs"
                        disabled={maxOvertimeToSaldoHours <= 0}
                        onClick={() => applyOvertimeToSaldoHours(0)}
                      >
                        Vše k proplacení (0h do salda)
                      </Button>
                      {maxOvertimeToSaldoHours > 0 && (
                        <Button
                          variant="filled"
                          colorKey="emerald"
                          size="xs"
                          onClick={() => applyOvertimeToSaldoHours(maxOvertimeToSaldoHours)}
                        >
                          Převést celý přesčas do salda (
                          {formatHoursMinutes(maxOvertimeToSaldoHours)})
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Výsledný stav po převodech */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="p-4 rounded-2xl bg-slate-900 text-white dark:bg-zinc-800 space-y-1">
                    <div className="text-xs text-slate-300 dark:text-zinc-400">
                      Nový zůstatek Konta salda (převod do dalšího měsíce)
                    </div>
                    <div className="text-xl font-bold font-mono text-indigo-400">
                      {formatOvertime(resultingNewSaldoHours)}
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-900 text-white dark:bg-zinc-800 space-y-1">
                    <div className="text-xs text-slate-300 dark:text-zinc-400">
                      Výsledný přesčas v měsíci (k proplacení / zůstatek)
                    </div>
                    <div
                      className={`text-xl font-bold font-mono ${
                        resultingPaidOvertimeHours < 0 ? 'text-rose-400' : 'text-emerald-400'
                      }`}
                    >
                      {formatOvertime(resultingPaidOvertimeHours)}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ============================================================= */}
            {/* KROK 4: SUMARIZACE OSOBY DLE ZADANÝCH ÚDAJŮ                   */}
            {/* ============================================================= */}
            {wizardStep === 4 && (
              <div className="space-y-5">
                <div className="px-4 py-3 rounded-2xl bg-emerald-500/10 text-xs text-emerald-800 dark:text-emerald-200 space-y-1">
                  <div className="font-bold">
                    4. krok: Sumarizace měsíční uzávěrky před uložením
                  </div>
                  <p>
                    Zkontrolujte souhrnné údaje osoby <strong>{activePerson.fullName}</strong> za{' '}
                    <strong>
                      {selectedMonthName} {selectedYearNum}
                    </strong>
                    . V případě potřeby se můžete vrátit a údaje opravit, nebo uzávěrku uložit.
                  </p>
                </div>

                {/* Bod 5: Sumarizace na 4. kroku: 1 položka = 1 řádek, 3 sloupce na desktopu, 2 na tabletu, 1 na mobilu */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-800/50 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  <ClosureSummaryRow
                    icon={CalendarDays}
                    colorKey="emerald"
                    label="Odpracováno"
                    value={formatHoursMinutes(activePerson.workedHours)}
                    total={formatHoursMinutes(activePerson.fundHours)}
                  />
                  <ClosureSummaryRow
                    icon={TrendingUp}
                    colorKey={resultingPaidOvertimeHours < 0 ? 'rose' : 'sky'}
                    label="Přesčas (výsledný)"
                    value={formatOvertime(resultingPaidOvertimeHours)}
                    valueColorClass={
                      resultingPaidOvertimeHours < 0
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-emerald-600 dark:text-emerald-400'
                    }
                  />
                  <ClosureSummaryRow
                    icon={Layers}
                    colorKey="indigo"
                    label="Saldo (k danému měsíci)"
                    value={formatOvertime(resultingNewSaldoHours)}
                    valueColorClass="text-indigo-600 dark:text-indigo-400"
                  />
                  <ClosureSummaryRow
                    icon={Building2}
                    colorKey="emerald"
                    label="Neověřené přítomnosti"
                    value={0}
                    valueColorClass="text-emerald-600 dark:text-emerald-400"
                  />
                  <ClosureSummaryRow
                    activityType="illness"
                    label={getAbsenceTypeLabel('illness', absenceTypesMap, activePerson.contract === 'OSVČ')}
                    value={activePerson.illnessDays}
                    unit="d"
                  />
                  <ClosureSummaryRow
                    activityType="ocr"
                    label={getAbsenceTypeLabel('ocr', absenceTypesMap, activePerson.contract === 'OSVČ')}
                    value={activePerson.ocrDays}
                    unit="d"
                  />
                  <ClosureSummaryRow
                    activityType="vacation"
                    label={getAbsenceTypeLabel('vacation', absenceTypesMap, activePerson.contract === 'OSVČ')}
                    value={activePerson.vacationDays}
                    unit="d"
                  />
                  <ClosureSummaryRow
                    activityType="sick_day"
                    label={getAbsenceTypeLabel('sick_day', absenceTypesMap, activePerson.contract === 'OSVČ')}
                    value={activePerson.sickDays}
                    unit="d"
                  />
                  <ClosureSummaryRow
                    activityType="doctor"
                    label={getAbsenceTypeLabel('doctor', absenceTypesMap, activePerson.contract === 'OSVČ')}
                    value={formatHoursMinutes(activePerson.doctorHours)}
                  />
                  <ClosureSummaryRow
                    activityType="unpaid_leave"
                    label={getAbsenceTypeLabel('unpaid_leave', absenceTypesMap, activePerson.contract === 'OSVČ')}
                    value={activePerson.unpaidLeaveDays}
                    unit="d"
                  />
                </div>

                {/* Přehledová tabulka bilance */}
                <div className="rounded-2xl bg-slate-50 dark:bg-zinc-800/40 p-4 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between py-1 border-b border-slate-200/60 dark:border-zinc-700/50">
                    <span className="text-slate-500 dark:text-zinc-400">
                      1. Neověřené přítomnosti v kanceláři:
                    </span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      0 (vše ověřeno)
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-slate-200/60 dark:border-zinc-700/50">
                    <span className="text-slate-500 dark:text-zinc-400">
                      2. Doklady absencí (eNeschopenka / Propustka / OČR):
                    </span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      {requiredChecklistItems.length > 0
                        ? `Doloženo (${requiredChecklistItems.length}/${requiredChecklistItems.length})`
                        : 'Bez dokladových absencí'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-slate-200/60 dark:border-zinc-700/50">
                    <span className="text-slate-500 dark:text-zinc-400">
                      Výchozí balance přesčasu v měsíci:
                    </span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      {formatOvertime(rawOvertimeBalanceHours)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-slate-200/60 dark:border-zinc-700/50">
                    <span className="text-slate-500 dark:text-zinc-400">
                      Uplatněno ze salda předchozích měsíců:
                    </span>
                    <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                      +{formatHoursMinutes(requestedSaldoUsedHours)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-slate-200/60 dark:border-zinc-700/50">
                    <span className="text-slate-500 dark:text-zinc-400">
                      Převedeno z přesčasu tohoto měsíce do konta salda:
                    </span>
                    <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                      +{formatHoursMinutes(requestedOvertimeToSaldoHours)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-slate-200/60 dark:border-zinc-700/50">
                    <span className="font-semibold text-slate-800 dark:text-zinc-200">
                      Výsledný přesčas k proplacení (zůstatek měsíce):
                    </span>
                    <span
                      className={`font-mono font-bold text-sm ${
                        resultingPaidOvertimeHours < 0
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {formatOvertime(resultingPaidOvertimeHours)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span className="font-semibold text-slate-800 dark:text-zinc-200">
                      Výsledné konto salda převedených přesčasů (do dalších měsíců {selectedYearNum}
                      ):
                    </span>
                    <span className="font-mono font-bold text-sm text-indigo-600 dark:text-indigo-400">
                      {formatOvertime(resultingNewSaldoHours)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Potvrzovací modál pro smazání neověřené přítomnosti v 1. kroku */}
      <ConfirmDeleteModal
        isOpen={Boolean(pendingDeleteEntry)}
        title="Smazat neověřenou přítomnost?"
        description={pendingDeleteEntry?.description || ''}
        onClose={() => setPendingDeleteEntry(null)}
        onConfirm={() => {
          if (pendingDeleteEntry) {
            void handleDeleteEntry(pendingDeleteEntry.id);
          }
        }}
      />

      {/* Bod 6: Potvrzovací modál pro vymazání záznamu uzávěrky osoby */}
      <ConfirmDeleteModal
        isOpen={Boolean(pendingDeleteClosure)}
        title="Vymazat záznam uzávěrky?"
        description={
          pendingDeleteClosure
            ? `Záznam měsíční uzávěrky pro ${pendingDeleteClosure.fullName} (${selectedMonthName} ${selectedYearNum}) bude vymazán a osoba se vrátí mezi neuzavřené.`
            : ''
        }
        onClose={() => setPendingDeleteClosure(null)}
        onConfirm={() => {
          void handleDeletePersonClosure();
        }}
      />

      {/* Bod 8: Dialog Automatická uzávěrka */}
      {isAutoCloseModalOpen && overview && (
        <Modal
          isOpen={isAutoCloseModalOpen}
          onClose={() => !isAutoClosing && setIsAutoCloseModalOpen(false)}
          title={`Automatická uzávěrka • ${selectedMonthName} ${selectedYearNum}`}
          subtitle={`Bude provedena pro ${unclosedPeople.length} dosud neuzavřených osob (již uzavřené osoby zůstanou beze změny)`}
          icon={Sparkles}
          size="md"
          footer={
            <div className="flex flex-col gap-2 w-full">
              <Button
                variant="filled"
                colorKey="emerald"
                size="big"
                width="full"
                icon={Sparkles}
                iconClassName="text-white"
                disabled={isAutoClosing}
                onClick={() => void handleConfirmAutoCloseMonth()}
              >
                {isAutoClosing ? 'Provádím uzávěrku…' : 'Automaticky převést přesčasy'}
              </Button>
              <Button
                variant="transparent"
                color="rose"
                size="normal"
                width="full"
                disabled={isAutoClosing}
                onClick={() => setIsAutoCloseModalOpen(false)}
              >
                Zavřít
              </Button>
            </div>
          }
        >
          <div className="space-y-3 text-xs text-slate-600 dark:text-zinc-300">
            <div className="font-bold text-slate-900 dark:text-white text-sm">
              Co provede automatická uzávěrka u neuzavřených osob ({unclosedPeople.length}):
            </div>
            <ul className="list-disc pl-5 space-y-1.5 leading-relaxed">
              <li>
                <strong>1. krok (Neověřené přítomnosti):</strong> Všechny neověřené přítomnosti v
                kanceláři se automaticky označí jako <strong>ověřené</strong>.
              </li>
              <li>
                <strong>2. krok (Doklady absencí):</strong> Všechny propustky u lékaře,
                eNeschopenky a žádosti o OČR v tomto měsíci se automaticky označí jako{' '}
                <strong>ověřené</strong>.
              </li>
              <li>
                <strong>3. krok (Automatický převod přesčasů a salda):</strong> U chybějícího času
                (záporný balance) se z konta salda vezme{' '}
                <strong>pouze doplnění chybějícího času</strong> (pokud nějaké saldo existuje) a
                kladný přesčas do plusu se <strong>celý převede do konta salda</strong>.
              </li>
            </ul>
          </div>
        </Modal>
      )}
    </div>
  );
}

import { useState, useMemo, useEffect, useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  CalendarDays,
  TrendingUp,
  Pencil,
  Trash2,
  History,
  Check,
  X
} from 'lucide-react';
import type { Persona } from '../App';
import { formatHoursMinutes, formatOvertime, type ShiftBlock } from '../types/attendance';
import type { LeaveRequestItem } from './LeaveRequestModal';
import type { DoctorVisitItem } from './DoctorVisitModal';
import type { UnifiedAbsenceRequestItem } from './AbsenceRequestRow';
import { getStatusConfig, type StatusType } from '../config/presenceConfig';
import { PresenceBadge } from './PresenceBadge';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { SECTIONS } from '../config/sectionsConfig';
import { Box, Button, StatPill } from './ui';
import { api, formatRecordEditLog, type TimeEntryDetailDto, type HolidayDto, type RecordEditLogDto } from '../api';

interface MyTimesheetViewProps {
  activePersona: Persona;
  viewerPersona?: Persona;
  isClockedIn?: boolean;
  activeLocation?: 'office' | 'home_office';
  clockInTime?: string;
  workplaceName?: string;
  hoursToday?: number;
  currentShifts?: ShiftBlock[];
  dailyTargetHours?: number;
  myVacationRequests?: LeaveRequestItem[];
  myDoctorVisits?: DoctorVisitItem[];
  embedded?: boolean;
  addToast?: (type: 'success' | 'warning' | 'error', title: string, message: string) => void;
  onEntriesChanged?: () => void;
  onOpenVacationModal?: (req: LeaveRequestItem) => void;
  onOpenDoctorModal?: (doc: DoctorVisitItem) => void;
  onDeleteAbsenceRequest?: (req: UnifiedAbsenceRequestItem) => void;
}

export interface DayLogSegment {
  id: string;
  type: StatusType;
  customLabel?: string;
  startTime?: string; // "HH:mm"
  endTime?: string | null; // "HH:mm" or null if ongoing
  hours: number;
  countsTowardFund: boolean;
  isTimeEntry?: boolean;
  isAllDayAbsence?: boolean;
  isHourlyAbsence?: boolean;
  absenceRequest?: LeaveRequestItem;
  doctorVisit?: DoctorVisitItem;
  editLogs?: RecordEditLogDto[];
}

interface MonthDayRow {
  dayNum: number;
  dateIso: string;
  dateStr: string;
  dayName: string;
  dayShort: string;
  isToday: boolean;
  isPast: boolean;
  isWeekend: boolean;
  isHoliday: boolean;
  holidayName?: string;
  logs: DayLogSegment[];
  firstCheckIn: string;
  lastCheckOut: string;
  recognizedHours: number;
}

const MONTH_NAMES = [
  'Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen',
  'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'
];

const DAY_NAMES_FULL = ['Neděle', 'Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota'];
const DAY_NAMES_SHORT = ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So'];

function parseMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function computeDaySummaryFromLogs(logs: DayLogSegment[]): {
  firstCheckIn: string;
  lastCheckOut: string;
  recognizedHours: number;
} {
  const timedLogs = logs.filter((l) => Boolean(l.startTime));
  let firstCheckIn = '—';
  let lastCheckOut = '—';

  if (timedLogs.length > 0) {
    // Nejnižší čas vyhrává pro první check-in (včetně lékaře či jiné časované absence)
    const sortedByStart = [...timedLogs].sort(
      (a, b) => parseMinutes(a.startTime!) - parseMinutes(b.startTime!)
    );
    firstCheckIn = sortedByStart[0].startTime!;

    // Nejvyšší čas vyhrává pro poslední check-out (nebo probíhající směna)
    if (timedLogs.some((l) => l.endTime === null)) {
      lastCheckOut = 'probíhá';
    } else {
      const withEnd = timedLogs.filter((l) => Boolean(l.endTime));
      if (withEnd.length > 0) {
        const sortedByEnd = [...withEnd].sort((a, b) => {
          const aStart = parseMinutes(a.startTime!);
          const aEndRaw = parseMinutes(a.endTime!);
          const aEnd = aEndRaw < aStart ? aEndRaw + 1440 : aEndRaw;
          const bStart = parseMinutes(b.startTime!);
          const bEndRaw = parseMinutes(b.endTime!);
          const bEnd = bEndRaw < bStart ? bEndRaw + 1440 : bEndRaw;
          return bEnd - aEnd;
        });
        lastCheckOut = sortedByEnd[0].endTime!;
      }
    }
  }

  // Součet všech přítomností a absencí, které započítávají čas do fondu
  const recognizedHours = logs.reduce(
    (sum, l) => (l.countsTowardFund ? sum + l.hours : sum),
    0
  );

  return {
    firstCheckIn,
    lastCheckOut,
    recognizedHours
  };
}

export function MyTimesheetView({
  activePersona,
  viewerPersona,
  isClockedIn = false,
  hoursToday = 0,
  currentShifts = [],
  dailyTargetHours,
  myVacationRequests = [],
  myDoctorVisits = [],
  embedded = false,
  addToast,
  onEntriesChanged,
  onOpenVacationModal,
  onOpenDoctorModal,
  onDeleteAbsenceRequest
}: MyTimesheetViewProps) {
  const now = new Date();
  const todayYear = now.getFullYear();
  const todayMonth = now.getMonth() + 1; // 1–12
  const todayDay = now.getDate();

  const effectiveViewer = viewerPersona || activePersona;
  const canEditTimeEntries =
    effectiveViewer.role === 'admin' || effectiveViewer.role === 'office_manager';

  const [selectedYear, setSelectedYear] = useState<number>(todayYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(todayMonth); // 1–12
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState<boolean>(false);
  const [pickerYear, setPickerYear] = useState<number>(todayYear);
  const pickerRef = useRef<HTMLDivElement | null>(null);

  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});
  const [dbEntries, setDbEntries] = useState<TimeEntryDetailDto[]>([]);
  const [dbHolidays, setDbHolidays] = useState<HolidayDto[]>([]);

  // Inline edit state for time entries (Admin / Officer)
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editStartTime, setEditStartTime] = useState<string>('08:00');
  const [editEndTime, setEditEndTime] = useState<string>('16:30');
  const [editLocationType, setEditLocationType] = useState<'office' | 'home_office'>('office');
  const [isSavingEntry, setIsSavingEntry] = useState<boolean>(false);
  const [openHistoryLogIds, setOpenHistoryLogIds] = useState<Record<string, boolean>>({});
  const [pendingDeleteEntry, setPendingDeleteEntry] = useState<{
    id: string;
    description: string;
  } | null>(null);

  const effectiveDailyTarget = dailyTargetHours ?? activePersona.dailyHours ?? 8.0;

  const handleStartEditEntry = (log: DayLogSegment) => {
    setEditingEntryId(log.id);
    setEditStartTime(log.startTime || '08:00');
    setEditEndTime(log.endTime || '');
    setEditLocationType(log.type === 'home_office' ? 'home_office' : 'office');
  };

  const handleCancelEditEntry = () => {
    setEditingEntryId(null);
  };

  const handleSaveEditEntry = async (entryId: string) => {
    if (!editStartTime) return;
    const origEntry = dbEntries.find((e) => e.id === entryId);
    if (origEntry) {
      const origEnd = origEntry.endTime || '';
      const origLoc = origEntry.locationType === 'office' ? 'office' : 'home_office';
      if (editStartTime === origEntry.startTime && editEndTime === origEnd && editLocationType === origLoc) {
        setEditingEntryId(null);
        return;
      }
    }
    setIsSavingEntry(true);
    try {
      const res = await api.updateTimeEntry(entryId, {
        startTime: editStartTime,
        endTime: editEndTime || undefined,
        locationType: editLocationType,
        editedByUserId: effectiveViewer.id
      });
      if (!res?.error) {
        const refreshed = await api.getMonthlyEntries(activePersona.id, selectedYear, selectedMonth);
        if (refreshed?.data) {
          setDbEntries(refreshed.data);
        }
        setEditingEntryId(null);
        addToast?.(
          'success',
          'Záznam docházky upraven',
          `Změna času (${editStartTime} – ${editEndTime || 'probíhá'}) byla uložena do databáze a zapsána do historie úprav.`
        );
        onEntriesChanged?.();
      } else {
        addToast?.(
          'error',
          'Chyba úpravy záznamu',
          res?.error?.message || 'Nepodařilo se uložit změnu záznamu.'
        );
      }
    } finally {
      setIsSavingEntry(false);
    }
  };

  const handleDeleteEntry = async (entryId: string) => {
    const res = await api.deleteTimeEntry(entryId, effectiveViewer.id);
    if (!res?.error) {
      setDbEntries((prev) => prev.filter((e) => e.id !== entryId));
      if (editingEntryId === entryId) {
        setEditingEntryId(null);
      }
      addToast?.(
        'warning',
        'Záznam docházky smazán',
        'Záznam byl přesunut do koše.'
      );
      onEntriesChanged?.();
    } else {
      addToast?.(
        'error',
        'Chyba při mazání',
        res?.error?.message || 'Nepodařilo se smazat záznam docházky.'
      );
    }
  };

  const toggleHistoryLog = (logId: string) => {
    setOpenHistoryLogIds((prev) => ({
      ...prev,
      [logId]: !prev[logId]
    }));
  };

  // Zavření popupu výběru měsíce při kliknutí mimo
  useEffect(() => {
    if (!isMonthPickerOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setIsMonthPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMonthPickerOpen]);

  // Načtení svátků z databáze pro zvolený rok (včetně plovoucích svátků dle sloupce Rule)
  useEffect(() => {
    let isMounted = true;
    api.getHolidays(selectedYear).then((res) => {
      if (!isMounted) return;
      if (res?.data) {
        setDbHolidays(res.data);
      } else {
        setDbHolidays([]);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [selectedYear]);

  // Načtení reálných časových záznamů z SQLite databáze pro zvolený rok a měsíc
  useEffect(() => {
    let isMounted = true;
    if (!activePersona.id || activePersona.id === 'anonymous') {
      setDbEntries([]);
      return;
    }

    api.getMonthlyEntries(activePersona.id, selectedYear, selectedMonth).then((res) => {
      if (!isMounted) return;
      if (res?.data) {
        setDbEntries(res.data);
      } else {
        setDbEntries([]);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [activePersona.id, selectedYear, selectedMonth, isClockedIn, hoursToday, currentShifts.length]);

  const holidayMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const h of dbHolidays) {
      if (h.date && h.name) {
        map.set(h.date, h.name);
      }
    }
    return map;
  }, [dbHolidays]);

  const toggleDayExpand = (dateIso: string) => {
    setExpandedDays((prev) => ({
      ...prev,
      [dateIso]: !prev[dateIso]
    }));
  };

  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear((y) => y - 1);
    } else {
      setSelectedMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear((y) => y + 1);
    } else {
      setSelectedMonth((m) => m + 1);
    }
  };

  const handleOpenMonthPicker = () => {
    setPickerYear(selectedYear);
    setIsMonthPickerOpen((prev) => !prev);
  };

  const handleSelectMonthFromPopup = (monthNum: number) => {
    setSelectedYear(pickerYear);
    setSelectedMonth(monthNum);
    setIsMonthPickerOpen(false);
  };

  // Měsíční rozpis dnů výhradně z reálných dat v databázi (bez jakýchkoliv mock dat)
  const monthDays = useMemo<MonthDayRow[]>(() => {
    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
    const rows: MonthDayRow[] = [];

    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(selectedYear, selectedMonth - 1, d);
      const dow = dateObj.getDay();
      const mmStr = String(selectedMonth).padStart(2, '0');
      const ddStr = String(d).padStart(2, '0');
      const dateIso = `${selectedYear}-${mmStr}-${ddStr}`;
      const dateStr = `${d}. ${selectedMonth}. ${selectedYear}`;

      const isWeekend = dow === 0 || dow === 6;
      const holidayName = holidayMap.get(dateIso);
      const isHoliday = Boolean(holidayName);
      const isToday =
        selectedYear === todayYear && selectedMonth === todayMonth && d === todayDay;
      const isPast =
        selectedYear < todayYear ||
        (selectedYear === todayYear && selectedMonth < todayMonth) ||
        (selectedYear === todayYear && selectedMonth === todayMonth && d < todayDay);

      const dayLogs: DayLogSegment[] = [];

      // 1. Reálné odpracované směny z databáze (time_entries)
      const entriesForDay = dbEntries.filter((e) => e.date === dateIso);
      if (entriesForDay.length > 0) {
        entriesForDay.forEach((entry) => {
          const isUnverifiedOffice = entry.locationType === 'office' && !entry.workplaceId && !entry.workplaceName;
          dayLogs.push({
            id: entry.id,
            type: entry.locationType,
            customLabel: isUnverifiedOffice ? 'Kancelář (bez ověření)' : undefined,
            startTime: entry.startTime,
            endTime: entry.endTime ?? null,
            hours: entry.hours,
            countsTowardFund: true,
            isTimeEntry: true,
            editLogs: entry.editLogs || []
          });
        });
      } else if (isToday && isClockedIn && currentShifts.some((s) => s.location !== 'doctor' && s.start !== '00:00')) {
        // Pokud právě běží dnešní směna v lokálním stavu před synchronizací (směny přes půlnoc začínající v 00:00 se v kalendáři počítají do předchozího dne)
        const workOnlyShifts = currentShifts.filter((s) => s.location !== 'doctor' && s.start !== '00:00');
        workOnlyShifts.forEach((s, idx) => {
          const startMin = parseMinutes(s.start);
          const endMin = s.end
            ? parseMinutes(s.end)
            : startMin + Math.round((hoursToday / workOnlyShifts.length) * 60);
          const durHours = Math.max(0, +((endMin - startMin) / 60).toFixed(2));
          const isUnverifiedOffice = s.location === 'office' && s.method !== 'nfc';
          dayLogs.push({
            id: s.id || `${dateIso}-shift-${idx}`,
            type: s.location,
            customLabel: isUnverifiedOffice ? 'Kancelář (bez ověření)' : undefined,
            startTime: s.start,
            endTime: s.end,
            hours: durHours,
            countsTowardFund: true,
            isTimeEntry: true
          });
        });
      }

      // 2. Reálné schválené absence z databáze (absence_requests)
      const matchedLeaves = myVacationRequests.filter(
        (req) =>
          !req.isDeleted &&
          req.status === 'approved' &&
          req.startDate <= dateIso &&
          (req.endDate || req.startDate) >= dateIso
      );

      matchedLeaves.forEach((leave) => {
        if (leave.type === 'home_office') {
          // Pokud již existuje odpracovaná směna na Home Office, nevytváříme duplicitní nulový záznam
          if (!dayLogs.some((l) => l.type === 'home_office')) {
            dayLogs.push({
              id: `${dateIso}-ho-${leave.id}`,
              type: 'home_office',
              hours: 0,
              countsTowardFund: false,
              isAllDayAbsence: true,
              absenceRequest: leave,
              editLogs: leave.editLogs || []
            });
          }
        } else if (!isWeekend && !isHoliday) {
          const cfg = getStatusConfig(leave.type);
          dayLogs.push({
            id: `${dateIso}-leave-${leave.id}`,
            type: leave.type as StatusType,
            hours: cfg.countsTowardFund ? effectiveDailyTarget : 0,
            countsTowardFund: cfg.countsTowardFund,
            isAllDayAbsence: true,
            absenceRequest: leave,
            editLogs: leave.editLogs || []
          });
        }
      });

      // 3. Reálné schválené návštěvy lékaře z databáze (absence_requests type='doctor')
      const matchedDoctors = myDoctorVisits.filter(
        (doc) =>
          !doc.isDeleted &&
          doc.status === 'approved' &&
          (doc.date === dateIso || (doc as any).startDate === dateIso)
      );

      matchedDoctors.forEach((doc) => {
        const docStart = doc.startTime || '08:00';
        const docEnd = doc.endTime || '12:00';
        const docHours = Math.max(0, +((parseMinutes(docEnd) - parseMinutes(docStart)) / 60).toFixed(2));
        dayLogs.push({
          id: `${dateIso}-doc-${doc.id}`,
          type: 'doctor',
          startTime: docStart,
          endTime: docEnd,
          hours: docHours,
          countsTowardFund: true,
          isHourlyAbsence: true,
          doctorVisit: doc,
          editLogs: doc.editLogs || []
        });
      });

      // 4. Vždy seřadit subworklogy chronologicky od nejnižšího času (startTime)
      dayLogs.sort((a, b) => {
        const minA = a.startTime ? parseMinutes(a.startTime) : Number.MAX_SAFE_INTEGER;
        const minB = b.startTime ? parseMinutes(b.startTime) : Number.MAX_SAFE_INTEGER;
        if (minA !== minB) {
          return minA - minB;
        }
        const endA = a.endTime ? parseMinutes(a.endTime) : Number.MAX_SAFE_INTEGER;
        const endB = b.endTime ? parseMinutes(b.endTime) : Number.MAX_SAFE_INTEGER;
        return endA - endB;
      });

      const summary = computeDaySummaryFromLogs(dayLogs);

      rows.push({
        dayNum: d,
        dateIso,
        dateStr,
        dayName: DAY_NAMES_FULL[dow],
        dayShort: DAY_NAMES_SHORT[dow],
        isToday,
        isPast,
        isWeekend,
        isHoliday,
        holidayName,
        logs: dayLogs,
        ...summary
      });
    }

    return rows;
  }, [
    selectedYear,
    selectedMonth,
    todayYear,
    todayMonth,
    todayDay,
    effectiveDailyTarget,
    dbEntries,
    currentShifts,
    hoursToday,
    myVacationRequests,
    myDoctorVisits,
    holidayMap
  ]);

  // Souhrnné měsíční metriky dle Pravidla #8 pro ikonové sumáře (StatPill)
  const summary = useMemo(() => {
    const workingDays = monthDays.filter((d) => !d.isWeekend && !d.isHoliday);
    const holidaysOnWeekdays = monthDays.filter((d) => !d.isWeekend && d.isHoliday);

    const monthlyFundHours = +(workingDays.length * effectiveDailyTarget).toFixed(2);
    const workedHoursTotal = +monthDays
      .reduce((sum, d) => sum + d.recognizedHours, 0)
      .toFixed(2);

    const saldoHours =
      workedHoursTotal > monthlyFundHours
        ? +(workedHoursTotal - monthlyFundHours).toFixed(2)
        : 0;

    const vacationDaysCount = monthDays.filter((d) =>
      d.logs.some((l) => l.type === 'vacation')
    ).length;

    const sickDaysCount = monthDays.filter((d) =>
      d.logs.some((l) => l.type === 'sick_day')
    ).length;

    const illnessDaysCount = monthDays.filter((d) =>
      d.logs.some((l) => l.type === 'illness')
    ).length;

    const doctorHoursTotal = +monthDays
      .reduce(
        (sum, d) =>
          sum +
          d.logs
            .filter((l) => l.type === 'doctor')
            .reduce((s, l) => s + l.hours, 0),
        0
      )
      .toFixed(1);

    const homeOfficeCount = monthDays.filter((d) =>
      d.logs.some((l) => l.type === 'home_office')
    ).length;

    const unpaidDaysCount = monthDays.filter((d) =>
      d.logs.some((l) => l.type === 'unpaid_leave')
    ).length;

    return {
      monthlyFundHours,
      workedHoursTotal,
      saldoHours,
      holidaysCount: holidaysOnWeekdays.length,
      vacationDaysCount,
      sickDaysCount,
      illnessDaysCount,
      doctorHoursTotal,
      homeOfficeCount,
      unpaidDaysCount
    };
  }, [monthDays, effectiveDailyTarget]);

  const monthPickerActions = (
    <div
      className={`relative ${embedded ? 'mx-auto' : 'self-start lg:self-auto'}`}
      ref={pickerRef}
    >
      {/* Přepínač měsíců s klikacím názvem měsíce pro otevření popupu */}
      <div className="flex items-center gap-1 bg-slate-100 dark:bg-zinc-800/80 p-1 rounded-2xl">
        <Button
          variant="surface"
          size="icon-sm"
          icon={ChevronLeft}
          onClick={handlePrevMonth}
          title="Předchozí měsíc"
        />
        <button
          type="button"
          onClick={handleOpenMonthPicker}
          className="px-3 py-1 rounded-xl text-xs font-bold text-slate-900 dark:text-white min-w-[104px] text-center hover:bg-white/80 dark:hover:bg-zinc-700/80 transition-colors cursor-pointer select-none"
          title="Kliknutím vyberte rok a měsíc"
        >
          {selectedYear === todayYear
            ? MONTH_NAMES[selectedMonth - 1]
            : `${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`}
        </button>
        <Button
          variant="surface"
          size="icon-sm"
          icon={ChevronRight}
          onClick={handleNextMonth}
          title="Následující měsíc"
        />
      </div>

      {/* Popup s výběrem roku a 4x3 gridem měsíců */}
      {isMonthPickerOpen && (
        <div
          className={`absolute ${
            embedded ? 'left-1/2 -translate-x-1/2' : 'right-0'
          } top-full mt-2 z-50 w-72 p-3 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-xl space-y-3`}
        >
          {/* Přepínač roku (stejný vizuál jako přepínač měsíce nad popupem; neaktualizuje výpis dokud se neklikne na měsíc) */}
          <div className="flex items-center justify-between gap-1 bg-slate-100 dark:bg-zinc-800/80 p-1 rounded-2xl">
            <Button
              variant="surface"
              size="icon-sm"
              icon={ChevronLeft}
              onClick={() => setPickerYear((y) => y - 1)}
              title="Předchozí rok"
            />
            <span className="px-3 text-xs font-bold font-mono text-slate-900 dark:text-white min-w-[80px] text-center">
              {pickerYear}
            </span>
            <Button
              variant="surface"
              size="icon-sm"
              icon={ChevronRight}
              onClick={() => setPickerYear((y) => y + 1)}
              title="Následující rok"
            />
          </div>

          {/* Grid měsíců 4x3 */}
          <div className="grid grid-cols-4 gap-1.5">
            {MONTH_NAMES.map((mName, idx) => {
              const mNum = idx + 1;
              const isSelected =
                selectedYear === pickerYear && selectedMonth === mNum;

              return (
                <Button
                  key={mNum}
                  variant={isSelected ? 'filled' : 'surface'}
                  colorKey={isSelected ? 'primary' : undefined}
                  size="xs"
                  onClick={() => handleSelectMonthFromPopup(mNum)}
                  className="justify-center px-1.5 font-semibold"
                >
                  {mName.slice(0, 3)}
                </Button>
              );
            })}
          </div>

          {/* Shortcut Aktuální (vždy viditelný) */}
          <div className="pt-1 border-t border-slate-100 dark:border-zinc-800">
            <Button
              variant="surface"
              colorKey="primary"
              size="xs"
              fullWidth
              onClick={() => {
                setPickerYear(todayYear);
                setSelectedYear(todayYear);
                setSelectedMonth(todayMonth);
                setIsMonthPickerOpen(false);
              }}
            >
              Aktuální
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  const timesheetContent = (
    <>
      {embedded && (
        <div className="w-full flex flex-row items-center justify-center">
          {monthPickerActions}
        </div>
      )}
      {/* 1. IKONOVÝ SUMÁŘ MĚSÍCE (StatPill pozicované od středu, nulové skryté vyjma fondu, "z kolika" pouze u 1. typu) */}
      <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 py-1">
        <StatPill
          icon={CalendarDays}
          colorKey="emerald"
          value={Math.round(summary.workedHoursTotal * 10) / 10}
          total={Math.round(summary.monthlyFundHours * 10) / 10}
          unit="h"
          label={MONTH_NAMES[selectedMonth - 1].toLowerCase()}
        />

        {Math.abs(summary.saldoHours) >= 0.05 && (
          <StatPill
            icon={TrendingUp}
            colorKey="sky"
            value={formatOvertime(summary.saldoHours)}
            label="Přesčas"
            valueColorClass={
              summary.saldoHours >= 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-amber-600 dark:text-amber-400'
            }
          />
        )}

        {summary.holidaysCount > 0 && (
          <StatPill
            activityType="holiday"
            value={summary.holidaysCount}
            unit="d"
            label="Svátky"
          />
        )}

        {summary.vacationDaysCount > 0 && (
          <StatPill
            activityType="vacation"
            value={summary.vacationDaysCount}
            unit="d"
            label="Dovolená"
          />
        )}

        {summary.sickDaysCount > 0 && (
          <StatPill
            activityType="sick_day"
            value={summary.sickDaysCount}
            unit="d"
            label="Sick day"
          />
        )}

        {summary.illnessDaysCount > 0 && (
          <StatPill
            activityType="illness"
            value={summary.illnessDaysCount}
            unit="d"
            label="Nemoc"
          />
        )}

        {summary.doctorHoursTotal > 0 && (
          <StatPill
            activityType="doctor"
            value={summary.doctorHoursTotal}
            unit="h"
            label="Lékař"
          />
        )}

        {summary.homeOfficeCount > 0 && (
          <StatPill
            activityType="home_office"
            value={summary.homeOfficeCount}
            unit="d"
            label="Home Office"
          />
        )}

        {summary.unpaidDaysCount > 0 && (
          <StatPill
            activityType="unpaid_leave"
            value={summary.unpaidDaysCount}
            unit="d"
            label="Neplacené"
          />
        )}
      </div>

      {/* 2. DENNÍ ROZPIS MĚSÍCE (ČISTÝ MULTI-LOG LAYOUT SE SAFE ZONE PRO ŠIPKU) */}
      <div className="space-y-1.5 pt-1">
        {monthDays.map((d) => {
          const isMultiLog = d.logs.length > 1;
          const hasEditableEntry = canEditTimeEntries && d.logs.some((l) => l.isTimeEntry);
          const hasEditableHourlyAbsence = canEditTimeEntries && d.logs.some((l) => l.isHourlyAbsence);
          const hasEditableAllDayAbsence = canEditTimeEntries && d.logs.some((l) => l.isAllDayAbsence);
          const totalEditLogsCount = d.logs.reduce((sum, l) => sum + (l.editLogs?.length ?? 0), 0);
          const hasEditLogs = totalEditLogsCount > 0;

          const isExpandable =
            isMultiLog ||
            hasEditableEntry ||
            hasEditableHourlyAbsence ||
            hasEditableAllDayAbsence ||
            hasEditLogs;
          const isExpanded = Boolean(expandedDays[d.dateIso]) && isExpandable;

          // Unikátní pills pro hlavní řádek (každý typ aktivity max 1x)
          const uniqueMainRowLogs = d.logs.filter(
            (log, index, self) =>
              index ===
              self.findIndex(
                (t) =>
                  t.type === log.type &&
                  (t.customLabel || '') === (log.customLabel || '')
              )
          );

          return (
            <div
              key={d.dateIso}
              className={`rounded-2xl transition-colors ${
                d.isToday
                  ? 'bg-amber-500/10 dark:bg-amber-500/15'
                  : d.isHoliday
                  ? 'bg-amber-50/70 dark:bg-amber-950/20'
                  : d.isWeekend
                  ? 'opacity-50 bg-slate-50/40 dark:bg-zinc-900/35'
                  : 'bg-slate-50/70 dark:bg-zinc-800/35 hover:bg-slate-100/80 dark:hover:bg-zinc-800/65'
              }`}
            >
              {/* HLAVNÍ ŘÁDEK DNE */}
              <div
                onClick={isExpandable ? () => toggleDayExpand(d.dateIso) : undefined}
                className={`py-2.5 px-3.5 flex items-center justify-between gap-3 ${
                  isExpandable ? 'cursor-pointer select-none' : ''
                }`}
              >
                {/* Vlevo: Kalendářík (ÚT / 6 bez tečky) + unikátní pills hned za datem */}
                <div className="flex items-center gap-3 min-w-0 flex-wrap">
                  <div
                    className={`w-11 h-11 rounded-2xl flex flex-col items-center justify-center flex-shrink-0 text-center ${
                      d.isToday
                        ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                        : d.isHoliday
                        ? 'bg-amber-500/20 text-amber-800 dark:text-amber-300 font-bold'
                        : d.isWeekend
                        ? 'bg-slate-200/60 dark:bg-zinc-800 text-slate-400 dark:text-zinc-500'
                        : 'bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 shadow-2xs'
                    }`}
                  >
                    <span className="text-[10px] uppercase font-bold leading-none">
                      {d.dayShort}
                    </span>
                    <span className="text-sm font-bold font-mono leading-tight mt-0.5">
                      {d.dayNum}
                    </span>
                  </div>

                  {/* Unikátní pills událostí daného dne přímo za dlaždicí data (bez chipu Dnes) */}
                  <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                    {d.isHoliday && (
                      <PresenceBadge
                        type="holiday"
                        customLabel={d.holidayName}
                        size="sm"
                      />
                    )}
                    {!d.isHoliday && d.isWeekend && uniqueMainRowLogs.length === 0 && (
                      <span className="text-xs font-medium text-slate-400 dark:text-zinc-500">
                        Víkend
                      </span>
                    )}
                    {uniqueMainRowLogs.length > 0 ? (
                      uniqueMainRowLogs.map((log) => (
                        <PresenceBadge
                          key={log.id}
                          type={log.type}
                          customLabel={log.customLabel}
                          size="sm"
                        />
                      ))
                    ) : (
                      !d.isHoliday &&
                      !d.isWeekend && (
                        <span className="text-xs font-medium text-slate-400 dark:text-zinc-500">
                          —
                        </span>
                      )
                    )}
                    {/* Indikace úpravy záznamu přímo na hlavním řádku dne */}
                    {hasEditLogs && (
                      <span
                        title="V tomto dni byl upraven záznam"
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-200/80 dark:bg-zinc-700/80 text-slate-600 dark:text-zinc-300 text-[10px] font-mono font-medium"
                      >
                        <History className="w-3 h-3" />
                        <span>{totalEditLogsCount}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Vpravo: První check-in – Poslední check-out + Celkový uznaný čas + Safe zone pro šipku / akce */}
                <div className="flex items-center gap-4 sm:gap-6 flex-shrink-0">
                  {/* První check-in a poslední check-out */}
                  <div className="text-right font-mono text-xs text-slate-600 dark:text-zinc-300 min-w-[96px]">
                    {d.firstCheckIn === '—' && d.lastCheckOut === '—'
                      ? '—'
                      : `${d.firstCheckIn} – ${d.lastCheckOut}`}
                  </div>

                  {/* Celkový uznaný čas ve formátu H + mm (např. 8h 30m) */}
                  <div className="min-w-[68px] text-right">
                    <span
                      className={`text-sm font-bold font-mono ${
                        d.recognizedHours > 0
                          ? 'text-slate-900 dark:text-white'
                          : 'text-slate-400 dark:text-zinc-600'
                      }`}
                    >
                      {d.recognizedHours > 0
                        ? formatHoursMinutes(d.recognizedHours)
                        : '—'}
                    </span>
                  </div>

                  {/* Safe zone napravo: šipka pro rozbalení */}
                  <div className="min-w-[32px] h-8 flex items-center justify-end gap-1 flex-shrink-0">
                    {isExpandable && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        icon={ChevronDown}
                        iconClassName={`transition-transform duration-200 ${
                          isExpanded ? 'rotate-180 text-amber-500' : ''
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleDayExpand(d.dateIso);
                        }}
                        title={isExpanded ? 'Skrýt jednotlivé záznamy' : 'Zobrazit jednotlivé záznamy'}
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* ROZBALENÉ PODZÁZNAMY DNE (vizuálně menší) */}
              {isExpanded && (
                <div className="pb-2.5 pt-0.5 pl-[68px] pr-3.5 space-y-1">
                  {d.logs.map((log) => {
                    const isEditingThis = editingEntryId === log.id;
                    const isDeletedLog = Boolean((log as any).isDeleted || log.absenceRequest?.isDeleted || log.doctorVisit?.isDeleted);
                    const canModifyTimeEntry =
                      !isDeletedLog &&
                      canEditTimeEntries &&
                      Boolean(log.isTimeEntry) &&
                      !log.id.includes('-shift-');
                    const canModifyAbsence =
                      !isDeletedLog &&
                      canEditTimeEntries &&
                      Boolean(log.absenceRequest || log.doctorVisit);
                    const logEditHistory = log.editLogs || [];
                    const isHistoryOpen = Boolean(openHistoryLogIds[log.id]);

                    return (
                      <div
                        key={log.id}
                        className="py-1.5 px-3 rounded-xl bg-white/70 dark:bg-zinc-900/50 space-y-1.5 text-xs"
                      >
                        {isEditingThis ? (
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <select
                                value={editLocationType}
                                onChange={(e) =>
                                  setEditLocationType(
                                    e.target.value === 'home_office' ? 'home_office' : 'office'
                                  )
                                }
                                className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-zinc-800 text-xs font-semibold text-slate-900 dark:text-white border border-slate-200 dark:border-zinc-700"
                              >
                                <option value="office">V kanceláři</option>
                                <option value="home_office">Home Office</option>
                              </select>
                              <input
                                type="time"
                                value={editStartTime}
                                onChange={(e) => setEditStartTime(e.target.value)}
                                className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-zinc-800 text-xs font-mono text-slate-900 dark:text-white border border-slate-200 dark:border-zinc-700"
                              />
                              <span className="text-slate-400">–</span>
                              <input
                                type="time"
                                value={editEndTime}
                                onChange={(e) => setEditEndTime(e.target.value)}
                                className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-zinc-800 text-xs font-mono text-slate-900 dark:text-white border border-slate-200 dark:border-zinc-700"
                              />
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Button
                                variant="filled"
                                colorKey="emerald"
                                size="xs"
                                icon={Check}
                                disabled={isSavingEntry}
                                onClick={() => handleSaveEditEntry(log.id)}
                              >
                                Uložit
                              </Button>
                              <Button
                                variant="outline"
                                colorKey="rose"
                                size="xs"
                                icon={X}
                                disabled={isSavingEntry}
                                onClick={handleCancelEditEntry}
                              >
                                Zrušit
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 min-w-0">
                              <PresenceBadge
                                type={log.type}
                                customLabel={log.customLabel}
                                size="xs"
                              />
                              {logEditHistory.length > 0 && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleHistoryLog(log.id);
                                  }}
                                  title="Zobrazit historii úprav záznamu"
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 text-[10px] font-medium transition-colors cursor-pointer"
                                >
                                  <History className="w-3 h-3" />
                                  <span>{logEditHistory.length}</span>
                                </button>
                              )}
                            </div>

                            <div className="flex items-center gap-4 sm:gap-6 flex-shrink-0">
                              <div className="text-right font-mono text-[11px] text-slate-500 dark:text-zinc-400 min-w-[96px]">
                                {log.startTime
                                  ? `${log.startTime} – ${log.endTime || 'probíhá'}`
                                  : ''}
                              </div>

                              <div className="min-w-[68px] text-right">
                                <span className="text-xs font-semibold font-mono text-slate-700 dark:text-zinc-300">
                                  {formatHoursMinutes(log.hours)}
                                </span>
                              </div>

                              {/* Zarovnávací safe zone pod šipkou / akční tlačítka pro Admin a Officer */}
                              <div className="min-w-[32px] flex items-center justify-end gap-1 flex-shrink-0">
                                {canModifyTimeEntry && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleStartEditEntry(log);
                                      }}
                                      title="Upravit záznam docházky"
                                      className="p-1 rounded-lg hover:bg-slate-200/70 dark:hover:bg-zinc-800 text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors cursor-pointer"
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const label =
                                          log.type === 'home_office' ? 'Home Office' : 'Kancelář';
                                        setPendingDeleteEntry({
                                          id: log.id,
                                          description: `Záznam docházky (${label}) • ${activePersona.name} • ${d.dateStr} (${log.startTime || '--:--'} – ${log.endTime || 'probíhá'})`
                                        });
                                      }}
                                      title="Smazat záznam docházky"
                                      className="p-1 rounded-lg hover:bg-rose-500/15 text-rose-500 hover:text-rose-600 dark:text-rose-400 transition-colors cursor-pointer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                )}
                                {canModifyAbsence && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (log.doctorVisit && onOpenDoctorModal) {
                                          onOpenDoctorModal(log.doctorVisit);
                                        } else if (log.absenceRequest && onOpenVacationModal) {
                                          onOpenVacationModal(log.absenceRequest);
                                        }
                                      }}
                                      title="Upravit absenci (otevřít detail)"
                                      className="p-1 rounded-lg hover:bg-slate-200/70 dark:hover:bg-zinc-800 text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors cursor-pointer"
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    {onDeleteAbsenceRequest && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const target = log.doctorVisit || log.absenceRequest;
                                          if (target) {
                                            onDeleteAbsenceRequest(target);
                                          }
                                        }}
                                        title="Smazat absenci"
                                        className="p-1 rounded-lg hover:bg-rose-500/15 text-rose-500 hover:text-rose-600 dark:text-rose-400 transition-colors cursor-pointer"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        {isHistoryOpen && logEditHistory.length > 0 && (
                          <div className="pt-1 border-t border-slate-200/60 dark:border-zinc-800/80 space-y-0.5 text-[11px] text-slate-500 dark:text-zinc-400 font-mono">
                            {logEditHistory.map((item) => (
                              <div key={item.id}>
                                {formatRecordEditLog(item)}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <ConfirmDeleteModal
        isOpen={Boolean(pendingDeleteEntry)}
        onClose={() => setPendingDeleteEntry(null)}
        onConfirm={() => {
          if (pendingDeleteEntry) {
            handleDeleteEntry(pendingDeleteEntry.id);
          }
        }}
        description={pendingDeleteEntry?.description || ''}
      />
    </>
  );

  if (embedded) {
    return <div className="space-y-6">{timesheetContent}</div>;
  }

  return (
    <Box
      header={{
        icon: SECTIONS.timesheets.icon,
        title: 'Moje výkazy práce',
        subtitle: `Měsíční evidence docházky, odpracovaného fondu a absencí • ${activePersona.name}`,
        actions: monthPickerActions
      }}
      className="space-y-6"
    >
      {timesheetContent}
    </Box>
  );
}

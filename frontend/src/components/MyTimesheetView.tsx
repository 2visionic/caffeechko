import { useState, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Download,
  Clock,
  TrendingUp,
  CalendarCheck,
  Sparkles
} from 'lucide-react';
import type { Persona } from '../App';
import { formatHoursMinutes, formatOvertime, type ShiftBlock } from '../types/attendance';
import type { LeaveRequestItem } from './LeaveRequestModal';
import type { DoctorVisitItem } from './DoctorVisitModal';
import { getStatusConfig, type StatusType } from '../config/presenceConfig';
import { PresenceBadge } from './PresenceBadge';
import { SECTIONS } from '../config/sectionsConfig';
import { Box, Button, SegmentedControl, ContractBadge } from './ui';

interface MyTimesheetViewProps {
  activePersona: Persona;
  isClockedIn?: boolean;
  activeLocation?: 'office' | 'home_office';
  clockInTime?: string;
  workplaceName?: string;
  hoursToday?: number;
  currentShifts?: ShiftBlock[];
  dailyTargetHours?: number;
  myVacationRequests?: LeaveRequestItem[];
  myDoctorVisits?: DoctorVisitItem[];
}

type DayFilterMode = 'workdays' | 'all' | 'absences' | 'home_office';

export interface DayLogSegment {
  id: string;
  type: StatusType;
  customLabel?: string;
  startTime?: string; // "HH:mm"
  endTime?: string | null; // "HH:mm" or null if ongoing
  hours: number;
  countsTowardFund: boolean;
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

const CZECH_HOLIDAYS: Record<string, string> = {
  '01-01': 'Nový rok',
  '05-01': 'Svátek práce',
  '05-08': 'Den vítězství',
  '07-05': 'Den slovanských věrozvěstů Cyrila a Metoděje',
  '07-06': 'Den upálení mistra Jana Husa',
  '09-28': 'Den české státnosti',
  '10-28': 'Státní svátek (28. říjen)',
  '11-17': 'Den boje za svobodu a demokracii',
  '12-24': 'Štědrý den',
  '12-25': '1. svátek vánoční',
  '12-26': '2. svátek vánoční'
};

function parseMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function addMinutesToTime(hhmm: string, totalMinutesToAdd: number): string {
  const total = parseMinutes(hhmm) + Math.round(totalMinutesToAdd);
  const outH = Math.floor(total / 60) % 24;
  const outM = total % 60;
  return `${String(outH).padStart(2, '0')}:${String(outM).padStart(2, '0')}`;
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
        const sortedByEnd = [...withEnd].sort(
          (a, b) => parseMinutes(b.endTime!) - parseMinutes(a.endTime!)
        );
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
  isClockedIn = false,
  activeLocation = 'office',
  clockInTime = '08:00',
  hoursToday = 0,
  currentShifts = [],
  dailyTargetHours,
  myVacationRequests = [],
  myDoctorVisits = []
}: MyTimesheetViewProps) {
  const currentYear = 2026;
  const todayMonth = 10; // Říjen
  const todayDay = 13;

  const [selectedMonth, setSelectedMonth] = useState<number>(todayMonth); // 1–12
  const [filterMode, setFilterMode] = useState<DayFilterMode>('all');
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({
    '2026-10-12': true // Ukázkově rozbalený multi-log den pro okamžitý přehled
  });

  const effectiveDailyTarget = dailyTargetHours ?? activePersona.dailyHours ?? 8.0;
  const scale = effectiveDailyTarget / 8.0;

  const toggleDayExpand = (dateIso: string) => {
    setExpandedDays((prev) => ({
      ...prev,
      [dateIso]: !prev[dateIso]
    }));
  };

  const handlePrevMonth = () => {
    setSelectedMonth((m) => (m === 1 ? 12 : m - 1));
  };

  const handleNextMonth = () => {
    setSelectedMonth((m) => (m === 12 ? 1 : m + 1));
  };

  // Měsíční rozpis dnů s podporou multi-log záznamů (více přítomností a absencí v jednom dni)
  const monthDays = useMemo<MonthDayRow[]>(() => {
    const daysInMonth = new Date(currentYear, selectedMonth, 0).getDate();
    const rows: MonthDayRow[] = [];

    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(currentYear, selectedMonth - 1, d);
      const dow = dateObj.getDay();
      const mmStr = String(selectedMonth).padStart(2, '0');
      const ddStr = String(d).padStart(2, '0');
      const dateIso = `${currentYear}-${mmStr}-${ddStr}`;
      const dateStr = `${d}. ${selectedMonth}. ${currentYear}`;
      const mmdd = `${mmStr}-${ddStr}`;

      const isWeekend = dow === 0 || dow === 6;
      const holidayName = CZECH_HOLIDAYS[mmdd];
      const isHoliday = Boolean(holidayName);
      const isToday = selectedMonth === todayMonth && d === todayDay;
      const isPast =
        selectedMonth < todayMonth || (selectedMonth === todayMonth && d < todayDay);

      // 1. Víkend
      if (isWeekend) {
        rows.push({
          dayNum: d,
          dateIso,
          dateStr,
          dayName: DAY_NAMES_FULL[dow],
          dayShort: DAY_NAMES_SHORT[dow],
          isToday,
          isPast,
          isWeekend: true,
          isHoliday: false,
          logs: [],
          firstCheckIn: '—',
          lastCheckOut: '—',
          recognizedHours: 0
        });
        continue;
      }

      // 2. Státní svátek ve všední den
      if (isHoliday) {
        const holidayLog: DayLogSegment = {
          id: `${dateIso}-holiday`,
          type: 'vacation',
          customLabel: holidayName,
          hours: effectiveDailyTarget,
          countsTowardFund: true
        };
        const summary = computeDaySummaryFromLogs([holidayLog]);
        rows.push({
          dayNum: d,
          dateIso,
          dateStr,
          dayName: DAY_NAMES_FULL[dow],
          dayShort: DAY_NAMES_SHORT[dow],
          isToday,
          isPast,
          isWeekend: false,
          isHoliday: true,
          holidayName,
          logs: [holidayLog],
          ...summary
        });
        continue;
      }

      // 3. Schválená celodenní absence (dovolená, sick day, nemoc, neplacené volno)
      const matchedLeave = myVacationRequests.find(
        (req) =>
          req.status === 'approved' &&
          req.startDate <= dateIso &&
          (req.endDate || req.startDate) >= dateIso
      );

      if (matchedLeave && matchedLeave.type !== 'home_office') {
        const cfg = getStatusConfig(matchedLeave.type);
        const leaveLog: DayLogSegment = {
          id: `${dateIso}-leave-${matchedLeave.id}`,
          type: matchedLeave.type,
          hours: cfg.countsTowardFund ? effectiveDailyTarget : 0,
          countsTowardFund: cfg.countsTowardFund
        };
        const summary = computeDaySummaryFromLogs([leaveLog]);
        rows.push({
          dayNum: d,
          dateIso,
          dateStr,
          dayName: DAY_NAMES_FULL[dow],
          dayShort: DAY_NAMES_SHORT[dow],
          isToday,
          isPast,
          isWeekend: false,
          isHoliday: false,
          logs: [leaveLog],
          ...summary
        });
        continue;
      }

      // 4. Kontrola schváleného lékaře v daný den
      const matchedDoctor = myDoctorVisits.find(
        (doc) =>
          doc.status === 'approved' &&
          (doc.date === dateIso || (doc as any).startDate === dateIso)
      );

      // 5. Dnešní den (živé směny z currentShifts + případný lékař)
      if (isToday) {
        const todayLogs: DayLogSegment[] = [];

        if (currentShifts.length > 0) {
          currentShifts.forEach((s, idx) => {
            const startMin = parseMinutes(s.start);
            const endMin = s.end ? parseMinutes(s.end) : startMin + Math.round((hoursToday / currentShifts.length) * 60);
            const durHours = Math.max(0.25, (endMin - startMin) / 60);
            todayLogs.push({
              id: s.id || `${dateIso}-shift-${idx}`,
              type: s.location,
              startTime: s.start,
              endTime: s.end,
              hours: durHours,
              countsTowardFund: true
            });
          });
        } else {
          const worked = isClockedIn
            ? hoursToday > 0
              ? hoursToday
              : +(effectiveDailyTarget * 0.65).toFixed(2)
            : hoursToday > 0
            ? hoursToday
            : effectiveDailyTarget;
          const endStr = isClockedIn
            ? null
            : addMinutesToTime(clockInTime || '08:00', worked * 60);

          todayLogs.push({
            id: `${dateIso}-today-main`,
            type: isClockedIn ? activeLocation : 'office',
            startTime: clockInTime || '08:00',
            endTime: endStr,
            hours: worked,
            countsTowardFund: true
          });
        }

        if (matchedDoctor) {
          const docStart = matchedDoctor.startTime || '13:00';
          const docEnd = matchedDoctor.endTime || '17:00';
          const docHours = Math.max(0.5, (parseMinutes(docEnd) - parseMinutes(docStart)) / 60);
          todayLogs.push({
            id: `${dateIso}-doc-${matchedDoctor.id}`,
            type: 'doctor',
            startTime: docStart,
            endTime: docEnd,
            hours: docHours,
            countsTowardFund: true
          });
        }

        const summary = computeDaySummaryFromLogs(todayLogs);
        rows.push({
          dayNum: d,
          dateIso,
          dateStr,
          dayName: DAY_NAMES_FULL[dow],
          dayShort: DAY_NAMES_SHORT[dow],
          isToday: true,
          isPast: false,
          isWeekend: false,
          isHoliday: false,
          logs: todayLogs,
          ...summary
        });
        continue;
      }

      // 6. Uplynulé všední dny (včetně multi-log dnů pro rozkliknutí)
      if (isPast) {
        const dayLogs: DayLogSegment[] = [];

        // Den 12. v měsíci (nebo den se schváleným lékařem): ukázkový multi-log
        // 08:00–12:00 V kanceláři (4h 00m), 12:30–13:00 V kanceláři (0h 30m), 13:00–17:00 U lékaře (4h 00m)
        if (d === 12 || matchedDoctor) {
          const h1 = +(4.0 * scale).toFixed(2);
          const h2 = +(0.5 * scale).toFixed(2);
          const docStart = matchedDoctor?.startTime || '13:00';
          const docEnd = matchedDoctor?.endTime || addMinutesToTime(docStart, 4.0 * scale * 60);
          const docDur = Math.max(0.5, (parseMinutes(docEnd) - parseMinutes(docStart)) / 60);

          dayLogs.push(
            {
              id: `${dateIso}-seg-1`,
              type: 'office',
              startTime: '08:00',
              endTime: addMinutesToTime('08:00', h1 * 60),
              hours: h1,
              countsTowardFund: true
            },
            {
              id: `${dateIso}-seg-2`,
              type: 'office',
              startTime: '12:30',
              endTime: addMinutesToTime('12:30', h2 * 60),
              hours: h2,
              countsTowardFund: true
            },
            {
              id: `${dateIso}-seg-3`,
              type: 'doctor',
              startTime: docStart,
              endTime: docEnd,
              hours: docDur,
              countsTowardFund: true
            }
          );
        } else if (d % 4 === 0) {
          // Multi-log: dopolední a odpolední blok s obědovou přestávkou + případný přesun na Home Office
          const morningHours = +(4.0 * scale).toFixed(2);
          const afternoonHours = +(4.5 * scale).toFixed(2);
          const morningEnd = addMinutesToTime('08:00', morningHours * 60);
          const afternoonStart = addMinutesToTime(morningEnd, 30);
          const afternoonEnd = addMinutesToTime(afternoonStart, afternoonHours * 60);

          dayLogs.push(
            {
              id: `${dateIso}-seg-1`,
              type: 'office',
              startTime: '08:00',
              endTime: morningEnd,
              hours: morningHours,
              countsTowardFund: true
            },
            {
              id: `${dateIso}-seg-2`,
              type: d === 8 ? 'home_office' : 'office',
              startTime: afternoonStart,
              endTime: afternoonEnd,
              hours: afternoonHours,
              countsTowardFund: true
            }
          );
        } else {
          // Standardní dvoufázový nebo jednolitý pracovní den
          const isHoDay = matchedLeave?.type === 'home_office' || dow === 2 || dow === 5;
          const startOffsets = ['08:00', '08:15', '07:45', '08:30', '08:00'];
          const startT = startOffsets[d % startOffsets.length];
          const pauseMin = effectiveDailyTarget >= 6 ? 30 : 0;
          const endT = addMinutesToTime(startT, effectiveDailyTarget * 60 + pauseMin);

          dayLogs.push({
            id: `${dateIso}-seg-1`,
            type: isHoDay ? 'home_office' : 'office',
            startTime: startT,
            endTime: endT,
            hours: effectiveDailyTarget,
            countsTowardFund: true
          });
        }

        const summary = computeDaySummaryFromLogs(dayLogs);
        rows.push({
          dayNum: d,
          dateIso,
          dateStr,
          dayName: DAY_NAMES_FULL[dow],
          dayShort: DAY_NAMES_SHORT[dow],
          isToday: false,
          isPast: true,
          isWeekend: false,
          isHoliday: false,
          logs: dayLogs,
          ...summary
        });
        continue;
      }

      // 7. Budoucí všední dny v měsíci
      const futureLogs: DayLogSegment[] =
        matchedLeave?.type === 'home_office'
          ? [
              {
                id: `${dateIso}-planned-ho`,
                type: 'home_office',
                hours: 0,
                countsTowardFund: false
              }
            ]
          : [];

      rows.push({
        dayNum: d,
        dateIso,
        dateStr,
        dayName: DAY_NAMES_FULL[dow],
        dayShort: DAY_NAMES_SHORT[dow],
        isToday: false,
        isPast: false,
        isWeekend: false,
        isHoliday: false,
        logs: futureLogs,
        firstCheckIn: '—',
        lastCheckOut: '—',
        recognizedHours: 0
      });
    }

    return rows;
  }, [
    currentYear,
    selectedMonth,
    effectiveDailyTarget,
    scale,
    myVacationRequests,
    myDoctorVisits,
    isClockedIn,
    activeLocation,
    clockInTime,
    hoursToday,
    currentShifts
  ]);

  // Souhrnné měsíční metriky dle Pravidla #8
  const summary = useMemo(() => {
    const workingDays = monthDays.filter((d) => !d.isWeekend && !d.isHoliday);
    const holidaysOnWeekdays = monthDays.filter((d) => !d.isWeekend && d.isHoliday);

    const monthlyFundHours = +(workingDays.length * effectiveDailyTarget).toFixed(2);
    const elapsedWorkingDays = workingDays.filter((d) => d.isPast || d.isToday);
    const elapsedTargetHours = +(elapsedWorkingDays.length * effectiveDailyTarget).toFixed(2);

    const workedHoursTotal = +monthDays
      .reduce((sum, d) => sum + d.recognizedHours, 0)
      .toFixed(2);

    const referenceTarget =
      selectedMonth < todayMonth
        ? monthlyFundHours
        : selectedMonth > todayMonth
        ? 0
        : elapsedTargetHours;

    const saldoHours = +(workedHoursTotal - referenceTarget).toFixed(2);
    const homeOfficeCount = monthDays.filter(
      (d) => (d.isPast || d.isToday) && d.logs.some((l) => l.type === 'home_office')
    ).length;
    const absenceDaysCount = monthDays.filter((d) =>
      d.logs.some(
        (l) =>
          !d.isHoliday &&
          (l.type === 'vacation' ||
            l.type === 'sick_day' ||
            l.type === 'illness' ||
            l.type === 'unpaid_leave' ||
            l.type === 'doctor')
      )
    ).length;

    const progressPercent =
      monthlyFundHours > 0
        ? Math.min(100, Math.round((workedHoursTotal / monthlyFundHours) * 100))
        : 0;

    return {
      workingDaysCount: workingDays.length,
      holidaysCount: holidaysOnWeekdays.length,
      monthlyFundHours,
      workedHoursTotal,
      saldoHours,
      homeOfficeCount,
      absenceDaysCount,
      progressPercent
    };
  }, [monthDays, effectiveDailyTarget, selectedMonth]);

  // Filtrované dny
  const displayedDays = useMemo(() => {
    return monthDays.filter((d) => {
      if (filterMode === 'workdays') return !d.isWeekend;
      if (filterMode === 'absences') {
        return (
          d.isHoliday ||
          d.logs.some(
            (l) =>
              l.type === 'vacation' ||
              l.type === 'sick_day' ||
              l.type === 'illness' ||
              l.type === 'unpaid_leave' ||
              l.type === 'doctor'
          )
        );
      }
      if (filterMode === 'home_office') {
        return d.logs.some((l) => l.type === 'home_office');
      }
      return true;
    });
  }, [monthDays, filterMode]);

  const handleExportCsv = () => {
    let csv = 'Datum;Den;Prvni prichod;Posledni odchod;Uznany cas;Zaznamy\n';
    monthDays.forEach((d) => {
      const logsText = d.logs
        .map((l) => {
          const cfg = getStatusConfig(l.type);
          const lbl = l.customLabel || cfg.label;
          const tRange = l.startTime ? ` (${l.startTime}-${l.endTime || 'probiha'})` : '';
          return `${lbl}${tRange}: ${formatHoursMinutes(l.hours)}`;
        })
        .join(' | ');
      csv += `${d.dateStr};${d.dayShort};${d.firstCheckIn};${d.lastCheckOut};${formatHoursMinutes(d.recognizedHours)};"${logsText}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `vykaz_${activePersona.name.replace(/\s+/g, '_').toLowerCase()}_${MONTH_NAMES[selectedMonth - 1].toLowerCase()}_${currentYear}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Box
      header={{
        icon: SECTIONS.timesheets.icon,
        title: 'Moje výkazy práce',
        subtitle: `Měsíční evidence docházky, odpracovaného fondu a absencí • ${activePersona.name}`,
        badge: <ContractBadge contract={activePersona.contract || 'HPP'} />,
        actions: (
          <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
            {/* Přepínač měsíců (bez přepínače roku) */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-zinc-800/80 p-1 rounded-2xl">
              <Button
                variant="surface"
                size="icon-sm"
                icon={ChevronLeft}
                onClick={handlePrevMonth}
                title="Předchozí měsíc"
              />
              <span className="px-3 text-xs font-bold text-slate-900 dark:text-white min-w-[96px] text-center">
                {MONTH_NAMES[selectedMonth - 1]}
              </span>
              <Button
                variant="surface"
                size="icon-sm"
                icon={ChevronRight}
                onClick={handleNextMonth}
                title="Následující měsíc"
              />
            </div>

            <Button
              variant="surface"
              size="sm"
              icon={Download}
              onClick={handleExportCsv}
              title="Stáhnout měsíční výkaz ve formátu CSV"
            >
              Export CSV
            </Button>
          </div>
        )
      }}
      className="space-y-6"
    >
      {/* 1. MĚSÍČNÍ SUMARIZACE (4 KPI BLOKY S FORMÁTEM H + mm) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/40">
          <span className="text-[11px] font-mono text-slate-400 dark:text-zinc-500 block uppercase font-semibold">
            Měsíční fond ({MONTH_NAMES[selectedMonth - 1]})
          </span>
          <div className="text-lg sm:text-xl font-bold font-mono text-slate-900 dark:text-white mt-1">
            {formatHoursMinutes(summary.monthlyFundHours)}
          </div>
          <span className="text-[11px] text-slate-500 dark:text-zinc-400 block mt-0.5">
            {summary.workingDaysCount} prac. dní • {formatHoursMinutes(effectiveDailyTarget)}/den
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/40">
          <span className="text-[11px] font-mono text-slate-400 dark:text-zinc-500 block uppercase font-semibold">
            Uznáno celkem
          </span>
          <div className="text-lg sm:text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
            {formatHoursMinutes(summary.workedHoursTotal)}
          </div>
          <span className="text-[11px] text-slate-500 dark:text-zinc-400 block mt-0.5">
            {summary.progressPercent} % měsíčního fondu
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/40">
          <span className="text-[11px] font-mono text-slate-400 dark:text-zinc-500 block uppercase font-semibold">
            Průběžné saldo
          </span>
          <div
            className={`text-lg sm:text-xl font-bold font-mono mt-1 ${
              summary.saldoHours >= 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-amber-600 dark:text-amber-400'
            }`}
          >
            {formatOvertime(summary.saldoHours)}
          </div>
          <span className="text-[11px] text-slate-500 dark:text-zinc-400 flex items-center gap-1 mt-0.5">
            <TrendingUp className="w-3 h-3 text-amber-500" />
            <span>{summary.saldoHours >= 0 ? 'Přesčas / rezerva' : 'K dopracování'}</span>
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/40">
          <span className="text-[11px] font-mono text-slate-400 dark:text-zinc-500 block uppercase font-semibold">
            Režim & Absence
          </span>
          <div className="text-lg sm:text-xl font-bold font-mono text-slate-900 dark:text-white mt-1">
            {summary.homeOfficeCount} d HO • {summary.absenceDaysCount} d Abs.
          </div>
          <span className="text-[11px] text-slate-500 dark:text-zinc-400 flex items-center gap-1 mt-0.5">
            <CalendarCheck className="w-3 h-3 text-sky-500" />
            <span>
              {summary.holidaysCount > 0
                ? `${summary.holidaysCount}× státní svátek v měsíci`
                : 'Bez státních svátků'}
            </span>
          </span>
        </div>
      </div>

      {/* 2. VIZUÁLNÍ UKAZATEL PLNĚNÍ FONDU + FILTR DNŮ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div className="flex-1 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              <span>Plnění fondu pracovní doby ({MONTH_NAMES[selectedMonth - 1]})</span>
            </span>
            <span className="font-mono font-bold text-slate-900 dark:text-white">
              {formatHoursMinutes(summary.workedHoursTotal)} / {formatHoursMinutes(summary.monthlyFundHours)} ({summary.progressPercent} %)
            </span>
          </div>
          <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-zinc-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${summary.progressPercent}%` }}
            />
          </div>
        </div>

        <SegmentedControl
          value={filterMode}
          onChange={(v) => setFilterMode(v as DayFilterMode)}
          size="sm"
          options={[
            { id: 'all', label: `Vše (${monthDays.length})` },
            { id: 'workdays', label: 'Všední dny' },
            { id: 'home_office', label: 'Home Office' },
            { id: 'absences', label: 'Absence & Svátky' }
          ]}
        />
      </div>

      {/* 3. DENNÍ ROZPIS MĚSÍCE (ČISTÝ MULTI-LOG LAYOUT SE SAFE ZONE PRO ŠIPKU) */}
      <div className="space-y-1.5 pt-1">
        {displayedDays.length === 0 ? (
          <div className="py-10 text-center text-xs text-slate-400 dark:text-zinc-500 rounded-2xl bg-slate-50/60 dark:bg-zinc-800/30">
            Pro zvolený filtr nebyly v měsíci {MONTH_NAMES[selectedMonth - 1]} nalezeny žádné záznamy.
          </div>
        ) : (
          displayedDays.map((d) => {
            const isMultiLog = d.logs.length > 1;
            const isExpanded = Boolean(expandedDays[d.dateIso]) && isMultiLog;

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
                  onClick={isMultiLog ? () => toggleDayExpand(d.dateIso) : undefined}
                  className={`py-2.5 px-3.5 flex items-center justify-between gap-3 ${
                    isMultiLog ? 'cursor-pointer select-none' : ''
                  }`}
                >
                  {/* Vlevo: Kalendářík (ÚT / 6 bez tečky) + všechny pills hned za datem */}
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

                    {/* Pills všech událostí daného dne přímo za dlaždicí data */}
                    <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                      {d.isToday && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500 text-slate-950">
                          Dnes
                        </span>
                      )}

                      {d.isHoliday ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300">
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>{d.holidayName}</span>
                        </span>
                      ) : d.isWeekend ? (
                        <span className="text-xs font-medium text-slate-400 dark:text-zinc-500">
                          Víkend
                        </span>
                      ) : d.logs.length > 0 ? (
                        d.logs.map((log) => (
                          <PresenceBadge
                            key={log.id}
                            type={log.type}
                            customLabel={log.customLabel}
                            size="sm"
                          />
                        ))
                      ) : (
                        <span className="text-xs font-medium text-slate-400 dark:text-zinc-500">
                          —
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Vpravo: První check-in – Poslední check-out + Celkový uznaný čas + Safe zone pro šipku */}
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

                    {/* Safe zone napravo (pevných 32x32 px u všech řádků) */}
                    <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
                      {isMultiLog && (
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
                    {d.logs.map((log) => (
                      <div
                        key={log.id}
                        className="py-1.5 px-3 rounded-xl bg-white/70 dark:bg-zinc-900/50 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <PresenceBadge
                            type={log.type}
                            customLabel={log.customLabel}
                            size="xs"
                          />
                        </div>

                        <div className="flex items-center gap-4 sm:gap-6 flex-shrink-0">
                          <div className="text-right font-mono text-[11px] text-slate-500 dark:text-zinc-400 min-w-[96px]">
                            {log.startTime
                              ? `${log.startTime} – ${log.endTime || 'probíhá'}`
                              : 'Celý den'}
                          </div>

                          <div className="min-w-[68px] text-right">
                            <span className="text-xs font-semibold font-mono text-slate-700 dark:text-zinc-300">
                              {formatHoursMinutes(log.hours)}
                            </span>
                          </div>

                          {/* Zarovnávací safe zone pod šipkou */}
                          <div className="w-8 flex-shrink-0" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </Box>
  );
}

import { useState, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Clock,
  TrendingUp,
  CalendarCheck,
  Sparkles
} from 'lucide-react';
import type { Persona } from '../App';
import type { LeaveRequestItem } from './LeaveRequestModal';
import type { DoctorVisitItem } from './DoctorVisitModal';
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
  dailyTargetHours?: number;
  myVacationRequests?: LeaveRequestItem[];
  myDoctorVisits?: DoctorVisitItem[];
}

type DayFilterMode = 'workdays' | 'all' | 'absences' | 'home_office';

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
  type: 'office' | 'home_office' | 'doctor' | 'vacation' | 'sick_day' | 'illness' | 'unpaid_leave' | 'offline';
  typeLabel: string;
  clockIn: string;
  clockOut: string;
  pauseMinutes: number;
  workedHours: number;
  note?: string;
}

const MONTH_NAMES = [
  'Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen',
  'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'
];

const DAY_NAMES_FULL = ['Neděle', 'Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota'];
const DAY_NAMES_SHORT = ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So'];

const CZECH_HOLIDAYS: Record<string, string> = {
  '01-01': 'Nový rok / Den obnovy samostatného českého státu',
  '05-01': 'Svátek práce',
  '05-08': 'Den vítězství',
  '07-05': 'Den slovanských věrozvěstů Cyrila a Metoděje',
  '07-06': 'Den upálení mistra Jana Husa',
  '09-28': 'Den české státnosti',
  '10-28': 'Den vzniku samostatného československého státu',
  '11-17': 'Den boje za svobodu a demokracii',
  '12-24': 'Štědrý den',
  '12-25': '1. svátek vánoční',
  '12-26': '2. svátek vánoční'
};

function addMinutesToTime(hhmm: string, totalMinutesToAdd: number): string {
  const [h, m] = hhmm.split(':').map(Number);
  const total = (h || 8) * 60 + (m || 0) + Math.round(totalMinutesToAdd);
  const outH = Math.floor(total / 60) % 24;
  const outM = total % 60;
  return `${String(outH).padStart(2, '0')}:${String(outM).padStart(2, '0')}`;
}

export function MyTimesheetView({
  activePersona,
  isClockedIn = false,
  activeLocation = 'office',
  clockInTime = '08:00',
  workplaceName = 'Pobočka Praha 1 - Palmovka',
  hoursToday = 0,
  dailyTargetHours,
  myVacationRequests = [],
  myDoctorVisits = []
}: MyTimesheetViewProps) {
  const currentYear = 2026;
  const todayMonth = 10; // Říjen
  const todayDay = 13;

  const [selectedMonth, setSelectedMonth] = useState<number>(todayMonth); // 1–12
  const [filterMode, setFilterMode] = useState<DayFilterMode>('all');

  const effectiveDailyTarget = dailyTargetHours ?? activePersona.dailyHours ?? 8.0;

  const handlePrevMonth = () => {
    setSelectedMonth((m) => (m === 1 ? 12 : m - 1));
  };

  const handleNextMonth = () => {
    setSelectedMonth((m) => (m === 12 ? 1 : m + 1));
  };

  // Kompletní měsíční rozpis dnů propojený s reálnými žádostmi, svátky a dnešní docházkou
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
          type: 'offline',
          typeLabel: 'Víkend',
          clockIn: '—',
          clockOut: '—',
          pauseMinutes: 0,
          workedHours: 0
        });
        continue;
      }

      // 2. Státní svátek ve všední den
      if (isHoliday) {
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
          type: 'vacation',
          typeLabel: 'Státní svátek',
          clockIn: '—',
          clockOut: '—',
          pauseMinutes: 0,
          workedHours: effectiveDailyTarget,
          note: holidayName
        });
        continue;
      }

      // 3. Schválená absence (dovolená, sick day, nemoc, neplacené volno, plánovaný HO)
      const matchedLeave = myVacationRequests.find(
        (req) =>
          req.status === 'approved' &&
          req.startDate <= dateIso &&
          (req.endDate || req.startDate) >= dateIso
      );

      if (matchedLeave && matchedLeave.type !== 'home_office') {
        const countsToFund =
          matchedLeave.type === 'vacation' || matchedLeave.type === 'sick_day';
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
          type: matchedLeave.type,
          typeLabel: matchedLeave.typeName,
          clockIn: '—',
          clockOut: '—',
          pauseMinutes: 0,
          workedHours: countsToFund ? effectiveDailyTarget : 0,
          note: matchedLeave.note || 'Schválená celodenní absence'
        });
        continue;
      }

      // 4. Schválená návštěva lékaře v tento den
      const matchedDoctor = myDoctorVisits.find(
        (doc) =>
          doc.status === 'approved' &&
          (doc.date === dateIso || (doc as any).startDate === dateIso)
      );

      if (matchedDoctor) {
        const pauseMin = effectiveDailyTarget >= 6 ? 30 : 0;
        const shiftEnd = addMinutesToTime('08:00', effectiveDailyTarget * 60 + pauseMin);
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
          type: 'doctor',
          typeLabel: `Lékař (${matchedDoctor.startTime} – ${matchedDoctor.endTime})`,
          clockIn: '08:00',
          clockOut: isToday && isClockedIn ? '— (probíhá)' : shiftEnd,
          pauseMinutes: pauseMin,
          workedHours: effectiveDailyTarget,
          note: matchedDoctor.facilityName
            ? `Ordinace: ${matchedDoctor.facilityName}`
            : matchedDoctor.note || 'Zákonem uznaná překážka v práci'
        });
        continue;
      }

      // 5. Dnešní den (živý stav dle příchodu/odchodu)
      if (isToday) {
        const pauseMin = effectiveDailyTarget >= 6 ? 30 : 0;
        const defaultEnd = addMinutesToTime(clockInTime || '08:00', effectiveDailyTarget * 60 + pauseMin);
        const todayWorked = isClockedIn
          ? hoursToday > 0
            ? hoursToday
            : +(effectiveDailyTarget * 0.65).toFixed(1)
          : hoursToday > 0
          ? hoursToday
          : effectiveDailyTarget;

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
          type: isClockedIn ? activeLocation : 'office',
          typeLabel:
            (isClockedIn ? activeLocation : 'office') === 'home_office'
              ? 'Home Office'
              : 'V kanceláři',
          clockIn: clockInTime || '08:00',
          clockOut: isClockedIn ? '— (probíhá)' : defaultEnd,
          pauseMinutes: pauseMin,
          workedHours: todayWorked,
          note:
            (isClockedIn ? activeLocation : 'office') === 'home_office'
              ? 'Práce na dálku (Home Office)'
              : workplaceName && workplaceName !== 'Mimo práci'
              ? workplaceName
              : 'Pobočka Praha 1 - Palmovka'
        });
        continue;
      }

      // 6. Uplynulé všední dny (odpracované směny)
      if (isPast) {
        const isHoDay =
          matchedLeave?.type === 'home_office' || dow === 2 || dow === 5;
        const startOffsets = ['08:00', '08:15', '07:45', '08:30', '08:00'];
        const startT = startOffsets[d % startOffsets.length];
        const pauseMin = effectiveDailyTarget >= 6 ? 30 : 0;
        const bonusMinutes = d % 5 === 0 ? 30 : d % 7 === 0 ? -15 : 0;
        const dayHours = Math.max(
          0,
          +(effectiveDailyTarget + bonusMinutes / 60).toFixed(1)
        );
        const endT = addMinutesToTime(startT, dayHours * 60 + pauseMin);

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
          type: isHoDay ? 'home_office' : 'office',
          typeLabel: isHoDay ? 'Home Office' : 'V kanceláři',
          clockIn: startT,
          clockOut: endT,
          pauseMinutes: pauseMin,
          workedHours: dayHours,
          note: isHoDay
            ? 'Práce na dálku (Home Office)'
            : 'Pobočka Praha 1 - Palmovka'
        });
        continue;
      }

      // 7. Budoucí všední dny v měsíci (plán směny)
      const isPlannedHo = matchedLeave?.type === 'home_office';
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
        type: isPlannedHo ? 'home_office' : 'offline',
        typeLabel: isPlannedHo ? 'Plánovaný Home Office' : 'Plánovaná směna',
        clockIn: '—',
        clockOut: '—',
        pauseMinutes: 0,
        workedHours: 0,
        note: `Denní úvazek ${effectiveDailyTarget} h`
      });
    }

    return rows;
  }, [
    currentYear,
    selectedMonth,
    effectiveDailyTarget,
    myVacationRequests,
    myDoctorVisits,
    isClockedIn,
    activeLocation,
    clockInTime,
    workplaceName,
    hoursToday
  ]);

  // Souhrnné měsíční metriky dle Pravidla #8 (bez hardcodování)
  const summary = useMemo(() => {
    const workingDays = monthDays.filter((d) => !d.isWeekend && !d.isHoliday);
    const holidaysOnWeekdays = monthDays.filter((d) => !d.isWeekend && d.isHoliday);

    const monthlyFundHours = +(workingDays.length * effectiveDailyTarget).toFixed(1);
    const elapsedWorkingDays = workingDays.filter((d) => d.isPast || d.isToday);
    const elapsedTargetHours = +(elapsedWorkingDays.length * effectiveDailyTarget).toFixed(1);

    const workedHoursTotal = +monthDays
      .reduce((sum, d) => sum + d.workedHours, 0)
      .toFixed(1);

    // Saldo vůči dosud uplynulým pracovním dnům v probíhajícím měsíci (nebo celému měsíci v minulých měsících)
    const referenceTarget =
      selectedMonth < todayMonth
        ? monthlyFundHours
        : selectedMonth > todayMonth
        ? 0
        : elapsedTargetHours;

    const saldoHours = +(workedHoursTotal - referenceTarget).toFixed(1);
    const homeOfficeCount = monthDays.filter((d) => d.type === 'home_office' && (d.isPast || d.isToday)).length;
    const absenceDaysCount = monthDays.filter(
      (d) =>
        d.type === 'vacation' ||
        d.type === 'sick_day' ||
        d.type === 'illness' ||
        d.type === 'unpaid_leave' ||
        d.type === 'doctor'
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

  // Filtrované dny pro zobrazení
  const displayedDays = useMemo(() => {
    return monthDays.filter((d) => {
      if (filterMode === 'workdays') return !d.isWeekend;
      if (filterMode === 'absences') {
        return (
          d.isHoliday ||
          d.type === 'vacation' ||
          d.type === 'sick_day' ||
          d.type === 'illness' ||
          d.type === 'unpaid_leave' ||
          d.type === 'doctor'
        );
      }
      if (filterMode === 'home_office') return d.type === 'home_office';
      return true;
    });
  }, [monthDays, filterMode]);

  const handleExportCsv = () => {
    let csv = 'Datum;Den v tydnu;Stav;Prichod;Odchod;Pauza (min);Odpracovano (h);Poznamka\n';
    monthDays.forEach((d) => {
      csv += `${d.dateStr};${d.dayName};"${d.typeLabel}";${d.clockIn};${d.clockOut};${d.pauseMinutes};${d.workedHours};"${d.note || ''}"\n`;
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
      {/* 1. MĚSÍČNÍ SUMARIZACE (4 KPI BLOKY V TÓNOVÉ ELEVACI) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/40">
          <span className="text-[11px] font-mono text-slate-400 dark:text-zinc-500 block uppercase font-semibold">
            Měsíční fond ({MONTH_NAMES[selectedMonth - 1]})
          </span>
          <div className="text-lg sm:text-xl font-bold font-mono text-slate-900 dark:text-white mt-1">
            {summary.monthlyFundHours} h
          </div>
          <span className="text-[11px] text-slate-500 dark:text-zinc-400 block mt-0.5">
            {summary.workingDaysCount} prac. dní • {effectiveDailyTarget}h/den
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/40">
          <span className="text-[11px] font-mono text-slate-400 dark:text-zinc-500 block uppercase font-semibold">
            Uznáno celkem
          </span>
          <div className="text-lg sm:text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
            {summary.workedHoursTotal.toFixed(1)} h
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
            {summary.saldoHours >= 0
              ? `+${summary.saldoHours.toFixed(1)} h`
              : `${summary.saldoHours.toFixed(1)} h`}
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

      {/* 2. VIZUÁLNÍ UKAZATEL PLNĚNÍ MĚSÍČNÍHO FONDU + FILTR DNŮ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div className="flex-1 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              <span>Plnění fondu pracovní doby ({MONTH_NAMES[selectedMonth - 1]})</span>
            </span>
            <span className="font-mono font-bold text-slate-900 dark:text-white">
              {summary.workedHoursTotal.toFixed(1)} / {summary.monthlyFundHours} h ({summary.progressPercent} %)
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

      {/* 3. DENNÍ ROZPIS CELÉHO MĚSÍCE V JEDNOM BOXU */}
      <div className="space-y-1.5 pt-1">
        {displayedDays.length === 0 ? (
          <div className="py-10 text-center text-xs text-slate-400 dark:text-zinc-500 rounded-2xl bg-slate-50/60 dark:bg-zinc-800/30">
            Pro zvolený filtr nebyly v měsíci {MONTH_NAMES[selectedMonth - 1]} nalezeny žádné záznamy.
          </div>
        ) : (
          displayedDays.map((d) => (
            <div
              key={d.dateIso}
              className={`py-3 px-3.5 rounded-2xl transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                d.isToday
                  ? 'bg-amber-500/10 dark:bg-amber-500/15'
                  : d.isHoliday
                  ? 'bg-amber-50/70 dark:bg-amber-950/20'
                  : d.isWeekend
                  ? 'opacity-55 bg-slate-50/50 dark:bg-zinc-900/40'
                  : 'bg-slate-50/70 dark:bg-zinc-800/35 hover:bg-slate-100/80 dark:hover:bg-zinc-800/65'
              }`}
            >
              {/* Levá část: Kalendářová dlaždice dne + popis */}
              <div className="flex items-center gap-3.5 min-w-0">
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
                    {d.dayNum}.
                  </span>
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                      {d.dayName} {d.dateStr}
                    </span>

                    {d.isToday && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500 text-slate-950">
                        Dnes
                      </span>
                    )}

                    {d.isHoliday ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300">
                        <Sparkles className="w-3 h-3" />
                        <span>{d.typeLabel}</span>
                      </span>
                    ) : !d.isWeekend ? (
                      <PresenceBadge
                        type={d.type}
                        customLabel={d.typeLabel}
                        className="text-[11px] py-0.5 px-2"
                      />
                    ) : (
                      <span className="text-[11px] font-medium text-slate-400 dark:text-zinc-500">
                        Volný den
                      </span>
                    )}
                  </div>

                  {d.note && (
                    <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 truncate">
                      {d.note}
                    </p>
                  )}
                </div>
              </div>

              {/* Pravá část: Čas příchodu/odchodu, přestávka a uznané hodiny */}
              <div className="flex items-center justify-between sm:justify-end gap-5 flex-shrink-0 pt-1 sm:pt-0">
                <div className="text-left sm:text-right text-xs">
                  <div className="font-mono font-medium text-slate-700 dark:text-zinc-300">
                    {d.clockIn === '—' && d.clockOut === '—'
                      ? '—'
                      : `${d.clockIn} – ${d.clockOut}`}
                  </div>
                  {d.pauseMinutes > 0 && (
                    <span className="text-[10px] text-slate-400 dark:text-zinc-500 block">
                      pauza {d.pauseMinutes} min
                    </span>
                  )}
                </div>

                <div className="min-w-[68px] text-right">
                  <span
                    className={`text-sm sm:text-base font-bold font-mono ${
                      d.workedHours > 0
                        ? 'text-slate-900 dark:text-white'
                        : 'text-slate-400 dark:text-zinc-600'
                    }`}
                  >
                    {d.workedHours > 0 ? `${d.workedHours.toFixed(1)} h` : '—'}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </Box>
  );
}

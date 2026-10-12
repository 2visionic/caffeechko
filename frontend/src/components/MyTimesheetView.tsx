import { useState } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  CalendarDays
} from 'lucide-react';
import type { Persona } from '../App';
import { PresenceBadge } from './PresenceBadge';

interface MyTimesheetViewProps {
  activePersona: Persona;
  isClockedIn?: boolean;
  hoursToday?: number;
  onOpenMonthlyModal?: () => void;
}

interface WeekDayItem {
  dayName: string;
  dateStr: string;
  isToday: boolean;
  isWeekend: boolean;
  isHoliday: boolean;
  type: 'office' | 'home_office' | 'doctor' | 'vacation' | 'sick_day' | 'weekend' | 'holiday';
  typeLabel: string;
  clockIn: string;
  clockOut: string;
  pauseMinutes: number;
  workedHours: number;
  note?: string;
}

export function MyTimesheetView({
  activePersona,
  isClockedIn = false,
  hoursToday = 8.0,
  onOpenMonthlyModal
}: MyTimesheetViewProps) {
  // Navigation states: year, month, week
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [selectedMonth, setSelectedMonth] = useState<number>(10); // 1-12 (Říjen = 10)
  const [selectedWeek, setSelectedWeek] = useState<number>(42); // Týden 42 (12. 10. - 18. 10. 2026)

  const monthNames = [
    'Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen',
    'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'
  ];

  // Ukázková data pro aktuální týden 42 (12. 10. – 18. 10. 2026)
  const weekDays: WeekDayItem[] = [
    {
      dayName: 'Pondělí',
      dateStr: '12. 10. 2026',
      isToday: true,
      isWeekend: false,
      isHoliday: false,
      type: isClockedIn ? 'office' : 'office',
      typeLabel: 'V kanceláři',
      clockIn: '08:15',
      clockOut: isClockedIn ? '— (probíhá)' : '16:45',
      pauseMinutes: 30,
      workedHours: isClockedIn ? hoursToday : 8.0,
      note: 'Běžná směna v kanceláři'
    },
    {
      dayName: 'Úterý',
      dateStr: '13. 10. 2026',
      isToday: false,
      isWeekend: false,
      isHoliday: false,
      type: 'home_office',
      typeLabel: 'Home Office',
      clockIn: '08:00',
      clockOut: '16:30',
      pauseMinutes: 30,
      workedHours: 8.0,
      note: 'Práce na dálku'
    },
    {
      dayName: 'Středa',
      dateStr: '14. 10. 2026',
      isToday: false,
      isWeekend: false,
      isHoliday: false,
      type: 'office',
      typeLabel: 'V kanceláři',
      clockIn: '08:30',
      clockOut: '17:00',
      pauseMinutes: 30,
      workedHours: 8.0,
      note: 'Porada týmu & klientská schůzka'
    },
    {
      dayName: 'Čtvrtek',
      dateStr: '15. 10. 2026',
      isToday: false,
      isWeekend: false,
      isHoliday: false,
      type: 'doctor',
      typeLabel: 'Návštěva lékaře (09:00 – 12:00)',
      clockIn: '08:00',
      clockOut: '16:30',
      pauseMinutes: 30,
      workedHours: 8.0,
      note: 'Uznaná propustka k lékaři (3h)'
    },
    {
      dayName: 'Pátek',
      dateStr: '16. 10. 2026',
      isToday: false,
      isWeekend: false,
      isHoliday: false,
      type: 'home_office',
      typeLabel: 'Home Office',
      clockIn: '08:00',
      clockOut: '15:30',
      pauseMinutes: 30,
      workedHours: 7.0,
      note: 'Páteční zkrácená směna'
    },
    {
      dayName: 'Sobota',
      dateStr: '17. 10. 2026',
      isToday: false,
      isWeekend: true,
      isHoliday: false,
      type: 'weekend',
      typeLabel: 'Víkend',
      clockIn: '—',
      clockOut: '—',
      pauseMinutes: 0,
      workedHours: 0
    },
    {
      dayName: 'Neděle',
      dateStr: '18. 10. 2026',
      isToday: false,
      isWeekend: true,
      isHoliday: false,
      type: 'weekend',
      typeLabel: 'Víkend',
      clockIn: '—',
      clockOut: '—',
      pauseMinutes: 0,
      workedHours: 0
    }
  ];

  const totalWeeklyHours = weekDays.reduce((sum, d) => sum + d.workedHours, 0);
  const weeklyFund = activePersona.contract === 'OSVČ' ? 40.0 : 40.0;
  const weeklySaldo = totalWeeklyHours - weeklyFund;

  return (
    <div className="space-y-6">
      {/* 1. HLAVIČKA VÝKAZŮ & PŘEPÍNAČE OBDOBÍ */}
      <section className="bg-white dark:bg-zinc-900 rounded-3xl p-6 sm:p-8 shadow-sm transition-colors space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-amber-500/10 dark:bg-amber-400/15 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
                <CalendarDays className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  Moje výkazy práce
                </h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  Týdenní a měsíční rozpis docházky pro uživatele <strong className="font-semibold text-slate-800 dark:text-zinc-200">{activePersona.name}</strong> ({activePersona.contract})
                </p>
              </div>
            </div>
          </div>

          {/* OVLÁDÁNÍ: ROK / MĚSÍC / TÝDEN */}
          <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
            {/* Výběr roku */}
            <div className="flex items-center p-1 bg-slate-100 dark:bg-zinc-800 rounded-2xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => setSelectedYear(selectedYear - 1)}
                className="p-1.5 hover:bg-white dark:hover:bg-zinc-700 rounded-xl transition-colors"
                title="Předchozí rok"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="px-2 font-mono">{selectedYear}</span>
              <button
                type="button"
                onClick={() => setSelectedYear(selectedYear + 1)}
                className="p-1.5 hover:bg-white dark:hover:bg-zinc-700 rounded-xl transition-colors"
                title="Následující rok"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Výběr měsíce */}
            <div className="flex items-center p-1 bg-slate-100 dark:bg-zinc-800 rounded-2xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => setSelectedMonth(Math.max(1, selectedMonth - 1))}
                className="p-1.5 hover:bg-white dark:hover:bg-zinc-700 rounded-xl transition-colors"
                title="Předchozí měsíc"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="px-2">{monthNames[selectedMonth - 1]}</span>
              <button
                type="button"
                onClick={() => setSelectedMonth(Math.min(12, selectedMonth + 1))}
                className="p-1.5 hover:bg-white dark:hover:bg-zinc-700 rounded-xl transition-colors"
                title="Následující měsíc"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Přepínač týdne */}
            <div className="flex items-center p-1 bg-amber-500/10 dark:bg-amber-400/15 text-amber-900 dark:text-amber-300 rounded-2xl text-xs font-bold">
              <button
                type="button"
                onClick={() => setSelectedWeek(Math.max(1, selectedWeek - 1))}
                className="p-1.5 hover:bg-amber-500/20 rounded-xl transition-colors"
                title="Předchozí týden"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="px-2 font-mono">Týden {selectedWeek}</span>
              <button
                type="button"
                onClick={() => setSelectedWeek(Math.min(52, selectedWeek + 1))}
                className="p-1.5 hover:bg-amber-500/20 rounded-xl transition-colors"
                title="Následující týden"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Tlačítko Celý měsíc (pokud předáno) */}
            {onOpenMonthlyModal && (
              <button
                type="button"
                onClick={onOpenMonthlyModal}
                className="px-3 py-2 rounded-2xl bg-slate-100 hover:bg-slate-200/80 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 text-xs font-semibold flex items-center gap-1.5 transition-all"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Měsíční detail</span>
              </button>
            )}
          </div>
        </div>

        {/* 2. SUMARIZACE TÝDNE (4 KPI KARTY) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          <div className="p-4 rounded-2xl bg-slate-100/70 dark:bg-zinc-800/60">
            <span className="text-[11px] font-mono text-slate-500 dark:text-zinc-400 block uppercase">
              Týdenní fond
            </span>
            <div className="text-lg sm:text-xl font-bold font-mono text-slate-900 dark:text-white mt-1">
              {weeklyFund.toFixed(1)} h
            </div>
            <span className="text-[11px] text-slate-400 dark:text-zinc-500">
              5 pracovních dní
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-100/70 dark:bg-zinc-800/60">
            <span className="text-[11px] font-mono text-slate-500 dark:text-zinc-400 block uppercase">
              Odpracováno
            </span>
            <div className="text-lg sm:text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
              {totalWeeklyHours.toFixed(1)} h
            </div>
            <span className="text-[11px] text-slate-400 dark:text-zinc-500">
              {((totalWeeklyHours / weeklyFund) * 100).toFixed(0)} % týdenního fondu
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-100/70 dark:bg-zinc-800/60">
            <span className="text-[11px] font-mono text-slate-500 dark:text-zinc-400 block uppercase">
              Saldo týdne
            </span>
            <div
              className={`text-lg sm:text-xl font-bold font-mono mt-1 ${
                weeklySaldo >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-amber-600 dark:text-amber-400'
              }`}
            >
              {weeklySaldo >= 0 ? `+${weeklySaldo.toFixed(1)} h` : `${weeklySaldo.toFixed(1)} h`}
            </div>
            <span className="text-[11px] text-slate-400 dark:text-zinc-500">
              {weeklySaldo >= 0 ? 'Přesčas / rezerva' : 'Zbývá dopracovat'}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-100/70 dark:bg-zinc-800/60">
            <span className="text-[11px] font-mono text-slate-500 dark:text-zinc-400 block uppercase">
              Stav výkazu
            </span>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-300 mt-2 px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-950/60">
              <Clock className="w-3.5 h-3.5" />
              <span>Probíhající týden</span>
            </div>
          </div>
        </div>
      </section>

      {/* 3. TÝDENNÍ ROZPIS (7 DNÍ: PONDĚLÍ – NEDĚLE) */}
      <section className="bg-white dark:bg-zinc-900 rounded-3xl p-6 sm:p-8 shadow-sm transition-colors space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider font-mono">
            Rozpis jednotlivých dní (Týden {selectedWeek})
          </h3>
          <span className="text-xs text-slate-400 dark:text-zinc-500">
            Pondělí 12. 10. – Neděle 18. 10. 2026
          </span>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-zinc-800/60">
          {weekDays.map((d, idx) => {
            return (
              <div
                key={idx}
                className={`py-3.5 px-3 rounded-2xl transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  d.isToday
                    ? 'bg-amber-50/70 dark:bg-amber-950/20'
                    : d.isWeekend
                    ? 'opacity-60 bg-slate-50/40 dark:bg-zinc-900/40'
                    : 'hover:bg-slate-50 dark:hover:bg-zinc-800/40'
                }`}
              >
                {/* Den, datum a stavový chip */}
                <div className="flex items-center gap-3.5 min-w-0">
                  <div
                    className={`w-11 h-11 rounded-2xl flex flex-col items-center justify-center flex-shrink-0 text-center ${
                      d.isToday
                        ? 'bg-amber-500 text-white font-bold shadow-sm'
                        : d.isWeekend
                        ? 'bg-slate-100 dark:bg-zinc-800 text-slate-400 dark:text-zinc-500'
                        : 'bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200'
                    }`}
                  >
                    <span className="text-[10px] uppercase font-bold leading-none">
                      {d.dayName.slice(0, 2)}
                    </span>
                    <span className="text-sm font-bold leading-tight mt-0.5">
                      {d.dateStr.split('.')[0]}
                    </span>
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-slate-900 dark:text-white">
                        {d.dayName} {d.dateStr}
                      </span>
                      {d.isToday && (
                        <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-amber-500 text-white">
                          Dnes
                        </span>
                      )}
                      <PresenceBadge
                        type={d.type}
                        customLabel={d.typeLabel}
                        className="text-[11px] py-0.5 px-2"
                      />
                    </div>
                    {d.note && (
                      <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5 truncate">
                        {d.note}
                      </p>
                    )}
                  </div>
                </div>

                {/* Čas příchodu/odchodu, pauza a odpracované hodiny */}
                <div className="flex items-center justify-between sm:justify-end gap-5 flex-shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-zinc-800/60">
                  <div className="text-left sm:text-right text-xs">
                    <div className="font-mono font-medium text-slate-700 dark:text-zinc-300">
                      {d.clockIn} – {d.clockOut}
                    </div>
                    {d.pauseMinutes > 0 && (
                      <span className="text-[10px] text-slate-400 dark:text-zinc-500">
                        pauza {d.pauseMinutes} min
                      </span>
                    )}
                  </div>

                  <div className="min-w-[70px] text-right">
                    <span className="text-base font-bold font-mono text-slate-900 dark:text-white">
                      {d.workedHours > 0 ? `${d.workedHours.toFixed(1)} h` : '—'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

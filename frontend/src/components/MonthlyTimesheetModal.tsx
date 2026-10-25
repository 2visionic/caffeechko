import { useState, useEffect, useMemo } from 'react';
import { Calendar, Download } from 'lucide-react';
import { Modal, Button, ContractBadge } from './ui';
import { formatHoursMinutes, formatOvertime } from '../types/attendance';
import { api, type TimeEntryDetailDto, type HolidayDto } from '../api';
import { getStatusConfig } from '../config/presenceConfig';

interface RawAbsenceRequestDto {
  id: string;
  type: string;
  typeName?: string;
  startDate: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  hours?: number;
  status: string;
  isDeleted?: boolean;
}

interface MonthlyTimesheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: string;
  userName: string;
  userRole: string;
  contract: 'HPP' | 'OSVČ';
  dailyHours?: number;
  fundHours?: number;
  year?: number;
  monthIndex0?: number;
}

interface TimesheetDay {
  dayNum: number;
  dateFormatted: string;
  dayName: string;
  isWeekend: boolean;
  isHoliday: boolean;
  clockIn: string;
  clockOut: string;
  hours: number;
  type: string;
}

const MONTH_NAMES_CS = [
  'Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen',
  'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'
];

export function MonthlyTimesheetModal({
  isOpen,
  onClose,
  userId,
  userName,
  userRole,
  contract,
  dailyHours = 8,
  fundHours,
  year,
  monthIndex0
}: MonthlyTimesheetModalProps) {
  const now = new Date();
  const effectiveYear = year ?? now.getFullYear();
  const effectiveMonthIndex0 = monthIndex0 ?? now.getMonth();
  const effectiveMonthNum = effectiveMonthIndex0 + 1;

  const [dbEntries, setDbEntries] = useState<TimeEntryDetailDto[]>([]);
  const [dbHolidays, setDbHolidays] = useState<HolidayDto[]>([]);
  const [dbRequests, setDbRequests] = useState<RawAbsenceRequestDto[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;

    api.getHolidays(effectiveYear).then((res) => {
      if (!isMounted) return;
      setDbHolidays(res?.data || []);
    });

    if (userId && userId !== 'anonymous') {
      Promise.all([
        api.getMonthlyEntries(userId, effectiveYear, effectiveMonthNum),
        api.getMyRequests(userId)
      ]).then(([entriesRes, reqRes]) => {
        if (!isMounted) return;
        setDbEntries(entriesRes?.data || []);
        setDbRequests(Array.isArray(reqRes?.data) ? reqRes.data : (reqRes?.data?.requests || []));
      });
    } else {
      setDbEntries([]);
      setDbRequests([]);
    }

    return () => {
      isMounted = false;
    };
  }, [isOpen, userId, effectiveYear, effectiveMonthNum]);

  const holidayMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const h of dbHolidays) {
      if (h.date && h.name) {
        map.set(h.date, h.name);
      }
    }
    return map;
  }, [dbHolidays]);

  const effectiveDailyHours = dailyHours ?? 8;
  const daysInMonth = new Date(effectiveYear, effectiveMonthNum, 0).getDate();

  const { days, workingDaysCount, deductedAbsenceHours, vacationDaysCount, doctorHoursTotal } = useMemo(() => {
    const dayNames = ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So'];
    const mm = String(effectiveMonthNum).padStart(2, '0');
    const approvedRequests = dbRequests.filter((r) => !r.isDeleted && r.status === 'approved');

    let workDays = 0;
    let deductedHours = 0;
    let vacDays = 0;
    let docHours = 0;

    const list: TimesheetDay[] = Array.from({ length: daysInMonth }, (_, i) => {
      const dayNum = i + 1;
      const dd = String(dayNum).padStart(2, '0');
      const dateIso = `${effectiveYear}-${mm}-${dd}`;
      const dateFormatted = `${dayNum}. ${effectiveMonthNum}. ${effectiveYear}`;
      const dateObj = new Date(effectiveYear, effectiveMonthIndex0, dayNum);
      const dayIndex = dateObj.getDay();
      const isWeekend = dayIndex === 0 || dayIndex === 6;
      const holidayName = holidayMap.get(dateIso);
      const isHoliday = Boolean(holidayName);

      if (!isWeekend && !isHoliday) {
        workDays++;
      }

      const entriesForDay = dbEntries.filter((e) => e.date === dateIso);
      const matchedRequests = approvedRequests.filter(
        (r) => r.startDate <= dateIso && (r.endDate || r.startDate) >= dateIso
      );

      let clockIn = '—';
      let clockOut = '—';
      let hours = 0;
      let dayDeducted = 0;
      const labels: string[] = [];

      if (entriesForDay.length > 0) {
        const sortedByStart = [...entriesForDay].sort((a, b) => a.startTime.localeCompare(b.startTime));
        clockIn = sortedByStart[0].startTime;
        if (entriesForDay.some((e) => !e.endTime)) {
          clockOut = 'probíhá';
        } else {
          const sortedByEnd = [...entriesForDay].sort((a, b) => (b.endTime || '').localeCompare(a.endTime || ''));
          clockOut = sortedByEnd[0].endTime || '—';
        }
        hours += entriesForDay.reduce((sum, e) => sum + e.hours, 0);
        labels.push('Pracovní směna');
      }

      for (const req of matchedRequests) {
        const cfg = getStatusConfig(req.type);
        const resolvedLabel = req.typeName || cfg.label;
        if (req.type === 'doctor' || (req.hours && req.hours > 0)) {
          const rHours = req.hours || 0;
          docHours += rHours;
          if (!isWeekend && !isHoliday && cfg.countsTowardFund) {
            dayDeducted += rHours;
          }
          if (clockIn === '—' && req.startTime) clockIn = req.startTime;
          if (clockOut === '—' && req.endTime) clockOut = req.endTime;
          labels.push(`${resolvedLabel} (${formatHoursMinutes(rHours)})`);
        } else if (req.type === 'home_office') {
          if (!labels.some((l) => l === resolvedLabel || l.includes('Home Office'))) {
            labels.push(resolvedLabel);
          }
        } else if (!isWeekend && !isHoliday) {
          if (req.type === 'vacation') vacDays++;
          if (cfg.countsTowardFund) {
            dayDeducted += effectiveDailyHours;
          }
          labels.push(resolvedLabel);
        }
      }

      if (!isWeekend && !isHoliday && dayDeducted > 0) {
        deductedHours += Math.min(effectiveDailyHours, dayDeducted);
      }

      const type = isHoliday
        ? `Státní svátek (${holidayName})`
        : isWeekend && labels.length === 0
        ? 'Víkend'
        : labels.length > 0
        ? labels.join(' + ')
        : 'Pracovní den (bez záznamu)';

      return {
        dayNum,
        dateFormatted,
        dayName: dayNames[dayIndex],
        isWeekend,
        isHoliday,
        clockIn,
        clockOut,
        hours: +hours.toFixed(2),
        type
      };
    });

    return {
      days: list,
      workingDaysCount: workDays,
      deductedAbsenceHours: +deductedHours.toFixed(1),
      vacationDaysCount: vacDays,
      doctorHoursTotal: +docHours.toFixed(1)
    };
  }, [daysInMonth, effectiveYear, effectiveMonthIndex0, effectiveMonthNum, holidayMap, dbEntries, dbRequests, effectiveDailyHours]);

  if (!isOpen) return null;

  const plannedFundHours = fundHours ?? Math.max(0, +(workingDaysCount * effectiveDailyHours - deductedAbsenceHours).toFixed(1));
  const totalWorkedHours = +days.reduce((acc, d) => acc + d.hours, 0).toFixed(1);
  const saldoHours = +(totalWorkedHours - plannedFundHours).toFixed(1);
  const monthLabel = `${MONTH_NAMES_CS[effectiveMonthIndex0]} ${effectiveYear}`;

  const handleExportCsv = () => {
    let csv = 'Den;Datum;Den v tydnu;Prichod;Odchod;Hodiny;Typ\n';
    days.forEach((d) => {
      csv += `${d.dayNum};${d.dateFormatted};${d.dayName};${d.clockIn};${d.clockOut};${d.hours};"${d.type}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `dochazka_${userName.replace(/\s+/g, '_')}_${effectiveYear}_${String(effectiveMonthNum).padStart(2, '0')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={monthLabel}
      subtitle={
        <div className="flex items-center gap-1.5">
          <span>Měsíční docházkový list • {userName} ({userRole})</span>
          <ContractBadge contract={contract} />
        </div>
      }
      icon={Calendar}
      iconBgClass="bg-amber-500/10 text-amber-600 dark:text-amber-400"
      size="3xl"
      footer={
        <>
          <Button
            variant="surface"
            size="normal"
            width="full"
            icon={Download}
            onClick={handleExportCsv}
          >
            Export CSV (PAMICA / VEMA / Helios)
          </Button>
          <Button
            variant="transparent"
            color="rose"
            size="normal"
            width="full"
            onClick={onClose}
          >
            Zavřít
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Monthly Balance Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs flex-shrink-0">
          <div className="p-3 rounded-2xl bg-slate-100/70 dark:bg-zinc-800/60">
            <span className="text-[10px] uppercase font-mono text-slate-400 font-bold block">Pracovní fond</span>
            <span className="text-base font-bold font-mono text-slate-900 dark:text-white">{formatHoursMinutes(plannedFundHours)}</span>
            <span className="text-[10px] text-slate-500 block">{workingDaysCount} prac. dní</span>
          </div>

          <div className="p-3 rounded-2xl bg-slate-100/70 dark:bg-zinc-800/60">
            <span className="text-[10px] uppercase font-mono text-slate-400 font-bold block">Uznáno celkem</span>
            <span className="text-base font-bold font-mono text-emerald-600 dark:text-emerald-400">{formatHoursMinutes(totalWorkedHours)}</span>
            <span className="text-[10px] text-slate-500 block">Práce + Svátky + Abs.</span>
          </div>

          <div className="p-3 rounded-2xl bg-amber-500/10">
            <span className="text-[10px] uppercase font-mono text-amber-900 dark:text-amber-300 font-bold block">Saldo měsíce</span>
            <span className="text-base font-bold font-mono text-amber-700 dark:text-amber-400">
              {formatOvertime(saldoHours)}
            </span>
            <span className="text-[10px] text-amber-800/80 dark:text-amber-400 block">Převod do dalšího měsíce</span>
          </div>

          <div className="p-3 rounded-2xl bg-sky-500/10 dark:bg-sky-950/30">
            <span className="text-[10px] uppercase font-mono text-sky-900 dark:text-sky-300 font-bold block">Absence / Lékař</span>
            <span className="text-base font-bold font-mono text-sky-700 dark:text-sky-400">
              {vacationDaysCount} dnů Dov. / {formatHoursMinutes(doctorHoursTotal)} Lék.
            </span>
            <span className="text-[10px] text-sky-800/80 dark:text-sky-400 block">Plně kryto náhradou</span>
          </div>
        </div>

        {/* Scrollable Days Table */}
        <div className="overflow-y-auto max-h-[45vh] rounded-2xl bg-slate-50/50 dark:bg-zinc-800/30">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-mono text-[11px] border-b border-slate-200/40 dark:border-zinc-700/60">
              <tr>
                <th className="py-2.5 px-3">Datum</th>
                <th className="py-2.5 px-3">Den</th>
                <th className="py-2.5 px-3">Příchod</th>
                <th className="py-2.5 px-3">Odchod</th>
                <th className="py-2.5 px-3">Hodiny</th>
                <th className="py-2.5 px-3">Druh evidence / Popis</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/80 font-mono">
              {days.map((d) => (
                <tr
                  key={d.dayNum}
                  className={`hover:bg-slate-50 dark:hover:bg-zinc-800/50 ${
                    d.isWeekend
                      ? 'bg-slate-50/50 dark:bg-zinc-900/40 text-slate-400 dark:text-zinc-600'
                      : d.isHoliday
                      ? 'bg-amber-500/10 text-amber-900 dark:text-amber-300 font-semibold'
                      : d.type.includes('Dovolená')
                      ? 'bg-amber-50/40 dark:bg-amber-950/20 text-amber-800 dark:text-amber-400'
                      : d.type.includes('Lékař')
                      ? 'bg-sky-50/40 dark:bg-sky-950/20 text-sky-800 dark:text-sky-400'
                      : 'text-slate-800 dark:text-zinc-200'
                  }`}
                >
                  <td className="py-2 px-3 font-semibold font-sans">{d.dateFormatted}</td>
                  <td className="py-2 px-3">{d.dayName}</td>
                  <td className="py-2 px-3">{d.clockIn}</td>
                  <td className="py-2 px-3">{d.clockOut}</td>
                  <td className="py-2 px-3 font-bold">{d.hours > 0 ? formatHoursMinutes(d.hours) : '—'}</td>
                  <td className="py-2 px-3 font-sans text-xs">
                    {d.type}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
}


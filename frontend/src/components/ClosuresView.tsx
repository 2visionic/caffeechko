import { useState, useMemo, useEffect } from 'react';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Download,
  Check,
  Eye,
  TrendingUp,
  Users
} from 'lucide-react';
import type { Persona } from '../App';
import { RoleBadge } from './RoleBadge';
import { SECTIONS } from '../config/sectionsConfig';
import { Box, Button, Input, UserAvatar, StatusBadge, ContractBadge } from './ui';
import { formatHoursMinutes, formatOvertime } from '../types/attendance';
import { api, type HolidayDto } from '../api';

export type ClosureStatus = 'approved' | 'pending' | 'draft';

export interface PersonaClosureData {
  persona: Persona;
  monthlyFundHours: number;
  workedHours: number;
  saldoHours: number;
  vacationDaysTaken: number;
  doctorHoursTaken: number;
  sickDaysTaken: number;
  status: ClosureStatus;
  statusLabel: string;
  approvedBy?: string;
  approvedAt?: string;
  submittedAt?: string;
}

interface ClosuresViewProps {
  personasList: Persona[];
  activePersona: Persona;
  baseDailyHours?: number;
  onOpenMonthlyDetail?: (persona: Persona, year?: number, monthIndex0?: number) => void;
}

const MONTH_NAMES_CS = [
  'Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen',
  'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'
];

function countWorkingDaysInMonth(year: number, monthIndex0: number, holidayDatesSet: Set<string>): number {
  const daysInMonth = new Date(year, monthIndex0 + 1, 0).getDate();
  let count = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(year, monthIndex0, d);
    const dow = dt.getDay();
    if (dow !== 0 && dow !== 6) {
      const dateIso = `${year}-${String(monthIndex0 + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      if (!holidayDatesSet.has(dateIso)) {
        count++;
      }
    }
  }
  return count;
}

function countOverlapWorkingDays(
  startIso: string,
  endIso: string,
  year: number,
  monthIndex0: number,
  holidayDatesSet: Set<string>
): number {
  const daysInMonth = new Date(year, monthIndex0 + 1, 0).getDate();
  const mm = String(monthIndex0 + 1).padStart(2, '0');
  let count = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const dateIso = `${year}-${mm}-${String(d).padStart(2, '0')}`;
    if (dateIso >= startIso && dateIso <= endIso) {
      const dow = new Date(year, monthIndex0, d).getDay();
      if (dow !== 0 && dow !== 6 && !holidayDatesSet.has(dateIso)) {
        count++;
      }
    }
  }
  return count;
}

interface RealPersonClosureMetrics {
  workedHours: number;
  fundHours: number;
  vacationDaysTaken: number;
  doctorHoursTaken: number;
  sickDaysTaken: number;
}

export function ClosuresView({
  personasList,
  activePersona,
  baseDailyHours = 8,
  onOpenMonthlyDetail
}: ClosuresViewProps) {
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth()); // 0-indexed
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<ClosureStatus | 'all'>('all');
  const [approvedMap, setApprovedMap] = useState<Record<string, string>>({});
  const [dbHolidays, setDbHolidays] = useState<HolidayDto[]>([]);
  const [realMetricsMap, setRealMetricsMap] = useState<Record<string, RealPersonClosureMetrics>>({});

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

  // Navigace v měsících
  const handlePrevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear((y) => y - 1);
    } else {
      setSelectedMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear((y) => y + 1);
    } else {
      setSelectedMonth((m) => m + 1);
    }
  };

  const getSurname = (fullName: string): string => {
    const parts = (fullName || '').trim().split(' ').filter(Boolean);
    return parts.length > 1 ? parts[parts.length - 1] : fullName;
  };

  const holidayDatesSet = useMemo(() => {
    return new Set(dbHolidays.map((h) => h.date));
  }, [dbHolidays]);

  const workingDaysInMonth = useMemo(
    () => countWorkingDaysInMonth(selectedYear, selectedMonth, holidayDatesSet),
    [selectedYear, selectedMonth, holidayDatesSet]
  );

  // Načtení reálných měsíčních souhrnů a schválených absencí z databáze pro každou osobu
  useEffect(() => {
    let isMounted = true;
    const monthNum = selectedMonth + 1;
    const mm = String(monthNum).padStart(2, '0');
    const daysInMonth = new Date(selectedYear, monthNum, 0).getDate();
    const monthStartIso = `${selectedYear}-${mm}-01`;
    const monthEndIso = `${selectedYear}-${mm}-${String(daysInMonth).padStart(2, '0')}`;

    Promise.all(
      personasList.map(async (p) => {
        const [summaryRes, reqRes] = await Promise.all([
          api.getMonthSummary(p.id, selectedYear, monthNum),
          api.getMyRequests(p.id)
        ]);
        const personaDailyHours =
          p.dailyHours ?? (p.fteCoefficient ? p.fteCoefficient * baseDailyHours : baseDailyHours);
        const fallbackFund = +(workingDaysInMonth * personaDailyHours).toFixed(1);

        let vacationDaysTaken = 0;
        let doctorHoursTaken = 0;
        let sickDaysTaken = 0;

        const rawRequests = Array.isArray(reqRes?.data) ? reqRes.data : (reqRes?.data?.requests || []);
        const approvedRequests = rawRequests.filter((r: any) => r.status === 'approved');
        for (const req of approvedRequests) {
          const rStart = req.startDate;
          const rEnd = req.endDate || req.startDate;
          if (rEnd < monthStartIso || rStart > monthEndIso) continue;

          if (req.type === 'vacation') {
            vacationDaysTaken += countOverlapWorkingDays(rStart, rEnd, selectedYear, selectedMonth, holidayDatesSet);
          } else if (req.type === 'sick_day') {
            sickDaysTaken += countOverlapWorkingDays(rStart, rEnd, selectedYear, selectedMonth, holidayDatesSet);
          } else if (req.type === 'doctor' || (req.hours && req.hours > 0)) {
            if (rStart >= monthStartIso && rStart <= monthEndIso) {
              doctorHoursTaken += req.hours || 0;
            }
          }
        }

        return [
          p.id,
          {
            workedHours: summaryRes?.data ? +summaryRes.data.hoursWorked.toFixed(1) : 0,
            fundHours: summaryRes?.data ? +summaryRes.data.fundHours.toFixed(1) : fallbackFund,
            vacationDaysTaken,
            doctorHoursTaken: +doctorHoursTaken.toFixed(1),
            sickDaysTaken
          }
        ] as const;
      })
    ).then((entries) => {
      if (!isMounted) return;
      setRealMetricsMap(Object.fromEntries(entries));
    });

    return () => {
      isMounted = false;
    };
  }, [personasList, selectedYear, selectedMonth, holidayDatesSet, workingDaysInMonth, baseDailyHours]);

  const closuresData = useMemo<PersonaClosureData[]>(() => {
    return personasList.map((p) => {
      const personaDailyHours = p.dailyHours ?? (p.fteCoefficient ? p.fteCoefficient * baseDailyHours : baseDailyHours);
      const fallbackFund = +(workingDaysInMonth * personaDailyHours).toFixed(1);
      const metrics = realMetricsMap[p.id];

      const monthlyFundHours = metrics ? metrics.fundHours : fallbackFund;
      const workedHours = metrics ? metrics.workedHours : 0;
      const vacationDaysTaken = metrics ? metrics.vacationDaysTaken : 0;
      const doctorHoursTaken = metrics ? metrics.doctorHoursTaken : 0;
      const sickDaysTaken = metrics ? metrics.sickDaysTaken : 0;

      const approvalKey = `${p.id}-${selectedYear}-${selectedMonth}`;
      const approvedAtStr = approvedMap[approvalKey];

      let status: ClosureStatus = 'draft';
      let statusLabel = 'Rozpracováno';
      let approvedBy: string | undefined = undefined;
      let approvedAt: string | undefined = undefined;

      if (approvedAtStr) {
        status = 'approved';
        statusLabel = 'Schváleno';
        approvedBy = activePersona.name;
        approvedAt = approvedAtStr;
      } else if (workedHours > 0 || vacationDaysTaken > 0 || doctorHoursTaken > 0 || sickDaysTaken > 0) {
        status = 'pending';
        statusLabel = 'Ke schválení';
      }

      const saldoHours = +(workedHours - monthlyFundHours).toFixed(1);

      return {
        persona: p,
        monthlyFundHours,
        workedHours,
        saldoHours,
        vacationDaysTaken,
        doctorHoursTaken,
        sickDaysTaken,
        status,
        statusLabel,
        approvedBy,
        approvedAt
      };
    });
  }, [personasList, realMetricsMap, approvedMap, activePersona.name, workingDaysInMonth, baseDailyHours, selectedYear, selectedMonth]);

  const filtered = useMemo(() => {
    return closuresData.filter((item) => {
      const q = searchQuery.toLowerCase().trim();
      if (q) {
        const p = item.persona;
        const match =
          p.name.toLowerCase().includes(q) ||
          p.roleLabel.toLowerCase().includes(q) ||
          p.contract.toLowerCase().includes(q);
        if (!match) return false;
      }

      if (filterStatus !== 'all' && item.status !== filterStatus) {
        return false;
      }

      return true;
    });
  }, [closuresData, searchQuery, filterStatus]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const sA = getSurname(a.persona.name);
      const sB = getSurname(b.persona.name);
      return sA.localeCompare(sB, 'cs', { sensitivity: 'base' });
    });
  }, [filtered]);

  const stats = useMemo(() => {
    const totalCount = closuresData.length;
    const approvedCount = closuresData.filter((c) => c.status === 'approved').length;
    const pendingCount = closuresData.filter((c) => c.status === 'pending').length;
    const draftCount = closuresData.filter((c) => c.status === 'draft').length;
    const totalWorked = closuresData.reduce((acc, c) => acc + c.workedHours, 0);
    const totalFund = closuresData.reduce((acc, c) => acc + c.monthlyFundHours, 0);
    const totalSaldo = +(totalWorked - totalFund).toFixed(1);

    return {
      totalCount,
      approvedCount,
      pendingCount,
      draftCount,
      totalWorked: +totalWorked.toFixed(1),
      totalFund: +totalFund.toFixed(1),
      totalSaldo
    };
  }, [closuresData]);

  const handleApprove = (personaId: string) => {
    const approvalKey = `${personaId}-${selectedYear}-${selectedMonth}`;
    const nowTime = new Date().toLocaleString('cs-CZ', {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    setApprovedMap((prev) => ({ ...prev, [approvalKey]: nowTime }));
  };

  return (
    <div className="space-y-6">
      {/* 1. HLAVIČKA UZÁVĚREK & VOLIČ OBDOBÍ */}
      <Box
        header={{
          icon: SECTIONS.closures.icon,
          title: 'Uzávěrky',
          subtitle: 'Přehled odpracovaných fondů, přesčasů a schvalování docházky pro mzdové podklady',
          actions: (
            <div className="flex items-center gap-2 self-start md:self-auto bg-slate-100 dark:bg-zinc-800/80 p-1.5 rounded-2xl">
              <Button
                variant="surface"
                size="icon-sm"
                icon={ChevronLeft}
                onClick={handlePrevMonth}
                title="Předchozí měsíc"
              />

              <div className="px-4 py-1 text-center min-w-[140px]">
                <span className="text-xs font-bold text-slate-900 dark:text-white block">
                  {MONTH_NAMES_CS[selectedMonth]} {selectedYear}
                </span>
                <span className="text-[10px] font-mono text-slate-400 dark:text-zinc-500 uppercase">
                  Zúčtovací období
                </span>
              </div>

              <Button
                variant="surface"
                size="icon-sm"
                icon={ChevronRight}
                onClick={handleNextMonth}
                title="Následující měsíc"
              />
            </div>
          )
        }}
        className="space-y-4"
      >
        {/* Souhrnné statistiky období */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-800/40">
            <span className="text-[10px] uppercase font-mono text-slate-400 dark:text-zinc-500 block font-semibold">
              Osob v uzávěrce
            </span>
            <div className="text-xl font-bold font-mono text-slate-900 dark:text-white mt-1">
              {stats.totalCount}
            </div>
            <div className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              {stats.approvedCount} schváleno • {stats.pendingCount} čeká
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-800/40">
            <span className="text-[10px] uppercase font-mono text-slate-400 dark:text-zinc-500 block font-semibold">
              Pracovní fond
            </span>
            <div className="text-xl font-bold font-mono text-slate-900 dark:text-white mt-1">
              {formatHoursMinutes(stats.totalFund)}
            </div>
            <div className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              Základní plánovaný fond
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-800/40">
            <span className="text-[10px] uppercase font-mono text-slate-400 dark:text-zinc-500 block font-semibold">
              Uznáno celkem
            </span>
            <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
              {formatHoursMinutes(stats.totalWorked)}
            </div>
            <div className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              Včetně svátků a náhrad
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-800/40">
            <span className="text-[10px] uppercase font-mono text-slate-400 dark:text-zinc-500 block font-semibold">
              Celkové saldo (přesčasy)
            </span>
            <div
              className={`text-xl font-bold font-mono mt-1 ${
                stats.totalSaldo >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {formatOvertime(stats.totalSaldo)}
            </div>
            <div className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 text-amber-500" />
              <span>Převod do dalšího měsíce</span>
            </div>
          </div>
        </div>
      </Box>

      {/* 2. VYHLEDÁVÁNÍ, FILTRY & EXPORT */}
      <Box className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="w-full md:max-w-md">
            <Input
              icon={Search}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filtrovat jméno, roli či úvazek..."
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-zinc-800 rounded-xl text-xs">
              <button
                type="button"
                onClick={() => setFilterStatus('all')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                  filterStatus === 'all'
                    ? 'bg-white dark:bg-zinc-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-zinc-700/60'
                }`}
              >
                Vše ({closuresData.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('approved')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                  filterStatus === 'approved'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-500/10 dark:hover:bg-emerald-950/40'
                }`}
              >
                Schváleno ({stats.approvedCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('pending')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                  filterStatus === 'pending'
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-500/10 dark:hover:bg-amber-950/40'
                }`}
              >
                Ke schválení ({stats.pendingCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('draft')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                  filterStatus === 'draft'
                    ? 'bg-white dark:bg-zinc-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-zinc-700/60'
                }`}
              >
                Rozpracováno ({stats.draftCount})
              </button>
            </div>

            <Button
              variant="default"
              size="sm"
              icon={Download}
              onClick={() => alert(`Export podkladů pro mzdy za ${MONTH_NAMES_CS[selectedMonth]} ${selectedYear} do formátu XLSX připraven.`)}
              title="Stáhnout kompletní export pro mzdové účetnictví"
            >
              Export mezd
            </Button>
          </div>
        </div>
      </Box>

      {/* 3. SEZNAM OSOB A JEJICH UZÁVĚREK */}
      <Box
        header={{
          icon: Users,
          title: `Seznam osob v uzávěrce (${sorted.length})`,
          subtitle: 'Řazeno abecedně dle příjmení'
        }}
        className="space-y-4"
      >
        {sorted.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-slate-50 dark:bg-zinc-800/40 text-slate-500 dark:text-zinc-400 text-xs">
            Žádná osoba neodpovídá zvolenému filtru.
          </div>
        ) : (
          <div className="space-y-3">
            {sorted.map((item) => {
              const p = item.persona;
              const isPending = item.status === 'pending';

              return (
                <div
                  key={p.id}
                  className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-zinc-800/40 hover:bg-slate-100/70 dark:hover:bg-zinc-800/70 transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  {/* Levý sloupec: Avatar, Jméno, RoleBadge, Úvazek */}
                  <div className="flex items-center gap-3.5 min-w-0">
                    <UserAvatar name={p.name} size="md" />

                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-slate-900 dark:text-white truncate">
                          {p.name}
                        </span>
                        <RoleBadge role={p.role} roleLabel={p.roleLabel} />
                        <ContractBadge contract={p.contract} />
                      </div>
                      <div className="text-xs text-slate-500 dark:text-zinc-400 truncate">
                        {p.email} • Fond: {formatHoursMinutes(item.monthlyFundHours)} (úvazek)
                      </div>
                    </div>
                  </div>

                  {/* Střední sloupec: Uznáno, Saldo, Absence */}
                  <div className="grid grid-cols-3 gap-3 text-center sm:text-left min-w-[280px]">
                    <div className="space-y-0.5">
                      <span className="text-[10px] uppercase font-mono text-slate-400 dark:text-zinc-500 block">
                        Odpracováno
                      </span>
                      <span className="text-sm font-bold font-mono text-slate-900 dark:text-white">
                        {formatHoursMinutes(item.workedHours)}
                      </span>
                    </div>

                    <div className="space-y-0.5">
                      <span className="text-[10px] uppercase font-mono text-slate-400 dark:text-zinc-500 block">
                        Saldo měsíce
                      </span>
                      <span
                        className={`text-sm font-bold font-mono ${
                          item.saldoHours > 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : item.saldoHours < 0
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-slate-600 dark:text-zinc-400'
                        }`}
                      >
                        {formatOvertime(item.saldoHours)}
                      </span>
                    </div>

                    <div className="space-y-0.5">
                      <span className="text-[10px] uppercase font-mono text-slate-400 dark:text-zinc-500 block">
                        Absence
                      </span>
                      <div className="text-xs text-slate-700 dark:text-zinc-300 font-medium truncate">
                        {item.vacationDaysTaken > 0 && `${item.vacationDaysTaken} d. dov.`}
                        {item.vacationDaysTaken > 0 && item.doctorHoursTaken > 0 && ', '}
                        {item.doctorHoursTaken > 0 && `${formatHoursMinutes(item.doctorHoursTaken)} lék.`}
                        {item.sickDaysTaken > 0 && `${item.sickDaysTaken} d. sick.`}
                        {!item.vacationDaysTaken && !item.doctorHoursTaken && !item.sickDaysTaken && '0'}
                      </div>
                    </div>
                  </div>

                  {/* Pravý sloupec: Status badge & Akce (Detail / Schválit) */}
                  <div className="flex items-center justify-between lg:justify-end gap-3 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-200/60 dark:border-zinc-700/60">
                    <div className="flex flex-col items-start lg:items-end">
                      <StatusBadge status={item.status} customLabel={item.statusLabel} />
                      {item.approvedAt && (
                        <span className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1">
                          {item.approvedBy} ({item.approvedAt})
                        </span>
                      )}
                      {item.submittedAt && !item.approvedAt && (
                        <span className="text-[10px] text-amber-700 dark:text-amber-400 mt-1 font-medium">
                          Odesláno: {item.submittedAt}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="surface"
                        size="sm"
                        icon={Eye}
                        onClick={() => onOpenMonthlyDetail && onOpenMonthlyDetail(p, selectedYear, selectedMonth)}
                        title={`Otevřít kompletní měsíční výkaz pro ${p.name}`}
                      >
                        Detail
                      </Button>

                      {isPending && (
                        <Button
                          variant="filled"
                          colorKey="emerald"
                          size="sm"
                          icon={Check}
                          onClick={() => handleApprove(p.id)}
                          title={`Schválit měsíční uzávěrku pro ${p.name}`}
                        >
                          Schválit
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Box>
    </div>
  );
}

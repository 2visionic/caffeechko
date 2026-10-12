import { useState, useMemo } from 'react';
import {
  ClipboardCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
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
import { Box } from './ui';

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
  onOpenMonthlyDetail?: (persona: Persona) => void;
}

const MONTH_NAMES_CS = [
  'Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen',
  'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'
];

export function ClosuresView({
  personasList,
  activePersona,
  onOpenMonthlyDetail
}: ClosuresViewProps) {
  // Aktuálně zvolený měsíc a rok (default: Říjen 2026)
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [selectedMonth, setSelectedMonth] = useState<number>(9); // 0-indexed: 9 = Říjen
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<ClosureStatus | 'all'>('all');
  const [approvedMap, setApprovedMap] = useState<Record<string, boolean>>({});

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

  // Pomocná funkce pro extrakci příjmení pro řazení
  const getSurname = (fullName: string): string => {
    const parts = (fullName || '').trim().split(' ').filter(Boolean);
    return parts.length > 1 ? parts[parts.length - 1] : fullName;
  };

  // Generování realistických dat uzávěrek pro každou osobu v systému
  const closuresData = useMemo<PersonaClosureData[]>(() => {
    return personasList.map((p, idx) => {
      // Simulace různých stavů pro pestrý a realistický přehled
      const monthlyFundHours = p.contract === 'OSVČ' ? 160 : 168; // 21 pracovních dní * 8h

      let workedHours = 168;
      let status: ClosureStatus = 'draft';
      let statusLabel = 'Rozpracováno';
      let vacationDaysTaken = 0;
      let doctorHoursTaken = 0;
      let sickDaysTaken = 0;
      let approvedBy: string | undefined = undefined;
      let approvedAt: string | undefined = undefined;
      let submittedAt: string | undefined = undefined;

      if (idx === 0) {
        // Správce / Jan Novotný
        workedHours = 174.5;
        vacationDaysTaken = 1;
        doctorHoursTaken = 0;
        status = 'approved';
        statusLabel = 'Schváleno';
        approvedBy = 'Vedení společnosti';
        approvedAt = '10. 10. 2026 16:30';
      } else if (idx === 1) {
        // Manažer David Sýkora
        workedHours = 168.0;
        vacationDaysTaken = 2;
        status = 'approved';
        statusLabel = 'Schváleno';
        approvedBy = 'Jan Novotný';
        approvedAt = '09. 10. 2026 14:15';
      } else if (idx === 2) {
        // Team Lead Martin Dvořák
        workedHours = 172.0;
        doctorHoursTaken = 3.5;
        status = 'pending';
        statusLabel = 'Ke schválení';
        submittedAt = '11. 10. 2026 09:00';
      } else if (idx === 3) {
        // Tereza Černá
        workedHours = 165.5;
        sickDaysTaken = 1;
        status = 'pending';
        statusLabel = 'Ke schválení';
        submittedAt = '11. 10. 2026 10:45';
      } else if (idx === 4) {
        // Michal Horák
        workedHours = 158.0;
        vacationDaysTaken = 3;
        status = 'draft';
        statusLabel = 'Rozpracováno';
      } else {
        // Ostatní
        workedHours = 166.0 + (idx % 8);
        status = idx % 2 === 0 ? 'approved' : 'draft';
        statusLabel = status === 'approved' ? 'Schváleno' : 'Rozpracováno';
      }

      // Pokud byla uzávěrka v UI schválena
      if (approvedMap[p.id]) {
        status = 'approved';
        statusLabel = 'Schváleno';
        approvedBy = activePersona.name;
        approvedAt = 'Právě teď';
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
        approvedAt,
        submittedAt
      };
    });
  }, [personasList, approvedMap, activePersona.name]);

  // Filtrování
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

  // Řazení defaultně abecedně dle příjmení
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const sA = getSurname(a.persona.name);
      const sB = getSurname(b.persona.name);
      return sA.localeCompare(sB, 'cs', { sensitivity: 'base' });
    });
  }, [filtered]);

  // Souhrnné statistiky
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
      totalFund,
      totalSaldo
    };
  }, [closuresData]);

  const handleApprove = (personaId: string) => {
    setApprovedMap((prev) => ({ ...prev, [personaId]: true }));
  };

  const getStatusBadge = (status: ClosureStatus, label: string) => {
    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>{label}</span>
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300">
            <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>{label}</span>
          </span>
        );
      case 'draft':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300">
            <Clock className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400" />
            <span>{label}</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. HLAVIČKA UZÁVĚREK & VOLIČ OBDOBÍ */}
      <Box
        header={{
          icon: ClipboardCheck,
          title: 'Měsíční uzávěrky',
          subtitle: 'Přehled odpracovaných fondů, přesčasů a schvalování docházky pro mzdové podklady',
          actions: (
            <div className="flex items-center gap-2 self-start md:self-auto bg-slate-100 dark:bg-zinc-800/80 p-1.5 rounded-2xl">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-2 rounded-xl bg-white dark:bg-zinc-700 hover:bg-slate-200 dark:hover:bg-zinc-600 text-slate-700 dark:text-zinc-200 transition-colors shadow-xs"
                title="Předchozí měsíc"
                aria-label="Předchozí měsíc"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="px-4 py-1.5 text-center min-w-[140px]">
                <span className="text-xs font-bold text-slate-900 dark:text-white block">
                  {MONTH_NAMES_CS[selectedMonth]} {selectedYear}
                </span>
                <span className="text-[10px] font-mono text-slate-400 dark:text-zinc-500 uppercase">
                  Zúčtovací období
                </span>
              </div>

              <button
                type="button"
                onClick={handleNextMonth}
                className="p-2 rounded-xl bg-white dark:bg-zinc-700 hover:bg-slate-200 dark:hover:bg-zinc-600 text-slate-700 dark:text-zinc-200 transition-colors shadow-xs"
                title="Následující měsíc"
                aria-label="Následující měsíc"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )
        }}
        className="space-y-6"
      >

        {/* 2. SOUHRNNÉ KPI KARTY */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Zaměstnanci celkem */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/50 space-y-1">
            <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">
              Celkem osob
            </span>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {stats.totalCount}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-zinc-400">
              Aktivních úvazků v období
            </div>
          </div>

          {/* Schválené uzávěrky */}
          <div className="p-4 rounded-2xl bg-emerald-500/10 dark:bg-emerald-950/20 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-emerald-800 dark:text-emerald-300">
                Schváleno
              </span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-emerald-900 dark:text-emerald-200">
              {stats.approvedCount} <span className="text-sm font-normal text-emerald-700 dark:text-emerald-400">/ {stats.totalCount}</span>
            </div>
            <div className="text-[11px] text-emerald-700 dark:text-emerald-400">
              Připraveno ke mzdovému exportu
            </div>
          </div>

          {/* Ke schválení */}
          <div className="p-4 rounded-2xl bg-amber-500/10 dark:bg-amber-950/20 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-amber-900 dark:text-amber-300">
                Ke schválení
              </span>
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-amber-900 dark:text-amber-200">
              {stats.pendingCount}
            </div>
            <div className="text-[11px] text-amber-800 dark:text-amber-400">
              Čeká na kontrolu vedoucího
            </div>
          </div>

          {/* Celkový fond a saldo */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/50 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">
                Odpracováno / Saldo
              </span>
              <TrendingUp className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {stats.totalWorked} h
            </div>
            <div className="text-[11px] font-semibold text-slate-600 dark:text-zinc-300 flex items-center gap-1.5">
              <span>Fond: {stats.totalFund} h</span>
              <span className={stats.totalSaldo >= 0 ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-rose-600 dark:text-rose-400 font-bold'}>
                ({stats.totalSaldo >= 0 ? `+${stats.totalSaldo}` : stats.totalSaldo} h)
              </span>
            </div>
          </div>
        </div>

        {/* 3. VYHLEDÁVÁNÍ, FILTRY A EXPORT */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 pt-2">
          {/* Vyhledávací pole */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Hledat osobu v uzávěrkách..."
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-100 dark:bg-zinc-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all"
            />
          </div>

          {/* Filtry stavu & Tlačítko exportu */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-zinc-800 rounded-xl text-xs">
              <button
                type="button"
                onClick={() => setFilterStatus('all')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  filterStatus === 'all'
                    ? 'bg-white dark:bg-zinc-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900'
                }`}
              >
                Vše ({closuresData.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('approved')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  filterStatus === 'approved'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-emerald-600'
                }`}
              >
                Schváleno ({stats.approvedCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('pending')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  filterStatus === 'pending'
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-amber-600'
                }`}
              >
                Ke schválení ({stats.pendingCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('draft')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  filterStatus === 'draft'
                    ? 'bg-white dark:bg-zinc-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900'
                }`}
              >
                Rozpracováno ({stats.draftCount})
              </button>
            </div>

            {/* Mzdový export */}
            <button
              type="button"
              onClick={() => alert(`Export podkladů pro mzdy za ${MONTH_NAMES_CS[selectedMonth]} ${selectedYear} do formátu XLSX připraven.`)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 text-xs font-semibold transition-colors shadow-xs"
              title="Stáhnout kompletní export pro mzdové účetnictví"
            >
              <Download className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>Export mezd</span>
            </button>
          </div>
        </div>
      </Box>

      {/* 4. SEZNAM OSOB A JEJICH UZÁVĚREK (ŘÁDKOVÉ ZOBRAZENÍ) */}
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
                    {/* Circle avatar (stejný design jako v docházkové kartě) */}
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-amber-500/20 to-amber-600/30 dark:from-amber-500/30 dark:to-amber-600/20 text-amber-900 dark:text-amber-300 font-bold text-xs flex items-center justify-center shadow-xs flex-shrink-0">
                      {(p.name || '?')
                        .split(' ')
                        .filter(Boolean)
                        .map((n) => n[0])
                        .join('')}
                    </div>

                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-slate-900 dark:text-white truncate">
                          {p.name}
                        </span>
                        <RoleBadge role={p.role} roleLabel={p.roleLabel} showIcon={false} />
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-400 flex-wrap">
                        <span className="font-medium text-slate-700 dark:text-zinc-300">
                          {p.contract}
                        </span>
                        <span>•</span>
                        <span>Měsíční fond: <strong className="text-slate-800 dark:text-zinc-200">{item.monthlyFundHours} h</strong></span>
                        {p.managerName && (
                          <>
                            <span>•</span>
                            <span>Vedoucí: {p.managerName}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Střední sloupec: Odpracováno, Saldo, Čerpané absence */}
                  <div className="grid grid-cols-3 sm:flex sm:items-center gap-4 text-left sm:text-center text-xs">
                    {/* Odpracováno */}
                    <div className="space-y-0.5">
                      <span className="text-[10px] uppercase font-mono text-slate-400 dark:text-zinc-500 block">
                        Odpracováno
                      </span>
                      <span className="text-sm font-bold text-slate-900 dark:text-white">
                        {item.workedHours} h
                      </span>
                    </div>

                    {/* Saldo / Rozdíl */}
                    <div className="space-y-0.5">
                      <span className="text-[10px] uppercase font-mono text-slate-400 dark:text-zinc-500 block">
                        Saldo fondu
                      </span>
                      <span
                        className={`text-sm font-bold ${
                          item.saldoHours > 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : item.saldoHours < 0
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-slate-600 dark:text-zinc-400'
                        }`}
                      >
                        {item.saldoHours > 0 ? `+${item.saldoHours} h` : `${item.saldoHours} h`}
                      </span>
                    </div>

                    {/* Čerpané dny/hodiny */}
                    <div className="space-y-0.5">
                      <span className="text-[10px] uppercase font-mono text-slate-400 dark:text-zinc-500 block">
                        Absence v měsíci
                      </span>
                      <div className="text-xs text-slate-700 dark:text-zinc-300 font-medium">
                        {item.vacationDaysTaken > 0 && `${item.vacationDaysTaken} d. dov.`}
                        {item.vacationDaysTaken > 0 && item.doctorHoursTaken > 0 && ', '}
                        {item.doctorHoursTaken > 0 && `${item.doctorHoursTaken} h lék.`}
                        {item.sickDaysTaken > 0 && `${item.sickDaysTaken} d. sick.`}
                        {!item.vacationDaysTaken && !item.doctorHoursTaken && !item.sickDaysTaken && '0'}
                      </div>
                    </div>
                  </div>

                  {/* Pravý sloupec: Status badge & Akce (Detail / Schválit) */}
                  <div className="flex items-center justify-between lg:justify-end gap-3 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-200/60 dark:border-zinc-700/60">
                    <div className="flex flex-col items-start lg:items-end">
                      {getStatusBadge(item.status, item.statusLabel)}
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
                      {/* Tlačítko Detail */}
                      <button
                        type="button"
                        onClick={() => onOpenMonthlyDetail && onOpenMonthlyDetail(p)}
                        className="px-3 py-2 rounded-xl bg-white dark:bg-zinc-700 hover:bg-slate-200 dark:hover:bg-zinc-600 text-slate-700 dark:text-zinc-200 text-xs font-semibold transition-colors shadow-xs flex items-center gap-1.5"
                        title={`Otevřít kompletní měsíční výkaz pro ${p.name}`}
                      >
                        <Eye className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400" />
                        <span className="hidden sm:inline">Detail</span>
                      </button>

                      {/* Tlačítko Schválit (pokud je ke schválení) */}
                      {isPending && (
                        <button
                          type="button"
                          onClick={() => handleApprove(p.id)}
                          className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                          title={`Schválit měsíční uzávěrku pro ${p.name}`}
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Schválit</span>
                        </button>
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

import { useState, useMemo } from 'react';
import {
  Users,
  Search,
  Mail,
  Phone
} from 'lucide-react';
import type { Persona } from '../App';
import { getStatusConfig, STATUS_CONFIG_MAP, type StatusType } from '../config/presenceConfig';
import { RoleBadge } from './RoleBadge';
import { PresenceBadge } from './PresenceBadge';
import { Box } from './ui';

interface PersonsViewProps {
  personasList: Persona[];
  activePersona: Persona;
  getPersonaStatus: (p: Persona) => { statusText: string; statusColor: string; locationType: StatusType };
}

export function PersonsView({
  personasList,
  activePersona,
  getPersonaStatus
}: PersonsViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<StatusType | 'all'>('all');

  // Pomocná funkce pro extrakci příjmení (např. "Jan Novák" -> "Novák")
  const getSurname = (fullName: string): string => {
    const parts = (fullName || '').trim().split(' ').filter(Boolean);
    return parts.length > 1 ? parts[parts.length - 1] : fullName;
  };

  // 1. Filtrování podle hledání a stavu
  const filtered = useMemo(() => {
    return personasList.filter((p) => {
      const q = searchQuery.toLowerCase().trim();
      if (q) {
        const match =
          p.name.toLowerCase().includes(q) ||
          p.roleLabel.toLowerCase().includes(q) ||
          p.email.toLowerCase().includes(q) ||
          p.phoneNumber.toLowerCase().includes(q) ||
          p.contract.toLowerCase().includes(q) ||
          (p.managerName && p.managerName.toLowerCase().includes(q));
        if (!match) return false;
      }

      if (filterStatus !== 'all') {
        const status = getPersonaStatus(p);
        if (status.locationType !== filterStatus) return false;
      }

      return true;
    });
  }, [personasList, searchQuery, filterStatus, getPersonaStatus]);

  // 2. Seřazení DEFAULTNĚ ABECEDNĚ DLE PŘÍJMENÍ OSOBY
  const sortedBySurname = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const surnameA = getSurname(a.name);
      const surnameB = getSurname(b.name);
      const cmp = surnameA.localeCompare(surnameB, 'cs');
      if (cmp !== 0) return cmp;
      return a.name.localeCompare(b.name, 'cs');
    });
  }, [filtered]);

  // Počty pro filtry
  const inOfficeCount = personasList.filter((p) => getPersonaStatus(p).locationType === 'office').length;
  const homeOfficeCount = personasList.filter((p) => getPersonaStatus(p).locationType === 'home_office').length;
  const doctorCount = personasList.filter((p) => getPersonaStatus(p).locationType === 'doctor').length;
  const sickDayCount = personasList.filter((p) => getPersonaStatus(p).locationType === 'sick_day').length;
  const illnessCount = personasList.filter((p) => getPersonaStatus(p).locationType === 'illness').length;
  const vacationCount = personasList.filter((p) => getPersonaStatus(p).locationType === 'vacation').length;
  const unpaidLeaveCount = personasList.filter((p) => getPersonaStatus(p).locationType === 'unpaid_leave').length;
  const offlineCount = personasList.filter((p) => getPersonaStatus(p).locationType === 'offline').length;

  const filterOrder: StatusType[] = [
    'office',
    'home_office',
    'doctor',
    'sick_day',
    'illness',
    'vacation',
    'unpaid_leave',
    'offline'
  ];

  return (
    <Box
      header={{
        icon: Users,
        title: 'Adresář osob & zaměstnanců',
        subtitle: 'Kompletní seznam kolegů seřazený abecedně dle příjmení (pouze řádkový režim)',
        badge: (
          <span className="text-[11px] font-semibold px-2 py-0.2 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300">
            {sortedBySurname.length} / {personasList.length} osob
          </span>
        )
      }}
      className="space-y-5"
    >

      {/* 1. Vyhledávač na plnou šířku */}
      <div className="relative w-full">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Hledat osobu dle příjmení, jména, role, e-mailu, telefonu či nadřízeného..."
          className="w-full pl-10 pr-9 py-2.5 text-xs sm:text-sm rounded-2xl bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40 transition-all"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-2.5 text-sm text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300"
          >
            ×
          </button>
        )}
      </div>

      {/* 2. Filtrační tlačítka stavů */}
      <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
        <button
          type="button"
          onClick={() => setFilterStatus('all')}
          className={`px-3 py-1.5 rounded-xl font-medium transition-all ${
            filterStatus === 'all'
              ? 'bg-slate-900 text-white dark:bg-white dark:text-zinc-900 shadow-sm'
              : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200/70'
          }`}
        >
          Všichni ({personasList.length})
        </button>

        {filterOrder.map((statusKey) => {
          const cfg = STATUS_CONFIG_MAP[statusKey];
          const count =
            statusKey === 'office'
              ? inOfficeCount
              : statusKey === 'home_office'
              ? homeOfficeCount
              : statusKey === 'doctor'
              ? doctorCount
              : statusKey === 'sick_day'
              ? sickDayCount
              : statusKey === 'illness'
              ? illnessCount
              : statusKey === 'vacation'
              ? vacationCount
              : statusKey === 'unpaid_leave'
              ? unpaidLeaveCount
              : offlineCount;

          return (
            <button
              key={statusKey}
              type="button"
              onClick={() => setFilterStatus(statusKey)}
              className={`px-3 py-1.5 rounded-xl font-medium transition-all flex items-center gap-1.5 ${
                filterStatus === statusKey ? cfg.chipActiveClass : cfg.chipInactiveClass
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${cfg.dotClass}`} />
              <span>
                {statusKey === 'offline' ? 'Mimo práci' : cfg.label} ({count})
              </span>
            </button>
          );
        })}
      </div>

      {/* Prázdný stav */}
      {sortedBySurname.length === 0 && (
        <div className="py-8 text-center text-xs text-slate-400 dark:text-zinc-500">
          Žádná osoba neodpovídá zadanému hledání nebo filtru.
        </div>
      )}

      {/* 3. POUZE ŘÁDKOVÉ ZOBRAZENÍ (SEŘAZENO DLE PŘÍJMENÍ) */}
      {sortedBySurname.length > 0 && (
        <div className="divide-y divide-slate-100 dark:divide-zinc-800/60 pt-1">
          {sortedBySurname.map((p) => {
            const isCurrent = p.id === activePersona.id;
            const statusInfo = getPersonaStatus(p);
            const cfg = getStatusConfig(statusInfo.locationType);

            return (
              <div
                key={p.id}
                className={`py-3 px-3 rounded-2xl transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                  isCurrent
                    ? 'bg-amber-50/80 dark:bg-amber-950/25 ring-1 ring-amber-500/20'
                    : 'hover:bg-slate-50 dark:hover:bg-zinc-800/50'
                }`}
              >
                {/* Avatar a základní identita */}
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="relative flex-shrink-0">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold ${
                        isCurrent
                          ? 'bg-gradient-to-tr from-amber-500/20 to-amber-600/30 dark:from-amber-500/30 dark:to-amber-600/20 text-amber-900 dark:text-amber-300 shadow-sm'
                          : 'bg-slate-200 dark:bg-zinc-700 text-slate-700 dark:text-zinc-200'
                      }`}
                    >
                      {(p.name || '?')
                        .split(' ')
                        .filter(Boolean)
                        .map((n) => n[0])
                        .join('')}
                    </div>
                    <span
                      className={`absolute bottom-0 right-0 w-3 h-3 rounded-full ring-2 ring-white dark:ring-zinc-900 ${cfg.dotClass}`}
                    />
                  </div>

                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 dark:text-zinc-100 flex items-center gap-2 flex-wrap truncate">
                      <span className="truncate">{p.name}</span>
                      <RoleBadge role={p.role} roleLabel={p.roleLabel} className="flex-shrink-0" />
                      {p.contract && (
                        <span className="text-[10px] font-mono px-2 py-0.2 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400">
                          {p.contract}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 dark:text-zinc-500 flex items-center gap-2 truncate mt-0.5">
                      <span>{p.email}</span>
                      <span>•</span>
                      <span>{p.phoneNumber}</span>
                      {p.managerName && (
                        <>
                          <span>•</span>
                          <span className="hidden sm:inline">Nadřízený: {p.managerName}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Stav přítomnosti a kontaktní ikonky */}
                <div className="flex items-center justify-between md:justify-end gap-3 flex-shrink-0 pt-1 md:pt-0">
                  <PresenceBadge
                    type={statusInfo.locationType}
                    customLabel={statusInfo.statusText}
                  />

                  <div className="flex items-center gap-1">
                    {isCurrent ? (
                      <>
                        <span
                          className="p-1.5 text-slate-300 dark:text-zinc-600 cursor-not-allowed opacity-40 rounded-lg flex-shrink-0"
                          title="Váš kontakt"
                        >
                          <Mail className="w-3.5 h-3.5" />
                        </span>
                        <span
                          className="p-1.5 text-slate-300 dark:text-zinc-600 cursor-not-allowed opacity-40 rounded-lg flex-shrink-0"
                          title="Váš kontakt"
                        >
                          <Phone className="w-3.5 h-3.5" />
                        </span>
                      </>
                    ) : (
                      <>
                        <a
                          href={`mailto:${p.email}`}
                          className="p-1.5 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-slate-200/60 dark:hover:bg-zinc-700 rounded-lg transition-colors flex-shrink-0"
                          title={`Odeslat email: ${p.email}`}
                        >
                          <Mail className="w-3.5 h-3.5" />
                        </a>
                        <a
                          href={`tel:${p.phoneNumber}`}
                          className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 hover:bg-slate-200/60 dark:hover:bg-zinc-700 rounded-lg transition-colors flex-shrink-0"
                          title={`Zavolat: ${p.phoneNumber}`}
                        >
                          <Phone className="w-3.5 h-3.5" />
                        </a>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Box>
  );
}

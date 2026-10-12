import { useState, useMemo } from 'react';
import {
  Users,
  Search,
  Mail,
  Phone,
  X
} from 'lucide-react';
import type { Persona } from '../App';
import { getStatusConfig, STATUS_CONFIG_MAP, type StatusType } from '../config/presenceConfig';
import { RoleBadge } from './RoleBadge';
import { PresenceBadge } from './PresenceBadge';
import { Box, UserAvatar, ContractBadge, Input, Button } from './ui';

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

  const getSurname = (fullName: string): string => {
    const parts = (fullName || '').trim().split(' ').filter(Boolean);
    return parts.length > 1 ? parts[parts.length - 1] : fullName;
  };

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

  const sortedBySurname = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const surnameA = getSurname(a.name);
      const surnameB = getSurname(b.name);
      return surnameA.localeCompare(surnameB, 'cs', { sensitivity: 'base' });
    });
  }, [filtered]);

  const countsByStatus = useMemo(() => {
    const counts: Record<string, number> = {};
    personasList.forEach((p) => {
      const st = getPersonaStatus(p);
      counts[st.locationType] = (counts[st.locationType] || 0) + 1;
    });
    return counts;
  }, [personasList, getPersonaStatus]);

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
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300">
            {sortedBySurname.length} / {personasList.length} osob
          </span>
        )
      }}
      className="space-y-5"
    >
      {/* 1. Vyhledávač na plnou šířku */}
      <Input
        icon={Search}
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Hledat osobu dle příjmení, jména, role, e-mailu, telefonu či nadřízeného..."
        rightElement={
          searchQuery ? (
            <Button
              variant="ghost"
              size="icon-sm"
              icon={X}
              onClick={() => setSearchQuery('')}
              title="Vymazat vyhledávání"
            />
          ) : undefined
        }
      />

      {/* 2. Filtrační tlačítka stavů */}
      <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
        <button
          type="button"
          onClick={() => setFilterStatus('all')}
          className={`px-3 py-1.5 rounded-xl font-medium transition-all cursor-pointer ${
            filterStatus === 'all'
              ? 'bg-slate-900 text-white dark:bg-white dark:text-zinc-900 shadow-sm'
              : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200/70'
          }`}
        >
          Všichni ({personasList.length})
        </button>

        {filterOrder.map((statusKey) => {
          const cfg = STATUS_CONFIG_MAP[statusKey];
          const count = countsByStatus[statusKey] || 0;
          if (count === 0 && filterStatus !== statusKey) return null;

          const isActive = filterStatus === statusKey;
          return (
            <button
              key={statusKey}
              type="button"
              onClick={() => setFilterStatus(statusKey)}
              className="cursor-pointer"
            >
              <PresenceBadge
                type={statusKey}
                variant="chip"
                active={isActive}
                showIcon={true}
                customLabel={`${cfg.label} (${count})`}
              />
            </button>
          );
        })}
      </div>

      {/* 3. Seznam osob (výhradně přehledný řádkový režim) */}
      <div className="space-y-2 pt-2">
        {sortedBySurname.length === 0 ? (
          <div className="py-12 text-center text-slate-400 dark:text-zinc-500 text-xs sm:text-sm">
            Nenalezen žádný kolega odpovídající hledání či filtru.
          </div>
        ) : (
          sortedBySurname.map((p) => {
            const statusInfo = getPersonaStatus(p);
            const isCurrent = p.id === activePersona.id;

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
                  <UserAvatar
                    name={p.name}
                    size="md"
                    isCurrent={isCurrent}
                    statusType={statusInfo.locationType}
                  />

                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 dark:text-zinc-100 flex items-center gap-2 flex-wrap truncate">
                      <span className="truncate">{p.name}</span>
                      <RoleBadge role={p.role} roleLabel={p.roleLabel} className="flex-shrink-0" />
                      <ContractBadge contract={p.contract} />
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
                      <span
                        className="p-1.5 text-slate-300 dark:text-zinc-600 cursor-not-allowed opacity-40 rounded-lg flex-shrink-0"
                        title="Váš kontakt"
                      >
                        <Mail className="w-3.5 h-3.5" />
                      </span>
                    ) : (
                      <a
                        href={`mailto:${p.email}`}
                        className="p-1.5 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors flex-shrink-0"
                        title={`Napsat e-mail na ${p.email}`}
                      >
                        <Mail className="w-3.5 h-3.5" />
                      </a>
                    )}

                    {p.phoneNumber ? (
                      <a
                        href={`tel:${p.phoneNumber.replace(/\s+/g, '')}`}
                        className="p-1.5 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors flex-shrink-0"
                        title={`Zavolat na ${p.phoneNumber}`}
                      >
                        <Phone className="w-3.5 h-3.5" />
                      </a>
                    ) : (
                      <span
                        className="p-1.5 text-slate-300 dark:text-zinc-700 cursor-not-allowed opacity-40 rounded-lg flex-shrink-0"
                        title="Telefon není uveden"
                      >
                        <Phone className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </Box>
  );
}

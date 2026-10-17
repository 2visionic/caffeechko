import { useState } from 'react';
import { LayoutGrid, List, Search, Mail, Phone } from 'lucide-react';
import type { Persona } from '../types/attendance';
import { STATUS_CONFIG_MAP, type StatusType } from '../config/presenceConfig';
import { SECTIONS } from '../config/sectionsConfig';
import { RoleBadge } from './RoleBadge';
import { PresenceBadge } from './PresenceBadge';
import { Box, UserAvatar, SegmentedControl } from './ui';

interface WhoIsWhereBoxProps {
  personasList: Persona[];
  activePersona: Persona;
  getPersonaStatus: (p: Persona) => { statusText: string; statusColor: string; locationType: StatusType };
  title?: string;
  subtitle?: string;
}

const STATUS_ORDER_KEYS = [
  'office',
  'home_office',
  'doctor',
  'sick_day',
  'illness',
  'vacation',
  'unpaid_leave',
  'offline'
] as const;

const STATUS_SORT_WEIGHT: Record<string, number> = {
  office: 1,
  home_office: 2,
  doctor: 3,
  sick_day: 4,
  illness: 5,
  vacation: 6,
  unpaid_leave: 7,
  offline: 8
};

export function WhoIsWhereBox({
  personasList,
  activePersona,
  getPersonaStatus,
  title = 'Kdo je kde',
  subtitle = 'Live přehled týmu – kdo je v kanceláři, kdo na dálku a kdo na volnu či u lékaře'
}: WhoIsWhereBoxProps) {
  const [teamSearchQuery, setTeamSearchQuery] = useState<string>('');
  const [teamFilterStatus, setTeamFilterStatus] = useState<StatusType | 'all'>('all');
  const [presenceViewMode, setPresenceViewMode] = useState<'cards' | 'rows'>('rows');

  const inOfficeCount = personasList.filter((p) => getPersonaStatus(p).locationType === 'office').length;
  const homeOfficeCount = personasList.filter((p) => getPersonaStatus(p).locationType === 'home_office').length;
  const doctorCount = personasList.filter((p) => getPersonaStatus(p).locationType === 'doctor').length;
  const sickDayCount = personasList.filter((p) => getPersonaStatus(p).locationType === 'sick_day').length;
  const illnessCount = personasList.filter((p) => getPersonaStatus(p).locationType === 'illness').length;
  const vacationCount = personasList.filter((p) => getPersonaStatus(p).locationType === 'vacation').length;
  const unpaidLeaveCount = personasList.filter((p) => getPersonaStatus(p).locationType === 'unpaid_leave').length;
  const offlineCount = personasList.filter((p) => getPersonaStatus(p).locationType === 'offline').length;

  const filteredPersonas = personasList.filter((p) => {
    const q = teamSearchQuery.toLowerCase().trim();
    if (q) {
      const match =
        p.name.toLowerCase().includes(q) ||
        p.roleLabel.toLowerCase().includes(q) ||
        p.contract.toLowerCase().includes(q) ||
        (p.managerName && p.managerName.toLowerCase().includes(q)) ||
        (p.parentPersonName && p.parentPersonName.toLowerCase().includes(q));
      if (!match) return false;
    }

    const status = getPersonaStatus(p);
    if (teamFilterStatus !== 'all' && status.locationType !== teamFilterStatus) {
      return false;
    }
    return true;
  });

  const sortedPersonas = [...filteredPersonas].sort((a, b) => {
    const statusA = getPersonaStatus(a).locationType;
    const statusB = getPersonaStatus(b).locationType;
    const weightA = STATUS_SORT_WEIGHT[statusA] ?? 99;
    const weightB = STATUS_SORT_WEIGHT[statusB] ?? 99;

    if (weightA !== weightB) {
      return weightA - weightB;
    }

    return a.name.localeCompare(b.name, 'cs');
  });

  return (
    <Box
      header={{
        icon: SECTIONS.persons.icon,
        title,
        subtitle,
        badge: (
          <span className="text-[11px] font-semibold px-2 py-0.2 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300">
            {sortedPersonas.length} / {personasList.length} kolegů
          </span>
        ),
        actions: (
          <SegmentedControl
            value={presenceViewMode}
            onChange={setPresenceViewMode}
            size="sm"
            options={[
              { id: 'cards', label: 'Kartičky', icon: LayoutGrid },
              { id: 'rows', label: 'Řádky', icon: List }
            ]}
          />
        )
      }}
    >
      {/* 1. VYHLEDÁVAČ NA PLNOU ŠÍŘKU */}
      <div className="relative w-full">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
        <input
          type="text"
          value={teamSearchQuery}
          onChange={(e) => setTeamSearchQuery(e.target.value)}
          placeholder="Hledat kolegu podle jména, pozice, úvazku nebo nadřízeného..."
          className="w-full pl-10 pr-9 py-2.5 text-xs sm:text-sm rounded-2xl bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40 transition-all"
        />
        {teamSearchQuery && (
          <button
            onClick={() => setTeamSearchQuery('')}
            className="absolute right-3 top-2.5 text-sm text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300"
          >
            ×
          </button>
        )}
      </div>

      {/* 2. FILTRAČNÍ TLAČÍTKA NA VŠECHNY STAVY (ZALAMOVANÉ V POŽADOVANÉM POŘADÍ, POUZE S ALESPOŇ 1 ZÁZNAMEM) */}
      <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
        <button
          type="button"
          onClick={() => setTeamFilterStatus('all')}
          className={`px-3 py-1.5 rounded-xl font-medium transition-all cursor-pointer ${
            teamFilterStatus === 'all'
              ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
              : 'bg-amber-500/10 text-amber-800 dark:text-amber-300 hover:bg-amber-500/20'
          }`}
        >
          Všichni ({personasList.length})
        </button>

        {STATUS_ORDER_KEYS.map((statusKey) => {
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

          if (count === 0) return null;

          const isActive = teamFilterStatus === statusKey;

          return (
            <button
              key={statusKey}
              type="button"
              onClick={() => setTeamFilterStatus(statusKey)}
              className={`px-3 py-1.5 rounded-xl font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                isActive ? cfg.chipActiveClass : cfg.chipInactiveClass
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${cfg.dotClass}`} />
              <span>
                {cfg.label} ({count})
              </span>
            </button>
          );
        })}
      </div>

      {sortedPersonas.length === 0 && (
        <div className="py-8 text-center text-xs text-slate-400 dark:text-zinc-500">
          Žádný kolega neodpovídá zadanému hledání nebo filtru.
        </div>
      )}

      {/* KARTIČKOVÝ MÓD */}
      {presenceViewMode === 'cards' && sortedPersonas.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 pt-1">
          {sortedPersonas.map((p) => {
            const isCurrent = p.id === activePersona.id;
            const statusInfo = getPersonaStatus(p);
            const isEmergencyPhoneOnly = ['illness', 'sick_day', 'vacation', 'doctor'].includes(
              statusInfo.locationType
            );

            return (
              <div
                key={p.id}
                className={`p-4 rounded-2xl transition-all duration-200 flex flex-col justify-between ${
                  isCurrent
                    ? 'bg-amber-50 dark:bg-amber-950/30 ring-2 ring-amber-500/30 shadow-sm'
                    : 'bg-slate-100/70 dark:bg-zinc-800/60 hover:bg-slate-100 dark:hover:bg-zinc-800'
                }`}
              >
                <div>
                  <div className="flex items-center gap-3">
                    <UserAvatar
                      name={p.name}
                      size="md"
                      isCurrent={isCurrent}
                      statusType={statusInfo.locationType}
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5 truncate">
                        <span className="truncate">{p.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5 truncate">
                        <RoleBadge role={p.role} roleLabel={p.roleLabel} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-slate-200/40 dark:border-zinc-700/60 flex items-center justify-between gap-2">
                  <PresenceBadge
                    type={statusInfo.locationType}
                    customLabel={statusInfo.statusText}
                    showIcon={false}
                    className="truncate"
                  />

                  <div className="flex items-center gap-1 flex-shrink-0">
                    <a
                      href={isCurrent ? undefined : `mailto:${p.email}`}
                      className={`p-1.5 rounded-lg transition-colors flex-shrink-0 ${
                        isCurrent
                          ? 'text-slate-300 dark:text-zinc-600 pointer-events-none opacity-40 cursor-default'
                          : 'text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-emerald-500/10 dark:hover:bg-emerald-950/40'
                      }`}
                      title={isCurrent ? undefined : `Odeslat email: ${p.email}`}
                    >
                      <Mail className="w-3.5 h-3.5" />
                    </a>
                    <a
                      href={isCurrent ? undefined : `tel:${p.phoneNumber}`}
                      className={`p-1.5 rounded-lg transition-colors flex-shrink-0 ${
                        isCurrent
                          ? 'text-slate-300 dark:text-zinc-600 pointer-events-none opacity-40 cursor-default'
                          : isEmergencyPhoneOnly
                          ? 'text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 hover:bg-rose-500/10 dark:hover:bg-rose-950/40'
                          : 'text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-emerald-500/10 dark:hover:bg-emerald-950/40'
                      }`}
                      title={
                        isCurrent
                          ? undefined
                          : isEmergencyPhoneOnly
                          ? `Volat pouze v nutnosti (${statusInfo.statusText}): ${p.phoneNumber}`
                          : `Zavolat: ${p.phoneNumber}`
                      }
                    >
                      <Phone className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ŘÁDKOVÝ MÓD */}
      {presenceViewMode === 'rows' && sortedPersonas.length > 0 && (
        <div className="divide-y divide-slate-100 dark:divide-zinc-800/60">
          {sortedPersonas.map((p) => {
            const isCurrent = p.id === activePersona.id;
            const statusInfo = getPersonaStatus(p);
            const isEmergencyPhoneOnly = ['illness', 'sick_day', 'vacation', 'doctor'].includes(
              statusInfo.locationType
            );

            return (
              <div
                key={p.id}
                className={`py-3 px-2 sm:px-3 rounded-xl transition-colors flex items-center justify-between gap-3 ${
                  isCurrent
                    ? 'bg-amber-50 dark:bg-amber-950/25'
                    : 'hover:bg-slate-50 dark:hover:bg-zinc-800/50'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <UserAvatar
                    name={p.name}
                    size="md"
                    isCurrent={isCurrent}
                    statusType={statusInfo.locationType}
                  />

                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 dark:text-zinc-100 flex items-center gap-2 truncate">
                      <span className="truncate">{p.name}</span>
                      <RoleBadge role={p.role} roleLabel={p.roleLabel} />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  <PresenceBadge
                    type={statusInfo.locationType}
                    customLabel={statusInfo.statusText}
                  />

                  <div className="flex items-center gap-1">
                    <a
                      href={isCurrent ? undefined : `mailto:${p.email}`}
                      className={`p-1.5 rounded-lg transition-colors flex-shrink-0 ${
                        isCurrent
                          ? 'text-slate-300 dark:text-zinc-600 pointer-events-none opacity-40 cursor-default'
                          : 'text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-emerald-500/10 dark:hover:bg-emerald-950/40'
                      }`}
                      title={isCurrent ? undefined : `Odeslat email: ${p.email}`}
                    >
                      <Mail className="w-3.5 h-3.5" />
                    </a>
                    <a
                      href={isCurrent ? undefined : `tel:${p.phoneNumber}`}
                      className={`p-1.5 rounded-lg transition-colors flex-shrink-0 ${
                        isCurrent
                          ? 'text-slate-300 dark:text-zinc-600 pointer-events-none opacity-40 cursor-default'
                          : isEmergencyPhoneOnly
                          ? 'text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 hover:bg-rose-500/10 dark:hover:bg-rose-950/40'
                          : 'text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-emerald-500/10 dark:hover:bg-emerald-950/40'
                      }`}
                      title={
                        isCurrent
                          ? undefined
                          : isEmergencyPhoneOnly
                          ? `Volat pouze v nutnosti (${statusInfo.statusText}): ${p.phoneNumber}`
                          : `Zavolat: ${p.phoneNumber}`
                      }
                    >
                      <Phone className="w-3.5 h-3.5" />
                    </a>
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

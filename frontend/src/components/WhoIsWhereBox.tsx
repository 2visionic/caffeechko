import { useState } from 'react';
import { LayoutGrid, List, Search, Mail, Phone, Edit3, Sliders, Trash2, RotateCcw } from 'lucide-react';
import type { Persona } from '../types/attendance';
import { STATUS_CONFIG_MAP, type StatusType } from '../config/presenceConfig';
import { SECTIONS } from '../config/sectionsConfig';
import { RoleBadge } from './RoleBadge';
import { PresenceBadge } from './PresenceBadge';
import { Box, UserAvatar, SegmentedControl, Button } from './ui';

interface WhoIsWhereBoxProps {
  personasList: Persona[];
  activePersona: Persona;
  getPersonaStatus: (p: Persona) => { statusText: string; statusColor: string; locationType: StatusType };
  onSelectPersona?: (p: Persona) => void;
  title?: string;
  subtitle?: string;
  showContacts?: boolean;
  hideSearch?: boolean;
  onEditPersona?: (p: Persona) => void;
  onOpenPersonaSettings?: (p: Persona) => void;
  onDeletePersona?: (p: Persona) => void;
  extraHeaderAction?: React.ReactNode;
  extraFilterAction?: React.ReactNode;
}

/**
 * Určuje, zda má přihlášená osoba (viewer) přístup do Detailu osoby (target)
 * přesně podle pravidel zobrazení osob na stránce "Osoby":
 * - Vedoucí (team_lead) vidí lidi, kteří ho mají jako vedoucího (parentPersonId)
 * - Manažer (manager) vidí lidi, kteří ho mají jako manažera (managerId)
 * - Officer (office_manager) a Admin (admin) vidí všechny ostatní lidi
 */
export function canAccessPersonaDetail(viewer: Persona, target: Persona): boolean {
  if (!viewer || !target) return false;
  if (viewer.id === 'anonymous' || viewer.id === 'clean-uninstalled') return false;
  const activeId = viewer.id.toLowerCase();
  const targetId = target.id.toLowerCase();

  // Neotevíráme cizí ovládání pro sebe samého
  if (activeId === targetId) return false;

  if (viewer.role === 'team_lead') {
    return target.parentPersonId?.toLowerCase() === activeId;
  }

  if (viewer.role === 'manager') {
    return target.managerId?.toLowerCase() === activeId;
  }

  if (viewer.role === 'office_manager' || viewer.role === 'admin') {
    return true;
  }

  return false;
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
  onSelectPersona,
  title = 'Kdo je kde',
  subtitle = 'Live přehled týmu – kdo je v kanceláři, kdo na dálku a kdo na volnu či u lékaře',
  showContacts = true,
  hideSearch = false,
  onEditPersona,
  onOpenPersonaSettings,
  onDeletePersona,
  extraHeaderAction,
  extraFilterAction
}: WhoIsWhereBoxProps) {
  const [teamSearchQuery, setTeamSearchQuery] = useState<string>('');
  const [teamFilterStatus, setTeamFilterStatus] = useState<StatusType | 'all'>('all');
  const [presenceViewMode, setPresenceViewMode] = useState<'cards' | 'rows'>('rows');

  const visiblePersonas = personasList.filter(
    (p) => p.id.toLowerCase() !== activePersona.id.toLowerCase()
  );

  const inOfficeCount = visiblePersonas.filter((p) => getPersonaStatus(p).locationType === 'office').length;
  const homeOfficeCount = visiblePersonas.filter((p) => getPersonaStatus(p).locationType === 'home_office').length;
  const doctorCount = visiblePersonas.filter((p) => getPersonaStatus(p).locationType === 'doctor').length;
  const sickDayCount = visiblePersonas.filter((p) => getPersonaStatus(p).locationType === 'sick_day').length;
  const illnessCount = visiblePersonas.filter((p) => getPersonaStatus(p).locationType === 'illness').length;
  const vacationCount = visiblePersonas.filter((p) => getPersonaStatus(p).locationType === 'vacation').length;
  const unpaidLeaveCount = visiblePersonas.filter((p) => getPersonaStatus(p).locationType === 'unpaid_leave').length;
  const offlineCount = visiblePersonas.filter((p) => getPersonaStatus(p).locationType === 'offline').length;

  const filteredPersonas = visiblePersonas.filter((p) => {
    const q = teamSearchQuery.toLowerCase().trim();
    if (!hideSearch && q) {
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
            {sortedPersonas.length} / {visiblePersonas.length} kolegů
          </span>
        ),
        actions: (
          <div className="flex items-center gap-2">
            {extraHeaderAction}
            <SegmentedControl
              value={presenceViewMode}
              onChange={setPresenceViewMode}
              size="sm"
              options={[
                { id: 'cards', label: 'Kartičky', icon: LayoutGrid },
                { id: 'rows', label: 'Řádky', icon: List }
              ]}
            />
          </div>
        )
      }}
    >
      {/* 1. VYHLEDÁVAČ NA PLNOU ŠÍŘKU */}
      {!hideSearch && (
        <div className="relative flex items-center w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
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
              className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 flex items-center justify-center"
            >
              ×
            </button>
          )}
        </div>
      )}

      {/* 2. FILTRAČNÍ TLAČÍTKA NA VŠECHNY STAVY (ZALAMOVANÉ V POŽADOVANÉM POŘADÍ, POUZE S ALESPOŇ 1 ZÁZNAMEM) */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setTeamFilterStatus('all')}
            className={`px-3 py-1.5 rounded-xl font-medium transition-all cursor-pointer ${
              teamFilterStatus === 'all'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                : 'bg-amber-500/10 text-amber-800 dark:text-amber-300 hover:bg-amber-500/20'
            }`}
          >
            Všichni ({visiblePersonas.length})
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

        {extraFilterAction && <div className="ml-auto">{extraFilterAction}</div>}
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
            const canClick = Boolean(onSelectPersona) && canAccessPersonaDetail(activePersona, p);

            const isOfficerOrAdmin = activePersona.role === 'office_manager' || activePersona.role === 'admin';
            const isSelf = p.id.toLowerCase() === activePersona.id.toLowerCase();
            const canEditThis = Boolean(onEditPersona) && isOfficerOrAdmin;
            const canSettingsThis = Boolean(onOpenPersonaSettings) && isOfficerOrAdmin;
            const canDeleteThis = Boolean(onDeletePersona) && isOfficerOrAdmin && !isSelf;

            return (
              <div
                key={p.id}
                onClick={() => {
                  if (canClick) onSelectPersona!(p);
                }}
                title={canClick ? `Zobrazit detail osoby: ${p.name}` : undefined}
                className={`p-4 rounded-2xl transition-all duration-200 flex flex-col justify-between ${
                  canClick ? 'cursor-pointer' : ''
                } ${
                  isCurrent
                    ? 'bg-amber-50 dark:bg-amber-950/30 ring-2 ring-amber-500/30 shadow-sm'
                    : canClick
                    ? 'bg-slate-100/70 dark:bg-zinc-800/60 hover:bg-slate-100 dark:hover:bg-zinc-800'
                    : 'bg-slate-100/70 dark:bg-zinc-800/60'
                } ${p.isActive === false ? 'opacity-70' : ''}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <UserAvatar
                    name={p.name}
                    size="md"
                    isCurrent={isCurrent}
                    statusType={statusInfo.locationType}
                    isPermanentHomeOffice={p.isPermanentHomeOffice}
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5 truncate">
                      <span className="truncate">{p.name}</span>
                      {p.isActive === false && (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex-shrink-0">
                          Neaktivní
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5 truncate">
                      <RoleBadge role={p.role} roleLabel={p.roleLabel} />
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between gap-2">
                  <PresenceBadge
                    type={statusInfo.locationType}
                    customLabel={statusInfo.statusText}
                    showIcon={true}
                    className="truncate"
                  />

                  <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    {showContacts && (
                      <>
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
                      </>
                    )}

                    {(canEditThis || canSettingsThis || canDeleteThis) && (
                      <div className="flex items-center gap-1">
                        {canEditThis && (
                          <Button
                            variant="surface"
                            size="icon-sm"
                            icon={Edit3}
                            title={`Upravit profil: ${p.name}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditPersona?.(p);
                            }}
                          />
                        )}
                        {canSettingsThis && (
                          <Button
                            variant="surface"
                            size="icon-sm"
                            icon={Sliders}
                            title={`Nastavení absencí a fondu: ${p.name}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenPersonaSettings?.(p);
                            }}
                          />
                        )}
                        {canDeleteThis && (
                          <Button
                            variant="transparent"
                            color={p.isActive === false ? 'emerald' : 'rose'}
                            size="icon-sm"
                            icon={p.isActive === false ? RotateCcw : Trash2}
                            title={p.isActive === false ? `Aktivovat osobu: ${p.name}` : `Deaktivovat / smazat osobu: ${p.name}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeletePersona?.(p);
                            }}
                          />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ŘÁDKOVÝ MÓD (Tabulka Kdo je kde / Osoby ve správě: jen poslední sloupec doprava, ostatní doleva) */}
      {presenceViewMode === 'rows' && sortedPersonas.length > 0 && (
        <div className="divide-y divide-slate-100 dark:divide-zinc-800/60">
          {sortedPersonas.map((p) => {
            const isCurrent = p.id === activePersona.id;
            const statusInfo = getPersonaStatus(p);
            const isEmergencyPhoneOnly = ['illness', 'sick_day', 'vacation', 'doctor'].includes(
              statusInfo.locationType
            );
            const canClick = Boolean(onSelectPersona) && canAccessPersonaDetail(activePersona, p);

            const isOfficerOrAdmin = activePersona.role === 'office_manager' || activePersona.role === 'admin';
            const isSelf = p.id.toLowerCase() === activePersona.id.toLowerCase();
            const canEditThis = Boolean(onEditPersona) && isOfficerOrAdmin;
            const canSettingsThis = Boolean(onOpenPersonaSettings) && isOfficerOrAdmin;
            const canDeleteThis = Boolean(onDeletePersona) && isOfficerOrAdmin && !isSelf;

            const hasAnyActionsOrContacts = Boolean(showContacts || canEditThis || canSettingsThis || canDeleteThis);

            return (
              <div
                key={p.id}
                onClick={() => {
                  if (canClick) onSelectPersona!(p);
                }}
                title={canClick ? `Zobrazit detail osoby: ${p.name}` : undefined}
                className={`py-3 px-2 sm:px-3 rounded-xl transition-colors items-center gap-3 ${
                  hasAnyActionsOrContacts
                    ? 'grid grid-cols-[1fr_auto] sm:grid-cols-[minmax(200px,1.2fr)_minmax(160px,1fr)_auto]'
                    : 'grid grid-cols-[1fr_auto]'
                } ${
                  canClick ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-zinc-800/50' : ''
                } ${
                  isCurrent
                    ? 'bg-amber-50 dark:bg-amber-950/25'
                    : ''
                } ${p.isActive === false ? 'opacity-70' : ''}`}
              >
                {/* 1. sloupec (vlevo): Osoba + Role */}
                <div className="flex items-center gap-3 min-w-0 text-left">
                  <UserAvatar
                    name={p.name}
                    size="md"
                    isCurrent={isCurrent}
                    statusType={statusInfo.locationType}
                    isPermanentHomeOffice={p.isPermanentHomeOffice}
                  />

                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 dark:text-zinc-100 flex items-center gap-2 truncate">
                      <span className="truncate">{p.name}</span>
                      <RoleBadge role={p.role} roleLabel={p.roleLabel} />
                      {p.isActive === false && (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex-shrink-0">
                          Neaktivní
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Pokud nejsou kontakty ani akce: 2. sloupec (vpravo) - Stav zarovnán doprava */}
                {!hasAnyActionsOrContacts && (
                  <div className="flex items-center justify-end text-right min-w-0">
                    <PresenceBadge
                      type={statusInfo.locationType}
                      customLabel={statusInfo.statusText}
                      showIcon={true}
                    />
                  </div>
                )}

                {/* Pokud JSOU kontakty nebo akce: 2. sloupec vlevo a 3. sloupec vpravo */}
                {hasAnyActionsOrContacts && (
                  <>
                    <div className="hidden sm:flex items-center justify-start text-left min-w-0">
                      <PresenceBadge
                        type={statusInfo.locationType}
                        customLabel={statusInfo.statusText}
                        showIcon={true}
                      />
                    </div>

                    <div className="flex items-center justify-end gap-2 text-right flex-shrink-0">
                      <div className="sm:hidden">
                        <PresenceBadge
                          type={statusInfo.locationType}
                          customLabel={statusInfo.statusText}
                          showIcon={true}
                        />
                      </div>

                      <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                        {showContacts && (
                          <>
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
                          </>
                        )}

                        {(canEditThis || canSettingsThis || canDeleteThis) && (
                          <div className={`flex items-center gap-1.5 ${showContacts ? 'pl-2 ml-1 border-l border-slate-200 dark:border-zinc-700/60' : ''}`}>
                            {canEditThis && (
                              <Button
                                variant="surface"
                                size="icon-sm"
                                icon={Edit3}
                                onClick={() => onEditPersona?.(p)}
                                title={`Upravit profil: ${p.name}`}
                              />
                            )}
                            {canSettingsThis && (
                              <Button
                                variant="surface"
                                size="icon-sm"
                                icon={Sliders}
                                onClick={() => onOpenPersonaSettings?.(p)}
                                title={`Nastavení absencí a fondu: ${p.name}`}
                              />
                            )}
                            {canDeleteThis && (
                              <Button
                                variant={p.isActive === false ? 'surface' : 'transparent'}
                                color={p.isActive === false ? 'emerald' : 'rose'}
                                size="icon-sm"
                                icon={p.isActive === false ? RotateCcw : Trash2}
                                onClick={() => onDeletePersona?.(p)}
                                title={p.isActive === false ? `Aktivovat osobu: ${p.name}` : `Deaktivovat / smazat osobu: ${p.name}`}
                              />
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Box>
  );
}

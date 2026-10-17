import { useState } from 'react';
import {
  CheckCircle2,
  Users,
  Check
} from 'lucide-react';
import { formatContractLabel, type Persona } from '../types/attendance';
import type { LeaveRequestItem } from '../components/LeaveRequestModal';
import type { DoctorVisitItem } from '../components/DoctorVisitModal';
import type { RequestTypeOption } from '../components/NewRequestModal';
import { QuickRequestActions } from '../components/QuickRequestActions';
import { AbsenceRequestRow, sortAbsenceRequests, isDoctorRequest, type UnifiedAbsenceRequestItem } from '../components/AbsenceRequestRow';
import { Box, Button, UserAvatar, StatusBadge, SegmentedControl, Select } from '../components/ui';
import { SECTIONS } from '../config/sectionsConfig';

interface PendingUserCardProps {
  user: any;
  defaultVacationDays?: number;
  defaultSickDays?: number;
  defaultHomeOfficeWeeklyDays?: number;
  baseDailyHours?: number;
  weeklyWorkDays?: number;
  onApprove: (
    role: string,
    contractKind: string,
    weeklyHours: number,
    vacationDays?: number,
    sickDays?: number,
    homeOfficeWeeklyDays?: number,
    contractType?: string
  ) => void;
}

export function PendingUserCard({
  user,
  defaultVacationDays = 20,
  defaultSickDays = 3,
  defaultHomeOfficeWeeklyDays = 2,
  baseDailyHours = 8,
  weeklyWorkDays = 5,
  onApprove
}: PendingUserCardProps) {
  const [role, setRole] = useState<string>('colleague');
  const [contractKind, setContractKind] = useState<string>('employee');
  const [contractType, setContractType] = useState<string>('full_time');
  const [weeklyHours, setWeeklyHours] = useState<number>(baseDailyHours * weeklyWorkDays);
  const [vacationDays, setVacationDays] = useState<number>(defaultVacationDays);
  const [sickDays, setSickDays] = useState<number>(defaultSickDays);
  const [homeOfficeDays, setHomeOfficeDays] = useState<number>(defaultHomeOfficeWeeklyDays);

  const getFteCoeff = (cType: string) => {
    if (cType === 'half_time') return 0.5;
    if (cType === 'part_time') return 0.25;
    return 1.0;
  };

  const handleContractTypeChange = (cType: string) => {
    setContractType(cType);
    const coeff = getFteCoeff(cType);
    setWeeklyHours(Math.round(baseDailyHours * weeklyWorkDays * coeff));
    if (contractKind === 'employee') {
      setVacationDays(Math.round(defaultVacationDays * coeff * 10) / 10);
      setSickDays(Math.round(defaultSickDays * coeff * 10) / 10);
      setHomeOfficeDays(Math.round(defaultHomeOfficeWeeklyDays * coeff * 10) / 10);
    }
  };

  const handleContractChange = (val: string) => {
    setContractKind(val);
    if (val === 'osvc') {
      setVacationDays(0);
      setSickDays(0);
      setHomeOfficeDays(0);
    } else {
      const coeff = getFteCoeff(contractType);
      setVacationDays(Math.round(defaultVacationDays * coeff * 10) / 10);
      setSickDays(Math.round(defaultSickDays * coeff * 10) / 10);
      setHomeOfficeDays(Math.round(defaultHomeOfficeWeeklyDays * coeff * 10) / 10);
    }
  };

  return (
    <div
      className="p-6 sm:p-7 rounded-3xl bg-amber-500/5 dark:bg-amber-500/10 shadow-sm flex flex-col gap-5 transition-all"
      style={{ border: 'none' }}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3.5">
          <UserAvatar name={user.name} size="md" />
          <div>
            <div className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
              <span>{user.name}</span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">
                Google Workspace registrace
              </span>
            </div>
            <div className="text-xs text-slate-500 dark:text-zinc-400">
              {user.email}
            </div>
          </div>
        </div>

        <StatusBadge status="pending" customLabel="Čeká na nastavení úvazku" size="md" />
      </div>

      {/* Settings Row: Smlouva, Role, Úvazek */}
      <div className="p-4 rounded-2xl bg-white/60 dark:bg-zinc-800/60 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Select
          label="Typ smlouvy:"
          value={contractKind}
          onChange={(e) => handleContractChange(e.target.value)}
          options={[
            { value: 'employee', label: 'HPP' },
            { value: 'osvc', label: 'OSVČ' }
          ]}
        />

        <Select
          label="Pracovní role:"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          options={[
            { value: 'colleague', label: 'Kolega' },
            { value: 'team_lead', label: 'Vedoucí' },
            { value: 'manager', label: 'Manažer' },
            { value: 'office_manager', label: 'Office Manager' },
            { value: 'admin', label: 'Administrátor' }
          ]}
        />

        <Select
          label="Typ úvazku:"
          value={contractType}
          onChange={(e) => handleContractTypeChange(e.target.value)}
          options={[
            { value: 'full_time', label: formatContractLabel('HPP', 'full_time') },
            { value: 'half_time', label: formatContractLabel('HPP', 'half_time') },
            { value: 'part_time', label: formatContractLabel('HPP', 'part_time') }
          ]}
        />
      </div>

      {/* Settings Row 2: Fondy absencí (z firemního nastavení) */}
      <div className="p-4 rounded-2xl bg-white/60 dark:bg-zinc-800/60 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
            Dovolená (dní / rok):
          </label>
          <input
            type="number"
            min={0}
            max={100}
            value={vacationDays}
            onChange={(e) => setVacationDays(Number(e.target.value))}
            className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/20"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
            Sick days (dní / rok):
          </label>
          <input
            type="number"
            min={0}
            max={30}
            value={sickDays}
            onChange={(e) => setSickDays(Number(e.target.value))}
            className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/20"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
            Home Office (dní / týden):
          </label>
          <input
            type="number"
            min={0}
            max={7}
            value={homeOfficeDays}
            onChange={(e) => setHomeOfficeDays(Number(e.target.value))}
            className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/20"
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button
          variant="filled"
          colorKey="amber"
          icon={Check}
          onClick={() => onApprove(role, contractKind, weeklyHours, vacationDays, sickDays, homeOfficeDays, contractType)}
        >
          Schválit a nastavit úvazek
        </Button>
      </div>
    </div>
  );
}

export type RequestsPageTab = 'my' | 'colleagues' | 'onboarding';
export type RequestStatusFilter = 'all' | 'pending' | 'approved' | 'rejected';

export interface RequestsViewProps {
  activePersona: Persona;
  isManagerOrAdmin: boolean;
  agendaTab: RequestsPageTab;
  setAgendaTab: (tab: RequestsPageTab) => void;
  myVacationRequests: LeaveRequestItem[];
  myDoctorVisits: DoctorVisitItem[];
  colleagueVacationRequests: LeaveRequestItem[];
  colleagueDoctorVisits: DoctorVisitItem[];
  pendingUsers?: any[];
  companySettings?: any;
  handleApproveUser?: (
    userId: string,
    role: string,
    contractKind: string,
    weeklyHours: number,
    vacationDays?: number,
    sickDays?: number,
    homeOfficeWeeklyDays?: number,
    contractType?: string
  ) => void;
  onOpenNewRequestModal: (initialType?: RequestTypeOption) => void;
  onOpenVacationModal: (req: LeaveRequestItem) => void;
  onOpenDoctorModal: (doc: DoctorVisitItem) => void;
  onApproveVacation: (req: LeaveRequestItem) => void;
  onApproveDoctor: (doc: DoctorVisitItem) => void;
  addToast: (type: 'success' | 'warning' | 'error', title: string, message: string) => void;
  absenceTypesMap?: Record<string, any>;
}

export function RequestsView({
  activePersona,
  isManagerOrAdmin,
  agendaTab,
  setAgendaTab,
  myVacationRequests,
  myDoctorVisits,
  colleagueVacationRequests,
  colleagueDoctorVisits,
  pendingUsers = [],
  companySettings,
  handleApproveUser,
  onOpenNewRequestModal,
  onOpenVacationModal,
  onOpenDoctorModal,
  onApproveVacation: _onApproveVacation,
  onApproveDoctor: _onApproveDoctor,
  addToast,
  absenceTypesMap
}: RequestsViewProps) {
  const [myStatusFilter, setMyStatusFilter] = useState<RequestStatusFilter>('all');
  const [colleaguesStatusFilter, setColleaguesStatusFilter] = useState<RequestStatusFilter>('pending');

  const isAdminOrOfficer =
    activePersona.role === 'admin' || activePersona.role === 'office_manager';
  const effectiveTab: RequestsPageTab = !isManagerOrAdmin
    ? 'my'
    : agendaTab === 'onboarding' && !isAdminOrOfficer
    ? 'my'
    : agendaTab;

  const statusFilter: RequestStatusFilter =
    effectiveTab === 'colleagues' ? colleaguesStatusFilter : myStatusFilter;
  const setStatusFilter = (next: RequestStatusFilter) => {
    if (effectiveTab === 'colleagues') {
      setColleaguesStatusFilter(next);
    } else {
      setMyStatusFilter(next);
    }
  };

  const myAllItems: UnifiedAbsenceRequestItem[] = [
    ...myVacationRequests,
    ...myDoctorVisits
  ];
  const colleagueAllItems: UnifiedAbsenceRequestItem[] = [
    ...colleagueVacationRequests,
    ...colleagueDoctorVisits
  ];
  const colleaguePendingCount = colleagueAllItems.filter((item) => item.status === 'pending').length;

  const activeItems = effectiveTab === 'colleagues' ? colleagueAllItems : myAllItems;

  const pendingCount = activeItems.filter((item) => item.status === 'pending').length;
  const approvedCount = activeItems.filter((item) => item.status === 'approved').length;
  const rejectedCount = activeItems.filter((item) => item.status === 'rejected').length;

  const filteredItems = sortAbsenceRequests<UnifiedAbsenceRequestItem>(
    activeItems.filter((item) => {
      if (statusFilter === 'all') return true;
      return item.status === statusFilter;
    })
  );

  const tabOptions = [
    {
      id: 'my' as RequestsPageTab,
      label: 'Moje žádosti',
      badge: myAllItems.length > 0 ? myAllItems.length : undefined,
      badgeClass: 'bg-slate-200 dark:bg-zinc-600 text-slate-700 dark:text-zinc-200'
    },
    {
      id: 'colleagues' as RequestsPageTab,
      label: 'Žádosti kolegů',
      badge:
        colleaguePendingCount > 0
          ? colleaguePendingCount
          : colleagueAllItems.length > 0
          ? colleagueAllItems.length
          : undefined,
      badgeClass:
        colleaguePendingCount > 0
          ? 'bg-amber-500 text-white'
          : 'bg-slate-200 dark:bg-zinc-600 text-slate-700 dark:text-zinc-200'
    },
    ...(isAdminOrOfficer
      ? [
          {
            id: 'onboarding' as RequestsPageTab,
            label: 'Onboarding žádosti',
            badge: pendingUsers.length > 0 ? pendingUsers.length : undefined,
            badgeClass: 'bg-amber-500 text-white'
          }
        ]
      : [])
  ];

  const statusFilterOptions: { id: RequestStatusFilter; label: string; count: number; dotClass?: string }[] = [
    { id: 'all', label: 'Vše', count: activeItems.length },
    { id: 'pending', label: 'Čekající', count: pendingCount, dotClass: 'bg-amber-500' },
    { id: 'approved', label: 'Schválené', count: approvedCount, dotClass: 'bg-emerald-500' },
    { id: 'rejected', label: 'Neschválené', count: rejectedCount, dotClass: 'bg-rose-500' }
  ];

  return (
    <Box
      header={{
        icon: SECTIONS.requests.icon,
        title: activePersona.role === 'colleague' ? 'Moje žádosti' : 'Žádosti',
        subtitle:
          activePersona.role === 'colleague'
            ? 'Přehled vašich žádostí zadaných v tomto roce (v lednu i za prosinec)'
            : 'Přehled vašich žádostí, žádostí kolegů dle oprávnění a onboarding nových uživatelů',
        full: true,
        actions: isManagerOrAdmin ? (
          <SegmentedControl
            value={effectiveTab}
            onChange={(nextTab) => {
              setAgendaTab(nextTab);
              if (nextTab === 'colleagues') {
                setColleaguesStatusFilter('pending');
              } else {
                setMyStatusFilter('all');
              }
            }}
            size="sm"
            options={tabOptions}
          />
        ) : undefined
      }}
    >
      {/* 1. ONBOARDING ŽÁDOSTI (Officer & Administrátor) */}
      {effectiveTab === 'onboarding' && isAdminOrOfficer ? (
        <div className="space-y-3">
          {pendingUsers.length === 0 ? (
            <div className="p-8 rounded-2xl bg-slate-100/70 dark:bg-zinc-800/40 text-center space-y-1.5">
              <CheckCircle2 className="w-7 h-7 text-emerald-500 mx-auto mb-1" />
              <p className="text-sm font-semibold text-slate-800 dark:text-zinc-200">
                Žádné čekající onboarding žádosti
              </p>
              <p className="text-xs text-slate-400 dark:text-zinc-500 max-w-md mx-auto">
                Všichni nově přihlášení uživatelé mají nastavený úvazek a schválený účet.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold font-mono uppercase text-slate-700 dark:text-zinc-300">
                <Users className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>Čekající nové registrace zaměstnanců ({pendingUsers.length})</span>
              </div>
              {pendingUsers.map((u) => (
                <PendingUserCard
                  key={u.id}
                  user={u}
                  baseDailyHours={companySettings?.dailyHours}
                  weeklyWorkDays={companySettings?.weeklyWorkDays}
                  defaultVacationDays={companySettings?.defaultVacationDays}
                  defaultSickDays={companySettings?.defaultSickDays}
                  defaultHomeOfficeWeeklyDays={companySettings?.defaultHomeOfficeWeeklyDays}
                  onApprove={(role, contractKind, weeklyHours, vacationDays, sickDays, homeOfficeDays, contractType) =>
                    handleApproveUser &&
                    handleApproveUser(
                      u.id,
                      role,
                      contractKind,
                      weeklyHours,
                      vacationDays,
                      sickDays,
                      homeOfficeDays,
                      contractType
                    )
                  }
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        /* 2. MOJE ŽÁDOSTI NEBO ŽÁDOSTI KOLEGŮ */
        <div className="space-y-4">
          {effectiveTab === 'my' && (
            <QuickRequestActions
              onSelectType={(type) => onOpenNewRequestModal(type)}
              isOsvc={activePersona.contract === 'OSVČ'}
              absenceTypesMap={absenceTypesMap}
            />
          )}

          {/* Filtrování podle čekající / schválené / neschválené */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {statusFilterOptions.map((opt) => {
              const isActive = statusFilter === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setStatusFilter(isActive && opt.id !== 'all' ? 'all' : opt.id)}
                  className={`px-3 py-1.5 rounded-xl font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                    isActive
                      ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                      : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200/70 dark:hover:bg-zinc-700'
                  }`}
                >
                  {opt.dotClass && (
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isActive ? 'bg-slate-950' : opt.dotClass
                      }`}
                    />
                  )}
                  <span>
                    {opt.label} ({opt.count})
                  </span>
                </button>
              );
            })}
          </div>

          {filteredItems.length === 0 ? (
            <div className="p-6 rounded-2xl bg-slate-100/70 dark:bg-zinc-800/40 text-center space-y-1.5">
              <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-1" />
              <p className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-zinc-200">
                {statusFilter !== 'all'
                  ? 'Žádné žádosti neodpovídají zvolenému filtru stavu'
                  : effectiveTab === 'colleagues'
                  ? 'Žádné žádosti kolegů v tomto období'
                  : 'Zatím nemáte v tomto období podanou žádnou žádost'}
              </p>
              {effectiveTab === 'my' && statusFilter === 'all' && (
                <button
                  onClick={() => {
                    if (activePersona.id === 'anonymous') {
                      addToast(
                        'warning',
                        'Nepřihlášená osoba',
                        'Pro podání žádosti o volno nebo nahlášení lékaře se nejprve přihlaste výběrem osoby v horní liště.'
                      );
                      return;
                    }
                    onOpenNewRequestModal();
                  }}
                  className="mt-1 text-xs text-amber-600 dark:text-amber-400 font-semibold hover:underline"
                >
                  + Naplánovat dovolenou nebo nahlásit lékaře nyní
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredItems.map((item) => (
                <AbsenceRequestRow
                  key={item.id}
                  request={item}
                  showApplicant={effectiveTab === 'colleagues'}
                  onOpenDetail={() =>
                    isDoctorRequest(item) ? onOpenDoctorModal(item) : onOpenVacationModal(item)
                  }
                />
              ))}
            </div>
          )}
        </div>
      )}
    </Box>
  );
}

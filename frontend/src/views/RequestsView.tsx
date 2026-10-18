import { useState } from 'react';
import {
  CheckCircle2,
  Users
} from 'lucide-react';
import { type Persona } from '../types/attendance';
import type { LeaveRequestItem } from '../components/LeaveRequestModal';
import type { DoctorVisitItem } from '../components/DoctorVisitModal';
import type { RequestTypeOption } from '../components/NewRequestModal';
import { QuickRequestActions } from '../components/QuickRequestActions';
import { AbsenceRequestRow, sortAbsenceRequests, isDoctorRequest, type UnifiedAbsenceRequestItem } from '../components/AbsenceRequestRow';
import { PendingUserCard } from '../components/PendingUserCard';
import { Box, SegmentedControl } from '../components/ui';
import { SECTIONS } from '../config/sectionsConfig';

export { PendingUserCard };

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
  contractTypes?: any[];
  handleApproveUser?: (
    userId: string,
    role: string,
    contractKind: string,
    weeklyHours: number,
    vacationDays?: number,
    sickDays?: number,
    homeOfficeWeeklyDays?: number,
    contractType?: string,
    allowances?: Record<string, number>
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
  contractTypes,
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
    }),
    'desc'
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
            full
            value={effectiveTab}
            onChange={(nextTab) => {
              setAgendaTab(nextTab);
              if (nextTab === 'colleagues') {
                setColleaguesStatusFilter('pending');
              } else {
                setMyStatusFilter('all');
              }
            }}
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
                  defaultVacationDays={absenceTypesMap?.vacation?.defaultAllowance ?? 20}
                  defaultSickDays={absenceTypesMap?.sick_day?.defaultAllowance ?? 3}
                  defaultHomeOfficeWeeklyDays={absenceTypesMap?.home_office?.defaultAllowance ?? 2}
                  contractTypes={contractTypes}
                  absenceTypesMap={absenceTypesMap}
                  onApprove={(role, contractKind, weeklyHours, vacationDays, sickDays, homeOfficeDays, contractType, allowances) =>
                    handleApproveUser &&
                    handleApproveUser(
                      u.id,
                      role,
                      contractKind,
                      weeklyHours,
                      vacationDays,
                      sickDays,
                      homeOfficeDays,
                      contractType,
                      allowances
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
              vacationRemaining={activePersona.vacationRemaining}
              vacationTotal={activePersona.vacationTotal}
              sickDaysRemaining={activePersona.sickDaysRemaining}
              sickDaysTotal={activePersona.sickDaysTotal}
              homeOfficeWeeklyLimit={activePersona.homeOfficeDays}
              userRequests={myVacationRequests}
              isPermanentHomeOffice={activePersona.isPermanentHomeOffice}
              className="pb-3"
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

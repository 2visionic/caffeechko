import {
  Footprints,
  DoorOpen,
  CalendarDays,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  Users
} from 'lucide-react';
import type { Persona, ShiftBlock } from '../types/attendance';
import { formatHoursMinutes } from '../types/attendance';
import type { LeaveRequestItem } from '../components/LeaveRequestModal';
import type { DoctorVisitItem } from '../components/DoctorVisitModal';
import type { AbsenceTypeConfigDto } from '../api';
import { DayTimeline } from '../components/DayTimeline';
import { RoleBadge } from '../components/RoleBadge';
import { QuickRequestActions } from '../components/QuickRequestActions';
import { WhoIsWhereBox } from '../components/WhoIsWhereBox';
import { AbsenceRequestRow, sortAbsenceRequests, isDoctorRequest, type UnifiedAbsenceRequestItem } from '../components/AbsenceRequestRow';
import { TodayFundWidget } from '../components/ui/TodayFundWidget';
import { Box, Button, UserAvatar, StatPill, SegmentedControl } from '../components/ui';
import { SECTIONS } from '../config/sectionsConfig';
import { PendingUserCard, type RequestsPageTab } from './RequestsView';

interface DashboardViewProps {
  activePersona: Persona;
  isClockedIn: boolean;
  activeLocation: 'office' | 'home_office';
  clockInTime: string;
  workplaceName: string;
  hoursToday: number;
  currentShifts: ShiftBlock[];
  personasList: Persona[];
  getPersonaStatus: (p: Persona) => any;
  realMonthHoursWorked: number;
  realMonthFundHours: number;
  dailyTargetHours?: number;
  realOvertimeHours: string | number;
  realVacationRemaining: number | string;
  realVacationTotal?: number;
  realSickDaysRemaining: number | string;
  realSickDaysTotal?: number;
  realIllnessDays: number | string;
  realDoctorHours: number | string;
  realHomeOfficeDays: number | string;
  realUnpaidDays: number | string;
  onClockIn: () => void;
  onClockOut: () => void;
  onOpenNewRequestModal: (initialType?: any) => void;
  onOpenVacationModal: (r: LeaveRequestItem) => void;
  onOpenDoctorModal: (d: DoctorVisitItem) => void;
  onApproveVacation: (r: LeaveRequestItem) => void;
  onApproveDoctor: (d: DoctorVisitItem) => void;
  displayedDashboardVacations: LeaveRequestItem[];
  displayedDashboardDoctors: DoctorVisitItem[];
  totalDisplayedDashboardCount: number;
  myDashboardCount: number;
  dashboardRequestsTab: RequestsPageTab;
  setDashboardRequestsTab: (tab: RequestsPageTab) => void;
  canActivePersonaApprove: boolean;
  totalManagerPendingCount: number;
  colleaguePendingCount: number;
  colleagueDashboardVacations: LeaveRequestItem[];
  colleagueDashboardDoctors: DoctorVisitItem[];
  isColleaguesTab: boolean;
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
  addToast: (type: 'success' | 'warning' | 'error', title: string, message: string) => void;
  /** Zda zobrazujeme pohled Detail osoby (žlutá tlačítka příchodu/odchodu i absencí, bez Kdo je kde) */
  isPersonDetailView?: boolean;
  onClosePersonDetail?: () => void;
  onSelectPersona?: (p: Persona) => void;
  /** Zda osoba v dnešní den čerpá celodenní absenci (dovolená, sick day, neplacené volno, nemoc) -> zákaz příchodu a odchodu */
  hasFullDayAbsenceToday?: boolean;
  fullDayAbsenceLabel?: string;
  /** Konfigurace typů absencí z DB */
  absenceTypesMap?: Record<string, AbsenceTypeConfigDto>;
}

export function DashboardView({
  activePersona,
  isClockedIn,
  activeLocation,
  clockInTime,
  workplaceName,
  hoursToday,
  currentShifts,
  personasList,
  getPersonaStatus,
  realMonthHoursWorked,
  realMonthFundHours,
  dailyTargetHours,
  realOvertimeHours,
  realVacationRemaining,
  realVacationTotal,
  realSickDaysRemaining,
  realSickDaysTotal,
  realIllnessDays,
  realDoctorHours,
  realHomeOfficeDays,
  realUnpaidDays,
  onClockIn,
  onClockOut,
  onOpenNewRequestModal,
  onOpenVacationModal,
  onOpenDoctorModal,
  onApproveVacation: _onApproveVacation,
  onApproveDoctor: _onApproveDoctor,
  displayedDashboardVacations,
  displayedDashboardDoctors,
  totalDisplayedDashboardCount,
  myDashboardCount,
  dashboardRequestsTab,
  setDashboardRequestsTab,
  canActivePersonaApprove,
  totalManagerPendingCount,
  colleaguePendingCount,
  colleagueDashboardVacations,
  colleagueDashboardDoctors,
  isColleaguesTab,
  pendingUsers = [],
  companySettings,
  handleApproveUser,
  addToast,
  isPersonDetailView = false,
  onClosePersonDetail,
  onSelectPersona,
  hasFullDayAbsenceToday = false,
  fullDayAbsenceLabel,
  absenceTypesMap
}: DashboardViewProps) {
  const isAdminOrOfficer =
    activePersona.role === 'admin' || activePersona.role === 'office_manager';
  const effectiveDashboardTab: RequestsPageTab =
    isPersonDetailView || activePersona.role === 'colleague'
      ? 'my'
      : dashboardRequestsTab === 'onboarding' && !isAdminOrOfficer
      ? 'my'
      : dashboardRequestsTab;
  const colleagueDashboardTotalCount =
    colleagueDashboardVacations.length + colleagueDashboardDoctors.length;
  return (
    <div className="space-y-6">
      {/* 1. Dnešní přítomnost / Detail osoby (Modern MD3 Airy Timeline Card) */}
      <Box
        className="space-y-6"
        header={
          isPersonDetailView
            ? {
                icon: SECTIONS.persons.icon,
                title: 'Detail osoby',
                subtitle: `Přehled docházky a přímé ovládání osoby ${activePersona.name}`,
                actions: onClosePersonDetail ? (
                  <Button
                    variant="surface"
                    size="sm"
                    icon={ArrowLeft}
                    onClick={onClosePersonDetail}
                  >
                    Zpět
                  </Button>
                ) : undefined
              }
            : undefined
        }
      >
        {/* Top row: Osoba (vlevo) + Dnešní fond (vpravo ve stejné úrovni) */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <UserAvatar
              name={activePersona.name}
              size="lg"
              isCurrent={activePersona.id !== 'anonymous'}
              isOnline={isClockedIn}
            />

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white truncate">
                  {activePersona.name}
                </span>
                {activePersona.id !== 'anonymous' && (
                  <RoleBadge role={activePersona.role} roleLabel={activePersona.roleLabel} />
                )}
              </div>

              <h2 className="text-base sm:text-lg font-normal tracking-tight text-slate-900 dark:text-white mt-0.5 leading-snug">
                {activePersona.id === 'anonymous' ? (
                  'Nepřihlášeno (veřejný kiosek)'
                ) : hasFullDayAbsenceToday && fullDayAbsenceLabel ? (
                  fullDayAbsenceLabel
                ) : isClockedIn ? (
                  activeLocation === 'office' ? (
                    <>
                      V práci od {clockInTime} <span className="text-slate-400 dark:text-zinc-600 font-normal">•</span> {workplaceName}
                    </>
                  ) : (
                    <>Home Office od {clockInTime}</>
                  )
                ) : (
                  'Mimo práci'
                )}
              </h2>
            </div>
          </div>

          {activePersona.id !== 'anonymous' && (
            <TodayFundWidget
              worked={formatHoursMinutes(hoursToday)}
              target={formatHoursMinutes(dailyTargetHours ?? activePersona.dailyHours ?? 8)}
              isClockedIn={isClockedIn}
            />
          )}
        </div>

        {/* Two Main Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 sm:pt-6">
          <Button
            variant="filled"
            colorKey={isPersonDetailView ? 'amber' : 'emerald'}
            iconClassName={isPersonDetailView ? 'text-slate-950' : ''}
            size="hero"
            icon={Footprints}
            disabled={isClockedIn || hasFullDayAbsenceToday}
            onClick={() => {
              if (activePersona.id === 'anonymous') {
                addToast(
                  'warning',
                  'Nepřihlášená osoba',
                  'Pro zaznamenání příchodu vyberte osobu v horní vývojářské liště nebo přiložte NFC čip.'
                );
                return;
              }
              if (hasFullDayAbsenceToday) return;
              onClockIn();
            }}
            fullWidth
          >
            PŘÍCHOD
          </Button>

          <Button
            variant="filled"
            colorKey={isPersonDetailView ? 'amber' : 'rose'}
            iconClassName={isPersonDetailView ? 'text-slate-950' : ''}
            size="hero"
            icon={DoorOpen}
            disabled={!isClockedIn || hasFullDayAbsenceToday}
            onClick={() => {
              if (activePersona.id === 'anonymous') {
                addToast(
                  'warning',
                  'Nepřihlášená osoba',
                  'Pro zaznamenání odchodu vyberte osobu v horní vývojářské liště.'
                );
                return;
              }
              if (hasFullDayAbsenceToday) return;
              onClockOut();
            }}
            fullWidth
          >
            ODCHOD
          </Button>
        </div>

        {/* Progress Timeline Bar */}
        <div className="pt-3 sm:pt-4">
          <DayTimeline
            shifts={currentShifts}
            isClockedIn={isClockedIn}
            activeLocation={activeLocation}
            workplaceName={workplaceName}
          />
        </div>

        {/* Divider */}
        <div className="pt-3 sm:pt-4 pb-1 sm:pb-2">
          <div className="border-b border-slate-200/50 dark:border-zinc-800" />
        </div>

        {/* Sumarizace (makro pilulky pozicované od středu, nulové skryté vyjma fondu) */}
        {(() => {
          const isNonZeroStat = (val: string | number | undefined | null): boolean => {
            if (val === undefined || val === null || val === '—' || val === '') return false;
            if (typeof val === 'number') return val !== 0;
            const t = val.trim();
            return (
              t !== '0' &&
              t !== '+0' &&
              t !== '-0' &&
              t !== '0h 00m' &&
              t !== '+0h 00m' &&
              t !== '-0h 00m' &&
              t !== '0.0h' &&
              t !== '+0.0h'
            );
          };

          return (
            <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 py-1">
              <StatPill
                icon={CalendarDays}
                colorKey="emerald"
                value={realMonthHoursWorked}
                total={realMonthFundHours}
                unit="h"
                label={new Date().toLocaleString('cs-CZ', { month: 'long' })}
              />
              {isNonZeroStat(realOvertimeHours) && (
                <StatPill
                  icon={TrendingUp}
                  colorKey="sky"
                  value={realOvertimeHours}
                  label="Přesčas"
                  valueColorClass="text-emerald-600 dark:text-emerald-400"
                />
              )}
              {isNonZeroStat(realVacationRemaining) && isNonZeroStat(realVacationTotal) && (
                <StatPill
                  activityType="vacation"
                  value={realVacationRemaining}
                  total={realVacationTotal}
                  unit="d"
                  label={absenceTypesMap?.vacation?.nameEmployee}
                />
              )}
              {isNonZeroStat(realSickDaysRemaining) && isNonZeroStat(realSickDaysTotal) && (
                <StatPill
                  activityType="sick_day"
                  value={realSickDaysRemaining}
                  total={realSickDaysTotal}
                  unit="d"
                  label={absenceTypesMap?.sick_day?.nameEmployee}
                />
              )}
              {isNonZeroStat(realIllnessDays) && (
                <StatPill
                  activityType="illness"
                  value={realIllnessDays}
                  unit="d"
                  label={absenceTypesMap?.illness?.nameEmployee}
                />
              )}
              {isNonZeroStat(realDoctorHours) && (
                <StatPill
                  activityType="doctor"
                  value={realDoctorHours}
                  unit="h"
                  label={absenceTypesMap?.doctor?.nameEmployee}
                />
              )}
              {isNonZeroStat(realHomeOfficeDays) && (
                <StatPill
                  activityType="home_office"
                  value={realHomeOfficeDays}
                  unit="d"
                  label={absenceTypesMap?.home_office?.nameEmployee}
                />
              )}
              {isNonZeroStat(realUnpaidDays) && (
                <StatPill
                  activityType="unpaid_leave"
                  value={realUnpaidDays}
                  unit="d"
                  label={absenceTypesMap?.unpaid_leave?.nameEmployee}
                />
              )}
            </div>
          );
        })()}

        {/* Rychlá akční tlačítka absencí (sdílená komponenta) */}
        <QuickRequestActions
          onSelectType={onOpenNewRequestModal}
          isManagingOtherPerson={isPersonDetailView}
          isOsvc={activePersona.contract === 'OSVČ'}
          absenceTypesMap={absenceTypesMap}
          className="pt-3"
        />
      </Box>

      {/* 2. Aktuální žádosti Card */}
      <Box
        header={{
          icon: SECTIONS.requests.icon,
          title: 'Aktuální žádosti',
          subtitle: isPersonDetailView
            ? `Aktivní žádosti osoby ${activePersona.name} v tomto a následujícím měsíci, čekající a nepřečtené`
            : 'Čekající, nepřečtené a schválené žádosti pro tento a následující měsíc',
          full: true,
          actions:
            isPersonDetailView || activePersona.role === 'colleague' ? undefined : (
              <SegmentedControl
                value={effectiveDashboardTab}
                onChange={(v) => setDashboardRequestsTab(v as RequestsPageTab)}
                size="sm"
                options={[
                  {
                    id: 'my' as RequestsPageTab,
                    label: 'Moje žádosti',
                    badge: myDashboardCount > 0 ? myDashboardCount : undefined,
                    badgeClass: 'bg-slate-200 dark:bg-zinc-600 text-slate-700 dark:text-zinc-200'
                  },
                  {
                    id: 'colleagues' as RequestsPageTab,
                    label: 'Žádosti kolegů',
                    badge:
                      colleaguePendingCount > 0
                        ? colleaguePendingCount
                        : colleagueDashboardTotalCount > 0
                        ? colleagueDashboardTotalCount
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
                ]}
              />
            )
        }}
      >
        {/* Manažerská notifikace */}
        {!isPersonDetailView && canActivePersonaApprove && effectiveDashboardTab === 'my' && totalManagerPendingCount > 0 && (
          <div className="mb-4 p-3.5 rounded-2xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-xs text-amber-800 dark:text-amber-300">
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
              <span className="font-medium">
                Máte <strong className="font-bold">{totalManagerPendingCount} {totalManagerPendingCount === 1 ? 'žádost' : totalManagerPendingCount < 5 ? 'žádosti' : 'žádostí'}</strong> od členů týmu čekající na vaše posouzení.
              </span>
            </div>
            <Button
              variant="outline"
              colorKey="amber"
              size="xs"
              onClick={() => setDashboardRequestsTab('colleagues')}
              className="self-end sm:self-auto flex-shrink-0"
            >
              Zobrazit žádosti kolegů
            </Button>
          </div>
        )}

        {!isPersonDetailView && effectiveDashboardTab === 'onboarding' && isAdminOrOfficer ? (
          pendingUsers.length === 0 ? (
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
          )
        ) : totalDisplayedDashboardCount === 0 ? (
          <div className="p-8 rounded-2xl bg-slate-100/70 dark:bg-zinc-800/40 text-center space-y-1.5">
            <CheckCircle2 className="w-7 h-7 text-emerald-500 mx-auto mb-1" />
            <p className="text-sm font-semibold text-slate-800 dark:text-zinc-200">
              {!isPersonDetailView && isColleaguesTab
                ? 'Žádné čekající žádosti kolegů'
                : 'Žádné aktivní žádosti v tomto ani následujícím měsíci'}
            </p>
            <p className="text-xs text-slate-400 dark:text-zinc-500 max-w-md mx-auto">
              {isPersonDetailView
                ? `Osoba ${activePersona.name} nemá žádné aktivní ani čekající žádosti.`
                : isColleaguesTab
                ? activePersona.role === 'team_lead'
                  ? 'Členové vašeho týmu nemají žádné čekající žádosti.'
                  : 'V této chvíli nejsou evidovány žádné čekající žádosti kolegů.'
                : 'Nemáte naplánovanou žádnou aktivní žádost ani požadavky čekající na schválení.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {sortAbsenceRequests<UnifiedAbsenceRequestItem>([
              ...displayedDashboardVacations,
              ...displayedDashboardDoctors
            ]).map((item) => (
              <AbsenceRequestRow
                key={item.id}
                request={item}
                showApplicant={!isPersonDetailView && isColleaguesTab}
                onOpenDetail={() =>
                  isDoctorRequest(item) ? onOpenDoctorModal(item) : onOpenVacationModal(item)
                }
              />
            ))}
          </div>
        )}
      </Box>

      {/* 3. Kdo je kde (Live Radar) - v Detailu osoby se nezobrazuje */}
      {!isPersonDetailView && (
        <WhoIsWhereBox
          personasList={personasList}
          activePersona={activePersona}
          getPersonaStatus={getPersonaStatus}
          onSelectPersona={onSelectPersona}
        />
      )}
    </div>
  );
}

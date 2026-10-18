import { useState, useEffect } from 'react';
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
import { type AbsenceTypeConfigDto } from '../api';
import { getStatusConfig, type StatusType } from '../config/presenceConfig';
import { DayTimeline } from '../components/DayTimeline';
import { RoleBadge } from '../components/RoleBadge';
import { QuickRequestActions } from '../components/QuickRequestActions';
import { WhoIsWhereBox } from '../components/WhoIsWhereBox';
import { MyTimesheetView } from '../components/MyTimesheetView';
import { AbsenceRequestRow, sortAbsenceRequests, isDoctorRequest, type UnifiedAbsenceRequestItem } from '../components/AbsenceRequestRow';
import { TodayFundWidget } from '../components/ui/TodayFundWidget';
import { Box, Button, UserAvatar, StatPill, SegmentedControl } from '../components/ui';
import { SECTIONS } from '../config/sectionsConfig';
import { PendingUserCard, type RequestsPageTab } from './RequestsView';
import { AbsenceOverviewList, AbsencesView } from './AbsencesView';
import type { RecordEditLogDto } from '../api';

type PersonDetailTab = 'prehled' | 'zadosti' | 'absence' | 'vykazy';
type PersonRequestStatusFilter = 'all' | 'pending' | 'approved' | 'rejected';

export interface UpcomingAbsenceItem {
  id: string;
  applicantId: string;
  userName: string;
  userRole?: string;
  contract?: 'HPP' | 'OSVČ';
  contractType?: 'full_time' | 'half_time' | 'part_time';
  contractTypeName?: string;
  managerId?: string | null;
  managerName?: string | null;
  parentPersonId?: string | null;
  parentPersonName?: string | null;
  type: string;
  typeName?: string;
  startDate: string;
  endDate: string;
  daysCount: number;
  startTime?: string | null;
  endTime?: string | null;
  note?: string | null;
  status?: 'pending' | 'approved' | 'rejected';
  isRead?: boolean;
  createdAt?: string;
  approvedByName?: string | null;
  approvedByIsFemale?: boolean | null;
  approvedAt?: string | null;
  editLogs?: RecordEditLogDto[];
  isPermanentHomeOffice?: boolean;
}

interface DashboardViewProps {
  activePersona: Persona;
  /** Přihlášená osoba (která si prohlíží případný Detail osoby) */
  viewerPersona?: Persona;
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
  onOpenAbsenceDetail?: (item: UpcomingAbsenceItem) => void;
  onApproveVacation: (r: LeaveRequestItem) => void;
  onApproveDoctor: (d: DoctorVisitItem) => void;
  displayedDashboardVacations: LeaveRequestItem[];
  displayedDashboardDoctors: DoctorVisitItem[];
  allPersonVacations?: LeaveRequestItem[];
  allPersonDoctors?: DoctorVisitItem[];
  upcomingAbsences?: UpcomingAbsenceItem[];
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
  addToast: (type: 'success' | 'warning' | 'error', title: string, message: string) => void;
  /** Zda zobrazujeme pohled Detail osoby (žlutá tlačítka příchodu/odchodu i absencí, bez Kdo je kde) */
  isPersonDetailView?: boolean;
  onClosePersonDetail?: () => void;
  onSelectPersona?: (p: Persona) => void;
  /** Zda osoba v dnešní den čerpá celodenní absenci (dovolená, sick day, neplacené volno, nemoc) -> zákaz příchodu a odchodu */
  hasFullDayAbsenceToday?: boolean;
  fullDayAbsenceLabel?: string;
  fullDayAbsenceType?: StatusType;
  /** Konfigurace typů absencí z DB */
  absenceTypesMap?: Record<string, AbsenceTypeConfigDto>;
  canTogglePermanentHomeOffice?: boolean;
  onTogglePermanentHomeOffice?: (userId: string, nextValue: boolean) => void;
  absencesRefreshTrigger?: number;
  onDataChanged?: () => void;
}

export function DashboardView({
  activePersona,
  viewerPersona,
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
  onOpenAbsenceDetail,
  onApproveVacation: _onApproveVacation,
  onApproveDoctor: _onApproveDoctor,
  displayedDashboardVacations,
  displayedDashboardDoctors,
  allPersonVacations,
  allPersonDoctors,
  upcomingAbsences = [],
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
  contractTypes,
  handleApproveUser,
  addToast,
  isPersonDetailView = false,
  onClosePersonDetail,
  onSelectPersona,
  hasFullDayAbsenceToday = false,
  fullDayAbsenceLabel,
  fullDayAbsenceType,
  absenceTypesMap,
  canTogglePermanentHomeOffice: _canTogglePermanentHomeOffice = false,
  onTogglePermanentHomeOffice: _onTogglePermanentHomeOffice,
  absencesRefreshTrigger = 0,
  onDataChanged
}: DashboardViewProps) {
  const [personDetailTab, setPersonDetailTab] = useState<PersonDetailTab>('prehled');
  const [personStatusFilter, setPersonStatusFilter] = useState<PersonRequestStatusFilter>('all');

  useEffect(() => {
    setPersonDetailTab('prehled');
    setPersonStatusFilter('all');
  }, [activePersona.id, isPersonDetailView]);

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

  const personVacationsList = allPersonVacations ?? displayedDashboardVacations;
  const personDoctorsList = allPersonDoctors ?? displayedDashboardDoctors;
  const personAllRequests: UnifiedAbsenceRequestItem[] = [
    ...personVacationsList,
    ...personDoctorsList
  ];
  const personPendingCount = personAllRequests.filter((r) => r.status === 'pending').length;
  const personApprovedCount = personAllRequests.filter((r) => r.status === 'approved').length;
  const personRejectedCount = personAllRequests.filter((r) => r.status === 'rejected').length;
  const personFilteredRequests = sortAbsenceRequests<UnifiedAbsenceRequestItem>(
    personAllRequests.filter((r) =>
      personStatusFilter === 'all' ? true : r.status === personStatusFilter
    ),
    'desc'
  );

  // Determine status icon for Dashboard header (without background or border)
  const personaLiveStatus = activePersona.id !== 'anonymous' ? getPersonaStatus(activePersona) : null;
  const headerStatusType: StatusType =
    activePersona.id === 'anonymous'
      ? 'offline'
      : hasFullDayAbsenceToday
      ? fullDayAbsenceType || (personaLiveStatus?.locationType as StatusType) || 'vacation'
      : isClockedIn
      ? activeLocation
      : (personaLiveStatus?.locationType as StatusType) || 'offline';
  const headerStatusCfg = getStatusConfig(headerStatusType);
  const HeaderStatusIcon = headerStatusCfg.icon;

  return (
    <div className="space-y-6">
      {/* 1. Dnešní přítomnost / Detail osoby (Modern MD3 Airy Timeline Card) */}
      <Box className="space-y-6">
        {/* Top row: Zpět + Osoba (vlevo) + Dnešní fond (vpravo ve stejné úrovni) */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            {isPersonDetailView && onClosePersonDetail && (
              <Button
                variant="surface"
                size="sm"
                icon={ArrowLeft}
                onClick={onClosePersonDetail}
              >
                Zpět
              </Button>
            )}
            <UserAvatar
              name={activePersona.name}
              size="lg"
              isCurrent={activePersona.id !== 'anonymous'}
              isOnline={isClockedIn}
              isPermanentHomeOffice={activePersona.isPermanentHomeOffice}
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

              <h2 className="text-base sm:text-lg font-normal tracking-tight text-slate-900 dark:text-white mt-0.5 leading-snug flex items-center gap-1.5">
                <HeaderStatusIcon
                  className={`w-4 h-4 shrink-0 ${headerStatusCfg.iconColorClass}`}
                />
                <span>
                  {activePersona.id === 'anonymous' ? (
                    'Nepřihlášeno (veřejný kiosek)'
                  ) : hasFullDayAbsenceToday && fullDayAbsenceLabel ? (
                    fullDayAbsenceLabel
                  ) : isClockedIn ? (
                    activeLocation === 'office' ? (
                      <>
                        V práci od {clockInTime}{' '}
                        <span className="text-slate-400 dark:text-zinc-600 font-normal">•</span>{' '}
                        {workplaceName}
                      </>
                    ) : (
                      <>Home Office od {clockInTime}</>
                    )
                  ) : (
                    'Mimo práci'
                  )}
                </span>
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

        {isPersonDetailView && (
          <SegmentedControl
            full
            value={personDetailTab}
            onChange={(v) => setPersonDetailTab(v as PersonDetailTab)}
            options={[
              {
                id: 'prehled' as PersonDetailTab,
                label: 'Přehled',
                icon: SECTIONS.attendance.icon
              },
              {
                id: 'zadosti' as PersonDetailTab,
                label: 'Žádosti',
                icon: SECTIONS.requests.icon,
                badge:
                  personPendingCount > 0
                    ? personPendingCount
                    : personAllRequests.length > 0
                    ? personAllRequests.length
                    : undefined,
                badgeClass:
                  personPendingCount > 0
                    ? 'bg-amber-500 text-white'
                    : 'bg-slate-200 dark:bg-zinc-600 text-slate-700 dark:text-zinc-200'
              },
              {
                id: 'absence' as PersonDetailTab,
                label: 'Absence',
                icon: SECTIONS.absences.icon
              },
              {
                id: 'vykazy' as PersonDetailTab,
                label: 'Výkazy',
                icon: SECTIONS.timesheets.icon
              }
            ]}
          />
        )}

        {(!isPersonDetailView || personDetailTab === 'prehled') && (
          <>
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
              {realVacationRemaining !== '—' && isNonZeroStat(realVacationTotal) && (
                <StatPill
                  activityType="vacation"
                  value={realVacationRemaining}
                  total={realVacationTotal}
                  unit="d"
                  label={absenceTypesMap?.vacation?.nameEmployee}
                />
              )}
              {realSickDaysRemaining !== '—' && isNonZeroStat(realSickDaysTotal) && (
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
              vacationRemaining={realVacationRemaining}
              vacationTotal={realVacationTotal}
              sickDaysRemaining={realSickDaysRemaining}
              sickDaysTotal={realSickDaysTotal}
              homeOfficeWeeklyLimit={activePersona.homeOfficeDays}
              userRequests={personVacationsList}
              isPermanentHomeOffice={activePersona.isPermanentHomeOffice}
              className="pt-3"
            />
          </>
        )}

        {isPersonDetailView && personDetailTab === 'zadosti' && (
          <div className="space-y-4">
            {/* Filtrování podle čekající / schválené / neschválené */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {(
                [
                  { id: 'all' as PersonRequestStatusFilter, label: 'Vše', count: personAllRequests.length },
                  { id: 'pending' as PersonRequestStatusFilter, label: 'Čekající', count: personPendingCount, dotClass: 'bg-amber-500' },
                  { id: 'approved' as PersonRequestStatusFilter, label: 'Schválené', count: personApprovedCount, dotClass: 'bg-emerald-500' },
                  { id: 'rejected' as PersonRequestStatusFilter, label: 'Neschválené', count: personRejectedCount, dotClass: 'bg-rose-500' }
                ]
              ).map((opt) => {
                const isActive = personStatusFilter === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setPersonStatusFilter(isActive && opt.id !== 'all' ? 'all' : opt.id)}
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

            {personFilteredRequests.length === 0 ? (
              <div className="p-8 rounded-2xl bg-slate-100/70 dark:bg-zinc-800/40 text-center space-y-1.5">
                <CheckCircle2 className="w-7 h-7 text-emerald-500 mx-auto mb-1" />
                <p className="text-sm font-semibold text-slate-800 dark:text-zinc-200">
                  {personStatusFilter !== 'all'
                    ? 'Žádné žádosti neodpovídají zvolenému filtru stavu'
                    : `Osoba ${activePersona.name} nemá žádné evidované žádosti`}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {personFilteredRequests.map((item) => (
                  <AbsenceRequestRow
                    key={item.id}
                    request={item}
                    showApplicant={false}
                    onOpenDetail={() =>
                      isDoctorRequest(item) ? onOpenDoctorModal(item) : onOpenVacationModal(item)
                    }
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {isPersonDetailView && personDetailTab === 'absence' && (
          <AbsencesView
            embedded
            userId={activePersona.id}
            personasList={personasList}
            absenceTypesMap={absenceTypesMap}
            refreshTrigger={absencesRefreshTrigger}
            onOpenAbsenceDetail={onOpenAbsenceDetail}
          />
        )}

        {isPersonDetailView && personDetailTab === 'vykazy' && (
          <MyTimesheetView
            embedded
            activePersona={activePersona}
            viewerPersona={viewerPersona ?? activePersona}
            isClockedIn={isClockedIn}
            activeLocation={activeLocation}
            clockInTime={clockInTime}
            workplaceName={workplaceName}
            hoursToday={hoursToday}
            currentShifts={currentShifts}
            dailyTargetHours={dailyTargetHours}
            myVacationRequests={personVacationsList}
            myDoctorVisits={personDoctorsList}
            addToast={addToast}
            onEntriesChanged={onDataChanged}
          />
        )}
      </Box>

      {/* 2. Aktuální žádosti Card - zobrazuje se pouze na hlavním Přehledu (mimo Detail osoby) */}
      {!isPersonDetailView && (
        <Box
          header={{
            icon: SECTIONS.requests.icon,
            title: 'Aktuální žádosti',
            subtitle: 'Čekající, nepřečtené a schválené žádosti pro tento a následující měsíc',
            full: true,
            actions:
              activePersona.role === 'colleague' ? undefined : (
                <SegmentedControl
                  full
                  value={effectiveDashboardTab}
                  onChange={(v) => setDashboardRequestsTab(v as RequestsPageTab)}
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
          {canActivePersonaApprove && effectiveDashboardTab === 'my' && totalManagerPendingCount > 0 && (
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

          {effectiveDashboardTab === 'onboarding' && isAdminOrOfficer ? (
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
            )
          ) : totalDisplayedDashboardCount === 0 ? (
            <div className="p-8 rounded-2xl bg-slate-100/70 dark:bg-zinc-800/40 text-center space-y-1.5">
              <CheckCircle2 className="w-7 h-7 text-emerald-500 mx-auto mb-1" />
              <p className="text-sm font-semibold text-slate-800 dark:text-zinc-200">
                {isColleaguesTab
                  ? 'Žádné čekající žádosti kolegů'
                  : 'Žádné aktivní žádosti v tomto ani následujícím měsíci'}
              </p>
              <p className="text-xs text-slate-400 dark:text-zinc-500 max-w-md mx-auto">
                {isColleaguesTab
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
                  showApplicant={isColleaguesTab}
                  onOpenDetail={() =>
                    isDoctorRequest(item) ? onOpenDoctorModal(item) : onOpenVacationModal(item)
                  }
                />
              ))}
            </div>
          )}
        </Box>
      )}

      {/* 3. Přehled absencí (aktuální týden a nadcházející týden) - v Detailu osoby se nezobrazuje */}
      {!isPersonDetailView && (() => {
        const now = new Date();
        const dow = now.getDay(); // 0 = Sun, 1 = Mon...
        const diffToMon = dow === 0 ? -6 : 1 - dow;
        const thisMonday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMon);
        const thisSunday = new Date(thisMonday.getFullYear(), thisMonday.getMonth(), thisMonday.getDate() + 6);
        const nextMonday = new Date(thisMonday.getFullYear(), thisMonday.getMonth(), thisMonday.getDate() + 7);
        const nextSunday = new Date(thisMonday.getFullYear(), thisMonday.getMonth(), thisMonday.getDate() + 13);

        const toIso = (d: Date) =>
          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const toShortCz = (d: Date) => `${d.getDate()}. ${d.getMonth() + 1}.`;

        const todayIso = toIso(now);
        const thisMonIso = toIso(thisMonday);
        const thisSunIso = toIso(thisSunday);
        const nextMonIso = toIso(nextMonday);
        const nextSunIso = toIso(nextSunday);

        // Nezobrazovat již ukončené absence (DatumDo < dnešní datum) a zobrazovat pouze schválené
        const currentWeekItems = upcomingAbsences.filter((a) => {
          if (a.status && a.status !== 'approved') return false;
          const s = a.startDate;
          const e = a.endDate || a.startDate;
          if (e < todayIso) return false;
          return s <= thisSunIso && e >= thisMonIso;
        });

        // Nadcházející týden zobrazuje pouze schválené absence s DatumOd (StartDateFrom) v nadcházejícím týdnu
        const nextWeekItems = upcomingAbsences.filter((a) => {
          if (a.status && a.status !== 'approved') return false;
          const s = a.startDate;
          const e = a.endDate || a.startDate;
          if (e < todayIso) return false;
          return s >= nextMonIso && s <= nextSunIso;
        });

        const totalVisibleCount = currentWeekItems.length + nextWeekItems.length;
        const countLabel =
          totalVisibleCount === 1
            ? '1 záznam'
            : totalVisibleCount >= 2 && totalVisibleCount <= 4
            ? `${totalVisibleCount} záznamy`
            : `${totalVisibleCount} záznamů`;

        const renderWeekSection = (
          weekTitle: string,
          rangeLabel: string,
          items: UpcomingAbsenceItem[],
          keyPrefix: string
        ) => (
          <div className="space-y-2">
            <div className="flex items-center justify-between px-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-300">
                {weekTitle}
              </span>
              <span className="text-[11px] font-mono text-slate-400 dark:text-zinc-500">
                {rangeLabel}
              </span>
            </div>

            {items.length === 0 ? (
              <div className="py-4 px-3 rounded-xl bg-slate-100/60 dark:bg-zinc-800/40 text-center text-xs text-slate-400 dark:text-zinc-500">
                Žádné plánované absence v tomto týdnu
              </div>
            ) : (
              <AbsenceOverviewList
                items={items}
                personasList={personasList}
                absenceTypesMap={absenceTypesMap}
                keyPrefix={keyPrefix}
                onOpenDetail={onOpenAbsenceDetail}
              />
            )}
          </div>
        );

        return (
          <Box
            header={{
              icon: SECTIONS.absences.icon,
              title: 'Přehled absencí',
              subtitle: 'Schválené absence a práce na dálku v aktuálním a nadcházejícím týdnu',
              badge: (
                <span className="text-[11px] font-semibold px-2 py-0.2 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300">
                  {countLabel}
                </span>
              )
            }}
          >
            <div className="space-y-4">
              {renderWeekSection(
                'Aktuální týden',
                `${toShortCz(thisMonday)} – ${toShortCz(thisSunday)}`,
                currentWeekItems,
                'week-curr'
              )}
              {renderWeekSection(
                'Nadcházející týden',
                `${toShortCz(nextMonday)} – ${toShortCz(nextSunday)}`,
                nextWeekItems,
                'week-next'
              )}
            </div>
          </Box>
        );
      })()}

      {/* 4. Kdo je kde (Live Radar) - v Detailu osoby se nezobrazuje */}
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

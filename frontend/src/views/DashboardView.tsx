import {
  Footprints,
  DoorOpen,
  CalendarDays,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Check
} from 'lucide-react';
import type { Persona, ShiftBlock } from '../types/attendance';
import { formatHoursMinutes, formatDateCzech } from '../types/attendance';
import type { LeaveRequestItem } from '../components/LeaveRequestModal';
import type { DoctorVisitItem } from '../components/DoctorVisitModal';
import { DayTimeline } from '../components/DayTimeline';
import { RoleBadge } from '../components/RoleBadge';
import { PresenceBadge } from '../components/PresenceBadge';
import { QuickRequestActions } from '../components/QuickRequestActions';
import { WhoIsWhereBox } from '../components/WhoIsWhereBox';
import { TodayFundWidget } from '../components/ui/TodayFundWidget';
import { Box, Button, UserAvatar, StatusBadge, StatPill, SegmentedControl } from '../components/ui';
import { SECTIONS } from '../config/sectionsConfig';

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
  dashboardRequestsTab: 'my' | 'colleagues';
  setDashboardRequestsTab: (tab: 'my' | 'colleagues') => void;
  canActivePersonaApprove: boolean;
  totalManagerPendingCount: number;
  colleaguePendingCount: number;
  colleagueDashboardVacations: LeaveRequestItem[];
  colleagueDashboardDoctors: DoctorVisitItem[];
  isColleaguesTab: boolean;
  addToast: (type: 'success' | 'warning' | 'error', title: string, message: string) => void;
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
  onApproveVacation,
  onApproveDoctor,
  displayedDashboardVacations,
  displayedDashboardDoctors,
  totalDisplayedDashboardCount,
  dashboardRequestsTab,
  setDashboardRequestsTab,
  canActivePersonaApprove,
  totalManagerPendingCount,
  colleaguePendingCount,
  colleagueDashboardVacations,
  colleagueDashboardDoctors,
  isColleaguesTab,
  addToast
}: DashboardViewProps) {
  return (
    <div className="space-y-6">
      {/* 1. Dnešní přítomnost (Modern MD3 Airy Timeline Card) */}
      <Box className="space-y-6">
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
            colorKey="emerald"
            size="hero"
            icon={Footprints}
            disabled={isClockedIn}
            onClick={() => {
              if (activePersona.id === 'anonymous') {
                addToast(
                  'warning',
                  'Nepřihlášená osoba',
                  'Pro zaznamenání příchodu vyberte osobu v horní vývojářské liště nebo přiložte NFC čip.'
                );
                return;
              }
              onClockIn();
            }}
            fullWidth
          >
            PŘÍCHOD
          </Button>

          <Button
            variant="filled"
            colorKey="rose"
            size="hero"
            icon={DoorOpen}
            disabled={!isClockedIn}
            onClick={() => {
              if (activePersona.id === 'anonymous') {
                addToast(
                  'warning',
                  'Nepřihlášená osoba',
                  'Pro zaznamenání odchodu vyberte osobu v horní vývojářské liště.'
                );
                return;
              }
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
                  label="Dovolená"
                />
              )}
              {isNonZeroStat(realSickDaysRemaining) && isNonZeroStat(realSickDaysTotal) && (
                <StatPill
                  activityType="sick_day"
                  value={realSickDaysRemaining}
                  total={realSickDaysTotal}
                  unit="d"
                  label="Sick day"
                />
              )}
              {isNonZeroStat(realIllnessDays) && (
                <StatPill
                  activityType="illness"
                  value={realIllnessDays}
                  unit="d"
                  label="Nemoc"
                />
              )}
              {isNonZeroStat(realDoctorHours) && (
                <StatPill
                  activityType="doctor"
                  value={realDoctorHours}
                  unit="h"
                  label="Lékař"
                />
              )}
              {isNonZeroStat(realHomeOfficeDays) && (
                <StatPill
                  activityType="home_office"
                  value={realHomeOfficeDays}
                  unit="d"
                  label="Home Office"
                />
              )}
              {isNonZeroStat(realUnpaidDays) && (
                <StatPill
                  activityType="unpaid_leave"
                  value={realUnpaidDays}
                  unit="d"
                  label="Neplacené"
                />
              )}
            </div>
          );
        })()}

        {/* Rychlá akční tlačítka absencí (sdílená komponenta) */}
        <QuickRequestActions
          onSelectType={onOpenNewRequestModal}
          className="pt-3"
        />
      </Box>

      {/* 2. Aktuální žádosti Card */}
      <Box
        header={{
          icon: SECTIONS.requests.icon,
          title: 'Aktuální žádosti',
          subtitle: 'Aktivní v tomto měsíci, čekající na schválení a zamítnuté',
          full: true,
          actions: activePersona.role === 'colleague' ? undefined : (
            <SegmentedControl
              value={dashboardRequestsTab}
              onChange={(v) => setDashboardRequestsTab(v as 'my' | 'colleagues')}
              size="sm"
              options={[
                { id: 'my', label: 'Moje' },
                {
                  id: 'colleagues',
                  label: 'Žádosti kolegů',
                  badge: (canActivePersonaApprove ? colleaguePendingCount : (colleagueDashboardVacations.length + colleagueDashboardDoctors.length)) > 0
                    ? (canActivePersonaApprove ? colleaguePendingCount : (colleagueDashboardVacations.length + colleagueDashboardDoctors.length))
                    : undefined
                }
              ]}
            />
          )
        }}
      >
        {/* Manažerská notifikace */}
        {canActivePersonaApprove && dashboardRequestsTab === 'my' && totalManagerPendingCount > 0 && (
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

        {totalDisplayedDashboardCount === 0 ? (
          <div className="p-8 rounded-2xl bg-slate-100/70 dark:bg-zinc-800/40 text-center space-y-1.5">
            <CheckCircle2 className="w-7 h-7 text-emerald-500 mx-auto mb-1" />
            <p className="text-sm font-semibold text-slate-800 dark:text-zinc-200">
              {isColleaguesTab
                ? 'Žádné aktivní žádosti kolegů v tomto měsíci'
                : 'Žádné aktivní žádosti v tomto měsíci ani čekající požadavky'}
            </p>
            <p className="text-xs text-slate-400 dark:text-zinc-500 max-w-md mx-auto">
              {isColleaguesTab
                ? activePersona.role === 'team_lead'
                  ? 'Členové vašeho týmu nemají v tomto měsíci žádné aktivní ani čekající žádosti.'
                  : 'V této chvíli nejsou evidovány žádné čekající ani aktivní žádosti kolegů v organizaci.'
                : 'Nemáte v tomto měsíci naplánovanou dovolenou ani žádosti čekající na schválení.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {displayedDashboardVacations.map((r) => {
              const isPending = r.status === 'pending';
              return (
                <div
                  key={r.id}
                  className="py-2.5 px-3.5 rounded-2xl bg-slate-100/70 dark:bg-zinc-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {isColleaguesTab && (
                      <>
                        <UserAvatar name={r.userName} size="sm" />
                        <div className="min-w-0 flex items-center gap-1.5 truncate">
                          <span className="font-bold text-slate-900 dark:text-white truncate">{r.userName}</span>
                          <RoleBadge role={r.userRole} roleLabel={r.userRole} />
                        </div>
                      </>
                    )}
                    <PresenceBadge
                      type={r.type}
                      customLabel={r.typeName}
                      variant="text"
                      className={isColleaguesTab ? "w-32 sm:w-36 flex-shrink-0" : "w-36 sm:w-44 flex-shrink-0"}
                    />
                    <span className="font-semibold text-slate-900 dark:text-white truncate">
                      {formatDateCzech(r.startDate)}{r.startDate !== r.endDate ? ` – ${formatDateCzech(r.endDate)}` : ''}
                    </span>
                    <span className="font-mono text-[11px] px-2 py-0.5 rounded-lg bg-white dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 flex-shrink-0">
                      {r.daysCount} {r.daysCount === 1 ? 'den' : r.daysCount < 5 ? 'dny' : 'dní'}
                    </span>
                    {r.status === 'approved' && (
                      <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium hidden md:inline truncate">
                        • Aktivní / Nadcházející
                      </span>
                    )}
                    {r.status === 'rejected' && r.rejectionReason && (
                      <span className="text-[11px] text-rose-500 hidden md:inline truncate max-w-[200px]" title={r.rejectionReason}>
                        • Důvod: {r.rejectionReason}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto flex-shrink-0">
                    {!isColleaguesTab && (r.status === 'approved' || r.status === 'rejected') && !r.isRead && (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300"
                        title="Otevřete Detail pro označení jako přečtené"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        Nepřečteno
                      </span>
                    )}

                    {isColleaguesTab && canActivePersonaApprove && isPending && (
                      <Button
                        variant="filled"
                        colorKey="emerald"
                        size="xs"
                        icon={Check}
                        onClick={() => onApproveVacation(r)}
                      >
                        Schválit
                      </Button>
                    )}

                    {(!isPending || !canActivePersonaApprove || !isColleaguesTab) && (
                      <StatusBadge status={r.status} size="sm" />
                    )}

                    <Button
                      variant="surface"
                      size="xs"
                      onClick={() => onOpenVacationModal(r)}
                    >
                      Detail
                    </Button>
                  </div>
                </div>
              );
            })}

            {displayedDashboardDoctors.map((d) => {
              const isPending = d.status === 'pending';
              return (
                <div
                  key={d.id}
                  className="py-2.5 px-3.5 rounded-2xl bg-slate-100/70 dark:bg-zinc-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {isColleaguesTab && (
                      <>
                        <UserAvatar name={d.userName} size="sm" />
                        <div className="min-w-0 flex items-center gap-1.5 truncate">
                          <span className="font-bold text-slate-900 dark:text-white truncate">{d.userName}</span>
                          <RoleBadge role={d.userRole} roleLabel={d.userRole} />
                        </div>
                      </>
                    )}
                    <PresenceBadge
                      type="doctor"
                      customLabel={d.typeName || 'Lékař'}
                      variant="text"
                      className={isColleaguesTab ? "w-32 sm:w-36 flex-shrink-0" : "w-36 sm:w-44 flex-shrink-0"}
                    />
                    <span className="font-semibold text-slate-900 dark:text-white truncate">
                      {formatDateCzech(d.date || (d as any).startDate)} ({d.startTime} – {d.endTime})
                    </span>
                    {d.facilityName && (
                      <span className="text-slate-400 dark:text-zinc-500 hidden sm:inline truncate max-w-[180px]">
                        • {d.facilityName}
                      </span>
                    )}
                    {d.status === 'rejected' && d.rejectionReason && (
                      <span className="text-[11px] text-rose-500 hidden md:inline truncate max-w-[200px]" title={d.rejectionReason}>
                        • Důvod: {d.rejectionReason}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto flex-shrink-0">
                    {!isColleaguesTab && (d.status === 'approved' || d.status === 'rejected') && !d.isRead && (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300"
                        title="Otevřete Detail pro označení jako přečtené"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        Nepřečteno
                      </span>
                    )}

                    {isColleaguesTab && canActivePersonaApprove && isPending && (
                      <Button
                        variant="filled"
                        colorKey="sky"
                        size="xs"
                        icon={Check}
                        onClick={() => onApproveDoctor(d)}
                      >
                        Schválit
                      </Button>
                    )}

                    {(!isPending || !canActivePersonaApprove || !isColleaguesTab) && (
                      <StatusBadge
                        status={d.status}
                        customLabel={d.status === 'approved' ? 'Uznáno' : d.status === 'rejected' ? 'Neuznáno' : undefined}
                        size="sm"
                      />
                    )}

                    <Button
                      variant="surface"
                      size="xs"
                      onClick={() => onOpenDoctorModal(d)}
                    >
                      Detail
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Box>

      {/* 3. Kdo je kde (Live Radar) */}
      <WhoIsWhereBox
        personasList={personasList}
        activePersona={activePersona}
        getPersonaStatus={getPersonaStatus}
      />
    </div>
  );
}

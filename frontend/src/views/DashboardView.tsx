import { useState } from 'react';
import {
  Footprints,
  DoorOpen,
  CalendarDays,
  TrendingUp,
  LayoutGrid,
  List,
  Search,
  Mail,
  Phone,
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
import { TodayFundWidget } from '../components/ui/TodayFundWidget';
import { Box, Button, UserAvatar, StatusBadge, StatPill, SegmentedControl } from '../components/ui';
import { getStatusConfig, STATUS_CONFIG_MAP, type StatusType } from '../config/presenceConfig';
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
  onOpenNewRequestModal: () => void;
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
  // Live Radar filter states (scoped to dashboard view)
  const [teamSearchQuery, setTeamSearchQuery] = useState<string>('');
  const [teamFilterStatus, setTeamFilterStatus] = useState<StatusType | 'all'>('all');
  const [presenceViewMode, setPresenceViewMode] = useState<'cards' | 'rows'>('rows');


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
              target={`${dailyTargetHours ?? activePersona.dailyHours ?? 8}h`}
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

        {/* Sumarizace (8 makro pilulek) */}
        <div className="grid grid-cols-2 min-[440px]:grid-cols-4 lg:grid-cols-8 gap-2 sm:gap-3 py-1">
          <StatPill
            icon={CalendarDays}
            colorKey="emerald"
            value={realMonthHoursWorked}
            total={realMonthFundHours}
            unit="h"
            label={new Date().toLocaleString('cs-CZ', { month: 'long' })}
          />
          <StatPill
            icon={TrendingUp}
            colorKey="sky"
            value={realOvertimeHours}
            label="Přesčas"
            valueColorClass="text-emerald-600 dark:text-emerald-400"
          />
          <StatPill
            activityType="vacation"
            value={realVacationRemaining}
            total={realVacationTotal}
            unit={realVacationRemaining === '—' ? undefined : 'd'}
            label="Dovolená"
          />
          <StatPill
            activityType="sick_day"
            value={realSickDaysRemaining}
            total={realSickDaysTotal}
            unit={realSickDaysRemaining === '—' ? undefined : 'd'}
            label="Sick day"
          />
          <StatPill
            activityType="illness"
            value={realIllnessDays}
            unit={realIllnessDays === '—' ? undefined : 'd'}
            label="Nemoc"
          />
          <StatPill
            activityType="doctor"
            value={realDoctorHours}
            unit={realDoctorHours === '—' ? undefined : 'h'}
            label="Lékař"
          />
          <StatPill
            activityType="home_office"
            value={realHomeOfficeDays}
            unit={realHomeOfficeDays === '—' ? undefined : 'd'}
            label="Home Office"
          />
          <StatPill
            activityType="unpaid_leave"
            value={realUnpaidDays}
            unit={realUnpaidDays === '—' ? undefined : 'd'}
            label="Neplacené"
          />
        </div>

        {/* Rychlá akční tlačítka absencí */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-3">
          {([
            'vacation',
            'sick_day',
            'illness',
            'doctor',
            'unpaid_leave',
            'home_office'
          ] as const).map((type) => {
            const cfg = getStatusConfig(type);
            return (
              <Button
                key={type}
                variant="default"
                colorKey={cfg.colorKey}
                size="md"
                icon={cfg.icon}
                onClick={onOpenNewRequestModal}
                fullWidth
              >
                {cfg.label}
              </Button>
            );
          })}
        </div>
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
      {(() => {
          // Dynamic team counts based on real SQLite database status & absences
          const inOfficeCount = personasList.filter((p) => getPersonaStatus(p).locationType === 'office').length;
          const homeOfficeCount = personasList.filter((p) => getPersonaStatus(p).locationType === 'home_office').length;
          const doctorCount = personasList.filter((p) => getPersonaStatus(p).locationType === 'doctor').length;
          const sickDayCount = personasList.filter((p) => getPersonaStatus(p).locationType === 'sick_day').length;
          const illnessCount = personasList.filter((p) => getPersonaStatus(p).locationType === 'illness').length;
          const vacationCount = personasList.filter((p) => getPersonaStatus(p).locationType === 'vacation').length;
          const unpaidLeaveCount = personasList.filter((p) => getPersonaStatus(p).locationType === 'unpaid_leave').length;
          const offlineCount = personasList.filter((p) => getPersonaStatus(p).locationType === 'offline').length;

          // Pořadí priorit stavů v Kdo je kde i filtrech:
          // v kanclu, homeoffice, u lekare, sickday, nemoc, dovolena, neplacene volno, mimo praci
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

          // Filter by search query and status filter
          const filteredPersonas = personasList.filter((p) => {
            const q = teamSearchQuery.toLowerCase().trim();
            if (q) {
              const match =
                p.name.toLowerCase().includes(q) ||
                p.roleLabel.toLowerCase().includes(q) ||
                p.contract.toLowerCase().includes(q) ||
                (p.managerName && p.managerName.toLowerCase().includes(q));
              if (!match) return false;
            }

            const status = getPersonaStatus(p);
            if (teamFilterStatus !== 'all' && status.locationType !== teamFilterStatus) {
              return false;
            }
            return true;
          });

          // Seřazení osob dle pořadí stavů a sekundárně dle jména
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
                title: 'Kdo je kde',
                subtitle: 'Live přehled týmu – kdo je v kanceláři, kdo na dálku a kdo na volnu či u lékaře',
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

              {/* 2. FILTRAČNÍ TLAČÍTKA NA VŠECHNY STAVY (ZALAMOVANÉ V POŽADOVANÉM POŘADÍ) */}
              <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                <button
                  type="button"
                  onClick={() => setTeamFilterStatus('all')}
                  className={`px-3 py-1.5 rounded-xl font-medium transition-all ${
                    teamFilterStatus === 'all'
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-zinc-900 shadow-sm'
                      : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200/70 dark:hover:bg-zinc-700 dark:hover:text-zinc-200'
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

                  const isActive = teamFilterStatus === statusKey;

                  return (
                    <button
                      key={statusKey}
                      type="button"
                      onClick={() => setTeamFilterStatus(statusKey)}
                      className={`px-3 py-1.5 rounded-xl font-medium transition-all flex items-center gap-1.5 ${
                        isActive
                          ? cfg.chipActiveClass
                          : cfg.chipInactiveClass
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${cfg.dotClass}`} />
                      <span>{cfg.label} ({count})</span>
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
                                  : 'text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-slate-200/60 dark:hover:bg-zinc-700'
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
                                  : 'text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 hover:bg-slate-200/60 dark:hover:bg-zinc-700'
                              }`}
                              title={isCurrent ? undefined : `Zavolat: ${p.phoneNumber}`}
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
                                  : 'text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-slate-200/60 dark:hover:bg-zinc-700'
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
                                  : 'text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 hover:bg-slate-200/60 dark:hover:bg-zinc-700'
                              }`}
                              title={isCurrent ? undefined : `Zavolat: ${p.phoneNumber}`}
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
        })()}
    </div>
  );
}

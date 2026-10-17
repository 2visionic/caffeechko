import { useState } from 'react';
import {
  CheckCircle2,
  Users,
  Check
} from 'lucide-react';
import type { Persona } from '../types/attendance';
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
            { value: 'employee', label: 'HPP (Zaměstnanec)' },
            { value: 'osvc', label: 'OSVČ (IČO)' }
          ]}
        />

        <Select
          label="Pracovní role:"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          options={[
            { value: 'colleague', label: 'Kolega / Pracovník' },
            { value: 'team_lead', label: 'Vedoucí týmu (Team Lead)' },
            { value: 'manager', label: 'Manažer / Vedoucí' },
            { value: 'office_manager', label: 'Office Manažer' },
            { value: 'admin', label: 'Administrátor' }
          ]}
        />

        <Select
          label="Typ úvazku (koeficient):"
          value={contractType}
          onChange={(e) => handleContractTypeChange(e.target.value)}
          options={[
            { value: 'full_time', label: `Plný úvazek (1.00 – ${baseDailyHours * weeklyWorkDays}h/týden)` },
            { value: 'half_time', label: `Poloviční úvazek (0.50 – ${baseDailyHours * weeklyWorkDays * 0.5}h/týden)` },
            { value: 'part_time', label: `Čtvrtinový úvazek (0.25 – ${baseDailyHours * weeklyWorkDays * 0.25}h/týden)` }
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

export interface RequestsViewProps {
  activePersona: Persona;
  isManagerOrAdmin: boolean;
  agendaTab: 'my' | 'team' | 'all';
  setAgendaTab: (tab: 'my' | 'team' | 'all') => void;
  myTotalRequestsCount: number;
  totalManagerPendingCount: number;
  myVacationRequests: LeaveRequestItem[];
  myDoctorVisits: DoctorVisitItem[];
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
  pendingVacationsForManager: LeaveRequestItem[];
  pendingDoctorsForManager: DoctorVisitItem[];
  onOpenNewRequestModal: (initialType?: RequestTypeOption) => void;
  onOpenVacationModal: (req: LeaveRequestItem) => void;
  onOpenDoctorModal: (doc: DoctorVisitItem) => void;
  onApproveVacation: (req: LeaveRequestItem) => void;
  onApproveDoctor: (doc: DoctorVisitItem) => void;
  addToast: (type: 'success' | 'warning' | 'error', title: string, message: string) => void;
}

export function RequestsView({
  activePersona,
  isManagerOrAdmin,
  agendaTab,
  setAgendaTab,
  myTotalRequestsCount,
  totalManagerPendingCount,
  myVacationRequests,
  myDoctorVisits,
  pendingUsers = [],
  companySettings,
  handleApproveUser,
  pendingVacationsForManager,
  pendingDoctorsForManager,
  onOpenNewRequestModal,
  onOpenVacationModal,
  onOpenDoctorModal,
  onApproveVacation: _onApproveVacation,
  onApproveDoctor: _onApproveDoctor,
  addToast
}: RequestsViewProps) {
  return (
    <Box
      header={{
        icon: SECTIONS.requests.icon,
        title: activePersona.role === 'colleague' ? 'Moje žádosti' : 'Žádosti & Provozní agenda',
        subtitle: activePersona.role === 'colleague'
          ? 'Přehled a správa vašich žádostí o dovolenou, sick days a návštěv lékaře'
          : 'Správa vašich žádostí o volno, propustek a schvalování týmových požadavků',
        full: true,
        actions: isManagerOrAdmin ? (
          <SegmentedControl
            full
            value={agendaTab}
            onChange={setAgendaTab}
            options={[
              { id: 'my', label: `Moje žádosti (${myTotalRequestsCount})` },
              {
                id: 'team',
                label: 'Schvalování týmu',
                badge: totalManagerPendingCount > 0 ? totalManagerPendingCount : undefined
              },
              { id: 'all', label: 'Vše' }
            ]}
          />
        ) : undefined
      }}
    >
      {/* OBSAH: MOJE ŽÁDOSTI (MINIFIKOVANÉ) */}
      {(!isManagerOrAdmin || agendaTab === 'my' || agendaTab === 'all') && (
        <div className="space-y-4">
          {/* Sdílená navigace rychlých akčních tlačítek absencí (stejná komponenta jako na Přehledu) */}
          <QuickRequestActions onSelectType={(type) => onOpenNewRequestModal(type)} />

          {isManagerOrAdmin && agendaTab === 'all' && (
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 font-mono pb-1">
              Moje podané žádosti ({myTotalRequestsCount})
            </div>
          )}

          {myTotalRequestsCount === 0 ? (
            <div className="p-5 rounded-2xl bg-slate-100/70 dark:bg-zinc-800/40 text-center">
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Zatím nemáte podanou žádnou žádost o volno ani nahlášeného lékaře.
              </p>
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
                className="mt-2 text-xs text-amber-600 dark:text-amber-400 font-semibold hover:underline"
              >
                + Naplánovat dovolenou nebo nahlásit lékaře nyní
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {sortAbsenceRequests<UnifiedAbsenceRequestItem>([
                ...myVacationRequests,
                ...myDoctorVisits
              ]).map((item) => (
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

      {/* OBSAH: SCHVALOVÁNÍ TÝMU (MINIFIKOVANÉ) */}
      {isManagerOrAdmin && (agendaTab === 'team' || agendaTab === 'all') && (
        <div className="space-y-3 pt-1">
          {agendaTab === 'all' && (
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 font-mono">
              Provozní agenda schvalování ({activePersona.roleLabel})
            </div>
          )}

          {totalManagerPendingCount === 0 && (
            <div className="p-5 rounded-2xl bg-slate-100/70 dark:bg-zinc-800/40 text-center">
              <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-1.5" />
              <p className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-zinc-200">
                Všechny žádosti vašeho týmu jsou vyřízeny
              </p>
              <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">
                Jako {activePersona.roleLabel} nemáte v této chvíli žádné čekající žádosti k posouzení.
              </p>
            </div>
          )}

          {/* ČEKAJÍCÍ NOVÉ REGISTRACE (Office Manager & Admin) */}
          {['admin', 'office_manager'].includes(activePersona.role) && pendingUsers.length > 0 && (
            <div className="space-y-2.5">
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
                    handleApproveUser && handleApproveUser(u.id, role, contractKind, weeklyHours, vacationDays, sickDays, homeOfficeDays, contractType)
                  }
                />
              ))}
            </div>
          )}

          {/* ŽÁDOSTI O VOLNO A PROPUSTKY K LÉKAŘI V TÝMU (SEŘAZENÉ) */}
          {sortAbsenceRequests<UnifiedAbsenceRequestItem>([
            ...pendingVacationsForManager,
            ...pendingDoctorsForManager
          ]).map((item) => (
            <AbsenceRequestRow
              key={item.id}
              request={item}
              showApplicant={true}
              onOpenDetail={() =>
                isDoctorRequest(item) ? onOpenDoctorModal(item) : onOpenVacationModal(item)
              }
            />
          ))}
        </div>
      )}
    </Box>
  );
}

import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Home,
  Coffee,
  CheckCircle2,
  AlertCircle,
  AlertOctagon,
  Phone,
  Mail,
  Moon,
  Sun,
  Calendar,
  ChevronDown,
  Smartphone,
  ShieldCheck,
  Users,
  Check,
  LayoutGrid,
  List,
  Clock,
  Search,
  Trash2,
  RotateCcw,
  UserX,
  LogOut,
  Settings,
  User,
  CalendarX,
  TrendingUp,
  CalendarDays,
  Palmtree,
  Thermometer,
  X
} from 'lucide-react';
import { NfcDebugSimulator } from './components/NfcDebugSimulator';
import { DayTimeline, type ShiftBlock } from './components/DayTimeline';
import { LeaveRequestModal, type LeaveRequestItem } from './components/LeaveRequestModal';
import { DoctorVisitModal, type DoctorVisitItem } from './components/DoctorVisitModal';
import { NewRequestModal, type NewRequestData } from './components/NewRequestModal';
import { InstallScreen } from './components/InstallScreen';
import { LoginScreen } from './components/LoginScreen';
import { PendingApprovalScreen } from './components/PendingApprovalScreen';
import { DevConfigModal } from './components/DevConfigModal';
import { AppNavigation, type NavTabId } from './components/AppNavigation';
import { MyTimesheetView } from './components/MyTimesheetView';
import { PersonsView } from './components/PersonsView';
import { ClosuresView } from './components/ClosuresView';
import { SettingsView } from './components/SettingsView';
import { MonthlyTimesheetModal } from './components/MonthlyTimesheetModal';
import { Header } from './components/Header';
import { Box, SectionHeader, StatPill } from './components/ui';
import { RoleBadge } from './components/RoleBadge';
import { PresenceBadge } from './components/PresenceBadge';
import { getStatusConfig, STATUS_CONFIG_MAP, type StatusType } from './config/presenceConfig';
import {
  api,
  type DevConfig,
  type RadarUserDto,
  type DatabaseMode,
  type DevDatabaseStatus,
  getStoredDbMode,
  setStoredDbMode,
  getSessionUserId,
  setSessionUserId,
  clearSessionUserId,
  setAuthToken
} from './api';
import { nfcService } from './services/nfcService';

export interface Persona {
  id: string;
  name: string;
  email: string;
  phoneNumber: string;
  role: 'admin' | 'manager' | 'team_lead' | 'office_manager' | 'colleague';
  roleLabel: string;
  managerId?: string;
  managerName?: string;
  vacationRemaining: number;
  vacationTotal: number;
  sickDaysRemaining: number;
  sickDaysTotal: number;
  unpaidLeaveDays?: number;
  contract: 'HPP' | 'OSVČ';
  isApproved?: boolean;
}

export function formatHoursMinutes(hoursDecimal: number): string {
  const totalMinutes = Math.max(0, Math.round(hoursDecimal * 60));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h ${m}m`;
}

export function formatDateCzech(dStr?: string | null): string {
  if (!dStr || typeof dStr !== 'string') return '';
  const parts = dStr.split('-');
  if (parts.length === 3) {
    return `${parseInt(parts[2], 10)}. ${parseInt(parts[1], 10)}. ${parts[0]}`;
  }
  return dStr;
}

export const DEV_PERSONAS: Persona[] = [
  {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    name: 'Jan Novotný',
    email: 'admin@firma.cz',
    phoneNumber: '+420 777 123 456',
    role: 'admin',
    roleLabel: 'Administrátor',
    vacationRemaining: 25,
    vacationTotal: 25,
    sickDaysRemaining: 3,
    sickDaysTotal: 3,
    unpaidLeaveDays: 0,
    contract: 'HPP'
  },
  {
    id: '77777777-7777-7777-7777-777777777777',
    name: 'David Sýkora',
    email: 'david.sykora@firma.cz',
    phoneNumber: '+420 777 789 012',
    role: 'manager',
    roleLabel: 'Manažer',
    vacationRemaining: 20,
    vacationTotal: 20,
    sickDaysRemaining: 3,
    sickDaysTotal: 3,
    unpaidLeaveDays: 0,
    contract: 'HPP'
  },
  {
    id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    name: 'Martina Svobodová',
    email: 'martina.svobodova@firma.cz',
    phoneNumber: '+420 777 345 678',
    role: 'office_manager',
    roleLabel: 'Office Manager',
    vacationRemaining: 18,
    vacationTotal: 20,
    sickDaysRemaining: 2,
    sickDaysTotal: 3,
    unpaidLeaveDays: 0,
    contract: 'HPP'
  },
  {
    id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    name: 'Jana Nováková',
    email: 'jana.novakova@firma.cz',
    phoneNumber: '+420 777 234 567',
    role: 'team_lead',
    roleLabel: 'Vedoucí',
    managerId: '77777777-7777-7777-7777-777777777777',
    managerName: 'David Sýkora',
    vacationRemaining: 16,
    vacationTotal: 20,
    sickDaysRemaining: 3,
    sickDaysTotal: 3,
    unpaidLeaveDays: 0,
    contract: 'HPP'
  },
  {
    id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
    name: 'Tomáš Dvořák',
    email: 'tomas.dvorak@firma.cz',
    phoneNumber: '+420 777 456 789',
    role: 'colleague',
    roleLabel: 'Kolega',
    managerId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    managerName: 'Jana Nováková',
    vacationRemaining: 12,
    vacationTotal: 20,
    sickDaysRemaining: 2,
    sickDaysTotal: 3,
    unpaidLeaveDays: 1,
    contract: 'HPP'
  },
  {
    id: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
    name: 'Martin Kovář',
    email: 'martin.kovar@firma.cz',
    phoneNumber: '+420 777 678 901',
    role: 'colleague',
    roleLabel: 'Kolega',
    managerId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    managerName: 'Jana Nováková',
    vacationRemaining: 15,
    vacationTotal: 20,
    sickDaysRemaining: 3,
    sickDaysTotal: 3,
    unpaidLeaveDays: 0,
    contract: 'HPP'
  },
  {
    id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    name: 'Lukáš Černý',
    email: 'lukas.cerny@firma.cz',
    phoneNumber: '+420 777 567 890',
    role: 'colleague',
    roleLabel: 'Kolega',
    managerId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    managerName: 'Jana Nováková',
    vacationRemaining: 0,
    vacationTotal: 0,
    sickDaysRemaining: 0,
    sickDaysTotal: 0,
    unpaidLeaveDays: 0,
    contract: 'OSVČ'
  },
  {
    id: '88888888-8888-8888-8888-888888888888',
    name: 'Eliška Králová',
    email: 'eliska.kralova@firma.cz',
    phoneNumber: '+420 777 890 123',
    role: 'colleague',
    roleLabel: 'Kolega',
    managerId: '77777777-7777-7777-7777-777777777777',
    managerName: 'David Sýkora',
    vacationRemaining: 17,
    vacationTotal: 20,
    sickDaysRemaining: 3,
    sickDaysTotal: 3,
    unpaidLeaveDays: 2,
    contract: 'HPP'
  }
];

export const UNINSTALLED_PERSONA: Persona = {
  id: 'clean-uninstalled',
  name: 'Před instalací',
  email: '',
  phoneNumber: '',
  role: 'admin',
  roleLabel: 'Před instalací',
  vacationRemaining: 0,
  vacationTotal: 0,
  sickDaysRemaining: 0,
  sickDaysTotal: 0,
  unpaidLeaveDays: 0,
  contract: 'HPP'
};

export const ANONYMOUS_PERSONA: Persona = {
  id: 'anonymous',
  name: 'Nepřihlášená osoba',
  email: '',
  phoneNumber: '',
  role: 'colleague',
  roleLabel: 'Nepřihlášen',
  vacationRemaining: 0,
  vacationTotal: 0,
  sickDaysRemaining: 0,
  sickDaysTotal: 0,
  unpaidLeaveDays: 0,
  contract: 'HPP'
};

interface ToastMessage {
  id: number;
  type: 'success' | 'warning' | 'error';
  title: string;
  message: string;
}

interface PendingUserCardProps {
  user: any;
  onApprove: (role: string, contractKind: string, weeklyHours: number) => void;
}

function PendingUserCard({ user, onApprove }: PendingUserCardProps) {
  const [role, setRole] = useState<string>('colleague');
  const [contractKind, setContractKind] = useState<string>('employee');
  const [weeklyHours, setWeeklyHours] = useState<number>(40);

  return (
    <div className="p-6 sm:p-7 rounded-3xl bg-white dark:bg-zinc-900 shadow-sm border border-amber-500/40 flex flex-col gap-5 transition-all">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-amber-500/15 text-amber-800 dark:text-amber-300 font-bold text-sm flex items-center justify-center flex-shrink-0">
            {(user.name || '?')
              .split(' ')
              .filter(Boolean)
              .map((n: string) => n[0])
              .join('')}
          </div>
          <div>
            <div className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
              <span>{user.name}</span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">
                Google Workspace registrace
              </span>
            </div>
            <div className="text-xs text-slate-500 dark:text-zinc-400">
              {user.email}
            </div>
          </div>
        </div>

        <span className="text-xs font-semibold px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 self-start sm:self-auto">
          Čeká na nastavení úvazku
        </span>
      </div>

      {/* Settings Row: Smlouva, Role, Úvazek */}
      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/60 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="text-[11px] font-mono text-slate-500 dark:text-zinc-400 block mb-1">
            Typ smlouvy:
          </label>
          <select
            value={contractKind}
            onChange={(e) => setContractKind(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-medium text-slate-800 dark:text-zinc-200"
          >
            <option value="employee">HPP (Zaměstnanec)</option>
            <option value="osvc">OSVČ (IČO)</option>
          </select>
        </div>

        <div>
          <label className="text-[11px] font-mono text-slate-500 dark:text-zinc-400 block mb-1">
            Pracovní role:
          </label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-medium text-slate-800 dark:text-zinc-200"
          >
            <option value="colleague">Kolega / Pracovník</option>
            <option value="team_lead">Vedoucí týmu (Team Lead)</option>
            <option value="manager">Manažer / Vedoucí</option>
            <option value="office_manager">Office Manažer</option>
            <option value="admin">Administrátor</option>
          </select>
        </div>

        <div>
          <label className="text-[11px] font-mono text-slate-500 dark:text-zinc-400 block mb-1">
            Týdenní fond hodin:
          </label>
          <select
            value={weeklyHours}
            onChange={(e) => setWeeklyHours(Number(e.target.value))}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-medium text-slate-800 dark:text-zinc-200 font-mono"
          >
            <option value={40}>40 hod / týdně (Plný úvazek)</option>
            <option value={30}>30 hod / týdně</option>
            <option value={20}>20 hod / týdně (Zkrácený úvazek)</option>
            <option value={10}>10 hod / týdně</option>
          </select>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <button
          onClick={() => onApprove(role, contractKind, weeklyHours)}
          className="px-5 py-2.5 rounded-2xl bg-amber-600 hover:bg-amber-700 active:scale-98 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition-all"
        >
          <Check className="w-4 h-4" />
          <span>Schválit a nastavit úvazek</span>
        </button>
      </div>
    </div>
  );
}

export function App() {
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('caffeechko_theme');
      if (saved) return saved === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  // Clean installation persistence
  const [cleanInstalled, setCleanInstalled] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('caffeechko_clean_installed') === 'true';
    }
    return false;
  });
  const [cleanAdminUser, setCleanAdminUser] = useState<Persona | null>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('caffeechko_clean_admin');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {}
      }
    }
    return null;
  });

  // Database mode: 'dev' (dochazka_dev.db) or 'clean' (dochazka_clean.db)
  const [dbMode, setDbMode] = useState<DatabaseMode>(() => getStoredDbMode());

  const [activePersona, setActivePersona] = useState<Persona>(() => {
    const mode = getStoredDbMode();
    if (mode === 'clean') {
      const isInst = typeof window !== 'undefined' && localStorage.getItem('caffeechko_clean_installed') === 'true';
      const savedAdmin = typeof window !== 'undefined' ? localStorage.getItem('caffeechko_clean_admin') : null;
      if (isInst && savedAdmin) {
        try {
          return JSON.parse(savedAdmin);
        } catch {}
      }
      return UNINSTALLED_PERSONA;
    }

    // In dev mode, check sessionStorage for currently logged-in persona
    const sessionUserId = getSessionUserId();
    if (sessionUserId === 'anonymous') {
      return ANONYMOUS_PERSONA;
    }
    if (sessionUserId) {
      const found = DEV_PERSONAS.find((p) => p.id === sessionUserId);
      if (found) return found;
    }

    return DEV_PERSONAS[0];
  });

  // Keep session storage synchronized with logged-in persona
  useEffect(() => {
    if (activePersona && activePersona.id && activePersona.id !== 'clean-uninstalled') {
      setSessionUserId(activePersona.id);
    }
  }, [activePersona]);

  // Current attendance state for active persona (loaded dynamically from SQLite DB)
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [activeLocation, setActiveLocation] = useState<'office' | 'home_office'>('office');
  const [workplaceName, setWorkplaceName] = useState('Mimo práci');
  const [clockInTime, setClockInTime] = useState('08:00');
  const [hoursToday, setHoursToday] = useState(0);
  const [currentShifts, setCurrentShifts] = useState<ShiftBlock[]>([]);
  const [teamPresence, setTeamPresence] = useState<RadarUserDto[]>([]);
  const [_weekDays, setWeekDays] = useState<{ date: string; dayName: string; hours: number; isToday: boolean }[]>([]);

  const [dbStatus, setDbStatus] = useState<DevDatabaseStatus | null>(null);
  const [isWipingCleanDb, setIsWipingCleanDb] = useState(false);
  const [isResettingDevDb, setIsResettingDevDb] = useState(false);

  // Team presence view mode: 'cards' | 'rows' (default is 'rows' as requested)
  const [presenceViewMode, setPresenceViewMode] = useState<'cards' | 'rows'>('rows');

  // Client-side visibility of Dev Mode tools (reappears on page reload)
  const [isDevVisible, setIsDevVisible] = useState(true);

  // Dev persona dropdown state
  const [isPersonaDropdownOpen, setIsPersonaDropdownOpen] = useState(false);
  const personaDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (personaDropdownRef.current && !personaDropdownRef.current.contains(event.target as Node)) {
        setIsPersonaDropdownOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsPersonaDropdownOpen(false);
      }
    }
    if (isPersonaDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isPersonaDropdownOpen]);

  // Modals state
  const [isNfcModalOpen, setIsNfcModalOpen] = useState(false);
  const [isHoLeaveModalOpen, setIsHoLeaveModalOpen] = useState(false);
  const [isNewRequestModalOpen, setIsNewRequestModalOpen] = useState(false);
  const [isDevConfigModalOpen, setIsDevConfigModalOpen] = useState(false);
  const [devConfig, setDevConfig] = useState<DevConfig>(() => {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('caffeechko_dev_config');
      if (cached) {
        try {
          return JSON.parse(cached);
        } catch {}
      }
    }
    return {
      appName: 'caffeechko',
      companyName: 'Firma s.r.o.',
      instanceName: 'firma',
      googleWorkspaceDomain: 'firma.cz',
      googleClientId: '',
      googleClientSecret: '',
      usePostgres: false,
      connectionString: 'Host=localhost;Port=5432;Database=dochazka_dev;Username=dev;Password=devpassword'
    };
  });

  useEffect(() => {
    async function fetchConfig() {
      const res = await api.getDevConfig();
      if (res?.data) {
        setDevConfig(res.data);
      }
    }
    fetchConfig();
  }, []);

  const currentDomain = devConfig.googleWorkspaceDomain || 'firma.cz';

  const effectivePersonas = useMemo(() => {
    return DEV_PERSONAS.map((p) => {
      const username = p.email ? p.email.split('@')[0] : 'user';
      return {
        ...p,
        email: `${username}@${currentDomain}`
      };
    });
  }, [currentDomain]);

  useEffect(() => {
    if (activePersona.id !== 'anonymous' && activePersona.id !== 'clean-uninstalled') {
      const username = activePersona.email ? activePersona.email.split('@')[0] : 'user';
      const updatedEmail = `${username}@${currentDomain}`;
      if (activePersona.email !== updatedEmail) {
        setActivePersona((prev) => ({ ...prev, email: updatedEmail }));
      }
    }
  }, [currentDomain, activePersona.id]);

  const [pauseReturnTime, setPauseReturnTime] = useState('14:30');

  // Vacation requests state
  const [vacationRequests, setVacationRequests] = useState<LeaveRequestItem[]>([]);
  const [selectedVacation, setSelectedVacation] = useState<LeaveRequestItem | null>(null);
  const [isVacationModalOpen, setIsVacationModalOpen] = useState(false);

  // Doctor visits state
  const [doctorVisits, setDoctorVisits] = useState<DoctorVisitItem[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<DoctorVisitItem | null>(null);
  const [isDoctorModalOpen, setIsDoctorModalOpen] = useState(false);

  // Pending user approvals (for Office Manager & Admin)
  const [pendingUsers, setPendingUsers] = useState<any[]>([]);

  // Live Radar filter states
  const [teamSearchQuery, setTeamSearchQuery] = useState<string>('');
  const [teamFilterStatus, setTeamFilterStatus] = useState<StatusType | 'all'>('all');
  const [agendaTab, setAgendaTab] = useState<'my' | 'team' | 'all'>('my');

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Dark mode effect
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('caffeechko_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const addToast = (type: 'success' | 'warning' | 'error', title: string, message: string) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  // Active navigation tab
  const [activeNavTab, setActiveNavTab] = useState<NavTabId>('dochazka');

  // Monthly timesheet modal for detailed review
  const [isMonthlyModalOpen, setIsMonthlyModalOpen] = useState(false);
  const [selectedMonthlyPersona, setSelectedMonthlyPersona] = useState<Persona | null>(null);

  // Helper to get real status from SQLite teamPresence or current active state
  const getPersonaStatus = (p: Persona) => {
    const isCurrent = p.id === activePersona.id;
    const todayStr = new Date().toISOString().split('T')[0];

    // 1. If currently clocked in, active clock-in location wins
    if (isCurrent && isClockedIn) {
      return {
        statusText: activeLocation === 'office' ? `V kanceláři (${workplaceName.split(' - ')[0]})` : 'Home Office',
        statusColor: activeLocation === 'office' ? 'emerald' : 'sky',
        locationType: activeLocation as 'office' | 'home_office'
      };
    }

    // 2. Check approved vacation/sick day requests spanning today
    const approvedVac = vacationRequests.find(
      (v) =>
        (v.applicantId === p.id || (v as any).userId === p.id || v.userName === p.name) &&
        v.status === 'approved' &&
        v.startDate <= todayStr &&
        v.endDate >= todayStr
    );
    if (approvedVac) {
      if (approvedVac.type === 'sick_day') {
        return {
          statusText: 'Sick day',
          statusColor: 'rose',
          locationType: 'sick_day' as const
        };
      }
      if (approvedVac.type === 'illness') {
        return {
          statusText: 'Nemoc',
          statusColor: 'red',
          locationType: 'illness' as const
        };
      }
      if (approvedVac.type === 'unpaid_leave') {
        return {
          statusText: 'Neplacené volno',
          statusColor: 'purple',
          locationType: 'unpaid_leave' as const
        };
      }
      return {
        statusText: 'Dovolená',
        statusColor: 'amber',
        locationType: 'vacation' as const
      };
    }

    // 3. Check approved or active doctor visits today
    const docVisit = doctorVisits.find(
      (d) =>
        (d.applicantId === p.id || (d as any).userId === p.id || d.userName === p.name) &&
        d.status !== 'rejected' &&
        (d.date === todayStr || (d as any).startDate === todayStr)
    );
    if (docVisit) {
      return {
        statusText: `U lékaře (${docVisit.startTime} – ${docVisit.endTime})`,
        statusColor: 'indigo',
        locationType: 'doctor' as const
      };
    }
    // 4. Radar status from SQLite database
    const radarItem = teamPresence.find((t) => t.userId?.toLowerCase() === p.id.toLowerCase());
    if (radarItem) {
      const locType = radarItem.statusColor === 'emerald' ? 'office' : radarItem.statusColor === 'sky' ? 'home_office' : 'offline';
      return {
        statusText: radarItem.statusText,
        statusColor: radarItem.statusColor,
        locationType: locType as 'office' | 'home_office' | 'offline'
      };
    }

    return {
      statusText: 'Mimo práci',
      statusColor: 'slate',
      locationType: 'offline' as const
    };
  };

  const personasList = dbMode === 'clean'
    ? (cleanInstalled && cleanAdminUser ? [activePersona] : [])
    : effectivePersonas;

  // Switch persona handler
  const handleSwitchPersona = async (persona: Persona) => {
    setActivePersona(persona);
    setSessionUserId(persona.id);
    setIsClockedIn(false);
    setActiveLocation('office');
    setWorkplaceName('Mimo práci');
    setClockInTime('08:00');
    setHoursToday(0);
    setCurrentShifts([]);

    if (persona.id === 'anonymous') {
      clearSessionUserId();
      addToast(
        'warning',
        'Přepnuto do nepřihlášeného stavu:',
        'Aktivní session byla odhlášena (čistá přihlašovací obrazovka).'
      );
    } else if (persona.id === 'clean-uninstalled') {
      clearSessionUserId();
    } else {
      // Dev impersonation: acquire real signed JWT token for selected dev persona
      const tokenRes = await api.devImpersonate(persona.id);
      if (tokenRes?.data?.accessToken) {
        setAuthToken(tokenRes.data.accessToken);
      }
      addToast(
        'success',
        'Přihlášena osoba (session aktivní):',
        `${persona.name} (${persona.roleLabel} • ${persona.contract})`
      );
    }
  };

  const handleGoogleLoginSuccess = (authUser: any) => {
    const persona: Persona = {
      id: authUser.id,
      name: authUser.name,
      email: authUser.email,
      phoneNumber: authUser.phoneNumber || '',
      role: authUser.role,
      roleLabel: authUser.roleLabel || 'Kolega',
      vacationRemaining: 25,
      vacationTotal: 25,
      sickDaysRemaining: 3,
      sickDaysTotal: 3,
      contract: authUser.contract === 'IČO' ? 'OSVČ' : 'HPP',
      isApproved: authUser.isApproved !== false
    };
    setActivePersona(persona);
    setSessionUserId(persona.id);
  };

  const handleLogout = async () => {
    await api.logout();
    setActivePersona(ANONYMOUS_PERSONA);
    setSessionUserId('anonymous');
    setIsClockedIn(false);
    setCurrentShifts([]);
    setVacationRequests([]);
    setDoctorVisits([]);
    setWeekDays([]);
    addToast('warning', 'Byl jste odhlášen', 'Aktivní session byla ukončena. Přepnuto do režimu recepčního kiosku.');
  };

  // Backend SQLite Database connection state
  const [isDbConnected, setIsDbConnected] = useState(false);

  const handleSwitchDatabaseMode = async (newMode: DatabaseMode) => {
    setDbMode(newMode);
    setStoredDbMode(newMode);
    await api.switchDatabase(newMode);

    // Reset local attendance state
    setIsClockedIn(false);
    setActiveLocation('office');
    setWorkplaceName('Mimo práci');
    setCurrentShifts([]);
    setHoursToday(0);

    if (newMode === 'clean') {
      if (!cleanInstalled) {
        clearSessionUserId();
        setActivePersona(UNINSTALLED_PERSONA);
        setTeamPresence([]);
        setWeekDays([]);
        setVacationRequests([]);
        setDoctorVisits([]);
        setDbStatus({
          currentMode: 'clean',
          databaseFile: 'dochazka_clean.db',
          tableCount: 0,
          userCount: 0,
          isInstalled: false
        });
      } else if (cleanAdminUser) {
        setSessionUserId(cleanAdminUser.id);
        setActivePersona(cleanAdminUser);
      }
    } else if (newMode === 'dev') {
      const savedSessionId = getSessionUserId();
      const devPersona = (savedSessionId && DEV_PERSONAS.find((p) => p.id === savedSessionId)) || DEV_PERSONAS[0];
      setSessionUserId(devPersona.id);
      setActivePersona(devPersona);
    }

    addToast(
      'success',
      'Přepnuta databáze:',
      newMode === 'clean' ? 'Instal (dochazka_clean.db)' : 'Test (dochazka_dev.db)'
    );
  };

  const handleWipeCleanDb = async () => {
    setIsWipingCleanDb(true);
    try {
      await api.wipeCleanDatabase();
      localStorage.removeItem('caffeechko_clean_installed');
      localStorage.removeItem('caffeechko_clean_admin');
      clearSessionUserId();
      setCleanInstalled(false);
      setCleanAdminUser(null);
      setActivePersona(UNINSTALLED_PERSONA);
      setDbStatus({
        currentMode: 'clean',
        databaseFile: 'dochazka_clean.db',
        tableCount: 0,
        userCount: 0,
        isInstalled: false
      });
      setIsClockedIn(false);
      setCurrentShifts([]);
      setTeamPresence([]);
      setWeekDays([]);
      setVacationRequests([]);
      setDoctorVisits([]);
      addToast('warning', 'Čistá DB vymazána', 'Všechny tabulky a struktury byly smazány. Zobrazena obrazovka první instalace.');
    } finally {
      setIsWipingCleanDb(false);
    }
  };

  const handleResetDevDb = async () => {
    if (!window.confirm('Opravdu chcete obnovit vývojářskou databázi ze šablony? Všechna lokální testovací data a noví uživatelé budou smazáni a nahrazeni čistou šablonou dochazka_dev.template.db.')) {
      return;
    }
    setIsResettingDevDb(true);
    try {
      const res = await api.resetDevDatabase();
      if (res?.data) {
        addToast('success', 'Databáze obnovena', 'Vývojářská databáze byla resetována ze šablony dochazka_dev.template.db.');
        const status = await api.getDatabaseStatus();
        if (status?.data) {
          setDbStatus(status.data);
        }
      } else {
        addToast('warning', 'Reset databáze', 'Požadavek na reset byl odeslán.');
      }
    } catch {
      addToast('error', 'Chyba resetu', 'Nepodařilo se obnovit databázi ze šablony.');
    } finally {
      setIsResettingDevDb(false);
    }
  };

  // Sync with real backend SQLite database upon mounting or persona switch
  useEffect(() => {
    let isMounted = true;
    async function syncBackendData() {
      try {
        if (dbMode === 'clean') {
          if (!cleanInstalled) {
            // In clean uninstalled mode, there are NO personas and NO active shifts
            setIsDbConnected(true);
            setIsClockedIn(false);
            setCurrentShifts([]);
            setTeamPresence([]);
            setWeekDays([]);
            setVacationRequests([]);
            setDoctorVisits([]);
            setDbStatus({
              currentMode: 'clean',
              databaseFile: 'dochazka_clean.db',
              tableCount: 0,
              userCount: 0,
              isInstalled: false
            });
            return;
          }

          setIsDbConnected(true);
          setTeamPresence([]);
          setWeekDays([]);
          setVacationRequests([]);
          setDoctorVisits([]);
          return;
        }

        if (activePersona.id === 'anonymous') {
          setIsDbConnected(true);
          setIsClockedIn(false);
          setCurrentShifts([]);
          setHoursToday(0);
          setWeekDays([]);
          setVacationRequests([]);
          setDoctorVisits([]);
          const whoRes = await api.getWhoIsWhere();
          if (whoRes && whoRes.data && isMounted) {
            setTeamPresence(whoRes.data);
          }
          return;
        }

        const dbStatusRes = await api.getDatabaseStatus();
        if (dbStatusRes?.data && isMounted) {
          setDbStatus(dbStatusRes.data);
        }

        const statusRes = await api.getStatus(activePersona.id);
        if (statusRes && statusRes.data && isMounted) {
          setIsDbConnected(true);
          setIsClockedIn(statusRes.data.isClockedIn);
          setHoursToday(statusRes.data.totalHoursWorkedToday ?? 0);

          if (!statusRes.data.isClockedIn) {
            setWorkplaceName('Mimo práci');
            if (!statusRes.data.totalHoursWorkedToday || statusRes.data.totalHoursWorkedToday === 0) {
              setCurrentShifts([]);
            }
          } else if (statusRes.data.isClockedIn && statusRes.data.startTime) {
            const startLocal = new Date(statusRes.data.startTime);
            const startHhMm = `${String(startLocal.getHours()).padStart(2, '0')}:${String(startLocal.getMinutes()).padStart(2, '0')}`;
            const locType = statusRes.data.locationType === 'office' ? 'office' : 'home_office';
            setActiveLocation(locType);
            setWorkplaceName(locType === 'office' ? 'Kancelář (Praha 1)' : 'Home Office');
            setClockInTime(startHhMm);
            setCurrentShifts((prev) => {
              if (prev.length === 0 || !prev.some((s) => s.end === null)) {
                return [
                  ...prev.filter((s) => s.end !== null),
                  {
                    id: statusRes.data.activeShiftId || `shift-${Date.now()}`,
                    start: startHhMm,
                    end: null,
                    location: locType,
                    locationName: locType === 'office' ? 'Kancelář (Praha 1)' : 'Home Office',
                    method: locType === 'office' ? 'nfc' : 'web'
                  }
                ];
              }
              return prev;
            });
          }
        } else if (isMounted) {
          setIsDbConnected(false);
        }

        // Fetch real weekly calendar from SQLite
        const weekRes = await api.getWeekSummary(activePersona.id);
        if (weekRes && weekRes.data && isMounted) {
          const dayNameMap: Record<string, string> = { po: 'Po', út: 'Út', st: 'St', čt: 'Čt', pá: 'Pá', so: 'So', ne: 'Ne' };
          setWeekDays(
            weekRes.data.map((d: any) => ({
              date: d.date,
              dayName: dayNameMap[d.dayName?.toLowerCase()] || d.dayName,
              hours: d.hoursWorked || 0,
              isToday: d.isToday
            }))
          );
        }

        // Fetch real live team presence from SQLite
        const whoRes = await api.getWhoIsWhere();
        if (whoRes && whoRes.data && isMounted) {
          setTeamPresence(whoRes.data);
        }

        // Map backend completed status and fields to frontend types
        const normalizeVacationItem = (item: any): LeaveRequestItem => ({
          ...item,
          startDate: item.startDate || '',
          endDate: item.endDate || item.startDate || '',
          daysCount: item.daysCount || 1,
          remainingDays: item.remainingDays ?? 15,
          totalDays: item.totalDays ?? 20,
          status: item.status === 'completed' || item.status === 'approved' ? 'approved' : item.status === 'rejected' ? 'rejected' : 'pending'
        });

        const normalizeDoctorItem = (item: any): DoctorVisitItem => ({
          ...item,
          type: 'doctor',
          date: item.date || item.startDate || '',
          startTime: item.startTime || '08:00',
          endTime: item.endTime || '12:00',
          facilityName: item.facilityName || (item.note && item.note.includes('ordinace') ? item.note : 'Zdravotnické zařízení / Ordinace'),
          hasConfirmationDocument: item.hasConfirmationDocument ?? true,
          status: item.status === 'completed' || item.status === 'approved' ? 'approved' : item.status === 'rejected' ? 'rejected' : 'pending'
        });

        // 1. Fetch user's own requests from database
        const myRes = await api.getMyRequests(activePersona.id);
        const myVacs: LeaveRequestItem[] = (myRes?.data || [])
          .filter((r: any) => r.type === 'vacation' || r.type === 'sick_day')
          .map(normalizeVacationItem);
        const myDocs: DoctorVisitItem[] = (myRes?.data || [])
          .filter((r: any) => r.type === 'doctor')
          .map(normalizeDoctorItem);

        // 1b. Fetch user's real absence balances from database
        const balRes = await api.getAbsenceBalances(activePersona.id);
        if (balRes?.data && isMounted) {
          setActivePersona((prev) => {
            if (prev.id !== activePersona.id) return prev;
            return {
              ...prev,
              vacationRemaining: balRes.data.vacationRemaining,
              vacationTotal: balRes.data.vacationTotal,
              sickDaysRemaining: balRes.data.sickDaysRemaining,
              sickDaysTotal: balRes.data.sickDaysTotal,
              unpaidLeaveDays: balRes.data.unpaidLeaveDays ?? prev.unpaidLeaveDays ?? 0
            };
          });
        }

        // 2. Fetch pending approvals for managers from database
        let pendingVacs: LeaveRequestItem[] = [];
        let pendingDocs: DoctorVisitItem[] = [];
        if (['admin', 'manager', 'team_lead', 'office_manager'].includes(activePersona.role)) {
          const pendingRes = await api.getPendingApprovals(activePersona.id);
          if (pendingRes?.data) {
            pendingVacs = pendingRes.data
              .filter((r: any) => r.type === 'vacation' || r.type === 'sick_day')
              .map(normalizeVacationItem);
            pendingDocs = pendingRes.data
              .filter((r: any) => r.type === 'doctor')
              .map(normalizeDoctorItem);
          }
        }

        // 3. Fetch pending user accounts for Office Manager & Admin
        if (['admin', 'office_manager'].includes(activePersona.role)) {
          const pUsersRes = await api.getPendingUsers();
          if (pUsersRes?.data && isMounted) {
            setPendingUsers(pUsersRes.data);
          }
        } else if (isMounted) {
          setPendingUsers([]);
        }

        if (isMounted) {
          const allVacs = [...myVacs];
          for (const pv of pendingVacs) {
            if (!allVacs.some((v) => v.id === pv.id)) allVacs.push(pv);
          }
          const allDocs = [...myDocs];
          for (const pd of pendingDocs) {
            if (!allDocs.some((d) => d.id === pd.id)) allDocs.push(pd);
          }
          setVacationRequests(allVacs);
          setDoctorVisits(allDocs);
        }
      } catch (err) {
        console.warn('Backend sync failed, using local state:', err);
      }
    }
    syncBackendData();
    return () => {
      isMounted = false;
    };
  }, [activePersona.id, dbMode]);

  // Vacation Handlers
  const handleOpenVacationModal = (req: LeaveRequestItem) => {
    setSelectedVacation(req);
    setIsVacationModalOpen(true);
  };

  const handleApproveVacation = async (updatedReq: LeaveRequestItem) => {
    setVacationRequests((prev) =>
      prev.map((r) => (r.id === updatedReq.id ? { ...updatedReq, status: 'approved' } : r))
    );
    // Write directly to SQLite database
    await api.approveAbsence(updatedReq.id, activePersona.id);

    addToast(
      'success',
      'Dovolená schválena v DB',
      `Dovolená pro ${updatedReq.userName} (${formatDateCzech(updatedReq.startDate)} – ${formatDateCzech(updatedReq.endDate)}, ${updatedReq.daysCount} dní) byla schválena a uložena do SQLite databáze.`
    );
  };

  const handleRejectVacation = async (requestId: string, reason: string) => {
    setVacationRequests((prev) =>
      prev.map((r) =>
        r.id === requestId ? { ...r, status: 'rejected', rejectionReason: reason } : r
      )
    );
    // Write directly to SQLite database
    await api.rejectAbsence(requestId, activePersona.id, reason);

    addToast(
      'warning',
      'Dovolená zamítnuta v DB',
      `Žádost o dovolenou byla zamítnuta s odůvodněním: "${reason}". Zapsáno do databáze.`
    );
  };

  // Doctor Handlers
  const handleOpenDoctorModal = (doc: DoctorVisitItem) => {
    setSelectedDoctor(doc);
    setIsDoctorModalOpen(true);
  };

  const handleApproveDoctor = async (updatedDoc: DoctorVisitItem) => {
    setDoctorVisits((prev) =>
      prev.map((d) => (d.id === updatedDoc.id ? { ...updatedDoc, status: 'approved' } : d))
    );
    // Write directly to SQLite database
    await api.approveAbsence(updatedDoc.id, activePersona.id);

    addToast(
      'success',
      'Propustka potvrzena v DB',
      `Lékařská propustka pro ${updatedDoc.userName} (${formatDateCzech(updatedDoc.date)}, ${updatedDoc.startTime} – ${updatedDoc.endTime}) byla uznána a uložena do SQLite databáze.`
    );
  };

  const handleRejectDoctor = async (requestId: string, reason: string) => {
    setDoctorVisits((prev) =>
      prev.map((d) =>
        d.id === requestId ? { ...d, status: 'rejected', rejectionReason: reason } : d
      )
    );
    // Write directly to SQLite database
    await api.rejectAbsence(requestId, activePersona.id, reason);

    addToast(
      'warning',
      'Propustka neuznána v DB',
      `Propustka k lékaři byla zamítnuta s odůvodněním: "${reason}". Zapsáno do databáze.`
    );
  };

  const handleApproveUser = async (
    userId: string,
    role: string,
    contractKind: string,
    weeklyHoursBudget: number
  ) => {
    const res = await api.approveUser({
      userId,
      role,
      contractKind,
      weeklyHoursBudget
    });
    if (res?.data) {
      addToast(
        'success',
        'Uživatel aktivován v DB',
        `${res.data.name} (${res.data.roleLabel} • ${res.data.contract}) byl schválen a může přistupovat do docházky.`
      );
      setPendingUsers((prev) => prev.filter((u) => u.id !== userId));
      if (activePersona.id === userId) {
        setActivePersona((prev) => ({
          ...prev,
          isApproved: true,
          role: res.data.role as any,
          roleLabel: res.data.roleLabel,
          contract: res.data.contract === 'IČO' ? 'OSVČ' : 'HPP'
        }));
      }
    } else {
      addToast('error', 'Chyba schválení', res?.error?.message || 'Nepodařilo se aktivovat uživatele.');
    }
  };

  // Create new request from Employee Self-Service Modal
  const handleCreateNewRequest = (data: NewRequestData) => {
    setIsNewRequestModalOpen(false);

    if (data.type === 'vacation') {
      const s = new Date(data.startDate);
      const e = new Date(data.endDate);
      const daysCount = Math.max(1, Math.round((e.getTime() - s.getTime()) / (1000 * 3600 * 24)) + 1);

      const isAutoApproved = activePersona.role === 'manager' || activePersona.role === 'admin';
      const newVac: LeaveRequestItem = {
        id: `vac-${Date.now()}`,
        applicantId: activePersona.id,
        userName: activePersona.name,
        userRole: activePersona.roleLabel,
        contract: activePersona.contract,
        managerId: activePersona.managerId,
        managerName: activePersona.managerName,
        type: 'vacation',
        typeName: 'Dovolená',
        startDate: data.startDate,
        endDate: data.endDate,
        daysCount,
        remainingDays: activePersona.vacationRemaining,
        totalDays: activePersona.vacationTotal,
        note: data.note,
        status: isAutoApproved ? 'approved' : 'pending'
      };
      setVacationRequests((prev) => [newVac, ...prev]);

      // Write directly to SQLite database
      api.submitAbsence({
        userId: activePersona.id,
        typeCode: 'vacation',
        startDate: data.startDate,
        endDate: data.endDate,
        note: data.note
      }).then(async () => {
        const bal = await api.getAbsenceBalances(activePersona.id);
        if (bal?.data) {
          setActivePersona((prev) => ({
            ...prev,
            vacationRemaining: bal.data.vacationRemaining,
            vacationTotal: bal.data.vacationTotal,
            sickDaysRemaining: bal.data.sickDaysRemaining,
            sickDaysTotal: bal.data.sickDaysTotal,
            unpaidLeaveDays: bal.data.unpaidLeaveDays ?? prev.unpaidLeaveDays ?? 0
          }));
        }
      });

      addToast(
        'success',
        isAutoApproved ? 'Žádost o dovolenou schválena (Auto-approve)' : 'Žádost o dovolenou podána (uloženo v DB)',
        isAutoApproved
          ? `Vaše dovolená na termín ${formatDateCzech(data.startDate)} – ${formatDateCzech(data.endDate)} (${daysCount} dní) byla automaticky schválena dle pravidel pro roli ${activePersona.roleLabel}.`
          : `Vaše žádost na termín ${formatDateCzech(data.startDate)} – ${formatDateCzech(data.endDate)} (${daysCount} dní) byla odeslána ke schválení (${activePersona.managerName || 'vedení'}) a zapsána do databáze.`
      );
    } else if (data.type === 'doctor') {
      const newDoc: DoctorVisitItem = {
        id: `doc-${Date.now()}`,
        applicantId: activePersona.id,
        userName: activePersona.name,
        userRole: activePersona.roleLabel,
        contract: activePersona.contract,
        managerId: activePersona.managerId,
        managerName: activePersona.managerName,
        type: 'doctor',
        typeName: 'Lékař / Vyšetření',
        date: data.startDate,
        startTime: data.startTime || '08:30',
        endTime: data.endTime || '11:30',
        facilityName: data.facilityName || 'Zdravotnické zařízení',
        hasConfirmationDocument: data.hasConfirmationDocument || false,
        note: data.note,
        status: 'pending'
      };
      setDoctorVisits((prev) => [newDoc, ...prev]);

      // Write directly to SQLite database
      api.submitAbsence({
        userId: activePersona.id,
        typeCode: 'doctor',
        startDate: data.startDate,
        endDate: data.startDate,
        startTime: data.startTime,
        endTime: data.endTime,
        facilityName: data.facilityName,
        hasConfirmationDocument: data.hasConfirmationDocument,
        note: data.note
      });

      addToast(
        'success',
        'Návštěva lékaře zaevidována (uloženo v DB)',
        `Propustka k lékaři na ${formatDateCzech(data.startDate)} (${data.startTime} – ${data.endTime}) byla předána ke schválení nadřízenému (${activePersona.managerName || 'vedení'}) a uložena do SQLite databáze.`
      );
    } else if (data.type === 'sick_day') {
      const newSick: LeaveRequestItem = {
        id: `sick-${Date.now()}`,
        applicantId: activePersona.id,
        userName: activePersona.name,
        userRole: activePersona.roleLabel,
        contract: activePersona.contract,
        managerId: activePersona.managerId,
        managerName: activePersona.managerName,
        type: 'sick_day',
        typeName: 'Sick Day (Zdravotní volno)',
        startDate: data.startDate,
        endDate: data.startDate,
        daysCount: 1,
        remainingDays: activePersona.sickDaysRemaining,
        totalDays: activePersona.sickDaysTotal,
        note: data.note || 'Nahlášení zdravotní indispozice.',
        status: 'pending'
      };
      setVacationRequests((prev) => [newSick, ...prev]);

      // Write directly to SQLite database
      api.submitAbsence({
        userId: activePersona.id,
        typeCode: 'sick_day',
        startDate: data.startDate,
        endDate: data.startDate,
        note: data.note || 'Sick Day'
      }).then(async () => {
        const bal = await api.getAbsenceBalances(activePersona.id);
        if (bal?.data) {
          setActivePersona((prev) => ({
            ...prev,
            vacationRemaining: bal.data.vacationRemaining,
            vacationTotal: bal.data.vacationTotal,
            sickDaysRemaining: bal.data.sickDaysRemaining,
            sickDaysTotal: bal.data.sickDaysTotal
          }));
        }
      });

      addToast(
        'success',
        'Sick Day nahlášen (uloženo v DB)',
        `Zdravotní volno na ${formatDateCzech(data.startDate)} bylo zaevidováno v databázi a notifikováno nadřízenému (${activePersona.managerName || 'vedení'}).`
      );
    } else if (data.type === 'illness') {
      const newIllness: LeaveRequestItem = {
        id: `illness-${Date.now()}`,
        applicantId: activePersona.id,
        userName: activePersona.name,
        userRole: activePersona.roleLabel,
        contract: activePersona.contract,
        managerId: activePersona.managerId,
        managerName: activePersona.managerName,
        type: 'illness',
        typeName: 'Nemocenská (DPN)',
        startDate: data.startDate,
        endDate: data.endDate || data.startDate,
        daysCount: 1,
        remainingDays: activePersona.sickDaysRemaining,
        totalDays: activePersona.sickDaysTotal,
        note: data.note || 'Nahlášení dočasné pracovní neschopnosti (nemoc).',
        status: 'pending'
      };
      setVacationRequests((prev) => [newIllness, ...prev]);

      addToast(
        'success',
        'Nemoc nahlášena',
        `Pracovní neschopnost od ${formatDateCzech(data.startDate)} byla nahlášena vedení.`
      );
    } else if (data.type === 'home_office') {
      addToast(
        'success',
        'Plán práce na Home Office uložen',
        `Home Office na ${formatDateCzech(data.startDate)} byl zanesen do kalendáře týmu.`
      );
    }
  };

  // Clock In handler
  const handleClockInAction = (locationType: 'office' | 'home_office', locationLabel?: string) => {
    setIsClockedIn(true);
    setActiveLocation(locationType);
    const locName = locationLabel || (locationType === 'office' ? 'Pobočka Praha 1 - Palmovka' : 'Home Office');
    setWorkplaceName(locName);

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    setClockInTime(timeStr);
    setIsNfcModalOpen(false);

    const newShift: ShiftBlock = {
      id: `shift-${Date.now()}`,
      start: timeStr,
      end: null,
      location: locationType,
      locationName: locName,
      method: locationType === 'office' ? 'nfc' : 'web'
    };
    setCurrentShifts((prev) => [...prev, newShift]);

    // Send clock-in directly to SQLite database
    api.clockIn({
      userId: activePersona.id,
      nfcIdentifier: locationType === 'office' ? 'praha1' : undefined,
      isHomeOffice: locationType === 'home_office'
    }).then(async () => {
      const whoRes = await api.getWhoIsWhere();
      if (whoRes?.data) setTeamPresence(whoRes.data);
      const weekRes = await api.getWeekSummary(activePersona.id);
      if (weekRes?.data) {
        const dayNameMap: Record<string, string> = { po: 'Po', út: 'Út', st: 'St', čt: 'Čt', pá: 'Pá', so: 'So', ne: 'Ne' };
        setWeekDays(
          weekRes.data.map((d: any) => ({
            date: d.date,
            dayName: dayNameMap[d.dayName?.toLowerCase()] || d.dayName,
            hours: d.hoursWorked || 0,
            isToday: d.isToday
          }))
        );
      }
    });

    addToast(
      'success',
      'Příchod zapsán do DB',
      locationType === 'office' ? `Přihlášen na: ${locName}. Zapsáno do SQLite.` : 'Přihlášen na Home Office. Zapsáno do SQLite.'
    );
  };

  // Clock Out click
  const handleClockOutClick = () => {
    if (activeLocation === 'home_office') {
      setIsHoLeaveModalOpen(true);
    } else {
      finishClockOut(false);
    }
  };

  const finishClockOut = (isPause: boolean, pauseTime?: string) => {
    setIsClockedIn(false);
    setIsHoLeaveModalOpen(false);

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    setCurrentShifts((prev) =>
      prev.map((s) => (s.end === null ? { ...s, end: timeStr } : s))
    );

    // Send clock-out directly to SQLite database
    api.clockOut({
      userId: activePersona.id,
      isPause,
      expectedReturnAt: isPause && pauseTime ? `${new Date().toISOString().split('T')[0]}T${pauseTime}:00Z` : undefined
    }).then(async () => {
      const whoRes = await api.getWhoIsWhere();
      if (whoRes?.data) setTeamPresence(whoRes.data);
      const weekRes = await api.getWeekSummary(activePersona.id);
      if (weekRes?.data) {
        const dayNameMap: Record<string, string> = { po: 'Po', út: 'Út', st: 'St', čt: 'Čt', pá: 'Pá', so: 'So', ne: 'Ne' };
        setWeekDays(
          weekRes.data.map((d: any) => ({
            date: d.date,
            dayName: dayNameMap[d.dayName?.toLowerCase()] || d.dayName,
            hours: d.hoursWorked || 0,
            isToday: d.isToday
          }))
        );
      }
    });

    if (isPause) {
      addToast(
        'warning',
        'Odchod na pauzu (uloženo v DB)',
        `Orientační návrat nastaven na ${pauseTime}. Kolegům v přehledu „Kdo je kde“ se zobrazuje vaše pauza.`
      );
    } else {
      addToast('success', 'Směna ukončena v DB', 'Čas odchodu byl řádně uložen do databáze (UTC).');
    }
  };

  // Simulated NFC Tap from Debug Simulator
  const handleSimulatedNfc = (identifier: string, type: 'office' | 'home_office' | 'invalid') => {
    if (type === 'invalid') {
      if (identifier === 'replay_attack') {
        addToast(
          'error',
          'Chyba zabezpečení: Replay útok',
          'NFC podpis byl již dříve použit. Monotónní počítadlo čipu neodpovídá sekvenci.'
        );
      } else {
        addToast(
          'error',
          'Neautorizovaný čip',
          'NFC karta není v systému zaregistrována. Přístup odepřen (403 Forbidden).'
        );
      }
      return;
    }

    if (identifier === 'praha1') {
      handleClockInAction('office', 'Pobočka Praha 1 - Palmovka');
    } else if (identifier === 'brno1') {
      handleClockInAction('office', 'Pobočka Brno - Spielberk');
    }
  };

  // Hardware NFC Listener (Capacitor on Android / iOS)
  useEffect(() => {
    nfcService.initHardwareNfc();
    const unsubscribe = nfcService.subscribe((result) => {
      handleSimulatedNfc(result.identifier, result.locationType);
    });
    return () => {
      unsubscribe();
      nfcService.stopHardwareNfc();
    };
  }, []);


  // RBAC & Approval Filtering according to Spec Section 04:
  // Admin: full company
  // Manager: subordinates + stand-in for Team Leads
  // Office Manager: doctor visits full company; vacations only direct subordinates
  // Team Lead: only assigned subordinates
  const isManagerOrAdmin = ['admin', 'manager', 'team_lead', 'office_manager'].includes(activePersona.role);

  const pendingVacationsForManager = vacationRequests.filter((r) => {
    if (activePersona.role === 'admin') return true;
    if (activePersona.role === 'manager') {
      if (r.managerId === activePersona.id) return true;
      const leadsUnderManager = effectivePersonas.filter((p) => p.managerId === activePersona.id && p.role === 'team_lead').map((p) => p.id);
      return leadsUnderManager.includes(r.managerId || '');
    }
    if (activePersona.role === 'team_lead' || activePersona.role === 'office_manager') {
      return r.managerId === activePersona.id;
    }
    return false;
  });

  const pendingDoctorsForManager = doctorVisits.filter((d) => {
    if (activePersona.role === 'admin' || activePersona.role === 'office_manager') return true;
    if (activePersona.role === 'manager') {
      if (d.managerId === activePersona.id) return true;
      const leadsUnderManager = effectivePersonas.filter((p) => p.managerId === activePersona.id && p.role === 'team_lead').map((p) => p.id);
      return leadsUnderManager.includes(d.managerId || '');
    }
    if (activePersona.role === 'team_lead') return d.managerId === activePersona.id;
    return false;
  });

  const totalManagerPendingCount =
    pendingVacationsForManager.filter((r) => r.status === 'pending').length +
    pendingDoctorsForManager.filter((d) => d.status === 'pending').length +
    (['admin', 'office_manager'].includes(activePersona.role) ? pendingUsers.length : 0);

  // Employee Self-Service: Requests submitted by the active persona
  const myVacationRequests = vacationRequests.filter(
    (r) => r.applicantId === activePersona.id || r.userName === activePersona.name
  );
  const myDoctorVisits = doctorVisits.filter(
    (d) => d.applicantId === activePersona.id || d.userName === activePersona.name
  );
  const myTotalRequestsCount = myVacationRequests.length + myDoctorVisits.length;


  return (
    <div className="min-h-screen pb-24 bg-[#f8fafc] dark:bg-[#09090b] text-slate-900 dark:text-zinc-100 transition-colors">
      {/* Dev Mode Role & Persona Bar (100% full width, solid yellow like NFC simulator) */}
      {isDevVisible && (
        <div className="w-full bg-yellow-400 text-slate-950 px-4 sm:px-6 lg:px-8 py-2 text-xs border-b border-yellow-500/80 shadow-sm">
          <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 font-extrabold text-slate-950">
                <ShieldCheck className="w-4 h-4 text-slate-950 flex-shrink-0" />
                <span className="tracking-wide">DEV REŽIM:</span>
                <span
                  className={`w-2 h-2 rounded-full ${isDbConnected ? 'bg-emerald-600' : 'bg-amber-600'}`}
                  title={isDbConnected ? 'SQLite DB připojena' : 'Lokální offline stav'}
                />
              </div>

              {/* Database Switcher */}
              <div className="flex items-center p-0.5 bg-yellow-500/50 rounded-xl text-[11px] font-semibold border border-yellow-600/30">
                <button
                  type="button"
                  onClick={() => handleSwitchDatabaseMode('dev')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all ${
                    dbMode === 'dev'
                      ? 'bg-slate-950 text-white shadow-sm font-bold'
                      : 'text-slate-950/80 hover:text-slate-950 font-semibold hover:bg-yellow-500/40'
                  }`}
                  title="Přepnout na testovací databázi se seedovanými uživateli a strukturou (dochazka_dev.db)"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span>Test (dochazka_dev.db)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSwitchDatabaseMode('clean')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all ${
                    dbMode === 'clean'
                      ? 'bg-slate-950 text-white shadow-sm font-bold'
                      : 'text-slate-950/80 hover:text-slate-950 font-semibold hover:bg-yellow-500/40'
                  }`}
                  title="Přepnout na čistou databázi pro simulaci instalace (dochazka_clean.db)"
                >
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <span>Instal (dochazka_clean.db)</span>
                </button>
              </div>

              {/* Wipe Clean DB Button - shown when clean mode is active */}
              {dbMode === 'clean' && (
                <button
                  type="button"
                  onClick={handleWipeCleanDb}
                  disabled={isWipingCleanDb}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-semibold text-[11px] transition-colors shadow-sm"
                  title="Smaže všechny tabulky a struktury z dochazka_clean.db a umožní znovu vyzkoušet instalaci od nuly"
                >
                  <Trash2 className="w-3.5 h-3.5 text-white" />
                  <span>{isWipingCleanDb ? 'Mažu...' : 'Reset DB'}</span>
                </button>
              )}

              {/* Reset Dev DB Button - shown when dev mode is active */}
              {dbMode === 'dev' && (
                <button
                  type="button"
                  onClick={handleResetDevDb}
                  disabled={isResettingDevDb}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-yellow-500/50 hover:bg-yellow-500/80 active:bg-yellow-600/50 text-slate-950 font-semibold text-[11px] transition-colors border border-yellow-600/30"
                  title="Smaže lokální testovací data a obnoví vývojářskou databázi ze šablony dochazka_dev.template.db"
                >
                  <RotateCcw className={`w-3.5 h-3.5 text-slate-950 ${isResettingDevDb ? 'animate-spin' : ''}`} />
                  <span>{isResettingDevDb ? 'Obnovuji...' : 'Resetovat DB do šablony'}</span>
                </button>
              )}

              {/* Dev Environment Config Wizard Button */}
              <button
                type="button"
                onClick={() => setIsDevConfigModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-yellow-500/50 hover:bg-yellow-500/80 active:bg-yellow-600/50 text-slate-950 font-semibold text-[11px] transition-colors border border-yellow-600/30"
                title="Nastavení firmy, oAuth domény a parametrů databáze (zapisuje do lokálního appsettings.Development.json)"
              >
                <Settings className="w-3.5 h-3.5 text-slate-950" />
                <span>Nastavení ({devConfig.companyName} / @{devConfig.googleWorkspaceDomain})</span>
              </button>
            </div>

            {/* Right section: Persona selector & Close DEV bar button */}
            <div className="flex items-center gap-2 self-end sm:self-auto flex-shrink-0">
              {/* Persona selector only shown in Test DB mode */}
              {dbMode === 'clean' ? (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono px-3 py-1.5 rounded-xl bg-yellow-500/50 text-slate-950 font-semibold border border-yellow-600/30">
                    {cleanInstalled && cleanAdminUser
                      ? `Správce: ${cleanAdminUser.name}`
                      : `Čistý stav: Neinstalováno (${dbStatus?.userCount ?? 0} osob)`}
                  </span>
                </div>
              ) : (
                <div className="relative" ref={personaDropdownRef}>
                  <button
                    onClick={() => setIsPersonaDropdownOpen(!isPersonaDropdownOpen)}
                    className={`flex items-center justify-between gap-2.5 px-3 py-1.5 rounded-2xl transition-all shadow-sm group ${
                      activePersona.id === 'anonymous'
                        ? 'bg-slate-900/10 hover:bg-slate-900/20 text-slate-950 border border-yellow-600/30'
                        : 'bg-white hover:bg-white/95 text-slate-950 font-medium border border-yellow-500/40 shadow-sm'
                    }`}
                    title="Klikněte pro změnu přihlášeného testovacího uživatele"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className={`w-6 h-6 rounded-full font-bold text-[10px] flex items-center justify-center flex-shrink-0 ${
                          activePersona.id === 'anonymous'
                            ? 'bg-slate-700 text-white'
                            : 'bg-yellow-400 text-slate-950 border border-yellow-500'
                        }`}
                      >
                        {activePersona.id === 'anonymous' ? (
                          <UserX className="w-3.5 h-3.5" />
                        ) : (
                          (activePersona.name || '?')
                            .split(' ')
                            .filter(Boolean)
                            .map((n) => n[0])
                            .join('')
                        )}
                      </div>
                      <span className="font-bold text-xs truncate max-w-[130px] sm:max-w-[160px]">
                        {activePersona.name}
                      </span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ${
                          activePersona.id === 'anonymous'
                            ? 'bg-slate-300 text-slate-800'
                            : 'bg-yellow-100 text-yellow-900'
                        }`}
                      >
                        {activePersona.roleLabel.split('/')[0].trim()}
                      </span>
                    </div>
                    <ChevronDown
                      className={`w-3.5 h-3.5 transition-transform flex-shrink-0 text-slate-950 ${isPersonaDropdownOpen ? 'rotate-180' : ''}`}
                    />
                  </button>

              {isPersonaDropdownOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-3xl bg-white dark:bg-zinc-900 shadow-2xl p-2.5 z-50 animate-in fade-in zoom-in-95 duration-150 space-y-1">
                  <div className="px-3 py-2 text-[11px] font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider font-mono flex items-center justify-between">
                    <span>Vyberte testovací osobu</span>
                    <span className="text-yellow-700 dark:text-yellow-400 font-bold font-mono text-[10px]">5 rolí + odhlášeno</span>
                  </div>
                  <div className="max-h-96 overflow-y-auto space-y-1 pr-1">
                    {/* Volba: Nepřihlášená osoba */}
                    <button
                      type="button"
                      onClick={() => {
                        handleSwitchPersona(ANONYMOUS_PERSONA);
                        setIsPersonaDropdownOpen(false);
                      }}
                      className={`w-full p-2.5 rounded-2xl text-left transition-all flex items-center justify-between gap-3 ${
                        activePersona.id === 'anonymous'
                          ? 'bg-slate-200/80 dark:bg-zinc-800 text-slate-900 dark:text-white font-bold'
                          : 'hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 ${
                            activePersona.id === 'anonymous'
                              ? 'bg-slate-700 dark:bg-zinc-300 text-white dark:text-zinc-900'
                              : 'bg-slate-200 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300'
                          }`}
                        >
                          <UserX className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold truncate flex items-center gap-1.5">
                            <span>Nepřihlášená osoba</span>
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-zinc-400 truncate mt-0.5">
                            Odhlášený stav • bez aktivní session
                          </div>
                        </div>
                      </div>
                      {activePersona.id === 'anonymous' && (
                        <Check className="w-4 h-4 text-slate-700 dark:text-slate-300 flex-shrink-0" />
                      )}
                    </button>

                    <div className="my-1 border-t border-slate-100 dark:border-zinc-800/80" />

                    {effectivePersonas.map((p) => {
                      const isSelected = p.id === activePersona.id;
                      const roleBadgeColor =
                        p.role === 'admin'
                          ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300'
                          : p.role === 'manager'
                          ? 'bg-indigo-100 text-indigo-900 dark:bg-indigo-950/60 dark:text-indigo-300'
                          : p.role === 'team_lead'
                          ? 'bg-purple-100 text-purple-900 dark:bg-purple-950/60 dark:text-purple-300'
                          : p.role === 'office_manager'
                          ? 'bg-rose-100 text-rose-900 dark:bg-rose-950/60 dark:text-rose-300'
                          : 'bg-sky-100 text-sky-900 dark:bg-sky-950/60 dark:text-sky-300';

                      return (
                        <button
                          key={p.id}
                          onClick={() => {
                            handleSwitchPersona(p);
                            setIsPersonaDropdownOpen(false);
                          }}
                          className={`w-full p-2.5 rounded-2xl text-left transition-all flex items-center justify-between gap-3 ${
                            isSelected
                              ? 'bg-yellow-400/25 text-yellow-950 dark:text-yellow-100 font-bold'
                              : 'hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-800 dark:text-zinc-200'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 ${
                                isSelected
                                  ? 'bg-yellow-500 text-slate-950'
                                  : 'bg-slate-200 dark:bg-zinc-700 text-slate-700 dark:text-zinc-300'
                              }`}
                            >
                              {(p.name || '?')
                                .split(' ')
                                .filter(Boolean)
                                .map((n) => n[0])
                                .join('')}
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-bold truncate flex items-center gap-1.5">
                                <span>{p.name}</span>
                                <span className="text-[10px] font-normal opacity-70">
                                  ({p.contract})
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-zinc-400 truncate flex items-center gap-1.5 mt-0.5">
                                <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-semibold ${roleBadgeColor}`}>
                                  {p.roleLabel}
                                </span>
                              </div>
                            </div>
                          </div>
                          {isSelected && (
                            <Check className="w-4 h-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Close Dev Mode button - completely on the far right */}
          <button
            type="button"
            onClick={() => setIsDevVisible(false)}
            className="p-1.5 rounded-xl bg-yellow-500/40 hover:bg-yellow-500/80 active:bg-yellow-600/60 text-slate-950 transition-colors flex items-center justify-center flex-shrink-0 border border-yellow-600/30"
            title="Skrýt vývojářský režim (při obnovení stránky se znovu objeví)"
            aria-label="Skrýt DEV režim"
          >
            <X className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>
      </div>
    </div>
  )}

      {/* Main Header (M3 Clean Elevation, STRICTLY NO BORDER) */}
      <Header
        devConfig={devConfig}
        activePersona={activePersona}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode(!darkMode)}
        isClockedIn={isClockedIn}
        dbMode={dbMode}
        cleanInstalled={cleanInstalled}
        isDevVisible={isDevVisible}
        onToggleDevVisible={() => setIsDevVisible(true)}
        onOpenSettings={() => setActiveNavTab('nastaveni')}
        onLogout={handleLogout}
        addToast={addToast}
      />

      {/* Main Content */}
      {dbMode === 'clean' && !cleanInstalled ? (
        <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-6">
          <InstallScreen
            devConfig={devConfig}
            onInstallComplete={(adminUser) => {
              const adminPersona: Persona = {
                id: adminUser?.id || 'clean-admin-001',
                name: adminUser?.name || 'Jan Správce',
                email: adminUser?.email || `admin@${devConfig.googleWorkspaceDomain || 'firma.cz'}`,
                phoneNumber: '+420 777 000 001',
                role: 'admin',
                roleLabel: 'Administrátor',
                vacationRemaining: 25,
                vacationTotal: 25,
                sickDaysRemaining: 3,
                sickDaysTotal: 3,
                contract: 'HPP'
              };
              setCleanInstalled(true);
              localStorage.setItem('caffeechko_clean_installed', 'true');
              setCleanAdminUser(adminPersona);
              localStorage.setItem('caffeechko_clean_admin', JSON.stringify(adminPersona));
              setSessionUserId(adminPersona.id);
              setActivePersona(adminPersona);
              setDbStatus({
                currentMode: 'clean',
                databaseFile: 'dochazka_clean.db',
                tableCount: 10,
                userCount: 1,
                isInstalled: true
              });
              addToast('success', 'Instalace dokončena', 'Databáze dochazka_clean.db byla inicializována a administrátor vytvořen.');
            }}
            onSwitchToDevDb={() => handleSwitchDatabaseMode('dev')}
          />
        </main>
      ) : activePersona.id === 'anonymous' ? (
        <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-6">
          <LoginScreen
            devConfig={devConfig}
            isDevVisible={isDevVisible}
            onLoginSuccess={handleGoogleLoginSuccess}
            addToast={addToast}
          />
        </main>
      ) : activePersona.isApproved === false ? (
        <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-6">
          <PendingApprovalScreen
            userId={activePersona.id}
            userName={activePersona.name}
            userEmail={activePersona.email}
            onRefreshStatus={async () => {
              const res = await api.getPendingStatus(activePersona.id);
              if (res?.data?.isApproved) {
                setActivePersona((prev) => ({ ...prev, isApproved: true }));
                addToast('success', 'Účet byl schválen!', 'Váš profil byl úspěšně aktivován v docházce.');
              } else {
                addToast('warning', 'Čeká se na schválení', 'Účet zatím čeká na nastavení úvazku.');
              }
            }}
            onLogout={handleLogout}
            addToast={addToast}
          />
        </main>
      ) : (
        <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
          {/* Globální navigace (Pills bar na desktopu, hamburger na mobilu) */}
          <AppNavigation
            activeTab={activeNavTab}
            onTabChange={setActiveNavTab}
            pendingClosuresCount={1}
          />

          {/* ZÁLOŽKA 1: DOCHÁZKA */}
          {activeNavTab === 'dochazka' && (
            <>
              {/* 1. Dnešní přítomnost (Modern MD3 Airy Timeline Card) */}
              <Box className="space-y-6">
          {/* Top row: Osoba (vlevo) + Přehled stavů (vpravo ve stejné úrovni) */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 sm:gap-6">
            {/* Osoba (zmenšená, kompaktní) */}
            <div className="flex items-center gap-3.5 flex-shrink-0">
              <div className="relative flex-shrink-0">
                {activePersona.id === 'anonymous' ? (
                  <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-slate-200 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 font-bold text-sm sm:text-base flex items-center justify-center shadow-sm">
                    <UserX className="w-5 h-5" />
                  </div>
                ) : (
                  <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-gradient-to-tr from-amber-500/20 to-amber-600/30 dark:from-amber-500/30 dark:to-amber-600/20 text-amber-900 dark:text-amber-300 font-bold text-sm sm:text-base flex items-center justify-center shadow-sm">
                    {(activePersona.name || '?')
                      .split(' ')
                      .filter(Boolean)
                      .map((n) => n[0])
                      .join('')}
                  </div>
                )}
                <span
                  className={`absolute bottom-0 right-0 w-3 h-3 rounded-full ring-2 ring-white dark:ring-zinc-900 ${
                    isClockedIn ? 'bg-emerald-500' : 'bg-slate-400'
                  }`}
                />
              </div>

              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white">
                    {activePersona.name}
                  </span>
                  {activePersona.id !== 'anonymous' && (
                    <RoleBadge role={activePersona.role} roleLabel={activePersona.roleLabel} />
                  )}
                  {activePersona.id !== 'anonymous' && activePersona.contract && (
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300">
                      {activePersona.contract}
                    </span>
                  )}
                  {activePersona.id !== 'anonymous' && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-mono font-medium px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300">
                      <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Dnes: <strong className="font-bold">{formatHoursMinutes(hoursToday)}</strong></span>
                      <span className="text-emerald-700/60 dark:text-emerald-400/60 font-normal">/ 8h fond</span>
                    </span>
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

            {/* Přehled stavů (5 pilulek: Měsíc, Přesčas, Dovolená, Sick days, Neplacené) */}
            <div className="grid grid-cols-5 gap-2 sm:gap-3 flex-shrink-0 self-stretch sm:self-auto pt-2 lg:pt-0">
              {/* 1. Aktuální měsíc (např. 24/168 h - říjen) */}
              <StatPill
                icon={CalendarDays}
                colorKey="emerald"
                value={activePersona.contract === 'OSVČ' ? 20 : 24}
                total={activePersona.contract === 'OSVČ' ? 160 : 168}
                unit="h"
                label={new Date().toLocaleString('cs-CZ', { month: 'long' })}
              />

              {/* 2. Přesčas */}
              <StatPill
                icon={TrendingUp}
                colorKey="sky"
                value={activePersona.contract === 'OSVČ' ? '—' : '+14.5'}
                unit={activePersona.contract === 'OSVČ' ? undefined : 'h'}
                label="Přesčas"
                valueColorClass="text-emerald-600 dark:text-emerald-400"
              />

              {/* 3. Dovolená */}
              <StatPill
                activityType="vacation"
                value={activePersona.id === 'anonymous' || activePersona.contract === 'OSVČ' ? '—' : activePersona.vacationRemaining}
                total={activePersona.id === 'anonymous' || activePersona.contract === 'OSVČ' ? undefined : activePersona.vacationTotal}
                unit={activePersona.id === 'anonymous' || activePersona.contract === 'OSVČ' ? undefined : 'd'}
                label="Dovolená"
              />

              {/* 4. Sick days */}
              <StatPill
                activityType="sick_day"
                value={activePersona.id === 'anonymous' || activePersona.contract === 'OSVČ' ? '—' : activePersona.sickDaysRemaining}
                total={activePersona.id === 'anonymous' || activePersona.contract === 'OSVČ' ? undefined : activePersona.sickDaysTotal}
                unit={activePersona.id === 'anonymous' || activePersona.contract === 'OSVČ' ? undefined : 'd'}
                label="Sick days"
              />

              {/* 5. Neplacené volno */}
              <StatPill
                activityType="unpaid_leave"
                value={activePersona.id === 'anonymous' || activePersona.contract === 'OSVČ' ? '—' : (activePersona.unpaidLeaveDays ?? 0)}
                unit={activePersona.id === 'anonymous' || activePersona.contract === 'OSVČ' ? undefined : 'd'}
                label="Neplacené"
              />
            </div>
          </div>

          {/* Two Main Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 sm:pt-6">
            <button
              onClick={() => {
                if (activePersona.id === 'anonymous') {
                  addToast(
                    'warning',
                    'Nepřihlášená osoba',
                    'Pro zaznamenání příchodu vyberte osobu v horní vývojářské liště nebo přiložte NFC čip.'
                  );
                  return;
                }
                setIsNfcModalOpen(true);
              }}
              disabled={isClockedIn}
              className={`h-16 rounded-full font-semibold text-lg flex items-center justify-center gap-3 shadow-md transition-all ${
                isClockedIn
                  ? 'bg-slate-100 dark:bg-zinc-800 text-slate-400 dark:text-zinc-600 cursor-not-allowed shadow-none'
                  : 'bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white shadow-emerald-600/25'
              }`}
            >
              <CheckCircle2 className="w-6 h-6" />
              <span>PŘÍCHOD</span>
            </button>

            <button
              onClick={() => {
                if (activePersona.id === 'anonymous') {
                  addToast(
                    'warning',
                    'Nepřihlášená osoba',
                    'Pro zaznamenání odchodu vyberte osobu v horní vývojářské liště.'
                  );
                  return;
                }
                handleClockOutClick();
              }}
              disabled={!isClockedIn}
              className={`h-16 rounded-full font-semibold text-lg flex items-center justify-center gap-3 shadow-md transition-all ${
                !isClockedIn
                  ? 'bg-slate-100 dark:bg-zinc-800 text-slate-400 dark:text-zinc-600 cursor-not-allowed shadow-none'
                  : 'bg-rose-600 hover:bg-rose-700 active:scale-98 text-white shadow-rose-600/25'
              }`}
            >
              <AlertCircle className="w-6 h-6" />
              <span>ODCHOD</span>
            </button>
          </div>

          {/* Progress Timeline Bar */}
          <div className="pt-2">
            <DayTimeline
              shifts={currentShifts}
              isClockedIn={isClockedIn}
              activeLocation={activeLocation}
              workplaceName={workplaceName}
            />
          </div>

          {/* Rychlá akční tlačítka absencí pod timeline (100% sjednoceno přes getStatusConfig) */}
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
              const ActionIcon = cfg.icon;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setIsNewRequestModalOpen(true)}
                  className="py-2.5 px-3 rounded-2xl bg-slate-100 hover:bg-slate-200/80 dark:bg-zinc-800 dark:hover:bg-zinc-700/80 text-slate-700 dark:text-zinc-200 font-medium text-xs sm:text-sm flex items-center justify-center gap-2 transition-all active:scale-98"
                >
                  <ActionIcon className={`w-4 h-4 ${cfg.iconColorClass} flex-shrink-0`} />
                  <span>{cfg.label}</span>
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => {
                setSelectedMonthlyPersona(activePersona);
                setIsMonthlyModalOpen(true);
              }}
              className="py-2.5 px-3 rounded-2xl bg-slate-100 hover:bg-slate-200/80 dark:bg-zinc-800 dark:hover:bg-zinc-700/80 text-slate-700 dark:text-zinc-200 font-medium text-xs sm:text-sm flex items-center justify-center gap-2 transition-all active:scale-98"
            >
              <CalendarDays className="w-4 h-4 text-emerald-500 dark:text-emerald-400 flex-shrink-0" />
              <span>Měsíční presence</span>
            </button>
          </div>
        </Box>

        {/* 2. SOUHRNNÁ KARTA: Žádosti & Provozní agenda */}
        <Box
          header={{
            icon: Calendar,
            title: 'Žádosti & Provozní agenda',
            subtitle: 'Správa vašich žádostí o volno, propustek a schvalování týmových požadavků',
            actions: isManagerOrAdmin ? (
              <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-zinc-800 rounded-2xl w-fit self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setAgendaTab('my')}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                    agendaTab === 'my'
                      ? 'bg-white dark:bg-zinc-700 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Moje žádosti ({myTotalRequestsCount})
                </button>

                <button
                  type="button"
                  onClick={() => setAgendaTab('team')}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    agendaTab === 'team'
                      ? 'bg-white dark:bg-zinc-700 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span>Schvalování týmu</span>
                  {totalManagerPendingCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white leading-none">
                      {totalManagerPendingCount}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setAgendaTab('all')}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                    agendaTab === 'all'
                      ? 'bg-white dark:bg-zinc-700 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Vše
                </button>
              </div>
            ) : undefined
          }}
        >

          {/* OBSAH: MOJE ŽÁDOSTI (MINIFIKOVANÉ) */}
          {(!isManagerOrAdmin || agendaTab === 'my' || agendaTab === 'all') && (
            <div className="space-y-2.5">
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
                      setIsNewRequestModalOpen(true);
                    }}
                    className="mt-2 text-xs text-amber-600 dark:text-amber-400 font-semibold hover:underline"
                  >
                    + Naplánovat dovolenou nebo nahlásit lékaře nyní
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Moje dovolené a sick days a nemoc a neplacené volno */}
                  {myVacationRequests.map((r) => (
                    <div
                      key={r.id}
                      className="py-2.5 px-3.5 rounded-2xl bg-slate-100/70 dark:bg-zinc-800/60 flex items-center justify-between gap-3 text-xs hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <PresenceBadge
                          type={r.type}
                          customLabel={r.typeName}
                          variant="text"
                          className="w-36 sm:w-44 flex-shrink-0"
                        />
                        <span className="font-semibold text-slate-900 dark:text-white truncate">
                          {formatDateCzech(r.startDate)}{r.startDate !== r.endDate ? ` – ${formatDateCzech(r.endDate)}` : ''}
                        </span>
                        <span className="font-mono text-[11px] px-2 py-0.5 rounded-lg bg-white dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 flex-shrink-0">
                          {r.daysCount} {r.daysCount === 1 ? 'den' : r.daysCount < 5 ? 'dny' : 'dní'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        {r.status === 'pending' && (
                          <span className="px-2.5 py-1 rounded-full font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 flex items-center gap-1 text-[11px]">
                            <Clock className="w-3 h-3" />
                            <span>Čeká</span>
                          </span>
                        )}
                        {r.status === 'approved' && (
                          <span className="px-2.5 py-1 rounded-full font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 flex items-center gap-1 text-[11px]">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Schváleno</span>
                          </span>
                        )}
                        {r.status === 'rejected' && (
                          <span className="px-2.5 py-1 rounded-full font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 flex items-center gap-1 text-[11px]">
                            <AlertCircle className="w-3 h-3" />
                            <span>Zamítnuto</span>
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() => handleOpenVacationModal(r)}
                          className="px-2.5 py-1 rounded-xl text-[11px] font-semibold text-slate-600 dark:text-zinc-300 bg-white dark:bg-zinc-700 hover:bg-slate-200 dark:hover:bg-zinc-600 transition-colors shadow-sm"
                        >
                          Detail
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Moji lékaři */}
                  {myDoctorVisits.map((d) => (
                    <div
                      key={d.id}
                      className="py-2.5 px-3.5 rounded-2xl bg-slate-100/70 dark:bg-zinc-800/60 flex items-center justify-between gap-3 text-xs hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <PresenceBadge
                          type="doctor"
                          customLabel={d.typeName || 'Lékař'}
                          variant="text"
                          className="w-36 sm:w-44 flex-shrink-0"
                        />
                        <span className="font-semibold text-slate-900 dark:text-white truncate">
                          {formatDateCzech(d.date || (d as any).startDate)} ({d.startTime} – {d.endTime})
                        </span>
                        {d.facilityName && (
                          <span className="text-slate-400 dark:text-zinc-500 hidden sm:inline truncate max-w-[180px]">
                            • {d.facilityName}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        {d.status === 'pending' && (
                          <span className="px-2.5 py-1 rounded-full font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 flex items-center gap-1 text-[11px]">
                            <Clock className="w-3 h-3" />
                            <span>Čeká</span>
                          </span>
                        )}
                        {d.status === 'approved' && (
                          <span className="px-2.5 py-1 rounded-full font-semibold bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 flex items-center gap-1 text-[11px]">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Uznáno</span>
                          </span>
                        )}
                        {d.status === 'rejected' && (
                          <span className="px-2.5 py-1 rounded-full font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 flex items-center gap-1 text-[11px]">
                            <AlertCircle className="w-3 h-3" />
                            <span>Neuznáno</span>
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() => handleOpenDoctorModal(d)}
                          className="px-2.5 py-1 rounded-xl text-[11px] font-semibold text-slate-600 dark:text-zinc-300 bg-white dark:bg-zinc-700 hover:bg-slate-200 dark:hover:bg-zinc-600 transition-colors shadow-sm"
                        >
                          Detail
                        </button>
                      </div>
                    </div>
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
                      onApprove={(role, contractKind, weeklyHours) =>
                        handleApproveUser(u.id, role, contractKind, weeklyHours)
                      }
                    />
                  ))}
                </div>
              )}

              {/* ŽÁDOSTI O VOLNO V TÝMU (MINIFIKOVANÉ) */}
              {pendingVacationsForManager.map((req) => {
                const isPending = req.status === 'pending';
                const isApproved = req.status === 'approved';

                return (
                  <div
                    key={req.id}
                    className="py-2.5 px-3.5 rounded-2xl bg-slate-100/70 dark:bg-zinc-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-zinc-700 text-slate-700 dark:text-zinc-200 font-bold text-xs flex items-center justify-center flex-shrink-0">
                        {(req.userName || '?')
                          .split(' ')
                          .filter(Boolean)
                          .map((n) => n[0])
                          .join('')}
                      </div>
                      <div className="min-w-0 flex items-center gap-2 truncate">
                        <span className="font-bold text-slate-900 dark:text-white truncate">{req.userName}</span>
                        <RoleBadge role={req.userRole} roleLabel={req.userRole} />
                      </div>
                      <PresenceBadge
                        type={req.type}
                        customLabel={req.typeName}
                        variant="text"
                        className="w-32 sm:w-36 flex-shrink-0"
                      />
                      <span className="text-slate-600 dark:text-zinc-300 truncate hidden md:inline">
                        {formatDateCzech(req.startDate)}
                        {req.startDate !== req.endDate ? ` – ${formatDateCzech(req.endDate)}` : ''}
                      </span>
                      <span className="font-mono text-[11px] px-2 py-0.5 rounded-lg bg-white dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 flex-shrink-0">
                        {req.daysCount} {req.daysCount === 1 ? 'den' : req.daysCount < 5 ? 'dny' : 'dní'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto flex-shrink-0">
                      <button
                        onClick={() => handleOpenVacationModal(req)}
                        className="px-2.5 py-1 rounded-xl text-[11px] font-semibold text-slate-600 dark:text-zinc-300 bg-white dark:bg-zinc-700 hover:bg-slate-200 dark:hover:bg-zinc-600 transition-colors shadow-sm"
                      >
                        Detail
                      </button>

                      {isPending && (
                        <button
                          onClick={() => handleApproveVacation(req)}
                          className="px-3 py-1 rounded-xl text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-colors flex items-center gap-1 active:scale-98"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Schválit</span>
                        </button>
                      )}

                      {isApproved && (
                        <span className="px-2.5 py-1 rounded-full font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 text-[11px]">
                          Schváleno
                        </span>
                      )}

                      {!isPending && !isApproved && (
                        <span className="px-2.5 py-1 rounded-full font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 text-[11px]">
                          Zamítnuto
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* PROPUSTKY K LÉKAŘI V TÝMU (MINIFIKOVANÉ) */}
              {pendingDoctorsForManager.map((doc) => {
                const isPending = doc.status === 'pending';
                const isApproved = doc.status === 'approved';

                return (
                  <div
                    key={doc.id}
                    className="py-2.5 px-3.5 rounded-2xl bg-slate-100/70 dark:bg-zinc-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-zinc-700 text-slate-700 dark:text-zinc-200 font-bold text-xs flex items-center justify-center flex-shrink-0">
                        {(doc.userName || '?')
                          .split(' ')
                          .filter(Boolean)
                          .map((n) => n[0])
                          .join('')}
                      </div>
                      <div className="min-w-0 flex items-center gap-2 truncate">
                        <span className="font-bold text-slate-900 dark:text-white truncate">{doc.userName}</span>
                        <RoleBadge role={doc.userRole} roleLabel={doc.userRole} />
                      </div>
                      <PresenceBadge
                        type="doctor"
                        customLabel={doc.typeName || 'Lékař'}
                        variant="text"
                        className="w-32 sm:w-36 flex-shrink-0"
                      />
                      <span className="text-slate-600 dark:text-zinc-300 truncate hidden md:inline">
                        {formatDateCzech(doc.date || (doc as any).startDate)} ({doc.startTime} – {doc.endTime})
                      </span>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto flex-shrink-0">
                      <button
                        onClick={() => handleOpenDoctorModal(doc)}
                        className="px-2.5 py-1 rounded-xl text-[11px] font-semibold text-slate-600 dark:text-zinc-300 bg-white dark:bg-zinc-700 hover:bg-slate-200 dark:hover:bg-zinc-600 transition-colors shadow-sm"
                      >
                        Detail
                      </button>

                      {isPending && (
                        <button
                          onClick={() => handleApproveDoctor(doc)}
                          className="px-3 py-1 rounded-xl text-[11px] font-bold text-white bg-sky-600 hover:bg-sky-700 shadow-sm transition-colors flex items-center gap-1 active:scale-98"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Schválit</span>
                        </button>
                      )}

                      {isApproved && (
                        <span className="px-2.5 py-1 rounded-full font-semibold bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 text-[11px]">
                          Uznáno
                        </span>
                      )}

                      {!isPending && !isApproved && (
                        <span className="px-2.5 py-1 rounded-full font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 text-[11px]">
                          Neuznáno
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Box>

        {/* 3. Týmový přehled: Kdo je kde */}
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
                icon: Coffee,
                title: 'Kdo je kde',
                subtitle: 'Live přehled týmu – kdo je v kanceláři, kdo na dálku a kdo na volnu či u lékaře',
                badge: (
                  <span className="text-[11px] font-semibold px-2 py-0.2 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300">
                    {sortedPersonas.length} / {personasList.length} kolegů
                  </span>
                ),
                actions: (
                  <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-zinc-800 rounded-2xl self-start sm:self-auto">
                    <button
                      onClick={() => setPresenceViewMode('cards')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                        presenceViewMode === 'cards'
                          ? 'bg-white dark:bg-zinc-700 text-slate-900 dark:text-white shadow-sm'
                          : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200'
                      }`}
                      title="Zobrazit jako kartičky"
                    >
                      <LayoutGrid className="w-3.5 h-3.5" />
                      <span>Kartičky</span>
                    </button>
                    <button
                      onClick={() => setPresenceViewMode('rows')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                        presenceViewMode === 'rows'
                          ? 'bg-white dark:bg-zinc-700 text-slate-900 dark:text-white shadow-sm'
                          : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200'
                      }`}
                      title="Zobrazit jako řádky"
                    >
                      <List className="w-3.5 h-3.5" />
                      <span>Řádky</span>
                    </button>
                  </div>
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
                      : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200/70'
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
                            <div className="relative flex-shrink-0">
                              <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-zinc-700 flex items-center justify-center font-bold text-xs text-slate-700 dark:text-zinc-200">
                                {(p.name || '?')
                                  .split(' ')
                                  .filter(Boolean)
                                  .map((n) => n[0])
                                  .join('')}
                              </div>
                              <span
                                className={`absolute bottom-0 right-0 w-3 h-3 rounded-full ring-2 ring-white dark:ring-zinc-900 ${
                                  statusInfo.statusColor === 'emerald'
                                    ? 'bg-emerald-500'
                                    : statusInfo.statusColor === 'sky'
                                    ? 'bg-sky-500'
                                    : statusInfo.statusColor === 'amber'
                                    ? 'bg-amber-500'
                                    : statusInfo.statusColor === 'rose'
                                    ? 'bg-rose-500'
                                    : statusInfo.statusColor === 'red'
                                    ? 'bg-red-500'
                                    : statusInfo.statusColor === 'indigo'
                                    ? 'bg-indigo-500'
                                    : statusInfo.statusColor === 'purple'
                                    ? 'bg-purple-500'
                                    : 'bg-slate-400'
                                }`}
                              />
                            </div>
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

                        <div className="mt-3 pt-3 border-t border-slate-200/40 dark:border-zinc-700/60 flex flex-col gap-2">
                          <PresenceBadge
                            type={statusInfo.locationType}
                            customLabel={statusInfo.statusText}
                            className="max-w-full truncate"
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
                          <div className="relative flex-shrink-0">
                            <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-zinc-700 flex items-center justify-center text-xs font-bold text-slate-700 dark:text-zinc-200">
                              {(p.name || '?')
                                .split(' ')
                                .filter(Boolean)
                                .map((n) => n[0])
                                .join('')}
                            </div>
                            <span
                              className={`absolute bottom-0 right-0 w-3 h-3 rounded-full ring-2 ring-white dark:ring-zinc-900 ${
                                statusInfo.statusColor === 'emerald'
                                  ? 'bg-emerald-500'
                                  : statusInfo.statusColor === 'sky'
                                  ? 'bg-sky-500'
                                  : statusInfo.statusColor === 'amber'
                                  ? 'bg-amber-500'
                                  : statusInfo.statusColor === 'rose'
                                  ? 'bg-rose-500'
                                  : statusInfo.statusColor === 'red'
                                  ? 'bg-red-500'
                                  : statusInfo.statusColor === 'indigo'
                                  ? 'bg-indigo-500'
                                  : statusInfo.statusColor === 'purple'
                                  ? 'bg-purple-500'
                                  : 'bg-slate-400'
                              }`}
                            />
                          </div>

                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-slate-900 dark:text-zinc-100 flex items-center gap-2 truncate">
                              <span className="truncate">{p.name}</span>
                              
                              <RoleBadge role={p.role} roleLabel={p.roleLabel} />
                            </div>
                            <div className="text-xs text-slate-500 dark:text-zinc-400 truncate">
                              {p.contract}
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
            </>
          )}

          {/* ZÁLOŽKA 2: MOJE VÝKAZY */}
          {activeNavTab === 'vykazy' && (
            <MyTimesheetView
              activePersona={activePersona}
              onOpenMonthlyModal={() => {
                setSelectedMonthlyPersona(activePersona);
                setIsMonthlyModalOpen(true);
              }}
            />
          )}

          {/* ZÁLOŽKA 3: OSOBY */}
          {activeNavTab === 'osoby' && (
            <PersonsView
              personasList={personasList}
              activePersona={activePersona}
              getPersonaStatus={getPersonaStatus}
            />
          )}

          {/* ZÁLOŽKA 4: MĚSÍČNÍ UZÁVĚRKY */}
          {activeNavTab === 'uzaverky' && (
            <ClosuresView
              personasList={personasList}
              activePersona={activePersona}
              onOpenMonthlyDetail={(p) => {
                setSelectedMonthlyPersona(p);
                setIsMonthlyModalOpen(true);
              }}
            />
          )}

          {/* ZÁLOŽKA 5: NASTAVENÍ SYSTÉMU */}
          {activeNavTab === 'nastaveni' && (
            <SettingsView
              devConfig={devConfig}
              dbMode={dbMode}
              onOpenDevModal={() => setIsDevConfigModalOpen(true)}
              onSwitchDbMode={handleSwitchDatabaseMode}
              onResetDevDb={handleResetDevDb}
              onWipeCleanDb={handleWipeCleanDb}
              isResettingDevDb={isResettingDevDb}
              isWipingCleanDb={isWipingCleanDb}
            />
          )}
        </main>
      )}

      {/* MODAL 1: Nová žádost o volno / lékař (Self-Service) */}
      <NewRequestModal
        isOpen={isNewRequestModalOpen}
        onClose={() => setIsNewRequestModalOpen(false)}
        onSubmit={handleCreateNewRequest}
        applicantName={activePersona.name}
        managerName={activePersona.managerName}
        vacationRemaining={activePersona.vacationRemaining}
        vacationTotal={activePersona.vacationTotal}
        sickDaysRemaining={activePersona.sickDaysRemaining}
        sickDaysTotal={activePersona.sickDaysTotal}
      />


      {/* MODAL 4: Pípnutí karty (NFC) s volbou "Jsem doma" */}
      {isNfcModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-sm rounded-3xl p-6 text-center shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400 animate-pulse">
              <Smartphone className="w-10 h-10" />
            </div>

            <h3 className="text-lg font-semibold mb-1 text-slate-900 dark:text-white">Přiložte telefon k NFC čipu</h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mb-6">
              Přiložte zadní stranu telefonu k recepční kartě na pobočce.
            </p>

            <div className="space-y-3">
              <button
                onClick={() => handleClockInAction('home_office')}
                className="w-full py-3.5 px-6 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 text-sm font-semibold transition-all"
              >
                <div className="flex items-center justify-center gap-2">
                  <Home className="w-4 h-4 text-sky-500" />
                  <span>Jsem doma (Home Office)</span>
                </div>
              </button>

              <button
                onClick={() => setIsNfcModalOpen(false)}
                className="w-full py-2.5 text-xs text-slate-500 hover:text-slate-700 dark:text-zinc-400 transition-colors"
              >
                Zrušit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: Odchod z Home Office (Konec vs. Pauza) */}
      {isHoLeaveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Ukončení práce na Home Office</h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mb-5">
              Zvolte, zda končíte pro dnešek definitivně, nebo jdete pouze na dočasnou pauzu.
            </p>

            <div className="space-y-3">
              <button
                onClick={() => finishClockOut(false)}
                className="w-full p-4 rounded-2xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-950/50 text-left transition-all group"
              >
                <div className="font-semibold text-rose-700 dark:text-rose-400 text-sm">Konec práce pro dnešek</div>
                <div className="text-xs text-rose-600/70 dark:text-rose-300/70 mt-0.5">
                  Definitivní uzavření směny v databázi
                </div>
              </button>

              <div className="p-4 rounded-2xl bg-amber-500/10 dark:bg-amber-500/15 space-y-3">
                <div>
                  <div className="font-semibold text-amber-950 dark:text-amber-300 text-sm flex items-center gap-1.5">
                    <Coffee className="w-4 h-4" />
                    <span>Ještě se vrátím (Pauza)</span>
                  </div>
                  <div className="text-xs text-amber-800/80 dark:text-amber-300/80 mt-0.5">
                    Směna se pozastaví a kolegům se zobrazí orientační čas návratu.
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-600 dark:text-zinc-300">Návrat cca:</span>
                  <input
                    type="time"
                    value={pauseReturnTime}
                    onChange={(e) => setPauseReturnTime(e.target.value)}
                    className="px-3 py-1.5 text-xs font-mono font-semibold rounded-xl bg-white dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <button
                    onClick={() => finishClockOut(true, pauseReturnTime)}
                    className="ml-auto px-4 py-1.5 text-xs font-semibold rounded-full bg-amber-500 hover:bg-amber-600 text-zinc-950 transition-colors"
                  >
                    Potvrdit
                  </button>
                </div>
              </div>

              <button
                onClick={() => setIsHoLeaveModalOpen(false)}
                className="w-full py-2 text-xs text-slate-500 hover:text-slate-700 transition-colors text-center"
              >
                Zpět
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 7: Detail a schválení žádosti o dovolenou */}
      {selectedVacation && (
        <LeaveRequestModal
          request={selectedVacation}
          isOpen={isVacationModalOpen}
          onClose={() => setIsVacationModalOpen(false)}
          onApprove={handleApproveVacation}
          onReject={handleRejectVacation}
        />
      )}

      {/* MODAL 8: Ověření propustky k lékaři */}
      {selectedDoctor && (
        <DoctorVisitModal
          request={selectedDoctor}
          isOpen={isDoctorModalOpen}
          onClose={() => setIsDoctorModalOpen(false)}
          onApprove={handleApproveDoctor}
          onReject={handleRejectDoctor}
        />
      )}

      {/* MODAL 9: Detail měsíčního výkazu (Timesheet) */}
      <MonthlyTimesheetModal
        isOpen={isMonthlyModalOpen}
        onClose={() => {
          setIsMonthlyModalOpen(false);
          setSelectedMonthlyPersona(null);
        }}
        userName={selectedMonthlyPersona?.name || activePersona.name}
        userRole={selectedMonthlyPersona?.roleLabel || activePersona.roleLabel}
        contract={selectedMonthlyPersona?.contract || activePersona.contract}
      />

      {/* Dev Environment Config Wizard Modal */}
      <DevConfigModal
        isOpen={isDevConfigModalOpen}
        onClose={() => setIsDevConfigModalOpen(false)}
        addToast={addToast}
        onConfigUpdated={(newConfig) => {
          setDevConfig(newConfig);
        }}
      />


      {/* Floating NFC Simulator in Dev Mode (hidden when DEV mode is closed) */}
      {isDevVisible && <NfcDebugSimulator onSimulateClockIn={handleSimulatedNfc} />}

      {/* Toast Notifications Container */}
      <div className="fixed bottom-6 right-6 z-50 space-y-2 max-w-sm pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto p-4 rounded-2xl text-white shadow-xl flex items-start gap-3 animate-in slide-in-from-bottom-5 duration-200 ${
              t.type === 'success'
                ? 'bg-emerald-600'
                : t.type === 'warning'
                ? 'bg-amber-500 text-zinc-950 font-medium'
                : 'bg-rose-600'
            }`}
          >
            {t.type === 'success' && <CheckCircle2 className="w-5 h-5 flex-shrink-0" />}
            {t.type === 'warning' && <AlertCircle className="w-5 h-5 flex-shrink-0 text-zinc-950" />}
            {t.type === 'error' && <AlertOctagon className="w-5 h-5 flex-shrink-0" />}
            <div>
              <div className="font-semibold text-sm leading-tight">{t.title}</div>
              <div className="text-xs opacity-90 mt-0.5">{t.message}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;

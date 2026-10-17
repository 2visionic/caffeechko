import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Home,
  Building2,
  Coffee,
  ChevronDown,
  Smartphone,
  ShieldCheck,
  Check,
  Trash2,
  RotateCcw,
  UserX,
  Settings,
  X
} from 'lucide-react';
import { NfcDebugSimulator } from './components/NfcDebugSimulator';
import type { ShiftBlock } from './types/attendance';
import { syncAbsenceTypeLabels, type StatusType } from './config/presenceConfig';
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
import { UserSettingsModal } from './components/UserSettingsModal';
import { Header } from './components/Header';
import {
  Button,
  ToastContainer,
  Modal
} from './components/ui';
import {
  api,
  type DevConfig,
  type RadarUserDto,
  type DatabaseMode,
  type DevDatabaseStatus,
  type MonthSummaryDto,
  type CompanySettingDto,
  type WorkplaceDto,
  type AbsenceTypeConfigDto,
  DEFAULT_ABSENCE_TYPES,
  resolveAbsenceTypeConfig,
  getStoredDbMode,
  setStoredDbMode,
  getSessionUserId,
  setSessionUserId,
  clearSessionUserId,
  setAuthToken
} from './api';
import { nfcService } from './services/nfcService';
import type { Persona, ToastMessage } from './types/attendance';
import { formatHoursMinutes, formatOvertime, formatDateCzech } from './types/attendance';
import { DEV_PERSONAS, UNINSTALLED_PERSONA, ANONYMOUS_PERSONA } from './config/personas';
import { DashboardView } from './views/DashboardView';
import { RequestsView, type RequestsPageTab } from './views/RequestsView';

export type { Persona, ToastMessage };
export { formatHoursMinutes, formatOvertime, formatDateCzech, DEV_PERSONAS, UNINSTALLED_PERSONA, ANONYMOUS_PERSONA };

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
      if (typeof window !== 'undefined') {
        const savedUser = sessionStorage.getItem('caffeechko_session_user');
        if (savedUser) {
          try {
            return JSON.parse(savedUser);
          } catch {}
        }
      }
    }

    return DEV_PERSONAS[0];
  });

  // Keep session storage synchronized with logged-in persona
  useEffect(() => {
    if (activePersona && activePersona.id && activePersona.id !== 'clean-uninstalled') {
      setSessionUserId(activePersona.id);
      if (activePersona.id !== 'anonymous' && typeof window !== 'undefined') {
        sessionStorage.setItem('caffeechko_session_user', JSON.stringify(activePersona));
      }
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
  const [monthSummary, setMonthSummary] = useState<MonthSummaryDto | null>(null);

  const [dbStatus, setDbStatus] = useState<DevDatabaseStatus | null>(null);
  const [isWipingCleanDb, setIsWipingCleanDb] = useState(false);
  const [isResettingDevDb, setIsResettingDevDb] = useState(false);


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
  const [isWorkplaceSelectModalOpen, setIsWorkplaceSelectModalOpen] = useState(false);
  const [workplaces, setWorkplaces] = useState<WorkplaceDto[]>([
    {
      id: '11111111-1111-1111-1111-111111111111',
      name: 'Pobočka Praha 1 - Palmovka',
      nfcIdentifier: 'praha1',
      address: 'Voctářova 18, Praha 8'
    },
    {
      id: '22222222-2222-2222-2222-222222222222',
      name: 'Pobočka Brno - Spielberk',
      nfcIdentifier: 'brno1',
      address: 'Holandská 10, Brno'
    }
  ]);
  const [isHoLeaveModalOpen, setIsHoLeaveModalOpen] = useState(false);
  const [isNewRequestModalOpen, setIsNewRequestModalOpen] = useState(false);
  const [newRequestInitialType, setNewRequestInitialType] = useState<any>('vacation');
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

  const [companySettings, setCompanySettings] = useState<CompanySettingDto | null>(null);
  const [absenceTypesMap, setAbsenceTypesMap] = useState<Record<string, AbsenceTypeConfigDto>>(
    () => DEFAULT_ABSENCE_TYPES
  );

  useEffect(() => {
    async function fetchConfig() {
      const res = await api.getDevConfig();
      if (res?.data) {
        setDevConfig(res.data);
      }
      const compRes = await api.getCompanySettings();
      if (compRes?.data) {
        setCompanySettings(compRes.data);
      }
      const wpRes = await api.getWorkplaces();
      if (wpRes?.data && wpRes.data.length > 0) {
        setWorkplaces(wpRes.data);
      }
      const typesRes = await api.getAbsenceTypes();
      if (typesRes?.data && typesRes.data.length > 0) {
        const nextMap: Record<string, AbsenceTypeConfigDto> = { ...DEFAULT_ABSENCE_TYPES };
        for (const t of typesRes.data) {
          nextMap[t.code] = t;
        }
        syncAbsenceTypeLabels(nextMap);
        setAbsenceTypesMap(nextMap);
      }
    }
    fetchConfig();
  }, []);

  const currentDomain = devConfig.googleWorkspaceDomain || 'firma.cz';

  const effectivePersonas = useMemo(() => {
    const roleLabelMap: Record<string, string> = {
      admin: 'Administrátor',
      manager: 'Manažer / Vedoucí',
      team_lead: 'Vedoucí týmu',
      office_manager: 'Office Manažer',
      colleague: 'Kolega'
    };

    const radarMap = new Map(teamPresence.map((r) => [r.userId.toLowerCase(), r]));
    const baseList: Persona[] = DEV_PERSONAS.map((p) => {
      const username = p.email ? p.email.split('@')[0] : 'user';
      const r = radarMap.get(p.id.toLowerCase());
      return {
        ...p,
        email: `${username}@${currentDomain}`,
        managerId: r?.managerId ?? p.managerId,
        managerName: r?.managerName ?? p.managerName,
        parentPersonId: r?.parentPersonId ?? p.parentPersonId,
        parentPersonName: r?.parentPersonName ?? p.parentPersonName
      };
    });

    const seenIds = new Set(baseList.map((p) => p.id.toLowerCase()));

    // Přidat reálné schválené uživatele z databáze (např. přihlášené přes Google OAuth), kteří nejsou ve výchozím DEV_PERSONAS
    for (const r of teamPresence) {
      if (!r.userId) continue;
      const lowerId = r.userId.toLowerCase();
      if (!seenIds.has(lowerId)) {
        seenIds.add(lowerId);
        const roleKey = (r.role || 'colleague') as Persona['role'];
        baseList.push({
          id: r.userId,
          name: r.displayName || r.email || 'Uživatel',
          email: r.email || '',
          phoneNumber: r.phoneNumber || '',
          role: roleKey,
          roleLabel: roleLabelMap[roleKey] || 'Kolega',
          contract: r.contractKind === 'OSVČ' ? 'OSVČ' : 'HPP',
          managerId: r.managerId || undefined,
          managerName: r.managerName || undefined,
          parentPersonId: r.parentPersonId || undefined,
          parentPersonName: r.parentPersonName || undefined,
          isApproved: true
        });
      }
    }

    if (
      activePersona &&
      activePersona.id &&
      activePersona.id !== 'anonymous' &&
      activePersona.id !== 'clean-uninstalled' &&
      activePersona.isApproved !== false &&
      !seenIds.has(activePersona.id.toLowerCase())
    ) {
      baseList.push(activePersona);
    }

    return baseList;
  }, [currentDomain, teamPresence, activePersona]);

  useEffect(() => {
    const isSeedPersona = DEV_PERSONAS.some((p) => p.id.toLowerCase() === activePersona.id.toLowerCase());
    if (isSeedPersona && activePersona.id !== 'anonymous' && activePersona.id !== 'clean-uninstalled') {
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

  const [agendaTab, setAgendaTab] = useState<RequestsPageTab>('my');
  const [dashboardRequestsTab, setDashboardRequestsTab] = useState<RequestsPageTab>('my');

  useEffect(() => {
    setDashboardRequestsTab('my');
    setAgendaTab('my');
    setInspectedPersona(null);
  }, [activePersona.id]);

  // Inspected Persona Detail state (when viewing another person's detail from Kdo je kde / Osoby)
  const [inspectedPersona, setInspectedPersona] = useState<Persona | null>(null);
  const [inspectedIsClockedIn, setInspectedIsClockedIn] = useState(false);
  const [inspectedActiveLocation, setInspectedActiveLocation] = useState<'office' | 'home_office'>('office');
  const [inspectedWorkplaceName, setInspectedWorkplaceName] = useState('Mimo práci');
  const [inspectedClockInTime, setInspectedClockInTime] = useState('08:00');
  const [inspectedHoursToday, setInspectedHoursToday] = useState(0);
  const [inspectedShifts, setInspectedShifts] = useState<ShiftBlock[]>([]);
  const [inspectedMonthSummary, setInspectedMonthSummary] = useState<MonthSummaryDto | null>(null);
  const [inspectedVacationRequests, setInspectedVacationRequests] = useState<LeaveRequestItem[]>([]);
  const [inspectedDoctorVisits, setInspectedDoctorVisits] = useState<DoctorVisitItem[]>([]);

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Dark mode effect
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('caffeechko_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('caffeechko_theme', 'light');
    }
  }, [darkMode]);

  const addToast = (type: 'success' | 'warning' | 'error', title: string, message: string) => {
    const id = Date.now();
    setToasts([{ id, type, title, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  };

  const removeToast = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Active navigation tab & mobile menu
  const [activeNavTab, setActiveNavTab] = useState<NavTabId>('dochazka');
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  // Bezpečnostní kontrola přístupových práv k záložkám:
  // - Osoby: všichni kromě kolegů
  // - Uzávěrky & Nastavení: pouze Admin a Officer
  useEffect(() => {
    const isColleague = activePersona.role === 'colleague';
    const isAdminOrOfficer = activePersona.role === 'admin' || activePersona.role === 'office_manager';

    if (activeNavTab === 'osoby' && isColleague) {
      setActiveNavTab('dochazka');
    } else if ((activeNavTab === 'uzaverky' || activeNavTab === 'nastaveni') && !isAdminOrOfficer) {
      setActiveNavTab('dochazka');
    }
  }, [activePersona.role, activeNavTab]);

  // Monthly timesheet modal for detailed review
  const [isMonthlyModalOpen, setIsMonthlyModalOpen] = useState(false);
  const [selectedMonthlyPersona, setSelectedMonthlyPersona] = useState<Persona | null>(null);

  // User settings modal (předvolby vzhledu, notifikace, profil)
  const [isUserSettingsModalOpen, setIsUserSettingsModalOpen] = useState(false);

  // Helper to get real status from SQLite teamPresence or current active state
  const getPersonaStatus = (p: Persona) => {
    const isCurrent = p.id === activePersona.id;
    const isInspected = Boolean(inspectedPersona && p.id === inspectedPersona.id);
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    const parseHhMm = (t?: string | null): number | null => {
      if (!t || !t.includes(':')) return null;
      const [h, m] = t.split(':').map(Number);
      if (Number.isNaN(h) || Number.isNaN(m)) return null;
      return h * 60 + m;
    };

    // 1. If currently clocked in, active clock-in location wins
    if (isCurrent && isClockedIn) {
      const officeDetail = workplaceName.startsWith('Kancelář (')
        ? workplaceName.replace(/^Kancelář \((.+)\)$/, '$1')
        : workplaceName.split(' - ')[0];
      const hoLabel = resolveAbsenceTypeConfig('home_office', absenceTypesMap).nameEmployee || 'Home Office';
      return {
        statusText: activeLocation === 'office' ? `V kanceláři (${officeDetail})` : hoLabel,
        statusColor: activeLocation === 'office' ? 'emerald' : 'sky',
        locationType: activeLocation as 'office' | 'home_office'
      };
    }

    if (isInspected && inspectedIsClockedIn) {
      const officeDetail = inspectedWorkplaceName.startsWith('Kancelář (')
        ? inspectedWorkplaceName.replace(/^Kancelář \((.+)\)$/, '$1')
        : inspectedWorkplaceName.split(' - ')[0];
      const hoLabel = resolveAbsenceTypeConfig('home_office', absenceTypesMap).nameEmployee || 'Home Office';
      return {
        statusText: inspectedActiveLocation === 'office' ? `V kanceláři (${officeDetail})` : hoLabel,
        statusColor: inspectedActiveLocation === 'office' ? 'emerald' : 'sky',
        locationType: inspectedActiveLocation as 'office' | 'home_office'
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
      const vacLabel = resolveAbsenceTypeConfig(approvedVac.type, absenceTypesMap).nameEmployee;
      if (approvedVac.type === 'sick_day') {
        return {
          statusText: vacLabel,
          statusColor: 'rose',
          locationType: 'sick_day' as const
        };
      }
      if (approvedVac.type === 'illness') {
        return {
          statusText: vacLabel,
          statusColor: 'red',
          locationType: 'illness' as const
        };
      }
      if (approvedVac.type === 'unpaid_leave') {
        return {
          statusText: vacLabel,
          statusColor: 'purple',
          locationType: 'unpaid_leave' as const
        };
      }
      if (approvedVac.type === 'home_office') {
        return {
          statusText: vacLabel,
          statusColor: 'sky',
          locationType: 'home_office' as const
        };
      }
      return {
        statusText: vacLabel,
        statusColor: 'amber',
        locationType: 'vacation' as const
      };
    }

    // 3. Check approved doctor visits today (only active if current time is within startTime–endTime)
    const docVisit = doctorVisits.find((d) => {
      const isUser = d.applicantId === p.id || (d as any).userId === p.id || d.userName === p.name;
      const isToday = d.date === todayStr || (d as any).startDate === todayStr;
      if (!isUser || d.status !== 'approved' || !isToday) return false;
      const startMin = parseHhMm(d.startTime);
      const endMin = parseHhMm(d.endTime);
      if (startMin === null || endMin === null) return false;
      return nowMinutes >= startMin && nowMinutes <= endMin;
    });
    if (docVisit) {
      const docLabel = resolveAbsenceTypeConfig('doctor', absenceTypesMap).nameEmployee || 'Lékař';
      return {
        statusText: `${docLabel} (${docVisit.startTime} – ${docVisit.endTime})`,
        statusColor: 'indigo',
        locationType: 'doctor' as const
      };
    }

    // 4. Radar status from SQLite database
    const radarItem = teamPresence.find((t) => t.userId?.toLowerCase() === p.id.toLowerCase());
    if (radarItem) {
      const locType =
        (radarItem.locationType as StatusType) ||
        (radarItem.statusColor === 'emerald' ? 'office' : radarItem.statusColor === 'sky' ? 'home_office' : 'offline');

      // Pokud záznam z radaru indikuje lékaře s časem od–do, ověříme, že časové okno stále probíhá
      if (locType === 'doctor' && radarItem.statusText) {
        const match = radarItem.statusText.match(/(\d{1,2}:\d{2})\s*[–-]\s*(\d{1,2}:\d{2})/);
        if (match) {
          const sMin = parseHhMm(match[1]);
          const eMin = parseHhMm(match[2]);
          if (sMin !== null && eMin !== null && (nowMinutes < sMin || nowMinutes > eMin)) {
            return {
              statusText: 'Nepřítomen',
              statusColor: 'slate',
              locationType: 'offline' as const
            };
          }
        }
      }

      return {
        statusText: radarItem.statusText,
        statusColor: radarItem.statusColor,
        locationType: locType
      };
    }

    return {
      statusText: 'Nepřítomen',
      statusColor: 'slate',
      locationType: 'offline' as const
    };
  };

  const personasList = dbMode === 'clean'
    ? (cleanInstalled && cleanAdminUser ? [activePersona] : [])
    : effectivePersonas;

  // Switch persona handler
  const handleSwitchPersona = async (persona: Persona) => {
    setInspectedPersona(null);
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
      vacationRemaining: undefined,
      vacationTotal: undefined,
      sickDaysRemaining: undefined,
      sickDaysTotal: undefined,
      homeOfficeDays: undefined,
      contract: authUser.contract === 'IČO' ? 'OSVČ' : 'HPP',
      isApproved: authUser.isApproved !== false
    };
    setInspectedPersona(null);
    setActivePersona(persona);
    setSessionUserId(persona.id);
  };

  const handleLogout = async () => {
    await api.logout();
    setInspectedPersona(null);
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

  const [isClearingLogs, setIsClearingLogs] = useState(false);

  const handleClearLogs = async () => {
    setIsClearingLogs(true);
    try {
      const res = await api.clearLogs();
      if (res && typeof res.data === 'number') {
        addToast('success', 'Logy vyprázdněny', `Z tabulky logs bylo smazáno ${res.data} záznamů.`);
      } else {
        addToast('warning', 'Logy vyprázdněny', 'Lokální fronta logů byla vyčištěna.');
      }
    } catch {
      addToast('error', 'Chyba', 'Nepodařilo se vyprázdnit tabulku logs.');
    } finally {
      setIsClearingLogs(false);
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

        const typesRes = await api.getAbsenceTypes();
        let currentTypesMap = absenceTypesMap;
        if (typesRes?.data && typesRes.data.length > 0 && isMounted) {
          const nextMap: Record<string, AbsenceTypeConfigDto> = { ...DEFAULT_ABSENCE_TYPES };
          for (const t of typesRes.data) {
            nextMap[t.code] = t;
          }
          syncAbsenceTypeLabels(nextMap);
          setAbsenceTypesMap(nextMap);
          currentTypesMap = nextMap;
        }
        const doctorTypeLabel = resolveAbsenceTypeConfig('doctor', currentTypesMap).nameEmployee || 'Lékař';

        const statusRes = await api.getStatus(activePersona.id);
        if (statusRes && statusRes.data && isMounted) {
          setIsDbConnected(true);
          setIsClockedIn(statusRes.data.isClockedIn);
          setHoursToday(statusRes.data.totalHoursWorkedToday ?? 0);

          const activeStartMs = statusRes.data.startTime ? new Date(statusRes.data.startTime).getTime() : undefined;
          const dbTodayShifts = Array.isArray((statusRes.data as any).todayShifts)
            ? (statusRes.data as any).todayShifts.map((s: any) => ({
                id: s.id,
                start: s.startTime,
                end: s.endTime || null,
                location: (
                  s.locationType === 'doctor'
                    ? 'doctor'
                    : s.locationType === 'office'
                    ? 'office'
                    : 'home_office'
                ) as 'office' | 'home_office' | 'doctor',
                locationName:
                  s.locationType === 'doctor'
                    ? s.workplaceName || doctorTypeLabel
                    : s.locationType === 'office'
                    ? s.workplaceName || 'Kancelář (bez ověření)'
                    : 'Home Office',
                method: (
                  s.locationType === 'doctor'
                    ? 'request'
                    : s.locationType === 'office' && s.workplaceId
                    ? 'nfc'
                    : 'web'
                ) as 'nfc' | 'web' | 'request',
                startedAtMs: !s.endTime ? activeStartMs : undefined
              }))
            : null;

          if (!statusRes.data.isClockedIn) {
            setWorkplaceName('Mimo práci');
            if (dbTodayShifts) {
              setCurrentShifts(dbTodayShifts);
            } else if (!statusRes.data.totalHoursWorkedToday || statusRes.data.totalHoursWorkedToday === 0) {
              setCurrentShifts([]);
            }
          } else if (statusRes.data.isClockedIn && statusRes.data.startTime) {
            const startLocal = new Date(statusRes.data.startTime);
            const startHhMm = `${String(startLocal.getHours()).padStart(2, '0')}:${String(startLocal.getMinutes()).padStart(2, '0')}`;
            const locType = statusRes.data.locationType === 'office' ? 'office' : 'home_office';
            const hasVerifiedWorkplace = Boolean(statusRes.data.workplaceName);
            const wpLabel = locType === 'office' ? (statusRes.data.workplaceName || 'Kancelář (bez ověření)') : 'Home Office';
            setActiveLocation(locType);
            setWorkplaceName(wpLabel);
            setClockInTime(startHhMm);
            if (dbTodayShifts && dbTodayShifts.length > 0) {
              setCurrentShifts(dbTodayShifts);
            } else {
              setCurrentShifts((prev) => {
                if (prev.length === 0 || !prev.some((s) => s.end === null)) {
                  return [
                    ...prev.filter((s) => s.end !== null),
                    {
                      id: statusRes.data.activeShiftId || `shift-${Date.now()}`,
                      start: startHhMm,
                      end: null,
                      location: locType,
                      locationName: wpLabel,
                      method: locType === 'office' && hasVerifiedWorkplace ? 'nfc' : 'web',
                      startedAtMs: activeStartMs
                    }
                  ];
                }
                return prev;
              });
            }
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
          remainingDays: item.remainingDays ?? 0,
          totalDays: item.totalDays ?? 0,
          isRead: Boolean(item.isRead),
          status: item.status === 'completed' || item.status === 'approved' ? 'approved' : item.status === 'rejected' ? 'rejected' : 'pending'
        });

        const normalizeDoctorItem = (item: any): DoctorVisitItem => ({
          ...item,
          type: 'doctor',
          date: item.date || item.startDate || '',
          startTime: item.startTime || '08:00',
          endTime: item.endTime || '12:00',
          facilityName: item.facilityName || undefined,
          hasConfirmationDocument: item.hasConfirmationDocument ?? true,
          isRead: Boolean(item.isRead),
          status: item.status === 'completed' || item.status === 'approved' ? 'approved' : item.status === 'rejected' ? 'rejected' : 'pending'
        });

        // 1. Fetch user's own requests from database (all leave types: vacation, sick_day, illness, unpaid, home_office)
        const myRes = await api.getMyRequests(activePersona.id);
        const myVacs: LeaveRequestItem[] = (myRes?.data || [])
          .filter((r: any) => r.type !== 'doctor')
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
              vacationRemaining: balRes.data.vacationRemaining !== null ? balRes.data.vacationRemaining : undefined,
              vacationTotal: balRes.data.vacationTotal !== null ? balRes.data.vacationTotal : undefined,
              sickDaysRemaining: balRes.data.sickDaysRemaining !== null ? balRes.data.sickDaysRemaining : undefined,
              sickDaysTotal: balRes.data.sickDaysTotal !== null ? balRes.data.sickDaysTotal : undefined,
              homeOfficeDays: balRes.data.homeOfficeWeeklyDays !== null ? balRes.data.homeOfficeWeeklyDays : undefined,
              unpaidLeaveDays: balRes.data.unpaidLeaveDays ?? prev.unpaidLeaveDays ?? 0
            };
          });
        }

        // 1c. Fetch user's real monthly summary (hours worked, fund, overtime) from database
        const monthRes = await api.getMonthSummary(activePersona.id);
        if (monthRes?.data && isMounted) {
          setMonthSummary(monthRes.data);
        } else if (isMounted) {
          setMonthSummary(null);
        }

        // 2. Fetch pending approvals for managers from database
        let pendingVacs: LeaveRequestItem[] = [];
        let pendingDocs: DoctorVisitItem[] = [];
        if (['admin', 'manager', 'team_lead', 'office_manager'].includes(activePersona.role)) {
          const pendingRes = await api.getPendingApprovals(activePersona.id);
          if (pendingRes?.data) {
            pendingVacs = pendingRes.data
              .filter((r: any) => r.type !== 'doctor')
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

  // Sync inspected persona data when viewing another person's detail
  useEffect(() => {
    if (!inspectedPersona?.id) {
      setInspectedIsClockedIn(false);
      setInspectedActiveLocation('office');
      setInspectedWorkplaceName('Mimo práci');
      setInspectedClockInTime('08:00');
      setInspectedHoursToday(0);
      setInspectedShifts([]);
      setInspectedMonthSummary(null);
      setInspectedVacationRequests([]);
      setInspectedDoctorVisits([]);
      return;
    }

    let isMounted = true;
    const targetId = inspectedPersona.id;

    async function syncInspectedData() {
      try {
        const statusRes = await api.getStatus(targetId);
        if (statusRes?.data && isMounted) {
          setInspectedIsClockedIn(statusRes.data.isClockedIn);
          setInspectedHoursToday(statusRes.data.totalHoursWorkedToday ?? 0);

          const inspectedStartMs = statusRes.data.startTime ? new Date(statusRes.data.startTime).getTime() : undefined;
          const doctorTypeLabel = resolveAbsenceTypeConfig('doctor', absenceTypesMap).nameEmployee || 'Lékař';
          const dbTodayShifts = Array.isArray((statusRes.data as any).todayShifts)
            ? (statusRes.data as any).todayShifts.map((s: any) => ({
                id: s.id,
                start: s.startTime,
                end: s.endTime || null,
                location: (
                  s.locationType === 'doctor'
                    ? 'doctor'
                    : s.locationType === 'office'
                    ? 'office'
                    : 'home_office'
                ) as 'office' | 'home_office' | 'doctor',
                locationName:
                  s.locationType === 'doctor'
                    ? s.workplaceName || doctorTypeLabel
                    : s.locationType === 'office'
                    ? s.workplaceName || 'Kancelář (bez ověření)'
                    : 'Home Office',
                method: (
                  s.locationType === 'doctor'
                    ? 'request'
                    : s.locationType === 'office' && s.workplaceId
                    ? 'nfc'
                    : 'web'
                ) as 'nfc' | 'web' | 'request',
                startedAtMs: !s.endTime ? inspectedStartMs : undefined
              }))
            : [];

          if (!statusRes.data.isClockedIn) {
            setInspectedWorkplaceName('Mimo práci');
            setInspectedShifts(dbTodayShifts);
          } else if (statusRes.data.startTime) {
            const startLocal = new Date(statusRes.data.startTime);
            const startHhMm = `${String(startLocal.getHours()).padStart(2, '0')}:${String(startLocal.getMinutes()).padStart(2, '0')}`;
            const locType = statusRes.data.locationType === 'office' ? 'office' : 'home_office';
            const wpLabel = locType === 'office' ? (statusRes.data.workplaceName || 'Kancelář (bez ověření)') : 'Home Office';
            setInspectedActiveLocation(locType);
            setInspectedWorkplaceName(wpLabel);
            setInspectedClockInTime(startHhMm);
            setInspectedShifts(dbTodayShifts);
          }
        }

        const balRes = await api.getAbsenceBalances(targetId);
        if (balRes?.data && isMounted) {
          setInspectedPersona((prev) => {
            if (!prev || prev.id !== targetId) return prev;
            return {
              ...prev,
              vacationRemaining: balRes.data.vacationRemaining !== null ? balRes.data.vacationRemaining : undefined,
              vacationTotal: balRes.data.vacationTotal !== null ? balRes.data.vacationTotal : undefined,
              sickDaysRemaining: balRes.data.sickDaysRemaining !== null ? balRes.data.sickDaysRemaining : undefined,
              sickDaysTotal: balRes.data.sickDaysTotal !== null ? balRes.data.sickDaysTotal : undefined,
              homeOfficeDays: balRes.data.homeOfficeWeeklyDays !== null ? balRes.data.homeOfficeWeeklyDays : undefined,
              unpaidLeaveDays: balRes.data.unpaidLeaveDays ?? prev.unpaidLeaveDays ?? 0
            };
          });
        }

        const monthRes = await api.getMonthSummary(targetId);
        if (isMounted) {
          setInspectedMonthSummary(monthRes?.data || null);
        }

        const myRes = await api.getMyRequests(targetId);
        if (myRes?.data && isMounted) {
          const normalizeVacationItem = (item: any): LeaveRequestItem => ({
            ...item,
            startDate: item.startDate || '',
            endDate: item.endDate || item.startDate || '',
            daysCount: item.daysCount || 1,
            remainingDays: item.remainingDays ?? 0,
            totalDays: item.totalDays ?? 0,
            isRead: Boolean(item.isRead),
            status: item.status === 'completed' || item.status === 'approved' ? 'approved' : item.status === 'rejected' ? 'rejected' : 'pending'
          });

          const normalizeDoctorItem = (item: any): DoctorVisitItem => ({
            ...item,
            type: 'doctor',
            date: item.date || item.startDate || '',
            startTime: item.startTime || '08:00',
            endTime: item.endTime || '12:00',
            facilityName: item.facilityName || undefined,
            hasConfirmationDocument: item.hasConfirmationDocument ?? true,
            isRead: Boolean(item.isRead),
            status: item.status === 'completed' || item.status === 'approved' ? 'approved' : item.status === 'rejected' ? 'rejected' : 'pending'
          });

          setInspectedVacationRequests(
            myRes.data.filter((r: any) => r.type !== 'doctor').map(normalizeVacationItem)
          );
          setInspectedDoctorVisits(
            myRes.data.filter((r: any) => r.type === 'doctor').map(normalizeDoctorItem)
          );
        }
      } catch (err) {
        console.warn('Inspected persona sync failed:', err);
      }
    }

    syncInspectedData();
    return () => {
      isMounted = false;
    };
  }, [inspectedPersona?.id]);

  // Vacation Handlers
  const handleOpenVacationModal = (req: LeaveRequestItem) => {
    if (!req.isRead) {
      setVacationRequests((prev) =>
        prev.map((r) => (r.id === req.id ? { ...r, isRead: true } : r))
      );
      setInspectedVacationRequests((prev) =>
        prev.map((r) => (r.id === req.id ? { ...r, isRead: true } : r))
      );
      void api.markAbsenceRead(req.id);
    }
    setSelectedVacation({ ...req, isRead: true });
    setIsVacationModalOpen(true);
  };

  const handleApproveVacation = async (updatedReq: LeaveRequestItem) => {
    setVacationRequests((prev) =>
      prev.map((r) => (r.id === updatedReq.id ? { ...updatedReq, status: 'approved', isRead: false } : r))
    );
    setInspectedVacationRequests((prev) =>
      prev.map((r) => (r.id === updatedReq.id ? { ...updatedReq, status: 'approved', isRead: false } : r))
    );
    // Write directly to SQLite database including any modified dates
    await api.approveAbsence(updatedReq.id, activePersona.id, {
      startDate: updatedReq.startDate,
      endDate: updatedReq.endDate
    });

    addToast(
      'success',
      'Dovolená schválena v DB',
      `Dovolená pro ${updatedReq.userName} (${formatDateCzech(updatedReq.startDate)} – ${formatDateCzech(updatedReq.endDate)}, ${updatedReq.daysCount} dní) byla schválena a uložena do SQLite databáze.`
    );
  };

  const handleRenewVacation = async (updatedReq: LeaveRequestItem) => {
    const isManagingOther = Boolean(inspectedPersona && inspectedPersona.id !== activePersona.id);
    const targetPersona = inspectedPersona || activePersona;
    const isAutoApproved = isManagingOther || !targetPersona.managerId;
    const nextStatus = isAutoApproved ? 'approved' : 'pending';
    const nowCreatedAt = new Date().toISOString();

    const renewedItem: LeaveRequestItem = {
      ...updatedReq,
      status: nextStatus,
      rejectionReason: undefined,
      isRead: false,
      createdAt: nowCreatedAt
    };

    setVacationRequests((prev) =>
      prev.map((r) => (r.id === updatedReq.id ? renewedItem : r))
    );
    setInspectedVacationRequests((prev) =>
      prev.map((r) => (r.id === updatedReq.id ? renewedItem : r))
    );

    await api.resubmitAbsence(updatedReq.id, {
      typeCode: updatedReq.type,
      startDate: updatedReq.startDate,
      endDate: updatedReq.endDate,
      note: updatedReq.note,
      autoApprove: isManagingOther ? true : undefined,
      approvedByUserId: isManagingOther ? activePersona.id : undefined
    });

    const bal = await api.getAbsenceBalances(updatedReq.applicantId || targetPersona.id);
    if (bal?.data) {
      const updateFn = (prev: Persona) => ({
        ...prev,
        vacationRemaining: bal.data.vacationRemaining !== null ? bal.data.vacationRemaining : undefined,
        vacationTotal: bal.data.vacationTotal !== null ? bal.data.vacationTotal : undefined,
        sickDaysRemaining: bal.data.sickDaysRemaining !== null ? bal.data.sickDaysRemaining : undefined,
        sickDaysTotal: bal.data.sickDaysTotal !== null ? bal.data.sickDaysTotal : undefined,
        homeOfficeDays: bal.data.homeOfficeWeeklyDays !== null ? bal.data.homeOfficeWeeklyDays : undefined,
        unpaidLeaveDays: bal.data.unpaidLeaveDays ?? prev.unpaidLeaveDays ?? 0
      });
      if (isManagingOther) {
        setInspectedPersona((prev) => (prev ? updateFn(prev) : prev));
      } else {
        setActivePersona(updateFn);
      }
    }

    addToast(
      'success',
      isAutoApproved ? 'Žádost obnovena a schválena' : 'Žádost obnovena a odeslána ke schválení',
      `Žádost (${formatDateCzech(updatedReq.startDate)} – ${formatDateCzech(updatedReq.endDate)}, ${updatedReq.daysCount} dní) byla upravena a znovu zařazena do schvalovacího procesu.`
    );
  };

  const handleRejectVacation = async (requestId: string, reason: string) => {
    setVacationRequests((prev) =>
      prev.map((r) =>
        r.id === requestId ? { ...r, status: 'rejected', rejectionReason: reason, isRead: false } : r
      )
    );
    setInspectedVacationRequests((prev) =>
      prev.map((r) =>
        r.id === requestId ? { ...r, status: 'rejected', rejectionReason: reason, isRead: false } : r
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
    if (!doc.isRead) {
      setDoctorVisits((prev) =>
        prev.map((d) => (d.id === doc.id ? { ...d, isRead: true } : d))
      );
      setInspectedDoctorVisits((prev) =>
        prev.map((d) => (d.id === doc.id ? { ...d, isRead: true } : d))
      );
      void api.markAbsenceRead(doc.id);
    }
    setSelectedDoctor({ ...doc, isRead: true });
    setIsDoctorModalOpen(true);
  };

  const handleApproveDoctor = async (updatedDoc: DoctorVisitItem) => {
    setDoctorVisits((prev) =>
      prev.map((d) => (d.id === updatedDoc.id ? { ...updatedDoc, status: 'approved', isRead: false } : d))
    );
    setInspectedDoctorVisits((prev) =>
      prev.map((d) => (d.id === updatedDoc.id ? { ...updatedDoc, status: 'approved', isRead: false } : d))
    );
    // Write directly to SQLite database including any modified time/facility
    await api.approveAbsence(updatedDoc.id, activePersona.id, {
      startDate: updatedDoc.date,
      endDate: updatedDoc.date,
      startTime: updatedDoc.startTime,
      endTime: updatedDoc.endTime,
      facilityName: updatedDoc.facilityName,
      hasConfirmationDocument: updatedDoc.hasConfirmationDocument
    });

    addToast(
      'success',
      'Propustka potvrzena v DB',
      `Lékařská propustka pro ${updatedDoc.userName} (${formatDateCzech(updatedDoc.date)}, ${updatedDoc.startTime} – ${updatedDoc.endTime}) byla uznána a uložena do SQLite databáze.`
    );
  };

  const handleRenewDoctor = async (updatedDoc: DoctorVisitItem) => {
    const isManagingOther = Boolean(inspectedPersona && inspectedPersona.id !== activePersona.id);
    const targetPersona = inspectedPersona || activePersona;
    const isAutoApproved = isManagingOther || !targetPersona.managerId;
    const nextStatus = isAutoApproved ? 'approved' : 'pending';
    const nowCreatedAt = new Date().toISOString();

    const renewedDoc: DoctorVisitItem = {
      ...updatedDoc,
      status: nextStatus,
      rejectionReason: undefined,
      isRead: false,
      createdAt: nowCreatedAt
    };

    setDoctorVisits((prev) =>
      prev.map((d) => (d.id === updatedDoc.id ? renewedDoc : d))
    );
    setInspectedDoctorVisits((prev) =>
      prev.map((d) => (d.id === updatedDoc.id ? renewedDoc : d))
    );

    await api.resubmitAbsence(updatedDoc.id, {
      typeCode: 'doctor',
      startDate: updatedDoc.date,
      endDate: updatedDoc.date,
      startTime: updatedDoc.startTime,
      endTime: updatedDoc.endTime,
      facilityName: updatedDoc.facilityName,
      hasConfirmationDocument: updatedDoc.hasConfirmationDocument,
      note: updatedDoc.note,
      autoApprove: isManagingOther ? true : undefined,
      approvedByUserId: isManagingOther ? activePersona.id : undefined
    });

    addToast(
      'success',
      isAutoApproved ? 'Propustka obnovena a schválena' : 'Propustka obnovena a odeslána ke schválení',
      `Propustka k lékaři (${formatDateCzech(updatedDoc.date)}, ${updatedDoc.startTime} – ${updatedDoc.endTime}) byla upravena a znovu zařazena do schvalovacího procesu.`
    );
  };

  const handleRejectDoctor = async (requestId: string, reason: string) => {
    setDoctorVisits((prev) =>
      prev.map((d) =>
        d.id === requestId ? { ...d, status: 'rejected', rejectionReason: reason, isRead: false } : d
      )
    );
    setInspectedDoctorVisits((prev) =>
      prev.map((d) =>
        d.id === requestId ? { ...d, status: 'rejected', rejectionReason: reason, isRead: false } : d
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

  const handleMarkRequestAsRead = async (requestId: string) => {
    setVacationRequests((prev) =>
      prev.map((r) => (r.id === requestId ? { ...r, isRead: true } : r))
    );
    setInspectedVacationRequests((prev) =>
      prev.map((r) => (r.id === requestId ? { ...r, isRead: true } : r))
    );
    setDoctorVisits((prev) =>
      prev.map((d) => (d.id === requestId ? { ...d, isRead: true } : d))
    );
    setInspectedDoctorVisits((prev) =>
      prev.map((d) => (d.id === requestId ? { ...d, isRead: true } : d))
    );
    await api.markAbsenceRead(requestId);
  };

  const handleApproveUser = async (
    userId: string,
    role: string,
    contractKind: string,
    weeklyHoursBudget: number,
    vacationDays?: number,
    sickDays?: number,
    homeOfficeWeeklyDays?: number,
    contractType?: string
  ) => {
    const res = await api.approveUser({
      userId,
      role,
      contractKind,
      contractType,
      weeklyHoursBudget,
      vacationDays,
      sickDays,
      homeOfficeWeeklyDays
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

  // Create new request from Employee Self-Service Modal (or on behalf of inspectedPersona)
  const handleCreateNewRequest = (data: NewRequestData) => {
    setIsNewRequestModalOpen(false);
    const targetPersona = inspectedPersona || activePersona;
    const isManagingOther = Boolean(inspectedPersona && inspectedPersona.id !== activePersona.id);
    const isAutoApproved = isManagingOther || !targetPersona.managerId;
    const nowCreatedAt = new Date().toISOString();

    const refreshTargetBalances = async () => {
      const bal = await api.getAbsenceBalances(targetPersona.id);
      if (bal?.data) {
        const updateFn = (prev: Persona) => ({
          ...prev,
          vacationRemaining: bal.data.vacationRemaining !== null ? bal.data.vacationRemaining : undefined,
          vacationTotal: bal.data.vacationTotal !== null ? bal.data.vacationTotal : undefined,
          sickDaysRemaining: bal.data.sickDaysRemaining !== null ? bal.data.sickDaysRemaining : undefined,
          sickDaysTotal: bal.data.sickDaysTotal !== null ? bal.data.sickDaysTotal : undefined,
          homeOfficeDays: bal.data.homeOfficeWeeklyDays !== null ? bal.data.homeOfficeWeeklyDays : undefined,
          unpaidLeaveDays: bal.data.unpaidLeaveDays ?? prev.unpaidLeaveDays ?? 0
        });
        if (isManagingOther) {
          setInspectedPersona((prev) => (prev ? updateFn(prev) : prev));
        } else {
          setActivePersona(updateFn);
        }
      }
      const whoRes = await api.getWhoIsWhere();
      if (whoRes?.data) setTeamPresence(whoRes.data);
    };

    const reqTypeLabel = resolveAbsenceTypeConfig(data.type, absenceTypesMap).nameEmployee;

    if (data.type === 'vacation') {
      const s = new Date(data.startDate);
      const effectiveEndDate = data.endDate || data.startDate;
      const e = new Date(effectiveEndDate);
      const daysCount = Math.max(1, Math.round((e.getTime() - s.getTime()) / (1000 * 3600 * 24)) + 1);

      const newVac: LeaveRequestItem = {
        id: `vac-${Date.now()}`,
        applicantId: targetPersona.id,
        userName: targetPersona.name,
        userRole: targetPersona.roleLabel,
        contract: targetPersona.contract,
        managerId: targetPersona.managerId,
        managerName: targetPersona.managerName,
        type: 'vacation',
        typeName: reqTypeLabel,
        startDate: data.startDate,
        endDate: effectiveEndDate,
        daysCount,
        remainingDays: targetPersona.vacationRemaining ?? 0,
        totalDays: targetPersona.vacationTotal ?? 0,
        note: data.note || '',
        status: isAutoApproved ? 'approved' : 'pending',
        createdAt: nowCreatedAt
      };
      setVacationRequests((prev) => [newVac, ...prev]);
      if (isManagingOther) {
        setInspectedVacationRequests((prev) => [newVac, ...prev]);
      }

      api.submitAbsence({
        userId: targetPersona.id,
        typeCode: 'vacation',
        startDate: data.startDate,
        endDate: effectiveEndDate,
        note: data.note || '',
        autoApprove: isManagingOther ? true : undefined,
        approvedByUserId: isManagingOther ? activePersona.id : undefined
      }).then(refreshTargetBalances);

      addToast(
        'success',
        isAutoApproved ? `${reqTypeLabel} schválena` : `Žádost (${reqTypeLabel}) podána`,
        isAutoApproved
          ? `${reqTypeLabel} (${targetPersona.name}) na termín ${formatDateCzech(data.startDate)} – ${formatDateCzech(data.endDate)} (${daysCount} dní) byla rovnou schválena.`
          : `Vaše žádost na termín ${formatDateCzech(data.startDate)} – ${formatDateCzech(data.endDate)} (${daysCount} dní) byla zaevidována a uložena do databáze.`
      );
    } else if (data.type === 'doctor') {
      const newDoc: DoctorVisitItem = {
        id: `doc-${Date.now()}`,
        applicantId: targetPersona.id,
        userName: targetPersona.name,
        userRole: targetPersona.roleLabel,
        contract: targetPersona.contract,
        managerId: targetPersona.managerId,
        managerName: targetPersona.managerName,
        type: 'doctor',
        typeName: reqTypeLabel,
        date: data.startDate,
        startTime: data.startTime || '08:30',
        endTime: data.endTime || '11:30',
        hasConfirmationDocument: data.hasConfirmationDocument || false,
        note: data.note,
        status: isAutoApproved ? 'approved' : 'pending',
        createdAt: nowCreatedAt
      };
      setDoctorVisits((prev) => [newDoc, ...prev]);
      if (isManagingOther) {
        setInspectedDoctorVisits((prev) => [newDoc, ...prev]);
      }

      api.submitAbsence({
        userId: targetPersona.id,
        typeCode: 'doctor',
        startDate: data.startDate,
        endDate: data.startDate,
        startTime: data.startTime,
        endTime: data.endTime,
        hasConfirmationDocument: data.hasConfirmationDocument,
        note: data.note,
        autoApprove: isManagingOther ? true : undefined,
        approvedByUserId: isManagingOther ? activePersona.id : undefined
      }).then(refreshTargetBalances);

      addToast(
        'success',
        isAutoApproved ? `${reqTypeLabel} schválen` : `${reqTypeLabel} zaevidován`,
        `Propustka (${reqTypeLabel}) na ${formatDateCzech(data.startDate)} (${data.startTime} – ${data.endTime}) byla uložena do databáze.`
      );
    } else if (data.type === 'sick_day') {
      const newSick: LeaveRequestItem = {
        id: `sick-${Date.now()}`,
        applicantId: targetPersona.id,
        userName: targetPersona.name,
        userRole: targetPersona.roleLabel,
        contract: targetPersona.contract,
        managerId: targetPersona.managerId,
        managerName: targetPersona.managerName,
        type: 'sick_day',
        typeName: reqTypeLabel,
        startDate: data.startDate,
        endDate: data.startDate,
        daysCount: 1,
        remainingDays: targetPersona.sickDaysRemaining ?? 0,
        totalDays: targetPersona.sickDaysTotal ?? 0,
        note: data.note || 'Nahlášení zdravotní indispozice.',
        status: isAutoApproved ? 'approved' : 'pending',
        createdAt: nowCreatedAt
      };
      setVacationRequests((prev) => [newSick, ...prev]);
      if (isManagingOther) {
        setInspectedVacationRequests((prev) => [newSick, ...prev]);
      }

      api.submitAbsence({
        userId: targetPersona.id,
        typeCode: 'sick_day',
        startDate: data.startDate,
        endDate: data.startDate,
        note: data.note || reqTypeLabel,
        autoApprove: isManagingOther ? true : undefined,
        approvedByUserId: isManagingOther ? activePersona.id : undefined
      }).then(refreshTargetBalances);

      addToast(
        'success',
        isAutoApproved ? `${reqTypeLabel} schválen` : `${reqTypeLabel} nahlášen`,
        `${reqTypeLabel} na ${formatDateCzech(data.startDate)} byl zaevidován v databázi.`
      );
    } else if (data.type === 'illness') {
      const s = new Date(data.startDate);
      const effectiveEndDate = data.endDate || data.startDate;
      const e = new Date(effectiveEndDate);
      const daysCount = Math.max(1, Math.round((e.getTime() - s.getTime()) / (1000 * 3600 * 24)) + 1);

      const newIllness: LeaveRequestItem = {
        id: `illness-${Date.now()}`,
        applicantId: targetPersona.id,
        userName: targetPersona.name,
        userRole: targetPersona.roleLabel,
        contract: targetPersona.contract,
        managerId: targetPersona.managerId,
        managerName: targetPersona.managerName,
        type: 'illness',
        typeName: reqTypeLabel,
        startDate: data.startDate,
        endDate: effectiveEndDate,
        daysCount,
        remainingDays: targetPersona.sickDaysRemaining ?? 0,
        totalDays: targetPersona.sickDaysTotal ?? 0,
        note: data.note || 'Nahlášení dočasné pracovní neschopnosti.',
        status: isAutoApproved ? 'approved' : 'pending',
        createdAt: nowCreatedAt
      };
      setVacationRequests((prev) => [newIllness, ...prev]);
      if (isManagingOther) {
        setInspectedVacationRequests((prev) => [newIllness, ...prev]);
      }

      api.submitAbsence({
        userId: targetPersona.id,
        typeCode: 'illness',
        startDate: data.startDate,
        endDate: effectiveEndDate,
        note: data.note || 'Nahlášení dočasné pracovní neschopnosti.',
        autoApprove: isManagingOther ? true : undefined,
        approvedByUserId: isManagingOther ? activePersona.id : undefined
      }).then(refreshTargetBalances);

      addToast(
        'success',
        isAutoApproved ? `${reqTypeLabel} schválena` : `${reqTypeLabel} nahlášena`,
        `${reqTypeLabel} od ${formatDateCzech(data.startDate)} do ${formatDateCzech(effectiveEndDate)} (${daysCount} dní) byla uložena do databáze.`
      );
    } else if (data.type === 'home_office') {
      const s = new Date(data.startDate);
      const effectiveEndDate = data.endDate || data.startDate;
      const e = new Date(effectiveEndDate);
      const daysCount = Math.max(1, Math.round((e.getTime() - s.getTime()) / (1000 * 3600 * 24)) + 1);

      const newHo: LeaveRequestItem = {
        id: `ho-${Date.now()}`,
        applicantId: targetPersona.id,
        userName: targetPersona.name,
        userRole: targetPersona.roleLabel,
        contract: targetPersona.contract,
        managerId: targetPersona.managerId,
        managerName: targetPersona.managerName,
        type: 'home_office',
        typeName: reqTypeLabel,
        startDate: data.startDate,
        endDate: effectiveEndDate,
        daysCount,
        remainingDays: targetPersona.homeOfficeDays ?? 0,
        totalDays: targetPersona.homeOfficeDays ?? 0,
        note: data.note || 'Práce z domova.',
        status: isAutoApproved ? 'approved' : 'pending',
        createdAt: nowCreatedAt
      };
      setVacationRequests((prev) => [newHo, ...prev]);
      if (isManagingOther) {
        setInspectedVacationRequests((prev) => [newHo, ...prev]);
      }

      api.submitAbsence({
        userId: targetPersona.id,
        typeCode: 'home_office',
        startDate: data.startDate,
        endDate: effectiveEndDate,
        note: data.note || 'Práce z domova.',
        autoApprove: isManagingOther ? true : undefined,
        approvedByUserId: isManagingOther ? activePersona.id : undefined
      }).then(refreshTargetBalances);

      addToast(
        'success',
        isAutoApproved ? `${reqTypeLabel} schválen` : `Plán práce (${reqTypeLabel}) uložen`,
        daysCount > 1
          ? `${reqTypeLabel} na termín ${formatDateCzech(data.startDate)} – ${formatDateCzech(effectiveEndDate)} (${daysCount} dní) byl zanesen do databáze.`
          : `${reqTypeLabel} na ${formatDateCzech(data.startDate)} byl zanesen do databáze.`
      );
    } else if (data.type === 'unpaid_leave') {
      const s = new Date(data.startDate);
      const effectiveEndDate = data.endDate || data.startDate;
      const e = new Date(effectiveEndDate);
      const daysCount = Math.max(1, Math.round((e.getTime() - s.getTime()) / (1000 * 3600 * 24)) + 1);

      const newUnpaid: LeaveRequestItem = {
        id: `unpaid-${Date.now()}`,
        applicantId: targetPersona.id,
        userName: targetPersona.name,
        userRole: targetPersona.roleLabel,
        contract: targetPersona.contract,
        managerId: targetPersona.managerId,
        managerName: targetPersona.managerName,
        type: 'unpaid_leave',
        typeName: reqTypeLabel,
        startDate: data.startDate,
        endDate: effectiveEndDate,
        daysCount,
        remainingDays: 0,
        totalDays: 0,
        note: data.note || 'Žádost o neplacené volno.',
        status: isAutoApproved ? 'approved' : 'pending',
        createdAt: nowCreatedAt
      };
      setVacationRequests((prev) => [newUnpaid, ...prev]);
      if (isManagingOther) {
        setInspectedVacationRequests((prev) => [newUnpaid, ...prev]);
      }

      api.submitAbsence({
        userId: targetPersona.id,
        typeCode: 'unpaid_leave',
        startDate: data.startDate,
        endDate: effectiveEndDate,
        note: data.note || 'Žádost o neplacené volno.',
        autoApprove: isManagingOther ? true : undefined,
        approvedByUserId: isManagingOther ? activePersona.id : undefined
      }).then(refreshTargetBalances);

      addToast(
        'success',
        isAutoApproved ? `${reqTypeLabel} schváleno` : `Žádost (${reqTypeLabel}) podána`,
        `${reqTypeLabel} na termín ${formatDateCzech(data.startDate)} – ${formatDateCzech(effectiveEndDate)} (${daysCount} dní) bylo uloženo do databáze.`
      );
    }
  };

  // Clock In handler (supports both activePersona and inspectedPersona)
  const handleClockInAction = (locationType: 'office' | 'home_office', locationLabel?: string, nfcId?: string) => {
    const targetPersona = inspectedPersona || activePersona;
    const isManagingOther = Boolean(inspectedPersona && inspectedPersona.id !== activePersona.id);
    const isUnverifiedOffice = locationType === 'office' && !nfcId;
    const locName =
      locationLabel ||
      (locationType === 'office'
        ? isUnverifiedOffice
          ? 'Kancelář (bez ověření)'
          : 'Pobočka Praha 1 - Palmovka'
        : 'Home Office');

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    setIsNfcModalOpen(false);
    setIsWorkplaceSelectModalOpen(false);

    const newShift: ShiftBlock = {
      id: `shift-${Date.now()}`,
      start: timeStr,
      end: null,
      location: locationType,
      locationName: locName,
      method: locationType === 'office' && nfcId ? 'nfc' : 'web',
      startedAtMs: Date.now()
    };

    if (isManagingOther) {
      setInspectedIsClockedIn(true);
      setInspectedActiveLocation(locationType);
      setInspectedWorkplaceName(locName);
      setInspectedClockInTime(timeStr);
      setInspectedShifts((prev) => [...prev, newShift]);
    } else {
      setIsClockedIn(true);
      setActiveLocation(locationType);
      setWorkplaceName(locName);
      setClockInTime(timeStr);
      setCurrentShifts((prev) => [...prev, newShift]);
    }

    // Send clock-in directly to SQLite database
    api.clockIn({
      userId: targetPersona.id,
      nfcIdentifier: locationType === 'office' && nfcId ? nfcId : undefined,
      isHomeOffice: locationType === 'home_office',
      editedByUserId: isManagingOther ? activePersona.id : undefined,
      editedByUserName: isManagingOther ? activePersona.name : undefined
    }).then(async (res) => {
      if (res?.data?.id) {
        const dbShiftId = String(res.data.id);
        const dbStartMs = res.data.startTime ? new Date(res.data.startTime).getTime() : newShift.startedAtMs;
        if (isManagingOther) {
          setInspectedShifts((prev) =>
            prev.map((s) => (s.id === newShift.id ? { ...s, id: dbShiftId, startedAtMs: dbStartMs } : s))
          );
        } else {
          setCurrentShifts((prev) =>
            prev.map((s) => (s.id === newShift.id ? { ...s, id: dbShiftId, startedAtMs: dbStartMs } : s))
          );
        }
      }
      const whoRes = await api.getWhoIsWhere();
      if (whoRes?.data) setTeamPresence(whoRes.data);
      if (isManagingOther) {
        const mRes = await api.getMonthSummary(targetPersona.id);
        if (mRes?.data) setInspectedMonthSummary(mRes.data);
      } else {
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
        const mRes = await api.getMonthSummary(activePersona.id);
        if (mRes?.data) setMonthSummary(mRes.data);
      }
    });

    addToast(
      'success',
      isManagingOther ? `Příchod zapsán (${targetPersona.name})` : 'Příchod zapsán do DB',
      locationType === 'office'
        ? isUnverifiedOffice
          ? 'Přihlášen v kanceláři bez ověření pracoviště. Zapsáno do SQLite.'
          : `Přihlášen na: ${locName}. Zapsáno do SQLite.`
        : 'Přihlášen na Home Office. Zapsáno do SQLite.'
    );
  };

  // Clock Out click
  const handleClockOutClick = () => {
    const isManagingOther = Boolean(inspectedPersona && inspectedPersona.id !== activePersona.id);
    const currentLoc = isManagingOther ? inspectedActiveLocation : activeLocation;
    if (currentLoc === 'home_office') {
      setIsHoLeaveModalOpen(true);
    } else {
      finishClockOut(false);
    }
  };

  const finishClockOut = (isPause: boolean, pauseTime?: string) => {
    const targetPersona = inspectedPersona || activePersona;
    const isManagingOther = Boolean(inspectedPersona && inspectedPersona.id !== activePersona.id);
    setIsHoLeaveModalOpen(false);

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const activeList = isManagingOther ? inspectedShifts : currentShifts;
    const openShift = [...activeList].reverse().find((s) => s.end === null);
    const isUnderOneMinuteLocal = Boolean(
      openShift?.startedAtMs && Date.now() - openShift.startedAtMs < 60000
    );

    if (isManagingOther) {
      setInspectedIsClockedIn(false);
      setInspectedWorkplaceName('Mimo práci');
      setInspectedShifts((prev) =>
        isUnderOneMinuteLocal
          ? prev.filter((s) => s.end !== null)
          : prev.map((s) => (s.end === null ? { ...s, end: timeStr } : s))
      );
    } else {
      setIsClockedIn(false);
      setWorkplaceName('Mimo práci');
      setCurrentShifts((prev) =>
        isUnderOneMinuteLocal
          ? prev.filter((s) => s.end !== null)
          : prev.map((s) => (s.end === null ? { ...s, end: timeStr } : s))
      );
    }

    // Send clock-out directly to SQLite database
    api.clockOut({
      userId: targetPersona.id,
      isPause,
      expectedReturnAt: isPause && pauseTime ? `${new Date().toISOString().split('T')[0]}T${pauseTime}:00Z` : undefined,
      editedByUserId: isManagingOther ? activePersona.id : undefined,
      editedByUserName: isManagingOther ? activePersona.name : undefined
    }).then(async (res) => {
      const wasDeleted = Boolean(
        res?.data?.deletedUnderOneMinute ||
          res?.data?.locationType === 'deleted_under_1min' ||
          isUnderOneMinuteLocal
      );

      if (wasDeleted) {
        const deletedId = res?.data?.id ? String(res.data.id) : openShift?.id;
        if (isManagingOther) {
          setInspectedShifts((prev) =>
            prev.filter((s) => s.end !== null && (!deletedId || s.id !== deletedId))
          );
        } else {
          setCurrentShifts((prev) =>
            prev.filter((s) => s.end !== null && (!deletedId || s.id !== deletedId))
          );
        }
        addToast(
          'warning',
          'Záznam kratší než 1 minuta vymazán',
          'Rozmezí mezi příchodem a odchodem bylo menší než 1 minuta (méně než 60 s), záznam byl rovnou vymazán.'
        );
      } else if (isPause) {
        addToast(
          'warning',
          'Odchod na pauzu (uloženo v DB)',
          `Orientační návrat nastaven na ${pauseTime}. Kolegům v přehledu „Kdo je kde“ se zobrazuje pauza.`
        );
      } else {
        addToast(
          'success',
          isManagingOther ? `Směna ukončena (${targetPersona.name})` : 'Směna ukončena v DB',
          'Čas odchodu byl řádně uložen do databáze (UTC).'
        );
      }

      const whoRes = await api.getWhoIsWhere();
      if (whoRes?.data) setTeamPresence(whoRes.data);
      const statusRes = await api.getStatus(targetPersona.id);
      if (statusRes?.data) {
        if (isManagingOther) {
          setInspectedHoursToday(statusRes.data.totalHoursWorkedToday ?? 0);
        } else {
          setHoursToday(statusRes.data.totalHoursWorkedToday ?? 0);
        }
      }
      if (isManagingOther) {
        const mRes = await api.getMonthSummary(targetPersona.id);
        if (mRes?.data) setInspectedMonthSummary(mRes.data);
      } else {
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
        const mRes = await api.getMonthSummary(activePersona.id);
        if (mRes?.data) setMonthSummary(mRes.data);
      }
    });
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
      handleClockInAction('office', 'Pobočka Praha 1 - Palmovka', 'praha1');
    } else if (identifier === 'brno1') {
      handleClockInAction('office', 'Pobočka Brno - Spielberk', 'brno1');
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


  // RBAC & Role Scope Filtering:
  // - Vedoucí (team_lead): lidé, kteří mají parentPersonId === activePersona.id
  // - Manažer (manager): lidé, kteří mají managerId === activePersona.id
  // - Officer (office_manager) a Administrátor (admin): všichni lidé
  const isManagerOrAdmin = ['admin', 'manager', 'team_lead', 'office_manager'].includes(activePersona.role);

  const matchesColleagueRoleScope = (item: {
    applicantId?: string;
    userName?: string;
    managerId?: string;
    parentPersonId?: string;
  }): boolean => {
    const activeId = activePersona.id.toLowerCase();
    const applicantId = (item.applicantId || '').toLowerCase();

    if (activePersona.role === 'team_lead') {
      const persona = effectivePersonas.find(
        (p) => p.id.toLowerCase() === applicantId || p.name === item.userName
      );
      const parentId = (item.parentPersonId || persona?.parentPersonId || '').toLowerCase();
      return parentId === activeId;
    }

    if (activePersona.role === 'manager') {
      const persona = effectivePersonas.find(
        (p) => p.id.toLowerCase() === applicantId || p.name === item.userName
      );
      const mgrId = (item.managerId || persona?.managerId || '').toLowerCase();
      return mgrId === activeId;
    }

    if (activePersona.role === 'office_manager' || activePersona.role === 'admin') {
      return true;
    }

    return false;
  };

  // Všechny žádosti spadající pod "Žádosti kolegů" dle role
  const allColleagueVacations = vacationRequests.filter(matchesColleagueRoleScope);
  const allColleagueDoctors = doctorVisits.filter(matchesColleagueRoleScope);

  const totalManagerPendingCount =
    allColleagueVacations.filter((r) => r.status === 'pending').length +
    allColleagueDoctors.filter((d) => d.status === 'pending').length +
    (['admin', 'office_manager'].includes(activePersona.role) ? pendingUsers.length : 0);

  // Employee Self-Service: Requests submitted by the active persona
  const myVacationRequests = vacationRequests.filter(
    (r) => r.applicantId?.toLowerCase() === activePersona.id.toLowerCase() || r.userName === activePersona.name
  );
  const myDoctorVisits = doctorVisits.filter(
    (d) => d.applicantId?.toLowerCase() === activePersona.id.toLowerCase() || d.userName === activePersona.name
  );

  // Target persona for Dashboard / Detail osoby view
  const viewPersona = inspectedPersona || activePersona;
  const viewMonthSummary = inspectedPersona ? inspectedMonthSummary : monthSummary;
  const viewHoursToday = inspectedPersona ? inspectedHoursToday : hoursToday;
  const viewMyVacations = inspectedPersona ? inspectedVacationRequests : myVacationRequests;
  const viewMyDoctors = inspectedPersona ? inspectedDoctorVisits : myDoctorVisits;
  const viewCurrentShifts = inspectedPersona ? inspectedShifts : currentShifts;

  // Real stats calculated directly from database records:
  // 1. Worked hours & Monthly fund (vždy počet pracovních dnů bez svátků * úvazek)
  const baseDailyHours = companySettings?.dailyHours ?? 8;
  const realDailyTargetHours = viewMonthSummary?.dailyTargetHours ?? Math.round(baseDailyHours * (viewPersona.fteCoefficient ?? (viewPersona.dailyHours ? viewPersona.dailyHours / 8 : 1.0)) * 10) / 10;
  const realMonthHoursWorked = viewMonthSummary ? viewMonthSummary.hoursWorked : viewHoursToday;
  const realMonthFundHours = viewMonthSummary ? viewMonthSummary.fundHours : Math.round(21 * realDailyTargetHours);

  // 2. Overtime
  const realOvertimeHours = formatOvertime(viewMonthSummary?.overtimeHours ?? viewPersona.overtimeHours ?? 0);

  // 3. Vacation (from DB balances)
  const hasVacationConfig = viewPersona.vacationTotal !== undefined && viewPersona.vacationTotal !== null;
  const realVacationRemaining = viewPersona.id === 'anonymous' || !hasVacationConfig
    ? '—'
    : (viewPersona.vacationRemaining ?? 0);
  const realVacationTotal = viewPersona.id === 'anonymous' || !hasVacationConfig
    ? undefined
    : (viewPersona.vacationTotal ?? undefined);

  // 4. Sick days (from DB balances)
  const hasSickDaysConfig = viewPersona.sickDaysTotal !== undefined && viewPersona.sickDaysTotal !== null;
  const realSickDaysRemaining = viewPersona.id === 'anonymous' || !hasSickDaysConfig
    ? '—'
    : (viewPersona.sickDaysRemaining ?? 0);
  const realSickDaysTotal = viewPersona.id === 'anonymous' || !hasSickDaysConfig
    ? undefined
    : (viewPersona.sickDaysTotal ?? undefined);

  // 5. Approved illness days
  const realIllnessDays = viewPersona.id === 'anonymous'
    ? '—'
    : viewMyVacations
        .filter((r) => r.type === 'illness' && r.status === 'approved')
        .reduce((sum, r) => sum + (r.daysCount || 0), 0);

  // 6. Approved doctor hours
  const realDoctorHours = viewPersona.id === 'anonymous'
    ? '—'
    : (viewMyDoctors || [])
        .filter((d) => d && d.status === 'approved')
        .reduce((sum, d) => {
          const sTime = typeof d.startTime === 'string' && d.startTime.includes(':') ? d.startTime : '08:00';
          const eTime = typeof d.endTime === 'string' && d.endTime.includes(':') ? d.endTime : '12:00';
          const [sh, sm] = sTime.split(':').map(Number);
          const [eh, em] = eTime.split(':').map(Number);
          const hours = Math.max(0, ((eh || 0) + (em || 0) / 60) - ((sh || 0) + (sm || 0) / 60));
          return sum + Math.round(hours * 10) / 10;
        }, 0);

  // 7. Home Office days (month summary from time entries + approved HO requests)
  // Pravidlo: Pokud pro uživatele není v DB nastaven home office fond, zobrazit '—'
  const hasHomeOfficeConfig = viewPersona.homeOfficeDays !== undefined && viewPersona.homeOfficeDays !== null;
  const realApprovedHoDays = (viewMyVacations || [])
    .filter((r) => r && r.type === 'home_office' && r.status === 'approved')
    .reduce((sum, r) => sum + (r.daysCount || 0), 0);
  const realHomeOfficeDays = viewPersona.id === 'anonymous' || !hasHomeOfficeConfig
    ? '—'
    : (viewMonthSummary?.homeOfficeDays ?? 0) + realApprovedHoDays;

  // 8. Unpaid leave days (from DB balances or approved requests)
  const realUnpaidDays = viewPersona.id === 'anonymous'
    ? '—'
    : (viewPersona.unpaidLeaveDays ?? (viewMyVacations || [])
        .filter((r) => r && r.type === 'unpaid_leave' && r.status === 'approved')
        .reduce((sum, r) => sum + (r.daysCount || 0), 0) ?? 0);

  // Časové hranice pro Přehled a Stránku Žádosti
  const todayDateObj = new Date();
  const currentYear = todayDateObj.getFullYear();
  const currentMonth = todayDateObj.getMonth() + 1; // 1..12
  const todayIsoStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(todayDateObj.getDate()).padStart(2, '0')}`;

  // Přehled: tento měsíc a následující měsíc
  const firstDayOfCurrentMonthStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
  const endOfNextMonthDate = new Date(currentYear, todayDateObj.getMonth() + 2, 0);
  const lastDayOfNextMonthStr = `${endOfNextMonthDate.getFullYear()}-${String(endOfNextMonthDate.getMonth() + 1).padStart(2, '0')}-${String(endOfNextMonthDate.getDate()).padStart(2, '0')}`;

  // Stránka Žádosti: tento rok + (aktuální měsíc - 1, což v lednu zobrazí i prosinec předchozího roku)
  const requestsPageMinDateStr = currentMonth === 1 ? `${currentYear - 1}-12-01` : `${currentYear}-01-01`;
  const requestsPageMaxDateStr = `${currentYear}-12-31`;

  // Pravidlo pro Žádosti na Přehledu (identické pro Moje žádosti i Žádosti kolegů):
  // - jakékoliv čekající žádosti (pending)
  // - zamítnuté nepřečtené žádosti (rejected && !isRead)
  // - schválené nepřečtené žádosti (approved && !isRead)
  // - + schválené přečtené žádosti, které se týkají tohoto měsíce a následujícího měsíce
  const isVisibleOnDashboard = (
    startDate: string,
    endDate: string,
    status: string,
    isRead?: boolean
  ): boolean => {
    if (status === 'pending') return true;
    if (status === 'rejected') return !isRead;
    if (status === 'approved') {
      if (!isRead) return true;
      const sDate = startDate || '';
      const eDate = endDate || sDate;
      return sDate <= lastDayOfNextMonthStr && eDate >= firstDayOfCurrentMonthStr;
    }
    return false;
  };

  // Pravidlo pro Stránku Žádosti (identické pro Moje žádosti i Žádosti kolegů):
  // - všechny žádosti zadané v tomto roce + (aktuální měsíc - 1, v lednu tedy i z prosince)
  const isVisibleOnRequestsPage = (
    startDate: string,
    endDate: string,
    createdAt?: string
  ): boolean => {
    const sDate = startDate || '';
    const eDate = endDate || sDate;
    const cDate = createdAt ? createdAt.slice(0, 10) : '';
    const matchesPlanned = sDate <= requestsPageMaxDateStr && eDate >= requestsPageMinDateStr;
    const matchesCreated = Boolean(cDate && cDate >= requestsPageMinDateStr && cDate <= requestsPageMaxDateStr);
    return matchesPlanned || matchesCreated;
  };

  // 1a. Moje žádosti na Přehledu (nebo žádosti prohlížené osoby v Detailu osoby)
  const dashboardMyVacations = (viewMyVacations || []).filter((r) => {
    if (!r) return false;
    return isVisibleOnDashboard(r.startDate, r.endDate || r.startDate, r.status, r.isRead);
  });

  const dashboardMyDoctors = (viewMyDoctors || []).filter((d) => {
    if (!d) return false;
    const visitDate = d.date || (d as any).startDate || '';
    return isVisibleOnDashboard(visitDate, visitDate, d.status, d.isRead);
  });

  const myDashboardCount = dashboardMyVacations.length + dashboardMyDoctors.length;

  // 1b. Žádosti kolegů na Přehledu (stejná pravidla jako Moje žádosti, akorát u osob dle role)
  const colleagueDashboardVacations = useMemo(() => {
    if (activePersona.role === 'colleague') return [];
    return allColleagueVacations.filter((r) =>
      isVisibleOnDashboard(r.startDate, r.endDate || r.startDate, r.status, r.isRead)
    );
  }, [allColleagueVacations, activePersona.role, firstDayOfCurrentMonthStr, lastDayOfNextMonthStr]);

  const colleagueDashboardDoctors = useMemo(() => {
    if (activePersona.role === 'colleague') return [];
    return allColleagueDoctors.filter((d) => {
      const visitDate = d.date || (d as any).startDate || '';
      return isVisibleOnDashboard(visitDate, visitDate, d.status, d.isRead);
    });
  }, [allColleagueDoctors, activePersona.role, firstDayOfCurrentMonthStr, lastDayOfNextMonthStr]);

  const colleaguePendingCount = useMemo(() => {
    return (
      colleagueDashboardVacations.filter((v) => v.status === 'pending').length +
      colleagueDashboardDoctors.filter((d) => d.status === 'pending').length
    );
  }, [colleagueDashboardVacations, colleagueDashboardDoctors]);

  // 2a. Moje žádosti na Stránce Žádosti (tento rok + prosinec v lednu)
  const requestsPageMyVacations = myVacationRequests.filter((r) =>
    isVisibleOnRequestsPage(r.startDate, r.endDate || r.startDate, r.createdAt)
  );
  const requestsPageMyDoctors = myDoctorVisits.filter((d) => {
    const visitDate = d.date || (d as any).startDate || '';
    return isVisibleOnRequestsPage(visitDate, visitDate, d.createdAt);
  });

  // 2b. Žádosti kolegů na Stránce Žádosti (stejná pravidla jako Moje žádosti, akorát u osob dle role)
  const requestsPageColleagueVacations = allColleagueVacations.filter((r) =>
    isVisibleOnRequestsPage(r.startDate, r.endDate || r.startDate, r.createdAt)
  );
  const requestsPageColleagueDoctors = allColleagueDoctors.filter((d) => {
    const visitDate = d.date || (d as any).startDate || '';
    return isVisibleOnRequestsPage(visitDate, visitDate, d.createdAt);
  });

  const canActivePersonaApprove = activePersona.role === 'manager' || activePersona.role === 'admin';

  // V Detailu osoby zobrazujeme vždy jen žádosti té konkrétní osoby
  const isColleaguesTab = !inspectedPersona && activePersona.role !== 'colleague' && dashboardRequestsTab === 'colleagues';
  const displayedDashboardVacations = isColleaguesTab ? colleagueDashboardVacations : dashboardMyVacations;
  const displayedDashboardDoctors = isColleaguesTab ? colleagueDashboardDoctors : dashboardMyDoctors;
  const totalDisplayedDashboardCount = displayedDashboardVacations.length + displayedDashboardDoctors.length;

  const dashboardTimelineShifts = useMemo<ShiftBlock[]>(() => {
    const baseShifts = viewCurrentShifts.filter((s) => s.location !== 'doctor');
    const todayApprovedDocs = (viewMyDoctors || []).filter(
      (d) => d && d.status === 'approved' && (d.date === todayIsoStr || (d as any).startDate === todayIsoStr)
    );
    const doctorTypeLabel = resolveAbsenceTypeConfig('doctor', absenceTypesMap).nameEmployee || 'Lékař';
    const docBlocks: ShiftBlock[] = todayApprovedDocs.map((doc) => ({
      id: `doc-${doc.id}`,
      start: doc.startTime || '08:00',
      end: doc.endTime || '12:00',
      location: 'doctor',
      locationName: doc.note || doctorTypeLabel,
      method: 'request',
      note: doc.note
    }));
    return [...baseShifts, ...docBlocks].sort((a, b) => a.start.localeCompare(b.start));
  }, [viewCurrentShifts, viewMyDoctors, todayIsoStr, absenceTypesMap]);

  const isModalReadOnly = (item: LeaveRequestItem | DoctorVisitItem | null): boolean => {
    if (!item) return true;
    if (item.status !== 'pending') return true;
    if (item.applicantId === activePersona.id || item.userName === activePersona.name) return true;
    if (activePersona.role === 'admin') return false;
    if (activePersona.role === 'manager') {
      const applicantPersona = effectivePersonas.find((p) => p.id === item.applicantId || p.name === item.userName);
      const mgrId = item.managerId || applicantPersona?.managerId;
      return mgrId !== activePersona.id;
    }
    return true; // team_lead and office_manager do not approve
  };

  const canRenewRequest = (item: LeaveRequestItem | DoctorVisitItem | null): boolean => {
    if (!item || item.status !== 'rejected') return false;
    const isOwn = item.applicantId === activePersona.id || item.userName === activePersona.name;
    const isInspectedTarget = Boolean(
      inspectedPersona && (item.applicantId === inspectedPersona.id || item.userName === inspectedPersona.name)
    );
    return isOwn || isInspectedTarget;
  };

  const canMarkRequestAsRead = (item: LeaveRequestItem | DoctorVisitItem | null): boolean => {
    if (!item) return false;
    const isOwn = item.applicantId === activePersona.id || item.userName === activePersona.name;
    return isOwn && (item.status === 'approved' || item.status === 'rejected') && !item.isRead;
  };

  // Zda má osoba (viewPersona) v dnešní den aktivní schválenou celodenní absenci (dovolená, sick day, neplacené volno, nemoc)
  const fullDayAbsenceStatusToday = useMemo(() => {
    if (viewPersona.id === 'anonymous' || viewPersona.id === 'clean-uninstalled') {
      return { hasAbsence: false, label: undefined };
    }
    const activeLeave = (viewMyVacations || []).find(
      (r) =>
        r &&
        r.status === 'approved' &&
        (r.type === 'vacation' || r.type === 'sick_day' || r.type === 'unpaid_leave' || r.type === 'illness') &&
        r.startDate <= todayIsoStr &&
        (r.endDate || r.startDate) >= todayIsoStr
    );
    if (activeLeave) {
      const label = resolveAbsenceTypeConfig(activeLeave.type, absenceTypesMap).nameEmployee;
      return { hasAbsence: true, label };
    }

    const pStatus = getPersonaStatus(viewPersona);
    if (
      pStatus &&
      (pStatus.locationType === 'vacation' ||
        pStatus.locationType === 'sick_day' ||
        pStatus.locationType === 'unpaid_leave' ||
        pStatus.locationType === 'illness')
    ) {
      return { hasAbsence: true, label: pStatus.statusText };
    }
    return { hasAbsence: false, label: undefined };
  }, [viewPersona, viewMyVacations, todayIsoStr, teamPresence, vacationRequests]);


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

              {/* Clear Logs Button */}
              <button
                type="button"
                onClick={handleClearLogs}
                disabled={isClearingLogs}
                className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-yellow-500/50 hover:bg-yellow-500/80 active:bg-yellow-600/50 text-slate-950 font-semibold text-[11px] transition-colors border border-yellow-600/30"
                title="Vyprázdní všechny záznamy z tabulky logs v databázi"
              >
                <Trash2 className="w-3.5 h-3.5 text-slate-950" />
                <span>{isClearingLogs ? 'Mažu...' : 'Vyprázdnit log'}</span>
              </button>

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
        onOpenSettings={() => setIsUserSettingsModalOpen(true)}
        onLogout={handleLogout}
        addToast={addToast}
        onToggleMobileMenu={() => setIsMobileNavOpen((prev) => !prev)}
        isMobileMenuOpen={isMobileNavOpen}
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
                vacationRemaining: undefined,
                vacationTotal: undefined,
                sickDaysRemaining: undefined,
                sickDaysTotal: undefined,
                homeOfficeDays: undefined,
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
        <div className="max-w-[1256px] mx-auto px-4 sm:px-6 pt-6">
          <div className="flex gap-6 lg:gap-8 items-start">
            {/* Plovoucí sticky menu vlevo (280px) na desktopu & vysouvací drawer na mobilu */}
            <AppNavigation
              activeTab={activeNavTab}
              onTabChange={(tab) => {
                setInspectedPersona(null);
                setActiveNavTab(tab);
                setIsMobileNavOpen(false);
              }}
              userRole={activePersona.role}
              pendingRequestsCount={totalManagerPendingCount}
              pendingClosuresCount={1}
              isMobileMenuOpen={isMobileNavOpen}
              onCloseMobileMenu={() => setIsMobileNavOpen(false)}
            />

            {/* Hlavní obsahový sloupec */}
            <main className="flex-1 min-w-0 space-y-6">

          {/* DETAIL OSOBY NEBO ZÁLOŽKA 1: PŘEHLED DOCHÁZKY (DASHBOARD) */}
          {(inspectedPersona !== null || activeNavTab === 'dochazka') && (
            <DashboardView
              activePersona={viewPersona}
              isClockedIn={inspectedPersona ? inspectedIsClockedIn : isClockedIn}
              activeLocation={inspectedPersona ? inspectedActiveLocation : activeLocation}
              clockInTime={inspectedPersona ? inspectedClockInTime : clockInTime}
              workplaceName={inspectedPersona ? inspectedWorkplaceName : workplaceName}
              hoursToday={viewHoursToday}
              currentShifts={dashboardTimelineShifts}
              personasList={personasList}
              getPersonaStatus={getPersonaStatus}
              realMonthHoursWorked={realMonthHoursWorked}
              realMonthFundHours={realMonthFundHours}
              dailyTargetHours={realDailyTargetHours}
              realOvertimeHours={realOvertimeHours}
              realVacationRemaining={realVacationRemaining}
              realVacationTotal={realVacationTotal}
              realSickDaysRemaining={realSickDaysRemaining}
              realSickDaysTotal={realSickDaysTotal}
              realIllnessDays={realIllnessDays}
              realDoctorHours={realDoctorHours}
              realHomeOfficeDays={realHomeOfficeDays}
              realUnpaidDays={realUnpaidDays}
              onClockIn={() => {
                if (inspectedPersona !== null) {
                  if (workplaces.length >= 2) {
                    setIsWorkplaceSelectModalOpen(true);
                  } else if (workplaces.length === 1) {
                    handleClockInAction('office', workplaces[0].name, workplaces[0].nfcIdentifier);
                  } else {
                    handleClockInAction('office', 'Pobočka Praha 1 - Palmovka', 'praha1');
                  }
                } else {
                  setIsNfcModalOpen(true);
                }
              }}
              onClockOut={handleClockOutClick}
              onOpenNewRequestModal={(initialType?: any) => {
                setNewRequestInitialType(initialType || 'vacation');
                setIsNewRequestModalOpen(true);
              }}
              onOpenVacationModal={handleOpenVacationModal}
              onOpenDoctorModal={handleOpenDoctorModal}
              onApproveVacation={handleApproveVacation}
              onApproveDoctor={handleApproveDoctor}
              displayedDashboardVacations={displayedDashboardVacations}
              displayedDashboardDoctors={displayedDashboardDoctors}
              totalDisplayedDashboardCount={totalDisplayedDashboardCount}
              myDashboardCount={myDashboardCount}
              dashboardRequestsTab={dashboardRequestsTab}
              setDashboardRequestsTab={setDashboardRequestsTab}
              canActivePersonaApprove={canActivePersonaApprove}
              totalManagerPendingCount={totalManagerPendingCount}
              colleaguePendingCount={colleaguePendingCount}
              colleagueDashboardVacations={colleagueDashboardVacations}
              colleagueDashboardDoctors={colleagueDashboardDoctors}
              isColleaguesTab={isColleaguesTab}
              pendingUsers={pendingUsers}
              companySettings={companySettings}
              handleApproveUser={handleApproveUser}
              addToast={addToast}
              isPersonDetailView={inspectedPersona !== null}
              onClosePersonDetail={() => setInspectedPersona(null)}
              onSelectPersona={(p) => setInspectedPersona(p)}
              hasFullDayAbsenceToday={fullDayAbsenceStatusToday.hasAbsence}
              fullDayAbsenceLabel={fullDayAbsenceStatusToday.label}
              absenceTypesMap={absenceTypesMap}
            />
          )}

          {/* ZÁLOŽKA: ŽÁDOSTI & PROVOZNÍ AGENDA */}
          {inspectedPersona === null && activeNavTab === 'zadosti' && (
            <RequestsView
              activePersona={activePersona}
              isManagerOrAdmin={isManagerOrAdmin}
              agendaTab={agendaTab}
              setAgendaTab={setAgendaTab}
              myVacationRequests={requestsPageMyVacations}
              myDoctorVisits={requestsPageMyDoctors}
              colleagueVacationRequests={requestsPageColleagueVacations}
              colleagueDoctorVisits={requestsPageColleagueDoctors}
              pendingUsers={pendingUsers}
              companySettings={companySettings}
              handleApproveUser={handleApproveUser}
              onOpenNewRequestModal={(initialType?: any) => {
                setNewRequestInitialType(initialType || 'vacation');
                setIsNewRequestModalOpen(true);
              }}
              onOpenVacationModal={handleOpenVacationModal}
              onOpenDoctorModal={handleOpenDoctorModal}
              onApproveVacation={handleApproveVacation}
              onApproveDoctor={handleApproveDoctor}
              addToast={addToast}
              absenceTypesMap={absenceTypesMap}
            />
          )}

          {/* ZÁLOŽKA 2: MOJE VÝKAZY */}
          {inspectedPersona === null && activeNavTab === 'vykazy' && (
            <MyTimesheetView
              activePersona={activePersona}
              isClockedIn={isClockedIn}
              activeLocation={activeLocation}
              clockInTime={clockInTime}
              workplaceName={workplaceName}
              hoursToday={hoursToday}
              currentShifts={currentShifts}
              dailyTargetHours={realDailyTargetHours}
              myVacationRequests={myVacationRequests}
              myDoctorVisits={myDoctorVisits}
            />
          )}

          {/* ZÁLOŽKA 3: OSOBY */}
          {inspectedPersona === null && activeNavTab === 'osoby' && (
            <PersonsView
              personasList={personasList}
              activePersona={activePersona}
              getPersonaStatus={getPersonaStatus}
              onSelectPersona={(p) => setInspectedPersona(p)}
            />
          )}

          {/* ZÁLOŽKA 4: MĚSÍČNÍ UZÁVĚRKY */}
          {inspectedPersona === null && activeNavTab === 'uzaverky' && (
            <ClosuresView
              personasList={personasList}
              activePersona={activePersona}
              baseDailyHours={companySettings?.dailyHours}
              onOpenMonthlyDetail={(p) => {
                setSelectedMonthlyPersona(p);
                setIsMonthlyModalOpen(true);
              }}
            />
          )}

          {/* ZÁLOŽKA 5: NASTAVENÍ SYSTÉMU */}
          {inspectedPersona === null && activeNavTab === 'nastaveni' && (
            <SettingsView
              devConfig={devConfig}
              dbMode={dbMode}
              companySettings={companySettings}
              onSaveCompanySettings={async (newSettings) => {
                const res = await api.updateCompanySettings(newSettings);
                if (res?.data) {
                  setCompanySettings(res.data);
                  addToast('success', 'Nastavení uloženo v DB', 'Výchozí firemní fondy a pravidla byly uloženy do databáze.');
                }
              }}
              onOpenDevModal={() => setIsDevConfigModalOpen(true)}
              onSwitchDbMode={handleSwitchDatabaseMode}
              onResetDevDb={handleResetDevDb}
              onWipeCleanDb={handleWipeCleanDb}
              isResettingDevDb={isResettingDevDb}
              isWipingCleanDb={isWipingCleanDb}
            />
          )}
            </main>
          </div>
        </div>
      )}

      {/* Footer (graficky průhledný) */}
      <footer className="w-full py-8 text-center text-xs text-slate-400 dark:text-zinc-500 bg-transparent select-none font-medium">
        <p>caffeechko © Petr Coolhanek</p>
      </footer>

      {/* MODAL 1: Nová žádost o volno / lékař (Self-Service nebo zadání za podřízenou osobu) */}
      <NewRequestModal
        isOpen={isNewRequestModalOpen}
        onClose={() => setIsNewRequestModalOpen(false)}
        onSubmit={handleCreateNewRequest}
        applicantName={viewPersona.name}
        applicantRole={viewPersona.roleLabel}
        managerName={inspectedPersona ? undefined : viewPersona.managerName}
        vacationRemaining={viewPersona.vacationRemaining}
        vacationTotal={viewPersona.vacationTotal}
        sickDaysRemaining={viewPersona.sickDaysRemaining}
        sickDaysTotal={viewPersona.sickDaysTotal}
        initialType={newRequestInitialType}
        isManagingOtherPerson={inspectedPersona !== null}
        absenceTypesMap={absenceTypesMap}
      />

      {/* MODAL: Výběr pracoviště při zápisu příchodu v Detailu osoby */}
      <Modal
        isOpen={isWorkplaceSelectModalOpen}
        onClose={() => setIsWorkplaceSelectModalOpen(false)}
        title="Výběr pracoviště"
        subtitle={`Zvolte pracoviště pro zápis příchodu (${viewPersona.name})`}
        icon={Building2}
        iconBgClass="bg-amber-400 text-slate-950"
        size="sm"
        footer={
          <div className="w-full">
            <Button
              variant="ghost"
              size="md"
              onClick={() => setIsWorkplaceSelectModalOpen(false)}
              fullWidth
            >
              Zrušit
            </Button>
          </div>
        }
      >
        <div className="space-y-2.5 py-1">
          {workplaces.map((wp) => (
            <button
              key={wp.id || wp.nfcIdentifier}
              type="button"
              onClick={() => handleClockInAction('office', wp.name, wp.nfcIdentifier)}
              className="w-full p-3.5 rounded-2xl bg-slate-100 hover:bg-amber-400/20 dark:bg-zinc-800 dark:hover:bg-amber-400/20 text-left transition-all flex items-center gap-3 cursor-pointer group"
            >
              <div className="w-9 h-9 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center shrink-0">
                <Building2 className="w-4 h-4 text-slate-950" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                  {wp.name}
                </div>
                {wp.address && (
                  <div className="text-xs text-slate-500 dark:text-zinc-400 truncate mt-0.5">
                    {wp.address}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      </Modal>

      {/* MODAL 4: Pípnutí karty (NFC) s volbami "Jsem v kanceláři (bez ověření)" a "Jsem doma" */}
      <Modal
        isOpen={isNfcModalOpen}
        onClose={() => setIsNfcModalOpen(false)}
        title="Přiložte telefon k NFC čipu"
        subtitle="Přiložte zadní stranu telefonu k recepční kartě na pobočce, nebo zvolte příchod bez čipu."
        icon={Smartphone}
        iconBgClass="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400"
        size="sm"
        footer={
          <div className="w-full">
            <Button
              variant="ghost"
              size="md"
              onClick={() => setIsNfcModalOpen(false)}
              fullWidth
            >
              Zrušit
            </Button>
          </div>
        }
      >
        <div className="space-y-4 py-2">
          {/* Submarine sonar pulsing background around smartphone icon */}
          <div className="relative w-32 h-32 mx-auto flex items-center justify-center my-2">
            <span className="absolute w-16 h-16 rounded-full bg-emerald-500/25 dark:bg-emerald-400/20 border border-emerald-500/40 dark:border-emerald-400/35 animate-sonar-1 pointer-events-none" />
            <span className="absolute w-16 h-16 rounded-full bg-emerald-500/20 dark:bg-emerald-400/15 border border-emerald-500/35 dark:border-emerald-400/30 animate-sonar-2 pointer-events-none" />
            <span className="absolute w-16 h-16 rounded-full bg-emerald-500/15 dark:bg-emerald-400/10 border border-emerald-500/25 dark:border-emerald-400/20 animate-sonar-3 pointer-events-none" />
            <div className="relative z-10 w-20 h-20 rounded-full bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-500/30 dark:border-emerald-400/30 shadow-lg shadow-emerald-500/15 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Smartphone className="w-10 h-10" />
            </div>
          </div>

          <div className="text-center text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-zinc-500 select-none">
            nebo
          </div>

          <div className="space-y-2 pt-1">
            <Button
              variant="surface"
              size="lg"
              className="w-full justify-center"
              icon={Building2}
              onClick={() => handleClockInAction('office', 'Kancelář (bez ověření)')}
            >
              Jsem v kanceláři (bez ověření)
            </Button>

            <Button
              variant="surface"
              size="lg"
              className="w-full justify-center"
              icon={Home}
              onClick={() => handleClockInAction('home_office')}
            >
              Jsem doma (Home Office)
            </Button>
          </div>
        </div>
      </Modal>

      {/* MODAL 5: Odchod z Home Office (Konec vs. Pauza) */}
      <Modal
        isOpen={isHoLeaveModalOpen}
        onClose={() => setIsHoLeaveModalOpen(false)}
        title="Ukončení práce na Home Office"
        subtitle="Zvolte, zda končíte pro dnešek definitivně, nebo jdete pouze na dočasnou pauzu."
        icon={Home}
        iconBgClass="bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400"
        size="sm"
        footer={
          <div className="w-full">
            <Button
              variant="ghost"
              size="md"
              onClick={() => setIsHoLeaveModalOpen(false)}
              fullWidth
            >
              Zpět
            </Button>
          </div>
        }
      >
        <div className="space-y-3 pt-2">
          <button
            type="button"
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
              <Button
                variant="filled"
                colorKey="amber"
                size="sm"
                className="ml-auto"
                onClick={() => finishClockOut(true, pauseReturnTime)}
              >
                Potvrdit
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* MODAL 7: Detail a schválení žádosti o dovolenou */}
      {selectedVacation && (
        <LeaveRequestModal
          request={selectedVacation}
          isOpen={isVacationModalOpen}
          onClose={() => setIsVacationModalOpen(false)}
          onApprove={handleApproveVacation}
          onReject={handleRejectVacation}
          onRenew={handleRenewVacation}
          readOnly={isModalReadOnly(selectedVacation)}
          canRenew={canRenewRequest(selectedVacation)}
          dailyHours={realDailyTargetHours}
          canMarkAsRead={canMarkRequestAsRead(selectedVacation)}
          onMarkAsRead={handleMarkRequestAsRead}
          isManagingOtherPerson={inspectedPersona !== null}
          absenceTypesMap={absenceTypesMap}
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
          onRenew={handleRenewDoctor}
          readOnly={isModalReadOnly(selectedDoctor)}
          canRenew={canRenewRequest(selectedDoctor)}
          canMarkAsRead={canMarkRequestAsRead(selectedDoctor)}
          onMarkAsRead={handleMarkRequestAsRead}
          isManagingOtherPerson={inspectedPersona !== null}
          absenceTypesMap={absenceTypesMap}
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
        dailyHours={selectedMonthlyPersona?.dailyHours ?? (selectedMonthlyPersona?.fteCoefficient ? selectedMonthlyPersona.fteCoefficient * baseDailyHours : (selectedMonthlyPersona ? baseDailyHours : realDailyTargetHours))}
        fundHours={selectedMonthlyPersona ? (selectedMonthlyPersona.dailyHours ? selectedMonthlyPersona.dailyHours * 21 : (selectedMonthlyPersona.fteCoefficient ? selectedMonthlyPersona.fteCoefficient * baseDailyHours * 21 : 21 * baseDailyHours)) : realMonthFundHours}
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

      {/* MODAL: Uživatelské nastavení (vzhled, notifikace, profil - přístupné všem) */}
      <UserSettingsModal
        isOpen={isUserSettingsModalOpen}
        onClose={() => setIsUserSettingsModalOpen(false)}
        activePersona={activePersona}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode(!darkMode)}
        onOpenSystemSettings={() => setActiveNavTab('nastaveni')}
        addToast={addToast}
      />


      {/* Floating NFC Simulator in Dev Mode (hidden when DEV mode is closed) */}
      {isDevVisible && <NfcDebugSimulator onSimulateClockIn={handleSimulatedNfc} />}

      {/* Toast Notifications Container */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}

export default App;

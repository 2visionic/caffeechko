import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Home,
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
import { RequestsView } from './views/RequestsView';

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

  const [companySettings, setCompanySettings] = useState<{
    defaultVacationDays: number;
    defaultSickDays: number;
    defaultHomeOfficeWeeklyDays: number;
  } | null>(null);

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

  const [agendaTab, setAgendaTab] = useState<'my' | 'team' | 'all'>('my');
  const [dashboardRequestsTab, setDashboardRequestsTab] = useState<'my' | 'colleagues'>('my');

  useEffect(() => {
    setDashboardRequestsTab('my');
  }, [activePersona.id]);

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
      vacationRemaining: undefined,
      vacationTotal: undefined,
      sickDaysRemaining: undefined,
      sickDaysTotal: undefined,
      homeOfficeDays: undefined,
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
          remainingDays: item.remainingDays ?? 0,
          totalDays: item.totalDays ?? 0,
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

  // Create new request from Employee Self-Service Modal
  const handleCreateNewRequest = (data: NewRequestData) => {
    setIsNewRequestModalOpen(false);

    if (data.type === 'vacation') {
      const s = new Date(data.startDate);
      const effectiveEndDate = data.endDate || data.startDate;
      const e = new Date(effectiveEndDate);
      const daysCount = Math.max(1, Math.round((e.getTime() - s.getTime()) / (1000 * 3600 * 24)) + 1);

      // Automaticky schválená žádost je, pokud dany clovek ma sloupecek ManagerId prazdne
      const isAutoApproved = !activePersona.managerId;
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
        endDate: effectiveEndDate,
        daysCount,
        remainingDays: activePersona.vacationRemaining ?? 0,
        totalDays: activePersona.vacationTotal ?? 0,
        note: data.note || '',
        status: isAutoApproved ? 'approved' : 'pending'
      };
      setVacationRequests((prev) => [newVac, ...prev]);

      // Write directly to SQLite database
      api.submitAbsence({
        userId: activePersona.id,
        typeCode: 'vacation',
        startDate: data.startDate,
        endDate: effectiveEndDate,
        note: data.note || ''
      }).then(async () => {
        const bal = await api.getAbsenceBalances(activePersona.id);
        if (bal?.data) {
          setActivePersona((prev) => ({
            ...prev,
            vacationRemaining: bal.data.vacationRemaining !== null ? bal.data.vacationRemaining : undefined,
            vacationTotal: bal.data.vacationTotal !== null ? bal.data.vacationTotal : undefined,
            sickDaysRemaining: bal.data.sickDaysRemaining !== null ? bal.data.sickDaysRemaining : undefined,
            sickDaysTotal: bal.data.sickDaysTotal !== null ? bal.data.sickDaysTotal : undefined,
            homeOfficeDays: bal.data.homeOfficeWeeklyDays !== null ? bal.data.homeOfficeWeeklyDays : undefined,
            unpaidLeaveDays: bal.data.unpaidLeaveDays ?? prev.unpaidLeaveDays ?? 0
          }));
        }
      });

      addToast(
        'success',
        isAutoApproved ? 'Žádost o dovolenou schválena' : 'Žádost o dovolenou podána',
        isAutoApproved
          ? `Vaše dovolená na termín ${formatDateCzech(data.startDate)} – ${formatDateCzech(data.endDate)} (${daysCount} dní) byla automaticky schválena.`
          : `Vaše žádost na termín ${formatDateCzech(data.startDate)} – ${formatDateCzech(data.endDate)} (${daysCount} dní) byla zaevidována a uložena do databáze.`
      );
    } else if (data.type === 'doctor') {
      const isAutoApproved = !activePersona.managerId;
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
        status: isAutoApproved ? 'approved' : 'pending'
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
        isAutoApproved ? 'Návštěva lékaře schválena' : 'Návštěva lékaře zaevidována',
        `Propustka k lékaři na ${formatDateCzech(data.startDate)} (${data.startTime} – ${data.endTime}) byla uložena do databáze.`
      );
    } else if (data.type === 'sick_day') {
      const isAutoApproved = !activePersona.managerId;
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
        remainingDays: activePersona.sickDaysRemaining ?? 0,
        totalDays: activePersona.sickDaysTotal ?? 0,
        note: data.note || 'Nahlášení zdravotní indispozice.',
        status: isAutoApproved ? 'approved' : 'pending'
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
            vacationRemaining: bal.data.vacationRemaining !== null ? bal.data.vacationRemaining : undefined,
            vacationTotal: bal.data.vacationTotal !== null ? bal.data.vacationTotal : undefined,
            sickDaysRemaining: bal.data.sickDaysRemaining !== null ? bal.data.sickDaysRemaining : undefined,
            sickDaysTotal: bal.data.sickDaysTotal !== null ? bal.data.sickDaysTotal : undefined,
            homeOfficeDays: bal.data.homeOfficeWeeklyDays !== null ? bal.data.homeOfficeWeeklyDays : undefined
          }));
        }
      });

      addToast(
        'success',
        isAutoApproved ? 'Sick Day schválen' : 'Sick Day nahlášen',
        `Zdravotní volno na ${formatDateCzech(data.startDate)} bylo zaevidováno v databázi.`
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
        remainingDays: activePersona.sickDaysRemaining ?? 0,
        totalDays: activePersona.sickDaysTotal ?? 0,
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
      const mRes = await api.getMonthSummary(activePersona.id);
      if (mRes?.data) setMonthSummary(mRes.data);
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
      const mRes = await api.getMonthSummary(activePersona.id);
      if (mRes?.data) setMonthSummary(mRes.data);
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


  // RBAC & Approval Filtering according to Spec:
  // Admin: full company (approves)
  // Manager: subordinates with managerId === activePersona.id (approves)
  // Team Lead: subordinates with parentPersonId === activePersona.id (informative, does not approve)
  // Office Manager: full company (informative, does not approve)
  const isManagerOrAdmin = ['admin', 'manager', 'team_lead', 'office_manager'].includes(activePersona.role);

  const pendingVacationsForManager = vacationRequests.filter((r) => {
    if (r.applicantId === activePersona.id || r.userName === activePersona.name) return false;

    if (activePersona.role === 'admin') return true;
    if (activePersona.role === 'manager') {
      const persona = effectivePersonas.find((p) => p.id === r.applicantId || p.name === r.userName);
      const mgrId = r.managerId || persona?.managerId;
      return mgrId === activePersona.id;
    }
    if (activePersona.role === 'team_lead') {
      const persona = effectivePersonas.find((p) => p.id === r.applicantId || p.name === r.userName);
      const parentId = r.parentPersonId || persona?.parentPersonId;
      return parentId === activePersona.id;
    }
    if (activePersona.role === 'office_manager') {
      return true;
    }
    return false;
  });

  const pendingDoctorsForManager = doctorVisits.filter((d) => {
    if (d.applicantId === activePersona.id || d.userName === activePersona.name) return false;

    if (activePersona.role === 'admin' || activePersona.role === 'office_manager') return true;
    if (activePersona.role === 'manager') {
      const persona = effectivePersonas.find((p) => p.id === d.applicantId || p.name === d.userName);
      const mgrId = d.managerId || persona?.managerId;
      return mgrId === activePersona.id;
    }
    if (activePersona.role === 'team_lead') {
      const persona = effectivePersonas.find((p) => p.id === d.applicantId || p.name === d.userName);
      const parentId = d.parentPersonId || persona?.parentPersonId;
      return parentId === activePersona.id;
    }
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

  // Real stats calculated directly from database records:
  // 1. Worked hours & Monthly fund (vždy počet pracovních dnů bez svátků * úvazek)
  const realDailyTargetHours = monthSummary?.dailyTargetHours ?? activePersona.dailyHours ?? 8;
  const realMonthHoursWorked = monthSummary ? monthSummary.hoursWorked : hoursToday;
  const realMonthFundHours = monthSummary ? monthSummary.fundHours : Math.round(21 * realDailyTargetHours);

  // 2. Overtime
  const realOvertimeHours = formatOvertime(monthSummary?.overtimeHours ?? activePersona.overtimeHours ?? 0);

  // 3. Vacation (from DB balances)
  const hasVacationConfig = activePersona.vacationTotal !== undefined && activePersona.vacationTotal !== null;
  const realVacationRemaining = activePersona.id === 'anonymous' || !hasVacationConfig
    ? '—'
    : (activePersona.vacationRemaining ?? 0);
  const realVacationTotal = activePersona.id === 'anonymous' || !hasVacationConfig
    ? undefined
    : (activePersona.vacationTotal ?? undefined);

  // 4. Sick days (from DB balances)
  const hasSickDaysConfig = activePersona.sickDaysTotal !== undefined && activePersona.sickDaysTotal !== null;
  const realSickDaysRemaining = activePersona.id === 'anonymous' || !hasSickDaysConfig
    ? '—'
    : (activePersona.sickDaysRemaining ?? 0);
  const realSickDaysTotal = activePersona.id === 'anonymous' || !hasSickDaysConfig
    ? undefined
    : (activePersona.sickDaysTotal ?? undefined);

  // 5. Approved illness days
  const realIllnessDays = activePersona.id === 'anonymous'
    ? '—'
    : myVacationRequests
        .filter((r) => r.type === 'illness' && r.status === 'approved')
        .reduce((sum, r) => sum + (r.daysCount || 0), 0);

  // 6. Approved doctor hours
  const realDoctorHours = activePersona.id === 'anonymous'
    ? '—'
    : (myDoctorVisits || [])
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
  const hasHomeOfficeConfig = activePersona.homeOfficeDays !== undefined && activePersona.homeOfficeDays !== null;
  const realApprovedHoDays = (myVacationRequests || [])
    .filter((r) => r && r.type === 'home_office' && r.status === 'approved')
    .reduce((sum, r) => sum + (r.daysCount || 0), 0);
  const realHomeOfficeDays = activePersona.id === 'anonymous' || !hasHomeOfficeConfig
    ? '—'
    : (monthSummary?.homeOfficeDays ?? 0) + realApprovedHoDays;

  // 8. Unpaid leave days (from DB balances or approved requests)
  const realUnpaidDays = activePersona.id === 'anonymous'
    ? '—'
    : (activePersona.unpaidLeaveDays ?? (myVacationRequests || [])
        .filter((r) => r && r.type === 'unpaid_leave' && r.status === 'approved')
        .reduce((sum, r) => sum + (r.daysCount || 0), 0) ?? 0);

  // Dashboard requests: active in current month (e.g. upcoming vacation) + ALL pending + ALL rejected
  const todayDateObj = new Date();
  const firstDayOfMonthStr = `${todayDateObj.getFullYear()}-${String(todayDateObj.getMonth() + 1).padStart(2, '0')}-01`;
  const lastDayOfMonthStr = `${todayDateObj.getFullYear()}-${String(todayDateObj.getMonth() + 1).padStart(2, '0')}-${String(new Date(todayDateObj.getFullYear(), todayDateObj.getMonth() + 1, 0).getDate()).padStart(2, '0')}`;

  const isItemActiveInMonth = (startDate: string, endDate?: string) => {
    const sDate = startDate || '';
    const eDate = endDate || sDate;
    return sDate <= lastDayOfMonthStr && eDate >= firstDayOfMonthStr;
  };

  // Moje žádosti pro dashboard
  const dashboardMyVacations = (myVacationRequests || []).filter((r) => {
    if (!r) return false;
    if (r.status === 'pending' || r.status === 'rejected') return true;
    if (r.status === 'approved') return isItemActiveInMonth(r.startDate, r.endDate);
    return false;
  });

  const dashboardMyDoctors = (myDoctorVisits || []).filter((d) => {
    if (!d) return false;
    if (d.status === 'pending' || d.status === 'rejected') return true;
    if (d.status === 'approved') {
      const visitDate = d.date || (d as any).startDate || '';
      return visitDate >= firstDayOfMonthStr && visitDate <= lastDayOfMonthStr;
    }
    return false;
  });

  // Žádosti kolegů pro dashboard (filtrované dle role a organizační hierarchie)
  const colleagueDashboardVacations = useMemo(() => {
    if (activePersona.role === 'colleague') return [];
    return vacationRequests.filter((r) => {
      if (r.applicantId === activePersona.id || r.userName === activePersona.name) return false;

      if (activePersona.role === 'team_lead') {
        const persona = effectivePersonas.find((p) => p.id === r.applicantId || p.name === r.userName);
        const parentId = r.parentPersonId || persona?.parentPersonId;
        if (parentId !== activePersona.id) return false;
      } else if (activePersona.role === 'manager') {
        const persona = effectivePersonas.find((p) => p.id === r.applicantId || p.name === r.userName);
        const mgrId = r.managerId || persona?.managerId;
        if (mgrId !== activePersona.id) return false;
      }
      // office_manager & admin see all colleagues

      if (r.status === 'pending' || r.status === 'rejected') return true;
      if (r.status === 'approved') return isItemActiveInMonth(r.startDate, r.endDate);
      return false;
    });
  }, [vacationRequests, activePersona, effectivePersonas, firstDayOfMonthStr, lastDayOfMonthStr]);

  const colleagueDashboardDoctors = useMemo(() => {
    if (activePersona.role === 'colleague') return [];
    return doctorVisits.filter((d) => {
      if (d.applicantId === activePersona.id || d.userName === activePersona.name) return false;

      if (activePersona.role === 'team_lead') {
        const persona = effectivePersonas.find((p) => p.id === d.applicantId || p.name === d.userName);
        const parentId = d.parentPersonId || persona?.parentPersonId;
        if (parentId !== activePersona.id) return false;
      } else if (activePersona.role === 'manager') {
        const persona = effectivePersonas.find((p) => p.id === d.applicantId || p.name === d.userName);
        const mgrId = d.managerId || persona?.managerId;
        if (mgrId !== activePersona.id) return false;
      }
      // office_manager & admin see all colleagues

      if (d.status === 'pending' || d.status === 'rejected') return true;
      if (d.status === 'approved') {
        const visitDate = d.date || (d as any).startDate || '';
        return visitDate >= firstDayOfMonthStr && visitDate <= lastDayOfMonthStr;
      }
      return false;
    });
  }, [doctorVisits, activePersona, effectivePersonas, firstDayOfMonthStr, lastDayOfMonthStr]);

  const colleaguePendingCount = useMemo(() => {
    return (
      colleagueDashboardVacations.filter((v) => v.status === 'pending').length +
      colleagueDashboardDoctors.filter((d) => d.status === 'pending').length
    );
  }, [colleagueDashboardVacations, colleagueDashboardDoctors]);

  const canActivePersonaApprove = activePersona.role === 'manager' || activePersona.role === 'admin';

  const isColleaguesTab = activePersona.role !== 'colleague' && dashboardRequestsTab === 'colleagues';
  const displayedDashboardVacations = isColleaguesTab ? colleagueDashboardVacations : dashboardMyVacations;
  const displayedDashboardDoctors = isColleaguesTab ? colleagueDashboardDoctors : dashboardMyDoctors;
  const totalDisplayedDashboardCount = displayedDashboardVacations.length + displayedDashboardDoctors.length;

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

          {/* ZÁLOŽKA 1: PŘEHLED DOCHÁZKY (DASHBOARD) */}
          {activeNavTab === 'dochazka' && (
            <DashboardView
              activePersona={activePersona}
              isClockedIn={isClockedIn}
              activeLocation={activeLocation}
              clockInTime={clockInTime}
              workplaceName={workplaceName}
              hoursToday={hoursToday}
              currentShifts={currentShifts}
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
              onClockIn={() => setIsNfcModalOpen(true)}
              onClockOut={handleClockOutClick}
              onOpenNewRequestModal={() => setIsNewRequestModalOpen(true)}
              onOpenVacationModal={handleOpenVacationModal}
              onOpenDoctorModal={handleOpenDoctorModal}
              onApproveVacation={handleApproveVacation}
              onApproveDoctor={handleApproveDoctor}
              displayedDashboardVacations={displayedDashboardVacations}
              displayedDashboardDoctors={displayedDashboardDoctors}
              totalDisplayedDashboardCount={totalDisplayedDashboardCount}
              dashboardRequestsTab={dashboardRequestsTab}
              setDashboardRequestsTab={setDashboardRequestsTab}
              canActivePersonaApprove={canActivePersonaApprove}
              totalManagerPendingCount={totalManagerPendingCount}
              colleaguePendingCount={colleaguePendingCount}
              colleagueDashboardVacations={colleagueDashboardVacations}
              colleagueDashboardDoctors={colleagueDashboardDoctors}
              isColleaguesTab={isColleaguesTab}
              addToast={addToast}
            />
          )}

          {/* ZÁLOŽKA: ŽÁDOSTI & PROVOZNÍ AGENDA */}
          {activeNavTab === 'zadosti' && (
            <RequestsView
              activePersona={activePersona}
              isManagerOrAdmin={isManagerOrAdmin}
              agendaTab={agendaTab}
              setAgendaTab={setAgendaTab}
              myTotalRequestsCount={myTotalRequestsCount}
              totalManagerPendingCount={totalManagerPendingCount}
              myVacationRequests={myVacationRequests}
              myDoctorVisits={myDoctorVisits}
              pendingUsers={pendingUsers}
              companySettings={companySettings}
              handleApproveUser={handleApproveUser}
              pendingVacationsForManager={pendingVacationsForManager}
              pendingDoctorsForManager={pendingDoctorsForManager}
              onOpenNewRequestModal={() => setIsNewRequestModalOpen(true)}
              onOpenVacationModal={handleOpenVacationModal}
              onOpenDoctorModal={handleOpenDoctorModal}
              onApproveVacation={handleApproveVacation}
              onApproveDoctor={handleApproveDoctor}
              addToast={addToast}
            />
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
          </div>
        </div>
      )}

      {/* Footer (graficky průhledný) */}
      <footer className="w-full py-8 text-center text-xs text-slate-400 dark:text-zinc-500 bg-transparent select-none font-medium">
        <p>caffeechko © Petr Coolhanek</p>
      </footer>

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
      <Modal
        isOpen={isNfcModalOpen}
        onClose={() => setIsNfcModalOpen(false)}
        title="Přiložte telefon k NFC čipu"
        subtitle="Přiložte zadní stranu telefonu k recepční kartě na pobočce."
        icon={Smartphone}
        iconBgClass="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400"
        size="sm"
      >
        <div className="space-y-4 py-2">
          <div className="w-20 h-20 mx-auto rounded-full bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400 animate-pulse">
            <Smartphone className="w-10 h-10" />
          </div>

          <div className="space-y-2 pt-2">
            <Button
              variant="surface"
              size="lg"
              className="w-full justify-center"
              icon={Home}
              onClick={() => handleClockInAction('home_office')}
            >
              Jsem doma (Home Office)
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-center text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200"
              onClick={() => setIsNfcModalOpen(false)}
            >
              Zrušit
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

          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-center text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors"
            onClick={() => setIsHoLeaveModalOpen(false)}
          >
            Zpět
          </Button>
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
          readOnly={isModalReadOnly(selectedVacation)}
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
          readOnly={isModalReadOnly(selectedDoctor)}
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
        dailyHours={selectedMonthlyPersona?.dailyHours ?? (selectedMonthlyPersona?.fteCoefficient ? selectedMonthlyPersona.fteCoefficient * 8 : (selectedMonthlyPersona ? 8 : realDailyTargetHours))}
        fundHours={selectedMonthlyPersona ? (selectedMonthlyPersona.dailyHours ? selectedMonthlyPersona.dailyHours * 21 : (selectedMonthlyPersona.fteCoefficient ? selectedMonthlyPersona.fteCoefficient * 8 * 21 : 168)) : realMonthFundHours}
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

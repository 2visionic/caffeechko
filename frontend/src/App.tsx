import { useState, useEffect, useMemo } from 'react';
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
import { DevToolbar } from './components/DevToolbar';
import { AttendanceClockModals } from './components/AttendanceClockModals';
import { ConfirmDeleteModal } from './components/ConfirmDeleteModal';
import { EditUserModal } from './components/EditUserModal';
import { PersonAbsenceSettingsModal } from './components/PersonAbsenceSettingsModal';
import { GdprConsentModal } from './components/GdprConsentModal';
import { canAccessPersonaDetail, canViewerSeePrivateAbsence } from './components/WhoIsWhereBox';
import { CONTRACT_TYPE_LABELS } from './types/attendance';
import { ToastContainer } from './components/ui';
import {
  api,
  type DevConfig,
  type RadarUserDto,
  type DatabaseMode,
  type DevDatabaseStatus,
  type MonthSummaryDto,
  type CompanySettingDto,
  type ContractTypeSettingDto,
  type WorkplaceDto,
  type AbsenceTypeConfigDto,
  type DeletedTimeEntryDto,
  type UserGdprOverviewDto,
  DEFAULT_ABSENCE_TYPES,
  resolveAbsenceTypeConfig,
  resolveAbsenceTypeLabel,
  getAbsenceTypeLabel,
  countWorkingDays,
  formatShortDayMonth,
  getStoredDbMode,
  setStoredDbMode,
  getSessionUserId,
  setSessionUserId,
  clearSessionUserId,
  setAuthToken,
  getLocalTodayIso
} from './api';
import { nfcService } from './services/nfcService';
import type { Persona, ToastMessage } from './types/attendance';
import { formatHoursMinutes, formatOvertime, formatDateCzech, syncContractTypeLabels, formatContractLabel } from './types/attendance';
import { getRoleConfig } from './components/RoleBadge';
import { DEV_PERSONAS, UNINSTALLED_PERSONA, ANONYMOUS_PERSONA } from './config/personas';
import { DashboardView } from './views/DashboardView';
import { RequestsView, type RequestsPageTab } from './views/RequestsView';
import { AbsencesView } from './views/AbsencesView';
import { TrashView, type DeletedAbsenceItem } from './views/TrashView';

export type { Persona, ToastMessage };
export { formatHoursMinutes, formatOvertime, formatDateCzech, DEV_PERSONAS, UNINSTALLED_PERSONA, ANONYMOUS_PERSONA };

function normalizeVacationItem(item: any): LeaveRequestItem {
  const sDate = item.startDate || '';
  const eDate = item.endDate || sDate || '';
  const computedWorkingDays = sDate ? countWorkingDays(sDate, eDate) : (item.daysCount || 1);
  return {
    ...item,
    startDate: sDate,
    endDate: eDate,
    daysCount: computedWorkingDays,
    remainingDays: item.remainingDays ?? 0,
    totalDays: item.totalDays ?? 0,
    isRead: Boolean(item.isRead),
    approvedByIsFemale: item.approvedByIsFemale !== undefined ? Boolean(item.approvedByIsFemale) : undefined,
    isDeleted: Boolean(item.isDeleted),
    deletedAt: item.deletedAt || undefined,
    editLogs: Array.isArray(item.editLogs) ? item.editLogs : [],
    status: item.status === 'completed' || item.status === 'approved' ? 'approved' : item.status === 'rejected' ? 'rejected' : 'pending'
  };
}

function normalizeDoctorItem(item: any): DoctorVisitItem {
  return {
    ...item,
    type: item.type || 'doctor',
    date: item.date || item.startDate || '',
    startTime: item.startTime || '08:00',
    endTime: item.endTime || '12:00',
    facilityName: item.facilityName || undefined,
    hasConfirmationDocument: item.hasConfirmationDocument ?? true,
    isRead: Boolean(item.isRead),
    approvedByIsFemale: item.approvedByIsFemale !== undefined ? Boolean(item.approvedByIsFemale) : undefined,
    isDeleted: Boolean(item.isDeleted),
    deletedAt: item.deletedAt || undefined,
    editLogs: Array.isArray(item.editLogs) ? item.editLogs : [],
    status: item.status === 'completed' || item.status === 'approved' ? 'approved' : item.status === 'rejected' ? 'rejected' : 'pending'
  };
}

function isHourlyAbsenceItem(item: any, typesMap: Record<string, AbsenceTypeConfigDto>): boolean {
  if (!item) return false;
  if (item.type === 'doctor') return true;
  const cfg = resolveAbsenceTypeConfig(item.type, typesMap);
  return cfg.durationMode === 'hours';
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

  // Modals state
  const [isNfcModalOpen, setIsNfcModalOpen] = useState(false);
  const [nfcModalMode, setNfcModalMode] = useState<'in' | 'out'>('in');
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
  const [contractTypes, setContractTypes] = useState<ContractTypeSettingDto[] | undefined>(undefined);
  const [absenceTypesMap, setAbsenceTypesMap] = useState<Record<string, AbsenceTypeConfigDto>>(
    () => DEFAULT_ABSENCE_TYPES
  );

  const [editingPersona, setEditingPersona] = useState<Persona | null>(null);
  const [settingsPersona, setSettingsPersona] = useState<Persona | null>(null);
  const [deletingPersona, setDeletingPersona] = useState<Persona | null>(null);

  const resolvedContractTypesMap = useMemo(() => {
    const map: Record<string, string> = { ...CONTRACT_TYPE_LABELS };
    if (contractTypes) {
      for (const ct of contractTypes) {
        if (ct?.code && ct?.name) {
          map[ct.code] = ct.name;
        }
      }
    }
    return map;
  }, [contractTypes]);

  const handleReloadUsers = async () => {
    const whoRes = await api.getWhoIsWhere();
    if (whoRes?.data) setTeamPresence(whoRes.data);
  };

  const handleConfirmToggleActivePersona = async () => {
    if (!deletingPersona) return;
    try {
      const res = await api.toggleUserActive(deletingPersona.id);
      if (res?.data) {
        const nextState = res.data.isActive;
        addToast(
          'success',
          nextState ? 'Osoba aktivována' : 'Osoba deaktivována',
          res.data.message || `Stav uživatele ${deletingPersona.name} byl upraven.`
        );
        await handleReloadUsers();
        if (inspectedPersona && inspectedPersona.id.toLowerCase() === deletingPersona.id.toLowerCase()) {
          setInspectedPersona((prev) => (prev ? { ...prev, isActive: nextState } : null));
        }
      }
    } catch (e: any) {
      addToast('error', 'Chyba změny stavu', e.message || 'Nepodařilo se změnit stav osoby.');
    } finally {
      setDeletingPersona(null);
    }
  };

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
      const ctRes = await api.getContractTypes();
      if (ctRes?.data && ctRes.data.length > 0) {
        syncContractTypeLabels(ctRes.data);
        setContractTypes(ctRes.data);
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
    const radarMap = new Map(teamPresence.map((r) => [r.userId.toLowerCase(), r]));
    const baseList: Persona[] = DEV_PERSONAS.map((p) => {
      const username = p.email ? p.email.split('@')[0] : 'user';
      const r = radarMap.get(p.id.toLowerCase());
      const roleKey = (r?.role || p.role || 'colleague') as Persona['role'];
      const isCurrentActive = activePersona?.id?.toLowerCase() === p.id.toLowerCase();
      return {
        ...p,
        name: r?.displayName || p.name,
        email: `${username}@${currentDomain}`,
        phoneNumber: r?.phoneNumber ?? p.phoneNumber,
        role: roleKey,
        roleLabel: r?.roleLabel || getRoleConfig(roleKey).label,
        contract: r?.contractKind ? (r.contractKind === 'OSVČ' ? 'OSVČ' : 'HPP') : p.contract,
        contractType: (r?.contractType as Persona['contractType']) ?? p.contractType,
        contractTypeName: r?.contractTypeName ?? p.contractTypeName,
        managerId: r?.managerId ?? p.managerId,
        managerName: r?.managerName ?? p.managerName,
        parentPersonId: r?.parentPersonId ?? p.parentPersonId,
        parentPersonName: r?.parentPersonName ?? p.parentPersonName,
        vacationRemaining: isCurrentActive ? activePersona.vacationRemaining : p.vacationRemaining,
        vacationTotal: isCurrentActive ? activePersona.vacationTotal : p.vacationTotal,
        sickDaysRemaining: isCurrentActive ? activePersona.sickDaysRemaining : p.sickDaysRemaining,
        sickDaysTotal: isCurrentActive ? activePersona.sickDaysTotal : p.sickDaysTotal,
        homeOfficeDays: isCurrentActive ? activePersona.homeOfficeDays : p.homeOfficeDays,
        unpaidLeaveDays: isCurrentActive ? activePersona.unpaidLeaveDays : p.unpaidLeaveDays,
        isPermanentHomeOffice:
          r?.isPermanentHomeOffice !== undefined
            ? r.isPermanentHomeOffice
            : isCurrentActive && activePersona.isPermanentHomeOffice !== undefined
            ? activePersona.isPermanentHomeOffice
            : p.isPermanentHomeOffice,
        isFemale:
          r?.isFemale !== undefined
            ? r.isFemale
            : isCurrentActive && activePersona.isFemale !== undefined
            ? activePersona.isFemale
            : p.isFemale,
        firstName: r?.firstName,
        lastName: r?.lastName,
        employmentStartDate: r?.employmentStartDate || p.employmentStartDate,
        isActive: r?.isActive ?? true,
        gdprStatus:
          (r?.gdprStatus as Persona['gdprStatus']) ??
          (isCurrentActive ? activePersona.gdprStatus : p.gdprStatus) ??
          'unfilled',
        activeGdprDocumentId:
          r?.activeGdprDocumentId ??
          (isCurrentActive ? activePersona.activeGdprDocumentId : p.activeGdprDocumentId)
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
          roleLabel: r.roleLabel || getRoleConfig(roleKey).label,
          contract: r.contractKind === 'OSVČ' ? 'OSVČ' : 'HPP',
          contractType: (r.contractType as Persona['contractType']) || undefined,
          contractTypeName: r.contractTypeName || undefined,
          managerId: r.managerId || undefined,
          managerName: r.managerName || undefined,
          parentPersonId: r.parentPersonId || undefined,
          parentPersonName: r.parentPersonName || undefined,
          isApproved: true,
          isPermanentHomeOffice: Boolean(r.isPermanentHomeOffice),
          isFemale: Boolean(r.isFemale),
          firstName: r.firstName,
          lastName: r.lastName,
          isActive: r.isActive ?? true,
          employmentStartDate: r.employmentStartDate || undefined,
          gdprStatus: (r.gdprStatus as Persona['gdprStatus']) || 'unfilled',
          activeGdprDocumentId: r.activeGdprDocumentId || undefined
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

  // Upcoming absences for current & next week (dashboard overview)
  const [upcomingAbsences, setUpcomingAbsences] = useState<any[]>([]);
  const [absencesRefreshTrigger, setAbsencesRefreshTrigger] = useState(0);

  // Pending user approvals (for Office Manager & Admin)
  const [pendingUsers, setPendingUsers] = useState<any[]>([]);
  const [deletedAbsences, setDeletedAbsences] = useState<DeletedAbsenceItem[]>([]);
  const [deletedTimeEntries, setDeletedTimeEntries] = useState<DeletedTimeEntryDto[]>([]);
  const [pendingDeleteAbsence, setPendingDeleteAbsence] = useState<{
    id: string;
    description: string;
  } | null>(null);

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
    }, 7000);
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
  const [selectedMonthlyYear, setSelectedMonthlyYear] = useState<number | undefined>(undefined);
  const [selectedMonthlyMonth, setSelectedMonthlyMonth] = useState<number | undefined>(undefined);

  // User settings modal (předvolby vzhledu, notifikace, profil)
  const [isUserSettingsModalOpen, setIsUserSettingsModalOpen] = useState(false);

  // GDPR state (přehled přihlášené osoby, prohlížené osoby a modál souhlasu)
  const [activeGdprOverview, setActiveGdprOverview] = useState<UserGdprOverviewDto | null>(null);
  const [inspectedGdprOverview, setInspectedGdprOverview] = useState<UserGdprOverviewDto | null>(null);
  const [isInspectedGdprLoading, setIsInspectedGdprLoading] = useState(false);
  const [isGdprConsentModalOpen, setIsGdprConsentModalOpen] = useState(false);
  const [isSubmittingGdprConsent, setIsSubmittingGdprConsent] = useState(false);

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
    const isPersonaOsvc = p.contract === 'OSVČ';
    if (isCurrent && isClockedIn) {
      const officeDetail = workplaceName.startsWith('Kancelář (')
        ? workplaceName.replace(/^Kancelář \((.+)\)$/, '$1')
        : workplaceName.split(' - ')[0];
      const hoLabel = getAbsenceTypeLabel('home_office', absenceTypesMap, isPersonaOsvc) || 'Home Office';
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
      const hoLabel = getAbsenceTypeLabel('home_office', absenceTypesMap, isPersonaOsvc) || 'Home Office';
      return {
        statusText: inspectedActiveLocation === 'office' ? `V kanceláři (${officeDetail})` : hoLabel,
        statusColor: inspectedActiveLocation === 'office' ? 'emerald' : 'sky',
        locationType: inspectedActiveLocation as 'office' | 'home_office'
      };
    }

    // 2. Check approved vacation/sick day requests spanning today (excluding home_office, which only counts as active when clocked in)
    const approvedVac = vacationRequests.find(
      (v) =>
        !v.isDeleted &&
        v.type !== 'home_office' &&
        (v.applicantId === p.id || (v as any).userId === p.id || v.userName === p.name) &&
        v.status === 'approved' &&
        v.startDate <= todayStr &&
        v.endDate >= todayStr
    );
    if (approvedVac) {
      const vacCfg = resolveAbsenceTypeConfig(approvedVac.type, absenceTypesMap);
      if (vacCfg.isPrivate && !canViewerSeePrivateAbsence(activePersona, p)) {
        return {
          statusText: 'Nedostupný',
          statusColor: 'red',
          locationType: 'unavailable' as const
        };
      }
      const vacLabel = resolveAbsenceTypeLabel(vacCfg, isPersonaOsvc);
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
      return {
        statusText: vacLabel,
        statusColor: 'amber',
        locationType: 'vacation' as const
      };
    }

    // 3. Check approved doctor visits today (only active if current time is within startTime–endTime)
    const docVisit = doctorVisits.find((d) => {
      if (d.isDeleted) return false;
      const isUser = d.applicantId === p.id || (d as any).userId === p.id || d.userName === p.name;
      const isToday = d.date === todayStr || (d as any).startDate === todayStr;
      if (!isUser || d.status !== 'approved' || !isToday) return false;
      const startMin = parseHhMm(d.startTime);
      const endMin = parseHhMm(d.endTime);
      if (startMin === null || endMin === null) return false;
      return nowMinutes >= startMin && nowMinutes <= endMin;
    });
    if (docVisit) {
      const docTypeCode = (docVisit as any).type || 'doctor';
      const docCfg = resolveAbsenceTypeConfig(docTypeCode, absenceTypesMap);
      if (docCfg.isPrivate && !canViewerSeePrivateAbsence(activePersona, p)) {
        return {
          statusText: 'Nedostupný',
          statusColor: 'red',
          locationType: 'unavailable' as const
        };
      }
      const docLabel = resolveAbsenceTypeLabel(docCfg, isPersonaOsvc) || 'Lékař';
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

      if ((isCurrent && !isClockedIn && locType === 'home_office') || (isInspected && !inspectedIsClockedIn && locType === 'home_office')) {
        return {
          statusText: 'Mimo práci',
          statusColor: 'slate',
          locationType: 'offline' as const
        };
      }

      if (locType === 'unavailable') {
        return {
          statusText: 'Nedostupný',
          statusColor: 'red',
          locationType: 'unavailable' as const
        };
      }

      if (
        locType !== 'office' &&
        locType !== 'home_office' &&
        locType !== 'offline' &&
        locType !== 'break' &&
        locType !== 'holiday'
      ) {
        const radarTypeCfg = resolveAbsenceTypeConfig(locType, absenceTypesMap);
        if (radarTypeCfg.isPrivate && !canViewerSeePrivateAbsence(activePersona, p)) {
          return {
            statusText: 'Nedostupný',
            statusColor: 'red',
            locationType: 'unavailable' as const
          };
        }
      }

      // Pokud záznam z radaru indikuje lékaře s časem od–do, ověříme, že časové okno stále probíhá
      if (locType === 'doctor' && radarItem.statusText) {
        const match = radarItem.statusText.match(/(\d{1,2}:\d{2})\s*[–-]\s*(\d{1,2}:\d{2})/);
        if (match) {
          const sMin = parseHhMm(match[1]);
          const eMin = parseHhMm(match[2]);
          if (sMin !== null && eMin !== null && (nowMinutes < sMin || nowMinutes > eMin)) {
            return {
              statusText: 'Mimo práci',
              statusColor: 'slate',
              locationType: 'offline' as const
            };
          }
        }
      }

      return {
        statusText: radarItem.statusText === 'Nepřítomen' ? 'Mimo práci' : radarItem.statusText,
        statusColor: radarItem.statusColor,
        locationType: locType
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

  const [personaSyncCounter, setPersonaSyncCounter] = useState(0);
  const [currentDateIso, setCurrentDateIso] = useState(() => getLocalTodayIso());

  // Automatický přechod přes půlnoc bez nutnosti obnovy stránky (reset denního timeline a re-sync z DB)
  useEffect(() => {
    const checkDateRollover = () => {
      const nextIso = getLocalTodayIso();
      setCurrentDateIso((prevIso) => {
        if (prevIso !== nextIso) {
          setCurrentShifts((prev) =>
            prev
              .filter((s) => s.end === null && s.location !== 'doctor')
              .map((s) => ({ ...s, start: '00:00' }))
          );
          setInspectedShifts((prev) =>
            prev
              .filter((s) => s.end === null && s.location !== 'doctor')
              .map((s) => ({ ...s, start: '00:00' }))
          );
          setHoursToday(0);
          setInspectedHoursToday(0);
          setPersonaSyncCounter((c) => c + 1);
          return nextIso;
        }
        return prevIso;
      });
    };

    const interval = setInterval(checkDateRollover, 5000);
    window.addEventListener('focus', checkDateRollover);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', checkDateRollover);
    };
  }, []);

  // Switch persona handler
  const handleSwitchPersona = async (persona: Persona) => {
    setInspectedPersona(null);
    setActiveGdprOverview(null);
    if (persona.gdprStatus === 'unfilled') {
      setActiveNavTab('dochazka');
    }
    setActivePersona((prev) =>
      prev.id === persona.id
        ? {
            ...persona,
            vacationRemaining: prev.vacationRemaining ?? persona.vacationRemaining,
            vacationTotal: prev.vacationTotal ?? persona.vacationTotal,
            sickDaysRemaining: prev.sickDaysRemaining ?? persona.sickDaysRemaining,
            sickDaysTotal: prev.sickDaysTotal ?? persona.sickDaysTotal,
            homeOfficeDays: prev.homeOfficeDays ?? persona.homeOfficeDays,
            unpaidLeaveDays: prev.unpaidLeaveDays ?? persona.unpaidLeaveDays
          }
        : persona
    );
    setSessionUserId(persona.id);
    setPersonaSyncCounter((c) => c + 1);
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
        `${persona.name} (${persona.roleLabel} • ${formatContractLabel(persona.contract, persona.contractType, persona.contractTypeName)})`
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
      roleLabel: authUser.roleLabel || 'Uživatel',
      vacationRemaining: undefined,
      vacationTotal: undefined,
      sickDaysRemaining: undefined,
      sickDaysTotal: undefined,
      homeOfficeDays: undefined,
      contract: authUser.contract === 'IČO' || authUser.contract === 'OSVČ' ? 'OSVČ' : 'HPP',
      contractType: authUser.contractType || undefined,
      contractTypeName: authUser.contractTypeName || undefined,
      isPermanentHomeOffice: Boolean(authUser.isPermanentHomeOffice),
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
  const [isResettingGdpr, setIsResettingGdpr] = useState(false);

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

  const handleResetGdpr = async () => {
    setIsResettingGdpr(true);
    try {
      const res = await api.resetGdprSends();
      const deletedCount = typeof res?.data === 'number' ? res.data : 0;
      setActivePersona((prev) => ({ ...prev, gdprStatus: 'unfilled' }));
      setInspectedPersona(null);
      setActiveNavTab('dochazka');
      const [whoRes, gdprRes] = await Promise.all([
        api.getWhoIsWhere(),
        activePersona.id && activePersona.id !== 'anonymous' && activePersona.id !== 'clean-uninstalled'
          ? api.getUserGdprOverview(activePersona.id)
          : Promise.resolve(null)
      ]);
      if (whoRes?.data) setTeamPresence(whoRes.data);
      if (gdprRes?.data) setActiveGdprOverview(gdprRes.data);
      void refreshUpcomingAbsences();
      setPersonaSyncCounter((c) => c + 1);
      addToast(
        'warning',
        'Reset GDPR proveden',
        `Tabulka odeslaných souhlasů/nesouhlasů GDPR byla vyprázdněna (smazáno ${deletedCount} záznamů).`
      );
    } catch {
      addToast('error', 'Chyba resetu GDPR', 'Nepodařilo se vyprázdnit tabulku GDPR souhlasů.');
    } finally {
      setIsResettingGdpr(false);
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
          if (activePersona.id && activePersona.id !== 'anonymous' && activePersona.id !== 'clean-uninstalled') {
            const gdprRes = await api.getUserGdprOverview(activePersona.id);
            const gdprData = gdprRes?.data;
            if (isMounted && gdprData) {
              setActiveGdprOverview(gdprData);
              setActivePersona((prev) => ({
                ...prev,
                gdprStatus: gdprData.currentStatus,
                activeGdprDocumentId: gdprData.activeGdprId
              }));
            }
          }
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
          setActiveGdprOverview(null);
          const whoRes = await api.getWhoIsWhere();
          if (whoRes && whoRes.data && isMounted) {
            setTeamPresence(whoRes.data);
          }
          return;
        }

        if (activePersona.id && activePersona.id !== 'clean-uninstalled') {
          setSessionUserId(activePersona.id);
        }

        const [
          dbStatusRes,
          typesRes,
          statusRes,
          weekRes,
          whoRes,
          myRes,
          balRes,
          monthRes,
          pendingRes,
          pUsersRes,
          upcomingRes,
          gdprRes
        ] = await Promise.all([
          api.getDatabaseStatus(),
          api.getAbsenceTypes(),
          api.getStatus(activePersona.id),
          api.getWeekSummary(activePersona.id),
          api.getWhoIsWhere(),
          api.getMyRequests(activePersona.id, true),
          api.getAbsenceBalances(activePersona.id),
          api.getMonthSummary(activePersona.id),
          ['admin', 'manager', 'team_lead', 'office_manager'].includes(activePersona.role)
            ? api.getPendingApprovals(activePersona.id)
            : Promise.resolve(null),
          ['admin', 'office_manager'].includes(activePersona.role)
            ? api.getPendingUsers()
            : Promise.resolve(null),
          api.getUpcomingAbsences(),
          api.getUserGdprOverview(activePersona.id)
        ]);

        if (!isMounted) return;

        if (gdprRes?.data) {
          setActiveGdprOverview(gdprRes.data);
        }

        if (dbStatusRes?.data) {
          setDbStatus(dbStatusRes.data);
        }

        if (upcomingRes?.data) {
          setUpcomingAbsences(upcomingRes.data);
        }

        let currentTypesMap = absenceTypesMap;
        if (typesRes?.data && typesRes.data.length > 0) {
          const nextMap: Record<string, AbsenceTypeConfigDto> = { ...DEFAULT_ABSENCE_TYPES };
          for (const t of typesRes.data) {
            nextMap[t.code] = t;
          }
          syncAbsenceTypeLabels(nextMap);
          setAbsenceTypesMap(nextMap);
          currentTypesMap = nextMap;
        }
        const doctorTypeLabel = resolveAbsenceTypeConfig('doctor', currentTypesMap).nameEmployee || 'Lékař';

        if (statusRes && statusRes.data) {
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
            setCurrentShifts(dbTodayShifts || []);
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
              setCurrentShifts([
                {
                  id: statusRes.data.activeShiftId || `shift-${Date.now()}`,
                  start: startHhMm,
                  end: null,
                  location: locType,
                  locationName: wpLabel,
                  method: locType === 'office' && hasVerifiedWorkplace ? 'nfc' : 'web',
                  startedAtMs: activeStartMs
                }
              ]);
            }
          }
        } else {
          setIsDbConnected(false);
        }

        // Weekly calendar
        if (weekRes && weekRes.data) {
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

        // Team presence & absence balances merged in one update to avoid race condition
        const myRadar = whoRes?.data?.find(
          (u: RadarUserDto) => u.userId.toLowerCase() === activePersona.id.toLowerCase()
        );
        if (whoRes?.data) {
          setTeamPresence(whoRes.data);
        }

        if (myRadar || balRes?.data) {
          setActivePersona((prev) => {
            if (prev.id.toLowerCase() !== activePersona.id.toLowerCase()) return prev;
            const roleKey = (myRadar?.role || prev.role || 'colleague') as Persona['role'];
            return {
              ...prev,
              ...(myRadar
                ? {
                    role: roleKey,
                    roleLabel: myRadar.roleLabel || getRoleConfig(roleKey).label,
                    contract: myRadar.contractKind === 'OSVČ' ? 'OSVČ' : 'HPP',
                    contractType: (myRadar.contractType as Persona['contractType']) ?? prev.contractType,
                    contractTypeName: myRadar.contractTypeName ?? prev.contractTypeName,
                    managerId: myRadar.managerId ?? undefined,
                    managerName: myRadar.managerName ?? undefined,
                    parentPersonId: myRadar.parentPersonId ?? undefined,
                    parentPersonName: myRadar.parentPersonName ?? undefined,
                    isPermanentHomeOffice:
                      myRadar.isPermanentHomeOffice !== undefined
                        ? myRadar.isPermanentHomeOffice
                        : prev.isPermanentHomeOffice,
                    employmentStartDate:
                      myRadar.employmentStartDate !== undefined
                        ? (myRadar.employmentStartDate || undefined)
                        : prev.employmentStartDate,
                    gdprStatus:
                      (myRadar.gdprStatus as Persona['gdprStatus']) ??
                      gdprRes?.data?.currentStatus ??
                      prev.gdprStatus,
                    activeGdprDocumentId:
                      myRadar.activeGdprDocumentId ??
                      gdprRes?.data?.activeGdprId ??
                      prev.activeGdprDocumentId
                  }
                : gdprRes?.data
                ? {
                    gdprStatus: gdprRes.data.currentStatus,
                    activeGdprDocumentId: gdprRes.data.activeGdprId
                  }
                : {}),
              ...(balRes?.data
                ? {
                    vacationRemaining:
                      balRes.data.vacationRemaining !== null ? balRes.data.vacationRemaining : undefined,
                    vacationTotal:
                      balRes.data.vacationTotal !== null ? balRes.data.vacationTotal : undefined,
                    sickDaysRemaining:
                      balRes.data.sickDaysRemaining !== null ? balRes.data.sickDaysRemaining : undefined,
                    sickDaysTotal:
                      balRes.data.sickDaysTotal !== null ? balRes.data.sickDaysTotal : undefined,
                    homeOfficeDays:
                      balRes.data.homeOfficeWeeklyDays !== null
                        ? balRes.data.homeOfficeWeeklyDays
                        : undefined,
                    homeOfficePeriod: balRes.data.homeOfficePeriod ?? prev.homeOfficePeriod,
                    homeOfficeDaysLimit:
                      balRes.data.homeOfficeDaysLimit !== null && balRes.data.homeOfficeDaysLimit !== undefined
                        ? Number(balRes.data.homeOfficeDaysLimit)
                        : undefined,
                    homeOfficeRemaining: balRes.data.balances?.home_office?.remaining,
                    homeOfficeTotal: balRes.data.balances?.home_office?.total,
                    homeOfficeUsed: balRes.data.balances?.home_office?.used,
                    unpaidLeaveDays: balRes.data.unpaidLeaveDays ?? prev.unpaidLeaveDays ?? 0
                  }
                : {})
            };
          });
        }

        if (monthRes?.data) {
          setMonthSummary(monthRes.data);
        } else {
          setMonthSummary(null);
        }

        const myVacs: LeaveRequestItem[] = (myRes?.data || [])
          .filter((r: any) => !isHourlyAbsenceItem(r, currentTypesMap))
          .map(normalizeVacationItem);
        const myDocs: DoctorVisitItem[] = (myRes?.data || [])
          .filter((r: any) => isHourlyAbsenceItem(r, currentTypesMap))
          .map(normalizeDoctorItem);

        const pendingVacs: LeaveRequestItem[] = (pendingRes?.data || [])
          .filter((r: any) => !isHourlyAbsenceItem(r, currentTypesMap))
          .map(normalizeVacationItem);
        const pendingDocs: DoctorVisitItem[] = (pendingRes?.data || [])
          .filter((r: any) => isHourlyAbsenceItem(r, currentTypesMap))
          .map(normalizeDoctorItem);

        if (['admin', 'office_manager'].includes(activePersona.role)) {
          if (pUsersRes?.data) {
            setPendingUsers(pUsersRes.data);
          }
          const [delAbsRes, delEntriesRes] = await Promise.all([
            api.getDeletedAbsences(),
            api.getDeletedTimeEntries()
          ]);
          if (isMounted) {
            setDeletedAbsences(Array.isArray(delAbsRes?.data) ? delAbsRes.data : []);
            setDeletedTimeEntries(Array.isArray(delEntriesRes?.data) ? delEntriesRes.data : []);
          }
        } else {
          setPendingUsers([]);
          setDeletedAbsences([]);
          setDeletedTimeEntries([]);
        }

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
      } catch (err) {
        console.warn('Backend sync failed, using local state:', err);
      }
    }
    syncBackendData();
    return () => {
      isMounted = false;
    };
  }, [activePersona.id, dbMode, personaSyncCounter]);

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
        setIsInspectedGdprLoading(true);
        const [statusRes, balRes, monthRes, myRes, gdprRes] = await Promise.all([
          api.getStatus(targetId),
          api.getAbsenceBalances(targetId),
          api.getMonthSummary(targetId),
          api.getMyRequests(targetId, true),
          api.getUserGdprOverview(targetId)
        ]);

        if (!isMounted) return;

        setIsInspectedGdprLoading(false);
        const inspectedGdprData = gdprRes?.data;
        if (inspectedGdprData) {
          setInspectedGdprOverview(inspectedGdprData);
          setInspectedPersona((prev) =>
            prev && prev.id === targetId
              ? {
                  ...prev,
                  gdprStatus: inspectedGdprData.currentStatus,
                  activeGdprDocumentId: inspectedGdprData.activeGdprId
                }
              : prev
          );
        }

        if (statusRes?.data) {
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

        if (balRes?.data) {
          setInspectedPersona((prev) => {
            if (!prev || prev.id !== targetId) return prev;
            return {
              ...prev,
              vacationRemaining: balRes.data.vacationRemaining !== null ? balRes.data.vacationRemaining : undefined,
              vacationTotal: balRes.data.vacationTotal !== null ? balRes.data.vacationTotal : undefined,
              sickDaysRemaining: balRes.data.sickDaysRemaining !== null ? balRes.data.sickDaysRemaining : undefined,
              sickDaysTotal: balRes.data.sickDaysTotal !== null ? balRes.data.sickDaysTotal : undefined,
              homeOfficeDays: balRes.data.homeOfficeWeeklyDays !== null ? balRes.data.homeOfficeWeeklyDays : undefined,
              homeOfficePeriod: balRes.data.homeOfficePeriod ?? prev.homeOfficePeriod,
              homeOfficeDaysLimit:
                balRes.data.homeOfficeDaysLimit !== null && balRes.data.homeOfficeDaysLimit !== undefined
                  ? Number(balRes.data.homeOfficeDaysLimit)
                  : undefined,
              homeOfficeRemaining: balRes.data.balances?.home_office?.remaining,
              homeOfficeTotal: balRes.data.balances?.home_office?.total,
              homeOfficeUsed: balRes.data.balances?.home_office?.used,
              unpaidLeaveDays: balRes.data.unpaidLeaveDays ?? prev.unpaidLeaveDays ?? 0
            };
          });
        }

        setInspectedMonthSummary(monthRes?.data || null);

        if (myRes?.data) {
          setInspectedVacationRequests(
            myRes.data.filter((r: any) => !isHourlyAbsenceItem(r, absenceTypesMap)).map(normalizeVacationItem)
          );
          setInspectedDoctorVisits(
            myRes.data.filter((r: any) => isHourlyAbsenceItem(r, absenceTypesMap)).map(normalizeDoctorItem)
          );
        }
      } catch (err) {
        if (isMounted) setIsInspectedGdprLoading(false);
        console.warn('Inspected persona sync failed:', err);
      }
    }

    syncInspectedData();
    return () => {
      isMounted = false;
    };
  }, [inspectedPersona?.id, personaSyncCounter]);

  // Vacation Handlers
  const shouldMarkRequestReadByApplicant = (req: {
    applicantId?: string;
    userName?: string;
    status?: string;
    isRead?: boolean;
  }): boolean => {
    if (!req || req.isRead) return false;
    if (inspectedPersona !== null) return false;
    if (req.status !== 'approved' && req.status !== 'rejected') return false;
    return (
      Boolean(req.applicantId && req.applicantId.toLowerCase() === activePersona.id.toLowerCase()) ||
      req.userName === activePersona.name
    );
  };

  const handleOpenVacationModal = (req: LeaveRequestItem) => {
    const markRead = shouldMarkRequestReadByApplicant(req);
    if (markRead) {
      void api.markAbsenceRead(req.id);
    }

    const targetPerson =
      (inspectedPersona &&
      ((req.applicantId && inspectedPersona.id.toLowerCase() === req.applicantId.toLowerCase()) ||
        inspectedPersona.name === req.userName)
        ? inspectedPersona
        : null) ||
      (activePersona &&
      ((req.applicantId && activePersona.id.toLowerCase() === req.applicantId.toLowerCase()) ||
        activePersona.name === req.userName)
        ? activePersona
        : null) ||
      personasList.find(
        (p) =>
          (req.applicantId && p.id.toLowerCase() === req.applicantId.toLowerCase()) ||
          p.name === req.userName
      );

    let enrichedTotal = req.totalDays;
    let enrichedRemaining = req.remainingDays;
    if (enrichedTotal <= 0 && targetPerson) {
      if (req.type === 'vacation' && (targetPerson.vacationTotal ?? 0) > 0) {
        enrichedTotal = targetPerson.vacationTotal!;
        enrichedRemaining = targetPerson.vacationRemaining ?? 0;
      } else if (req.type === 'sick_day' && (targetPerson.sickDaysTotal ?? 0) > 0) {
        enrichedTotal = targetPerson.sickDaysTotal!;
        enrichedRemaining = targetPerson.sickDaysRemaining ?? 0;
      }
    }

    const computedDays = req.startDate
      ? countWorkingDays(req.startDate, req.endDate || req.startDate)
      : req.daysCount;

    setSelectedVacation({
      ...req,
      contract: req.contract || targetPerson?.contract,
      contractType: req.contractType || targetPerson?.contractType,
      contractTypeName: req.contractTypeName || targetPerson?.contractTypeName,
      isPermanentHomeOffice: req.isPermanentHomeOffice ?? targetPerson?.isPermanentHomeOffice,
      daysCount: computedDays,
      totalDays: enrichedTotal,
      remainingDays: enrichedRemaining,
      isRead: markRead ? true : req.isRead
    });
    setIsVacationModalOpen(true);

    const targetUserId = req.applicantId || targetPerson?.id;
    if (targetUserId && (req.type === 'vacation' || req.type === 'sick_day')) {
      void Promise.all([
        api.getAbsenceBalances(targetUserId),
        api.getMyRequests(targetUserId)
      ]).then(([bal, myRes]) => {
        if (!bal?.data) return;
        const freshTotal =
          req.type === 'vacation'
            ? (bal.data.vacationTotal ?? enrichedTotal)
            : (bal.data.sickDaysTotal ?? enrichedTotal);
        let freshRem =
          req.type === 'vacation'
            ? (bal.data.vacationRemaining ?? enrichedRemaining)
            : (bal.data.sickDaysRemaining ?? enrichedRemaining);

        if (freshTotal > 0 && Array.isArray(myRes?.data)) {
          const reqYear = (req.startDate || '').slice(0, 4) || String(new Date().getFullYear());
          const usedWorkingDays = myRes.data
            .filter(
              (r: any) =>
                r &&
                !r.isDeleted &&
                r.type === req.type &&
                (r.status === 'approved' || r.status === 'completed' || r.status === 'pending') &&
                String(r.startDate || '').startsWith(reqYear)
            )
            .reduce(
              (sum: number, r: any) =>
                sum + countWorkingDays(r.startDate, r.endDate || r.startDate),
              0
            );
          freshRem = Math.max(0, freshTotal - usedWorkingDays);
        }

        setSelectedVacation((prev) =>
          prev && prev.id === req.id
            ? { ...prev, totalDays: freshTotal, remainingDays: freshRem }
            : prev
        );
      });
    }
  };

  const refreshUpcomingAbsences = async () => {
    const upRes = await api.getUpcomingAbsences();
    if (upRes?.data) {
      setUpcomingAbsences(
        upRes.data.map((r: any) =>
          isHourlyAbsenceItem(r, absenceTypesMap)
            ? r
            : {
                ...r,
                daysCount: r.startDate
                  ? countWorkingDays(r.startDate, r.endDate || r.startDate)
                  : r.daysCount
              }
        )
      );
    }
    setAbsencesRefreshTrigger((c) => c + 1);
  };

  const handleOpenAbsenceDetail = (item: any) => {
    if (!item) return;
    if (item.type === 'unavailable') {
      const maskedVac = normalizeVacationItem({
        ...item,
        type: 'unavailable',
        typeName: 'Nedostupný',
        note: undefined,
        remainingDays: 0,
        totalDays: 0,
        editLogs: []
      });
      handleOpenVacationModal(maskedVac);
      return;
    }
    if (isHourlyAbsenceItem(item, absenceTypesMap)) {
      const existingDoc =
        doctorVisits.find((d) => d.id === item.id) ||
        inspectedDoctorVisits.find((d) => d.id === item.id);
      const mergedDoc = normalizeDoctorItem({
        ...(existingDoc || {}),
        ...item,
        date: item.date || item.startDate || existingDoc?.date || ''
      });
      handleOpenDoctorModal(mergedDoc);
    } else {
      const existingVac =
        vacationRequests.find((v) => v.id === item.id) ||
        inspectedVacationRequests.find((v) => v.id === item.id);
      const mergedVac = normalizeVacationItem({
        ...(existingVac || {}),
        ...item
      });
      handleOpenVacationModal(mergedVac);
    }
  };

  // Pre-validate overlap directly inside LeaveRequestModal / DoctorVisitModal (Point 7)
  const handleValidateAbsenceOverlap = async (params: {
    id: string;
    applicantId?: string;
    userName: string;
    startDate: string;
    endDate: string;
    startTime?: string | null;
    endTime?: string | null;
  }): Promise<string | null> => {
    const targetPerson = personasList.find(
      (p) =>
        (params.applicantId && p.id.toLowerCase() === params.applicantId.toLowerCase()) ||
        p.name === params.userName
    );
    const targetUserId = params.applicantId || targetPerson?.id;
    if (!targetUserId) return null;

    const toMinutes = (hhmm?: string | null): number | null => {
      if (!hhmm || !hhmm.includes(':')) return null;
      const [h, m] = hhmm.split(':').map(Number);
      if (isNaN(h) || isNaN(m)) return null;
      return h * 60 + m;
    };

    const reqStartMin = toMinutes(params.startTime);
    const reqEndMin = toMinutes(params.endTime);
    const isReqTimeRange = reqStartMin !== null && reqEndMin !== null && !(reqStartMin === 0 && reqEndMin === 0);

    // 1. Check against user's existing absences
    const myRes = await api.getMyRequests(targetUserId);
    const userAbsences: any[] = Array.isArray(myRes?.data) ? myRes.data : [];
    for (const ex of userAbsences) {
      if (!ex || ex.id === params.id) continue;
      if (ex.status === 'rejected' || ex.isDeleted) continue;
      const exStart = ex.startDate || ex.date || '';
      const exEnd = ex.endDate || exStart;
      if (!exStart) continue;
      if (params.startDate <= exEnd && params.endDate >= exStart) {
        const exStartMin = toMinutes(ex.startTime);
        const exEndMin = toMinutes(ex.endTime);
        const isExTimeRange = exStartMin !== null && exEndMin !== null && !(exStartMin === 0 && exEndMin === 0);
        if (isReqTimeRange && isExTimeRange) {
          if (reqStartMin! < exEndMin! && reqEndMin! > exStartMin!) {
            const label = ex.typeName || resolveAbsenceTypeConfig(ex.type, absenceTypesMap).nameEmployee;
            return `Zvolený čas koliduje s jinou absencí (${label}: ${formatDateCzech(exStart)}, ${ex.startTime}–${ex.endTime}).`;
          }
        } else {
          const label = ex.typeName || resolveAbsenceTypeConfig(ex.type, absenceTypesMap).nameEmployee;
          const rangeText =
            exStart === exEnd
              ? formatDateCzech(exStart)
              : `${formatDateCzech(exStart)} – ${formatDateCzech(exEnd)}`;
          return `Zvolený termín koliduje s jinou absencí (${label}: ${rangeText}).`;
        }
      }
    }

    // 2. Check against user's work entries in the affected month(s)
    const editedRecord = userAbsences.find((r) => r.id === params.id);
    const isHomeOffice = editedRecord?.type === 'home_office';
    if (!isHomeOffice) {
      const [sy, sm] = params.startDate.split('-').map(Number);
      const [ey, em] = params.endDate.split('-').map(Number);
      if (sy && sm) {
        const monthsToCheck: { y: number; m: number }[] = [{ y: sy, m: sm }];
        if (ey && em && (ey !== sy || em !== sm)) {
          monthsToCheck.push({ y: ey, m: em });
        }
        for (const { y, m } of monthsToCheck) {
          const entriesRes = await api.getMonthlyEntries(targetUserId, y, m);
          const entries = Array.isArray(entriesRes?.data) ? entriesRes.data : [];
          for (const entry of entries) {
            if (entry.date >= params.startDate && entry.date <= params.endDate) {
              if (isReqTimeRange) {
                const entryStartMin = toMinutes(entry.startTime) ?? 0;
                const entryEndMin = toMinutes(entry.endTime) ?? 23 * 60 + 59;
                if (reqStartMin! < entryEndMin && reqEndMin! > entryStartMin) {
                  return `Zvolený čas koliduje se záznamem přítomnosti ze dne ${formatDateCzech(entry.date)} (${entry.startTime}–${entry.endTime || 'probíhá'}).`;
                }
              } else {
                return `Zvolený termín koliduje se záznamem přítomnosti ze dne ${formatDateCzech(entry.date)} (${entry.startTime}–${entry.endTime || 'probíhá'}).`;
              }
            }
          }
        }
      }
    }

    return null;
  };

  const getApplicantDetailHandler = (
    item: LeaveRequestItem | DoctorVisitItem | null
  ): (() => void) | undefined => {
    if (!item) return undefined;
    const targetPersona = personasList.find(
      (p) =>
        (item.applicantId && p.id.toLowerCase() === item.applicantId.toLowerCase()) ||
        p.name === item.userName
    );
    if (!targetPersona) return undefined;
    if (!canAccessPersonaDetail(activePersona, targetPersona)) return undefined;
    return () => {
      setIsVacationModalOpen(false);
      setIsDoctorModalOpen(false);
      setInspectedPersona(targetPersona);
    };
  };

  const handleSaveVacationOnly = async (updatedReq: LeaveRequestItem): Promise<boolean | string> => {
    const res = await api.updateAbsence(updatedReq.id, {
      startDate: updatedReq.startDate,
      endDate: updatedReq.endDate,
      note: updatedReq.note,
      editedByUserId: activePersona.id
    });

    if (res?.error) {
      const msg = res.error.message || 'Zvolený termín koliduje s jiným záznamem.';
      addToast('error', 'Nelze uložit úpravu absence', msg);
      return msg;
    }

    const nowIso = new Date().toISOString();
    const prevReq =
      selectedVacation?.id === updatedReq.id
        ? selectedVacation
        : vacationRequests.find((r) => r.id === updatedReq.id) ||
          inspectedVacationRequests.find((r) => r.id === updatedReq.id) ||
          updatedReq;
    const prevStart = prevReq.startDate;
    const prevEnd = prevReq.endDate || prevStart;
    const prevVal =
      prevStart === prevEnd
        ? formatShortDayMonth(prevStart)
        : `${formatShortDayMonth(prevStart)} – ${formatShortDayMonth(prevEnd)}`;
    const isFem = activePersona.isFemale ?? activePersona.name.trim().endsWith('á');
    const nextEditLog = {
      id: `edit-${Date.now()}`,
      editedByUserId: activePersona.id,
      editedByName: activePersona.name,
      editedAt: nowIso,
      summary: `${isFem ? 'změnila z' : 'změnil z'} ${prevVal}`
    };
    const mergedItem: LeaveRequestItem = {
      ...updatedReq,
      editLogs: [nextEditLog, ...(updatedReq.editLogs || [])]
    };

    setVacationRequests((prev) =>
      prev.map((r) => (r.id === updatedReq.id ? mergedItem : r))
    );
    setInspectedVacationRequests((prev) =>
      prev.map((r) => (r.id === updatedReq.id ? mergedItem : r))
    );
    setSelectedVacation(mergedItem);
    void refreshUpcomingAbsences();
    setPersonaSyncCounter((c) => c + 1);

    addToast(
      'success',
      'Absence upravena v DB',
      `Změna termínu absence (${formatDateCzech(updatedReq.startDate)} – ${formatDateCzech(updatedReq.endDate)}) byla uložena a zapsána do historie úprav.`
    );
    return true;
  };

  const handleSaveDoctorOnly = async (updatedDoc: DoctorVisitItem): Promise<boolean | string> => {
    const res = await api.updateAbsence(updatedDoc.id, {
      startDate: updatedDoc.date,
      endDate: updatedDoc.date,
      startTime: updatedDoc.startTime,
      endTime: updatedDoc.endTime,
      facilityName: updatedDoc.facilityName,
      hasConfirmationDocument: updatedDoc.hasConfirmationDocument,
      note: updatedDoc.note,
      editedByUserId: activePersona.id
    });

    if (res?.error) {
      const msg = res.error.message || 'Zvolený termín koliduje s jiným záznamem.';
      addToast('error', 'Nelze uložit úpravu absence', msg);
      return msg;
    }

    const nowIso = new Date().toISOString();
    const prevDoc =
      selectedDoctor?.id === updatedDoc.id
        ? selectedDoctor
        : doctorVisits.find((d) => d.id === updatedDoc.id) ||
          inspectedDoctorVisits.find((d) => d.id === updatedDoc.id) ||
          updatedDoc;
    const prevDateStr = formatShortDayMonth(prevDoc.date || (prevDoc as any).startDate || updatedDoc.date);
    const prevVal = `${prevDateStr} (${prevDoc.startTime || '08:00'} – ${prevDoc.endTime || '12:00'})`;
    const isFem = activePersona.isFemale ?? activePersona.name.trim().endsWith('á');
    const nextEditLog = {
      id: `edit-${Date.now()}`,
      editedByUserId: activePersona.id,
      editedByName: activePersona.name,
      editedAt: nowIso,
      summary: `${isFem ? 'změnila z' : 'změnil z'} ${prevVal}`
    };
    const mergedDoc: DoctorVisitItem = {
      ...updatedDoc,
      editLogs: [nextEditLog, ...(updatedDoc.editLogs || [])]
    };

    setDoctorVisits((prev) =>
      prev.map((d) => (d.id === updatedDoc.id ? mergedDoc : d))
    );
    setInspectedDoctorVisits((prev) =>
      prev.map((d) => (d.id === updatedDoc.id ? mergedDoc : d))
    );
    setSelectedDoctor(mergedDoc);
    void refreshUpcomingAbsences();
    setPersonaSyncCounter((c) => c + 1);

    addToast(
      'success',
      'Absence upravena v DB',
      `Změna času (${formatDateCzech(updatedDoc.date)}, ${updatedDoc.startTime} – ${updatedDoc.endTime}) byla uložena a zapsána do historie úprav.`
    );
    return true;
  };

  const handleDeleteAbsence = async (requestId: string) => {
    const res = await api.deleteAbsence(requestId, activePersona.id);
    if (res?.error) {
      addToast(
        'error',
        'Chyba při mazání absence',
        res.error.message || 'Nepodařilo se smazat absenci.'
      );
      return false;
    }

    const nowDeletedIso = new Date().toISOString();
    setVacationRequests((prev) =>
      prev.map((r) => (r.id === requestId ? { ...r, isDeleted: true, deletedAt: nowDeletedIso } : r))
    );
    setInspectedVacationRequests((prev) =>
      prev.map((r) => (r.id === requestId ? { ...r, isDeleted: true, deletedAt: nowDeletedIso } : r))
    );
    setDoctorVisits((prev) =>
      prev.map((d) => (d.id === requestId ? { ...d, isDeleted: true, deletedAt: nowDeletedIso } : d))
    );
    setInspectedDoctorVisits((prev) =>
      prev.map((d) => (d.id === requestId ? { ...d, isDeleted: true, deletedAt: nowDeletedIso } : d))
    );
    setIsVacationModalOpen(false);
    setIsDoctorModalOpen(false);
    void api.getWhoIsWhere().then((whoRes) => {
      if (whoRes?.data) setTeamPresence(whoRes.data);
    });
    void refreshUpcomingAbsences();
    setPersonaSyncCounter((c) => c + 1);

    addToast(
      'warning',
      'Absence smazána',
      'Záznam absence byl přesunut do koše.'
    );
    return true;
  };

  const promptDeleteAbsence = (item: any) => {
    if (!item?.id) return;
    const typeLabel =
      item.typeName || resolveAbsenceTypeConfig(item.type, absenceTypesMap).nameEmployee;
    const sDate = item.startDate || item.date || '';
    const eDate = item.endDate || sDate;
    const dateRange =
      sDate && eDate && eDate !== sDate
        ? `${formatDateCzech(sDate)} – ${formatDateCzech(eDate)}`
        : sDate
        ? formatDateCzech(sDate)
        : '';
    const timePart =
      item.startTime && item.endTime && !(item.startTime === '00:00' && item.endTime === '00:00')
        ? ` (${item.startTime}–${item.endTime})`
        : '';
    setPendingDeleteAbsence({
      id: item.id,
      description: `${typeLabel} • ${item.userName || ''}${dateRange ? ` • ${dateRange}` : ''}${timePart}`
    });
  };

  const handleRestoreAbsence = async (requestId: string) => {
    const res = await api.restoreAbsence(requestId, activePersona.id);
    if (!res || res.error) {
      addToast('error', 'Nelze obnovit absenci', res?.error?.message || 'Nepodařilo se obnovit absenci z koše.');
      return;
    }
    setDeletedAbsences((prev) => prev.filter((a) => a.id !== requestId));
    void refreshUpcomingAbsences();
    setPersonaSyncCounter((c) => c + 1);
    addToast('success', 'Absence obnovena', 'Záznam absence byl úspěšně obnoven z koše.');
  };

  const handleRestoreTimeEntry = async (entryId: string) => {
    const res = await api.restoreTimeEntry(entryId, activePersona.id);
    if (!res || res.error) {
      addToast('error', 'Nelze obnovit záznam', res?.error?.message || 'Nepodařilo se obnovit záznam docházky z koše.');
      return;
    }
    setDeletedTimeEntries((prev) => prev.filter((e) => e.id !== entryId));
    setPersonaSyncCounter((c) => c + 1);
    addToast('success', 'Záznam docházky obnoven', 'Záznam docházky byl úspěšně obnoven z koše.');
  };

  const handleTogglePermanentHomeOffice = async (userId: string, nextValue: boolean) => {
    const res = await api.setPermanentHomeOffice(userId, nextValue);
    if (res?.error) {
      addToast('error', 'Chyba uložení', res.error.message || 'Nepodařilo se změnit příznak Stálý Home Office.');
      return;
    }

    setTeamPresence((prev) =>
      prev.map((r) =>
        r.userId.toLowerCase() === userId.toLowerCase()
          ? { ...r, isPermanentHomeOffice: nextValue }
          : r
      )
    );

    if (activePersona.id.toLowerCase() === userId.toLowerCase()) {
      setActivePersona((prev) => ({ ...prev, isPermanentHomeOffice: nextValue }));
    }
    if (inspectedPersona && inspectedPersona.id.toLowerCase() === userId.toLowerCase()) {
      setInspectedPersona((prev) => (prev ? { ...prev, isPermanentHomeOffice: nextValue } : prev));
    }

    addToast(
      'success',
      nextValue ? 'Stálý Home Office zapnut' : 'Stálý Home Office vypnut',
      nextValue
        ? 'Osoba je označena jako Stálý Home Office (indikátor u avataru, žádosti o HO skryty, v příchodu HO na 1. místě).'
        : 'Označení Stálý Home Office bylo zrušeno.'
    );
  };

  const handleApproveVacation = async (updatedReq: LeaveRequestItem): Promise<boolean | string> => {
    // Write directly to SQLite database including any modified dates
    const res = await api.approveAbsence(updatedReq.id, activePersona.id, {
      startDate: updatedReq.startDate,
      endDate: updatedReq.endDate
    });
    if (res?.error) {
      const msg = res.error.message || 'Zvolený termín koliduje s jiným záznamem.';
      addToast('error', 'Nelze schválit absenci', msg);
      return msg;
    }

    const nowIso = new Date().toISOString();
    const isFem = activePersona.isFemale ?? activePersona.name.trim().endsWith('á');
    const applyUpdate = (r: LeaveRequestItem): LeaveRequestItem => {
      if (r.id !== updatedReq.id) return r;
      const datesChanged = r.startDate !== updatedReq.startDate || r.endDate !== updatedReq.endDate;
      const prevStart = r.startDate;
      const prevEnd = r.endDate || prevStart;
      const prevVal =
        prevStart === prevEnd
          ? formatShortDayMonth(prevStart)
          : `${formatShortDayMonth(prevStart)} – ${formatShortDayMonth(prevEnd)}`;
      const nextEditLogs = datesChanged
        ? [
            {
              id: `edit-${Date.now()}`,
              editedByUserId: activePersona.id,
              editedByName: activePersona.name,
              editedAt: nowIso,
              summary: `${isFem ? 'změnila z' : 'změnil z'} ${prevVal}`
            },
            ...(r.editLogs || [])
          ]
        : r.editLogs;
      return {
        ...updatedReq,
        status: 'approved',
        isRead: false,
        approvedByName: activePersona.name,
        approvedByIsFemale: activePersona.isFemale,
        approvedAt: nowIso,
        editLogs: nextEditLogs
      };
    };
    setVacationRequests((prev) => prev.map(applyUpdate));
    setInspectedVacationRequests((prev) => prev.map(applyUpdate));
    void refreshUpcomingAbsences();

    addToast(
      'success',
      'Dovolená schválena v DB',
      `Dovolená pro ${updatedReq.userName} (${formatDateCzech(updatedReq.startDate)} – ${formatDateCzech(updatedReq.endDate)}, ${updatedReq.daysCount} dní) byla schválena a uložena do SQLite databáze.`
    );
    return true;
  };

  const handleRenewVacation = async (updatedReq: LeaveRequestItem): Promise<boolean | string> => {
    const isManagingOther = Boolean(inspectedPersona && inspectedPersona.id !== activePersona.id);
    const typeConfig = resolveAbsenceTypeConfig(updatedReq.type, absenceTypesMap);
    const effectiveApproverRole = (typeConfig.approverRole ?? 'manager').trim().toLowerCase();
    const canAutoApproveForOther =
      isManagingOther &&
      (effectiveApproverRole === 'admin'
        ? activePersona.role === 'admin'
        : effectiveApproverRole === 'office_manager'
        ? ['admin', 'office_manager'].includes(activePersona.role)
        : ['admin', 'office_manager', 'manager'].includes(activePersona.role));
    const targetPersona = inspectedPersona || activePersona;
    const hoRule = resolveAbsenceTypeConfig('home_office', absenceTypesMap);
    const isUnlimitedHo =
      updatedReq.type === 'home_office' &&
      (Boolean(targetPersona.isPermanentHomeOffice) ||
        hoRule.defaultBudgetPeriod?.toLowerCase() === 'unlimited' ||
        ((targetPersona.homeOfficeDays === undefined || targetPersona.homeOfficeDays === null) &&
          (hoRule.defaultAllowance === undefined || hoRule.defaultAllowance === null)));
    const isAutoApproved =
      isUnlimitedHo ||
      effectiveApproverRole === '' ||
      effectiveApproverRole === 'none' ||
      (effectiveApproverRole === 'admin'
        ? targetPersona.role === 'admin' || activePersona.role === 'admin'
        : effectiveApproverRole === 'office_manager'
        ? ['admin', 'office_manager'].includes(targetPersona.role) || canAutoApproveForOther
        : effectiveApproverRole === 'team_lead'
        ? canAutoApproveForOther || !targetPersona.parentPersonId
        : canAutoApproveForOther || !targetPersona.managerId);
    const nextStatus = isAutoApproved ? 'approved' : 'pending';
    const nowCreatedAt = new Date().toISOString();

    const res = await api.resubmitAbsence(updatedReq.id, {
      typeCode: updatedReq.type,
      startDate: updatedReq.startDate,
      endDate: updatedReq.endDate,
      note: updatedReq.note,
      autoApprove: canAutoApproveForOther ? true : undefined,
      approvedByUserId: isManagingOther ? activePersona.id : undefined
    });

    if (res?.error) {
      const msg = res.error.message || 'Zvolený termín koliduje s jiným záznamem.';
      addToast('error', 'Nelze obnovit žádost', msg);
      return msg;
    }

    const renewedItem: LeaveRequestItem = {
      ...updatedReq,
      status: nextStatus,
      rejectionReason: undefined,
      isRead: false,
      createdAt: nowCreatedAt,
      approvedByName: isAutoApproved ? (isManagingOther ? activePersona.name : targetPersona.name) : undefined,
      approvedByIsFemale: isAutoApproved ? (isManagingOther ? activePersona.isFemale : targetPersona.isFemale) : undefined,
      approvedAt: isAutoApproved ? nowCreatedAt : undefined
    };

    setVacationRequests((prev) =>
      prev.map((r) => (r.id === updatedReq.id ? renewedItem : r))
    );
    setInspectedVacationRequests((prev) =>
      prev.map((r) => (r.id === updatedReq.id ? renewedItem : r))
    );

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
    void refreshUpcomingAbsences();

    addToast(
      'success',
      isAutoApproved ? 'Žádost obnovena a schválena' : 'Žádost obnovena a odeslána ke schválení',
      `Žádost (${formatDateCzech(updatedReq.startDate)} – ${formatDateCzech(updatedReq.endDate)}, ${updatedReq.daysCount} dní) byla upravena a znovu zařazena do schvalovacího procesu.`
    );
    return true;
  };

  const handleRejectVacation = async (requestId: string, reason: string) => {
    const nowIso = new Date().toISOString();
    setVacationRequests((prev) =>
      prev.map((r) =>
        r.id === requestId
          ? {
              ...r,
              status: 'rejected',
              rejectionReason: reason,
              isRead: false,
              approvedByName: activePersona.name,
              approvedByIsFemale: activePersona.isFemale,
              approvedAt: nowIso
            }
          : r
      )
    );
    setInspectedVacationRequests((prev) =>
      prev.map((r) =>
        r.id === requestId
          ? {
              ...r,
              status: 'rejected',
              rejectionReason: reason,
              isRead: false,
              approvedByName: activePersona.name,
              approvedByIsFemale: activePersona.isFemale,
              approvedAt: nowIso
            }
          : r
      )
    );
    // Write directly to SQLite database
    await api.rejectAbsence(requestId, activePersona.id, reason);
    void refreshUpcomingAbsences();

    addToast(
      'warning',
      'Dovolená zamítnuta v DB',
      `Žádost o dovolenou byla zamítnuta s odůvodněním: "${reason}". Zapsáno do databáze.`
    );
  };

  // Doctor Handlers
  const handleOpenDoctorModal = (doc: DoctorVisitItem) => {
    const markRead = shouldMarkRequestReadByApplicant(doc);
    if (markRead) {
      void api.markAbsenceRead(doc.id);
    }
    const targetPerson =
      (inspectedPersona &&
      ((doc.applicantId && inspectedPersona.id.toLowerCase() === doc.applicantId.toLowerCase()) ||
        inspectedPersona.name === doc.userName)
        ? inspectedPersona
        : null) ||
      (activePersona &&
      ((doc.applicantId && activePersona.id.toLowerCase() === doc.applicantId.toLowerCase()) ||
        activePersona.name === doc.userName)
        ? activePersona
        : null) ||
      personasList.find(
        (p) =>
          (doc.applicantId && p.id.toLowerCase() === doc.applicantId.toLowerCase()) ||
          p.name === doc.userName
      );
    setSelectedDoctor({
      ...doc,
      contract: doc.contract || targetPerson?.contract,
      contractType: doc.contractType || targetPerson?.contractType,
      contractTypeName: doc.contractTypeName || targetPerson?.contractTypeName,
      isPermanentHomeOffice: doc.isPermanentHomeOffice ?? targetPerson?.isPermanentHomeOffice,
      isRead: markRead ? true : doc.isRead
    });
    setIsDoctorModalOpen(true);
  };

  const handleApproveDoctor = async (updatedDoc: DoctorVisitItem): Promise<boolean | string> => {
    // Write directly to SQLite database including any modified time/facility
    const res = await api.approveAbsence(updatedDoc.id, activePersona.id, {
      startDate: updatedDoc.date,
      endDate: updatedDoc.date,
      startTime: updatedDoc.startTime,
      endTime: updatedDoc.endTime,
      facilityName: updatedDoc.facilityName,
      hasConfirmationDocument: updatedDoc.hasConfirmationDocument
    });
    if (res?.error) {
      const msg = res.error.message || 'Zvolený termín koliduje s jiným záznamem.';
      addToast('error', 'Nelze potvrdit propustku', msg);
      return msg;
    }

    const nowIso = new Date().toISOString();
    const isFem = activePersona.isFemale ?? activePersona.name.trim().endsWith('á');
    const applyUpdate = (d: DoctorVisitItem): DoctorVisitItem => {
      if (d.id !== updatedDoc.id) return d;
      const changed =
        d.date !== updatedDoc.date ||
        d.startTime !== updatedDoc.startTime ||
        d.endTime !== updatedDoc.endTime;
      const prevDateStr = formatShortDayMonth(d.date || (d as any).startDate || updatedDoc.date);
      const prevVal = `${prevDateStr} (${d.startTime || '08:00'} – ${d.endTime || '12:00'})`;
      const nextEditLogs = changed
        ? [
            {
              id: `edit-${Date.now()}`,
              editedByUserId: activePersona.id,
              editedByName: activePersona.name,
              editedAt: nowIso,
              summary: `${isFem ? 'změnila z' : 'změnil z'} ${prevVal}`
            },
            ...(d.editLogs || [])
          ]
        : d.editLogs;
      return {
        ...updatedDoc,
        status: 'approved',
        isRead: false,
        approvedByName: activePersona.name,
        approvedByIsFemale: activePersona.isFemale,
        approvedAt: nowIso,
        editLogs: nextEditLogs
      };
    };
    setDoctorVisits((prev) => prev.map(applyUpdate));
    setInspectedDoctorVisits((prev) => prev.map(applyUpdate));
    void refreshUpcomingAbsences();

    addToast(
      'success',
      'Propustka potvrzena v DB',
      `Lékařská propustka pro ${updatedDoc.userName} (${formatDateCzech(updatedDoc.date)}, ${updatedDoc.startTime} – ${updatedDoc.endTime}) byla uznána a uložena do SQLite databáze.`
    );
    return true;
  };

  const handleRenewDoctor = async (updatedDoc: DoctorVisitItem): Promise<boolean | string> => {
    const isManagingOther = Boolean(inspectedPersona && inspectedPersona.id !== activePersona.id);
    const canAutoApproveForOther =
      isManagingOther && ['admin', 'office_manager', 'manager'].includes(activePersona.role);
    const targetPersona = inspectedPersona || activePersona;
    const isAutoApproved = canAutoApproveForOther || !targetPersona.managerId;
    const nextStatus = isAutoApproved ? 'approved' : 'pending';
    const nowCreatedAt = new Date().toISOString();

    const res = await api.resubmitAbsence(updatedDoc.id, {
      typeCode: updatedDoc.type || 'doctor',
      startDate: updatedDoc.date,
      endDate: updatedDoc.date,
      startTime: updatedDoc.startTime,
      endTime: updatedDoc.endTime,
      facilityName: updatedDoc.facilityName,
      hasConfirmationDocument: updatedDoc.hasConfirmationDocument,
      note: updatedDoc.note,
      autoApprove: canAutoApproveForOther ? true : undefined,
      approvedByUserId: isManagingOther ? activePersona.id : undefined
    });

    if (res?.error) {
      const msg = res.error.message || 'Zvolený termín koliduje s jiným záznamem.';
      addToast('error', 'Nelze obnovit propustku', msg);
      return msg;
    }

    const renewedDoc: DoctorVisitItem = {
      ...updatedDoc,
      status: nextStatus,
      rejectionReason: undefined,
      isRead: false,
      createdAt: nowCreatedAt,
      approvedByName: isAutoApproved ? (isManagingOther ? activePersona.name : targetPersona.name) : undefined,
      approvedByIsFemale: isAutoApproved ? (isManagingOther ? activePersona.isFemale : targetPersona.isFemale) : undefined,
      approvedAt: isAutoApproved ? nowCreatedAt : undefined
    };

    setDoctorVisits((prev) =>
      prev.map((d) => (d.id === updatedDoc.id ? renewedDoc : d))
    );
    setInspectedDoctorVisits((prev) =>
      prev.map((d) => (d.id === updatedDoc.id ? renewedDoc : d))
    );
    void refreshUpcomingAbsences();

    addToast(
      'success',
      isAutoApproved ? 'Propustka obnovena a schválena' : 'Propustka obnovena a odeslána ke schválení',
      `Propustka (${formatDateCzech(updatedDoc.date)}, ${updatedDoc.startTime} – ${updatedDoc.endTime}) byla upravena a znovu zařazena do schvalovacího procesu.`
    );
    return true;
  };

  const handleRejectDoctor = async (requestId: string, reason: string) => {
    const nowIso = new Date().toISOString();
    setDoctorVisits((prev) =>
      prev.map((d) =>
        d.id === requestId
          ? {
              ...d,
              status: 'rejected',
              rejectionReason: reason,
              isRead: false,
              approvedByName: activePersona.name,
              approvedByIsFemale: activePersona.isFemale,
              approvedAt: nowIso
            }
          : d
      )
    );
    setInspectedDoctorVisits((prev) =>
      prev.map((d) =>
        d.id === requestId
          ? {
              ...d,
              status: 'rejected',
              rejectionReason: reason,
              isRead: false,
              approvedByName: activePersona.name,
              approvedByIsFemale: activePersona.isFemale,
              approvedAt: nowIso
            }
          : d
      )
    );
    // Write directly to SQLite database
    await api.rejectAbsence(requestId, activePersona.id, reason);
    void refreshUpcomingAbsences();

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
    contractType?: string,
    allowances?: Record<string, number>
  ) => {
    const res = await api.approveUser({
      userId,
      role,
      contractKind,
      contractType,
      weeklyHoursBudget,
      vacationDays,
      sickDays,
      homeOfficeWeeklyDays,
      allowances
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
    const typeConfig = resolveAbsenceTypeConfig(data.type, absenceTypesMap);
    const effectiveApproverRole = (typeConfig.approverRole ?? 'manager').trim().toLowerCase();
    const canAutoApproveForOther =
      isManagingOther &&
      (effectiveApproverRole === 'admin'
        ? activePersona.role === 'admin'
        : effectiveApproverRole === 'office_manager'
        ? ['admin', 'office_manager'].includes(activePersona.role)
        : ['admin', 'office_manager', 'manager'].includes(activePersona.role));
    const isPermanentHoAutoApprove =
      data.type === 'home_office' && Boolean(targetPersona.isPermanentHomeOffice);
    const isAutoApproved =
      isPermanentHoAutoApprove ||
      effectiveApproverRole === '' ||
      effectiveApproverRole === 'none' ||
      (effectiveApproverRole === 'admin'
        ? targetPersona.role === 'admin' || activePersona.role === 'admin'
        : effectiveApproverRole === 'office_manager'
        ? ['admin', 'office_manager'].includes(targetPersona.role) ||
          (isManagingOther && ['admin', 'office_manager'].includes(activePersona.role))
        : effectiveApproverRole === 'team_lead'
        ? canAutoApproveForOther || !targetPersona.parentPersonId
        : canAutoApproveForOther || !targetPersona.managerId);
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
      void refreshUpcomingAbsences();
    };

    const reqTypeLabel = resolveAbsenceTypeLabel(typeConfig, targetPersona.contract === 'OSVČ');
    const isHoursMode = typeConfig.durationMode === 'hours' || data.type === 'doctor';
    const isSingleDayMode = typeConfig.durationMode === 'single_day';

    if (isHoursMode) {
      const tempId = `doc-${Date.now()}`;
      const newDoc: DoctorVisitItem = {
        id: tempId,
        applicantId: targetPersona.id,
        userName: targetPersona.name,
        userRole: targetPersona.roleLabel,
        contract: targetPersona.contract,
        contractType: targetPersona.contractType,
        contractTypeName: targetPersona.contractTypeName,
        isPermanentHomeOffice: targetPersona.isPermanentHomeOffice,
        managerId: targetPersona.managerId,
        managerName: targetPersona.managerName,
        type: data.type || 'doctor',
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
        typeCode: data.type,
        startDate: data.startDate,
        endDate: data.startDate,
        startTime: data.startTime,
        endTime: data.endTime,
        hasConfirmationDocument: data.hasConfirmationDocument,
        note: data.note,
        autoApprove: canAutoApproveForOther ? true : undefined,
        approvedByUserId: isManagingOther ? activePersona.id : undefined
      }).then((res) => {
        if (!res || res.error || !res.data?.id) {
          setDoctorVisits((prev) => prev.filter((d) => d.id !== tempId));
          if (isManagingOther) {
            setInspectedDoctorVisits((prev) => prev.filter((d) => d.id !== tempId));
          }
          addToast('error', 'Nelze zadat absenci', res?.error?.message || 'Zvolený termín koliduje s jiným záznamem.');
          return;
        }
        const normalized = normalizeDoctorItem(res.data);
        setDoctorVisits((prev) => prev.map((d) => (d.id === tempId ? normalized : d)));
        if (isManagingOther) {
          setInspectedDoctorVisits((prev) => prev.map((d) => (d.id === tempId ? normalized : d)));
        }
        addToast(
          'success',
          isAutoApproved ? `${reqTypeLabel} schválen` : `${reqTypeLabel} zaevidován`,
          `Propustka (${reqTypeLabel}) na ${formatDateCzech(data.startDate)} (${data.startTime} – ${data.endTime}) byla uložena do databáze.`
        );
        void refreshTargetBalances();
      });
      return;
    }

    const effectiveEndDate = isSingleDayMode ? data.startDate : (data.endDate || data.startDate);
    const daysCount = countWorkingDays(data.startDate, effectiveEndDate);

    const remainingDays =
      data.type === 'vacation'
        ? (targetPersona.vacationRemaining ?? typeConfig.defaultAllowance ?? 0)
        : data.type === 'sick_day' || data.type === 'illness'
        ? (targetPersona.sickDaysRemaining ?? typeConfig.defaultAllowance ?? 0)
        : data.type === 'home_office'
        ? (targetPersona.homeOfficeDays ?? typeConfig.defaultAllowance ?? 0)
        : (typeConfig.defaultAllowance ?? 0);

    const totalDays =
      data.type === 'vacation'
        ? (targetPersona.vacationTotal ?? typeConfig.defaultAllowance ?? 0)
        : data.type === 'sick_day' || data.type === 'illness'
        ? (targetPersona.sickDaysTotal ?? typeConfig.defaultAllowance ?? 0)
        : data.type === 'home_office'
        ? (targetPersona.homeOfficeDays ?? typeConfig.defaultAllowance ?? 0)
        : (typeConfig.defaultAllowance ?? 0);

    const tempId = `${data.type}-${Date.now()}`;
    const newLeaveItem: LeaveRequestItem = {
      id: tempId,
      applicantId: targetPersona.id,
      userName: targetPersona.name,
      userRole: targetPersona.roleLabel,
      contract: targetPersona.contract,
      contractType: targetPersona.contractType,
      contractTypeName: targetPersona.contractTypeName,
      isPermanentHomeOffice: targetPersona.isPermanentHomeOffice,
      managerId: targetPersona.managerId,
      managerName: targetPersona.managerName,
      type: data.type as any,
      typeName: reqTypeLabel,
      startDate: data.startDate,
      endDate: effectiveEndDate,
      daysCount,
      remainingDays,
      totalDays,
      note: data.note || reqTypeLabel,
      status: isAutoApproved ? 'approved' : 'pending',
      createdAt: nowCreatedAt
    };

    setVacationRequests((prev) => [newLeaveItem, ...prev]);
    if (isManagingOther) {
      setInspectedVacationRequests((prev) => [newLeaveItem, ...prev]);
    }

    api.submitAbsence({
      userId: targetPersona.id,
      typeCode: data.type,
      startDate: data.startDate,
      endDate: effectiveEndDate,
      note: data.note || reqTypeLabel,
      autoApprove: canAutoApproveForOther ? true : undefined,
      approvedByUserId: isManagingOther ? activePersona.id : undefined
    }).then((res) => {
      if (!res || res.error || !res.data?.id) {
        setVacationRequests((prev) => prev.filter((r) => r.id !== tempId));
        if (isManagingOther) {
          setInspectedVacationRequests((prev) => prev.filter((r) => r.id !== tempId));
        }
        addToast('error', 'Nelze zadat absenci', res?.error?.message || 'Zvolený termín koliduje s jiným záznamem.');
        return;
      }
      const splitItems: any[] = (res.data as any)?.splitItems;
      if (Array.isArray(splitItems) && splitItems.length > 1) {
        const normalizedList = splitItems.map(normalizeVacationItem);
        setVacationRequests((prev) => [...normalizedList, ...prev.filter((r) => r.id !== tempId)]);
        if (isManagingOther) {
          setInspectedVacationRequests((prev) => [...normalizedList, ...prev.filter((r) => r.id !== tempId)]);
        }
        const splitDescs = splitItems.map((item) =>
          item.startDate === item.endDate
            ? `${formatDateCzech(item.startDate)} (${item.daysCount} d)`
            : `${formatDateCzech(item.startDate)} – ${formatDateCzech(item.endDate)} (${item.daysCount} d)`
        ).join(', ');
        addToast(
          'success',
          isAutoApproved ? `${reqTypeLabel} schváleno` : `Žádost (${reqTypeLabel}) podána`,
          `Žádost zasahovala přes přelom roku a byla automaticky rozdělena na ${splitItems.length} záznamy: ${splitDescs}.`
        );
      } else {
        const normalized = normalizeVacationItem(res.data);
        const finalApproved = normalized.status === 'approved';
        setVacationRequests((prev) => prev.map((r) => (r.id === tempId ? normalized : r)));
        if (isManagingOther) {
          setInspectedVacationRequests((prev) => prev.map((r) => (r.id === tempId ? normalized : r)));
        }
        addToast(
          'success',
          finalApproved ? `${reqTypeLabel} schváleno` : `Žádost (${reqTypeLabel}) podána`,
          daysCount > 1
            ? `${reqTypeLabel} (${targetPersona.name}) na termín ${formatDateCzech(data.startDate)} – ${formatDateCzech(effectiveEndDate)} (${daysCount} dní) bylo uloženo do databáze.`
            : `${reqTypeLabel} na ${formatDateCzech(data.startDate)} bylo uloženo do databáze.`
        );
      }
      void refreshUpcomingAbsences();
      setPersonaSyncCounter((c) => c + 1);
      void refreshTargetBalances();
    });
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
    } else if (!isManagingOther) {
      setNfcModalMode('out');
      setIsNfcModalOpen(true);
    } else {
      finishClockOut(false);
    }
  };

  const finishClockOut = (isPause: boolean, pauseTime?: string, nfcId?: string) => {
    const targetPersona = inspectedPersona || activePersona;
    const isManagingOther = Boolean(inspectedPersona && inspectedPersona.id !== activePersona.id);
    setIsHoLeaveModalOpen(false);
    setIsNfcModalOpen(false);

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const activeList = isManagingOther ? inspectedShifts : currentShifts;
    const openShift = [...activeList].reverse().find((s) => s.end === null);
    const isUnderOneMinuteLocal = Boolean(
      openShift?.startedAtMs && Date.now() - openShift.startedAtMs < 60000
    );

    const closeShiftWithVerification = (s: ShiftBlock): ShiftBlock => {
      if (s.end !== null) return s;
      if (s.location !== 'office') {
        return { ...s, end: timeStr };
      }
      const clockInVerified = s.method === 'nfc';
      const clockOutVerified = Boolean(nfcId) || isManagingOther;
      const finalIsVerified = clockInVerified && clockOutVerified;
      return {
        ...s,
        end: timeStr,
        method: finalIsVerified ? 'nfc' : 'web',
        locationName: finalIsVerified ? s.locationName : 'Kancelář (bez ověření)'
      };
    };

    if (isManagingOther) {
      setInspectedIsClockedIn(false);
      setInspectedWorkplaceName('Mimo práci');
      setInspectedShifts((prev) =>
        isUnderOneMinuteLocal
          ? prev.filter((s) => s.end !== null)
          : prev.map(closeShiftWithVerification)
      );
    } else {
      setIsClockedIn(false);
      setWorkplaceName('Mimo práci');
      setCurrentShifts((prev) =>
        isUnderOneMinuteLocal
          ? prev.filter((s) => s.end !== null)
          : prev.map(closeShiftWithVerification)
      );
    }

    // Send clock-out directly to SQLite database
    api.clockOut({
      userId: targetPersona.id,
      nfcIdentifier: nfcId,
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
        const wasOfficeShift = openShift?.location === 'office';
        const finalVerified = Boolean(res?.data?.workplaceId);
        addToast(
          'success',
          isManagingOther ? `Směna ukončena (${targetPersona.name})` : 'Směna ukončena v DB',
          wasOfficeShift && !finalVerified
            ? 'Směna uložena jako neověřená (Kancelář bez ověření), protože příchod nebo odchod proběhl bez NFC karty.'
            : 'Čas odchodu byl řádně uložen do databáze (UTC).'
        );
      }

      const whoRes = await api.getWhoIsWhere();
      if (whoRes?.data) setTeamPresence(whoRes.data);
      const statusRes = await api.getStatus(targetPersona.id);
      if (statusRes?.data) {
        const doctorTypeLabel = resolveAbsenceTypeConfig('doctor', absenceTypesMap).nameEmployee || 'Lékař';
        const syncedShifts: ShiftBlock[] | null = Array.isArray((statusRes.data as any).todayShifts)
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
              ) as 'nfc' | 'web' | 'request'
            }))
          : null;

        if (isManagingOther) {
          setInspectedHoursToday(statusRes.data.totalHoursWorkedToday ?? 0);
          if (syncedShifts) setInspectedShifts(syncedShifts);
        } else {
          setHoursToday(statusRes.data.totalHoursWorkedToday ?? 0);
          if (syncedShifts) setCurrentShifts(syncedShifts);
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

  // Simulated NFC Tap from Debug Simulator or Hardware NFC
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

    const currentlyIn = inspectedPersona ? inspectedIsClockedIn : isClockedIn;
    if (currentlyIn) {
      finishClockOut(false, undefined, identifier);
      return;
    }

    if (identifier === 'praha1') {
      handleClockInAction('office', 'Pobočka Praha 1 - Palmovka', 'praha1');
    } else if (identifier === 'brno1') {
      handleClockInAction('office', 'Pobočka Brno - Spielberk', 'brno1');
    } else {
      const matchedWp = workplaces.find((w) => w.nfcIdentifier === identifier);
      handleClockInAction('office', matchedWp?.name || 'Pobočka Praha 1 - Palmovka', identifier);
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

    // Vlastní žádosti patří výhradně do záložky „Moje žádosti“, v „Žádostech kolegů“ se nezobrazují
    if (applicantId === activeId || item.userName === activePersona.name) {
      return false;
    }

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

  const isModalReadOnly = (item: LeaveRequestItem | DoctorVisitItem | null): boolean => {
    if (!item) return true;
    if (item.status !== 'pending') return true;
    if (item.applicantId === activePersona.id || item.userName === activePersona.name) return true;

    const itemType = (item as any).type || 'vacation';
    const cfg = resolveAbsenceTypeConfig(itemType, absenceTypesMap);
    const approverRole =
      cfg.approverRole !== undefined
        ? cfg.approverRole
        : itemType === 'illness' || itemType === 'ocr'
        ? 'office_manager'
        : 'manager';

    if (!approverRole) return true;
    if (activePersona.role === 'admin') return false;

    if (approverRole === 'office_manager') {
      return activePersona.role !== 'office_manager';
    }

    if (approverRole === 'team_lead') {
      const applicantPersona = effectivePersonas.find(
        (p) => p.id.toLowerCase() === (item.applicantId || '').toLowerCase() || p.name === item.userName
      );
      const leadId = (item as any).parentPersonId || applicantPersona?.parentPersonId;
      return !leadId || leadId.toLowerCase() !== activePersona.id.toLowerCase();
    }

    if (approverRole === 'manager') {
      if (activePersona.role !== 'manager') return true;
      const applicantPersona = effectivePersonas.find(
        (p) => p.id.toLowerCase() === (item.applicantId || '').toLowerCase() || p.name === item.userName
      );
      const mgrId = item.managerId || applicantPersona?.managerId;
      return !mgrId || mgrId.toLowerCase() !== activePersona.id.toLowerCase();
    }

    return true;
  };

  // Všechny žádosti spadající pod "Žádosti kolegů" dle role
  const allColleagueVacations = vacationRequests.filter(matchesColleagueRoleScope);
  const allColleagueDoctors = doctorVisits.filter(matchesColleagueRoleScope);

  const totalManagerPendingCount =
    allColleagueVacations.filter(
      (r) => r.status === 'pending' && !r.isDeleted && !isModalReadOnly(r)
    ).length +
    allColleagueDoctors.filter((d) => d.status === 'pending' && !d.isDeleted && !isModalReadOnly(d)).length +
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

  // 2. Overtime (balance k aktuálnímu dni v měsíci, do mínusu i do plusu) + Saldo převedených přesčasů z měsíční uzávěrky
  const rawOvertimeHours = viewMonthSummary?.overtimeHours ?? viewPersona.overtimeHours ?? 0;
  const realOvertimeHours =
    Math.abs(rawOvertimeHours) >= 0.02 ? formatOvertime(rawOvertimeHours) : '0';
  const rawCarriedOverSaldoHours = viewMonthSummary?.carriedOverSaldoHours ?? 0;
  const realCarriedOverSaldoHours =
    Math.abs(rawCarriedOverSaldoHours) >= 0.02
      ? formatOvertime(rawCarriedOverSaldoHours)
      : '0';

  // Časové hranice pro Přehled a Stránku Žádosti (reagující na přechod přes půlnoc)
  const [currentYearStr, currentMonthStr] = currentDateIso.split('-');
  const currentYear = Number(currentYearStr);
  const currentMonth = Number(currentMonthStr); // 1..12
  const todayIsoStr = currentDateIso;

  const firstDayOfCurrentMonthStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
  const endOfCurrentMonthDate = new Date(currentYear, currentMonth, 0);
  const lastDayOfCurrentMonthStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(endOfCurrentMonthDate.getDate()).padStart(2, '0')}`;

  // Přehled: tento měsíc a následující měsíc
  const endOfNextMonthDate = new Date(currentYear, currentMonth + 1, 0);
  const lastDayOfNextMonthStr = `${endOfNextMonthDate.getFullYear()}-${String(endOfNextMonthDate.getMonth() + 1).padStart(2, '0')}-${String(endOfNextMonthDate.getDate()).padStart(2, '0')}`;

  // 3. Vacation (from DB balances, recalculated with working days excluding weekends & holidays)
  const hasVacationConfig = viewPersona.vacationTotal !== undefined && viewPersona.vacationTotal !== null;
  const usedVacationWorkingDaysThisYear = (viewMyVacations || [])
    .filter(
      (r) =>
        r &&
        !r.isDeleted &&
        r.type === 'vacation' &&
        (r.status === 'approved' || r.status === 'pending') &&
        String(r.startDate || '').startsWith(String(currentYear))
    )
    .reduce((sum, r) => sum + countWorkingDays(r.startDate, r.endDate || r.startDate), 0);
  const realVacationRemaining = viewPersona.id === 'anonymous' || !hasVacationConfig
    ? '—'
    : (viewMyVacations || []).length > 0 && viewPersona.vacationTotal !== undefined
    ? Math.max(0, viewPersona.vacationTotal - usedVacationWorkingDaysThisYear)
    : (viewPersona.vacationRemaining ?? 0);
  const realVacationTotal = viewPersona.id === 'anonymous' || !hasVacationConfig
    ? undefined
    : (viewPersona.vacationTotal ?? undefined);

  // 4. Sick days (from DB balances, recalculated with working days excluding weekends & holidays)
  const hasSickDaysConfig = viewPersona.sickDaysTotal !== undefined && viewPersona.sickDaysTotal !== null;
  const usedSickWorkingDaysThisYear = (viewMyVacations || [])
    .filter(
      (r) =>
        r &&
        !r.isDeleted &&
        r.type === 'sick_day' &&
        (r.status === 'approved' || r.status === 'pending') &&
        String(r.startDate || '').startsWith(String(currentYear))
    )
    .reduce((sum, r) => sum + countWorkingDays(r.startDate, r.endDate || r.startDate), 0);
  const realSickDaysRemaining = viewPersona.id === 'anonymous' || !hasSickDaysConfig
    ? '—'
    : (viewMyVacations || []).length > 0 && viewPersona.sickDaysTotal !== undefined
    ? Math.max(0, viewPersona.sickDaysTotal - usedSickWorkingDaysThisYear)
    : (viewPersona.sickDaysRemaining ?? 0);
  const realSickDaysTotal = viewPersona.id === 'anonymous' || !hasSickDaysConfig
    ? undefined
    : (viewPersona.sickDaysTotal ?? undefined);

  const countRequestDaysInCurrentMonth = (r: LeaveRequestItem): number => {
    const s = r.startDate || '';
    const e = r.endDate || s;
    if (!s || e < firstDayOfCurrentMonthStr || s > lastDayOfCurrentMonthStr) return 0;
    const effStart = s > firstDayOfCurrentMonthStr ? s : firstDayOfCurrentMonthStr;
    const effEnd = e < lastDayOfCurrentMonthStr ? e : lastDayOfCurrentMonthStr;
    return countWorkingDays(effStart, effEnd);
  };

  // 5. Approved illness days (current month)
  const realIllnessDays = viewPersona.id === 'anonymous'
    ? '—'
    : (viewMyVacations || [])
        .filter((r) => r && !r.isDeleted && r.type === 'illness' && r.status === 'approved')
        .reduce((sum, r) => sum + countRequestDaysInCurrentMonth(r), 0);

  // 5b. Approved OČR days (current month)
  const realOcrDays = viewPersona.id === 'anonymous'
    ? '—'
    : (viewMyVacations || [])
        .filter((r) => r && !r.isDeleted && r.type === 'ocr' && r.status === 'approved')
        .reduce((sum, r) => sum + countRequestDaysInCurrentMonth(r), 0);

  // 6. Approved doctor hours (current month)
  const realDoctorHours = viewPersona.id === 'anonymous'
    ? '—'
    : (viewMyDoctors || [])
        .filter((d) => {
          if (!d || d.isDeleted || d.status !== 'approved') return false;
          const docDate = d.date || (d as any).startDate || '';
          return docDate >= firstDayOfCurrentMonthStr && docDate <= lastDayOfCurrentMonthStr;
        })
        .reduce((sum, d) => {
          const sTime = typeof d.startTime === 'string' && d.startTime.includes(':') ? d.startTime : '08:00';
          const eTime = typeof d.endTime === 'string' && d.endTime.includes(':') ? d.endTime : '12:00';
          const [sh, sm] = sTime.split(':').map(Number);
          const [eh, em] = eTime.split(':').map(Number);
          const hours = Math.max(0, ((eh || 0) + (em || 0) / 60) - ((sh || 0) + (sm || 0) / 60));
          return sum + Math.round(hours * 10) / 10;
        }, 0);

  // 7. Home Office (na Přehledu dle nastaveného limitu: roční "10/10 rok", měsíční "9/10 měsíc", týdenní "9/10 týden")
  const effectiveHoPeriod = (() => {
    if (viewPersona.isPermanentHomeOffice) return 'unlimited';
    if (viewPersona.homeOfficePeriod) return viewPersona.homeOfficePeriod;
    const hoCfg = absenceTypesMap?.home_office;
    if (hoCfg) {
      if (hoCfg.defaultBudgetPeriod === 'yearly' && hoCfg.defaultAllowance !== null && hoCfg.defaultAllowance !== undefined) {
        return Number(hoCfg.defaultAllowance) === 0 ? 'disabled' : 'yearly';
      }
      if (hoCfg.defaultBudgetPeriod === 'monthly' && (hoCfg.defaultAllowance || hoCfg.maxPerMonthLimit)) {
        return 'monthly';
      }
      if (hoCfg.defaultBudgetPeriod === 'weekly' && hoCfg.defaultAllowance !== null && hoCfg.defaultAllowance !== undefined) {
        return Number(hoCfg.defaultAllowance) === 0 ? 'disabled' : 'weekly';
      }
      if (hoCfg.maxPerMonthLimit && hoCfg.maxPerMonthLimit > 0) {
        return 'monthly';
      }
      if (hoCfg.defaultBudgetPeriod === 'unlimited') {
        return 'unlimited';
      }
    }
    if (viewPersona.homeOfficeDays !== undefined && viewPersona.homeOfficeDays !== null) {
      return viewPersona.homeOfficeDays === 0 ? 'disabled' : 'weekly';
    }
    return 'unlimited';
  })();

  const effectiveHoLimit = (() => {
    if (effectiveHoPeriod === 'unlimited' || effectiveHoPeriod === 'disabled') return undefined;
    if (viewPersona.homeOfficeDaysLimit !== undefined && viewPersona.homeOfficeDaysLimit !== null && viewPersona.homeOfficeDaysLimit > 0) {
      return Number(viewPersona.homeOfficeDaysLimit);
    }
    if (viewPersona.homeOfficeTotal !== undefined && viewPersona.homeOfficeTotal !== null && viewPersona.homeOfficeTotal > 0) {
      return Number(viewPersona.homeOfficeTotal);
    }
    if (viewPersona.homeOfficeDays !== undefined && viewPersona.homeOfficeDays !== null && viewPersona.homeOfficeDays > 0) {
      return Number(viewPersona.homeOfficeDays);
    }
    const hoCfg = absenceTypesMap?.home_office;
    if (effectiveHoPeriod === 'monthly' && hoCfg?.maxPerMonthLimit) {
      return Number(hoCfg.maxPerMonthLimit);
    }
    if (hoCfg?.defaultAllowance) {
      return Number(hoCfg.defaultAllowance);
    }
    return undefined;
  })();

  const countRequestDaysInRange = (r: LeaveRequestItem, minDateStr: string, maxDateStr: string): number => {
    const s = r.startDate || '';
    const e = r.endDate || s;
    if (!s || e < minDateStr || s > maxDateStr) return 0;
    const effStart = s > minDateStr ? s : minDateStr;
    const effEnd = e < maxDateStr ? e : maxDateStr;
    return countWorkingDays(effStart, effEnd);
  };

  const nowDateForWeek = new Date();
  const dayOfWeekIdx = nowDateForWeek.getDay() === 0 ? 6 : nowDateForWeek.getDay() - 1;
  const weekMondayDate = new Date(nowDateForWeek.getFullYear(), nowDateForWeek.getMonth(), nowDateForWeek.getDate() - dayOfWeekIdx);
  const weekSundayDate = new Date(weekMondayDate.getFullYear(), weekMondayDate.getMonth(), weekMondayDate.getDate() + 6);
  const currentWeekMondayStr = `${weekMondayDate.getFullYear()}-${String(weekMondayDate.getMonth() + 1).padStart(2, '0')}-${String(weekMondayDate.getDate()).padStart(2, '0')}`;
  const currentWeekSundayStr = `${weekSundayDate.getFullYear()}-${String(weekSundayDate.getMonth() + 1).padStart(2, '0')}-${String(weekSundayDate.getDate()).padStart(2, '0')}`;
  const currentYearStartStr = `${currentYear}-01-01`;
  const currentYearEndStr = `${currentYear}-12-31`;

  const activeHoRequests = (viewMyVacations || []).filter(
    (r) => r && !r.isDeleted && r.type === 'home_office' && (r.status === 'approved' || r.status === 'pending')
  );

  const usedHoInPeriod = (() => {
    if (effectiveHoPeriod === 'yearly') {
      const reqDays = activeHoRequests.reduce((sum, r) => sum + countRequestDaysInRange(r, currentYearStartStr, currentYearEndStr), 0);
      return Math.max(reqDays, viewPersona.homeOfficeUsed ?? 0);
    }
    if (effectiveHoPeriod === 'monthly') {
      const reqDays = activeHoRequests.reduce((sum, r) => sum + countRequestDaysInCurrentMonth(r), 0);
      return Math.max(reqDays, viewPersona.homeOfficeUsed ?? 0);
    }
    if (effectiveHoPeriod === 'weekly') {
      const reqDays = activeHoRequests.reduce((sum, r) => sum + countRequestDaysInRange(r, currentWeekMondayStr, currentWeekSundayStr), 0);
      const todayHasHoShift = viewCurrentShifts.some((s) => s.location === 'home_office');
      const todayCoveredByReq = activeHoRequests.some((r) => r.startDate <= todayIsoStr && (r.endDate || r.startDate) >= todayIsoStr);
      return Math.max(reqDays + (todayHasHoShift && !todayCoveredByReq ? 1 : 0), viewPersona.homeOfficeUsed ?? 0);
    }
    return 0;
  })();

  const hasHoLimit =
    (effectiveHoPeriod === 'yearly' || effectiveHoPeriod === 'monthly' || effectiveHoPeriod === 'weekly') &&
    effectiveHoLimit !== undefined &&
    effectiveHoLimit > 0;

  const realHomeOfficeDays: number | string =
    viewPersona.id === 'anonymous' || effectiveHoPeriod === 'disabled'
      ? '—'
      : hasHoLimit
      ? Math.max(0, effectiveHoLimit! - usedHoInPeriod)
      : '—';

  const realHomeOfficeTotal: number | undefined =
    viewPersona.id === 'anonymous' || !hasHoLimit ? undefined : effectiveHoLimit;

  const realHomeOfficeUnit: string | undefined =
    effectiveHoPeriod === 'yearly'
      ? 'rok'
      : effectiveHoPeriod === 'monthly'
      ? 'měsíc'
      : effectiveHoPeriod === 'weekly'
      ? 'týden'
      : 'd';

  const hasApprovedHoToday = (viewMyVacations || []).some(
    (r) =>
      r &&
      !r.isDeleted &&
      r.status === 'approved' &&
      r.type === 'home_office' &&
      r.startDate <= todayIsoStr &&
      (r.endDate || r.startDate) >= todayIsoStr
  );
  const canLogHomeOffice =
    Boolean(viewPersona.isPermanentHomeOffice) ||
    effectiveHoPeriod === 'unlimited' ||
    hasApprovedHoToday;

  // 8. Approved unpaid leave days (current month)
  const realUnpaidDays = viewPersona.id === 'anonymous'
    ? '—'
    : (viewMyVacations || [])
        .filter((r) => r && !r.isDeleted && r.type === 'unpaid_leave' && r.status === 'approved')
        .reduce((sum, r) => sum + countRequestDaysInCurrentMonth(r), 0);

  // Stránka Žádosti: tento rok + příští rok + (aktuální měsíc - 1, což v lednu zobrazí i prosinec předchozího roku)
  const requestsPageMinDateStr = currentMonth === 1 ? `${currentYear - 1}-12-01` : `${currentYear}-01-01`;
  const requestsPageMaxDateStr = `${currentYear + 1}-12-31`;

  // Pravidlo pro Žádosti na Přehledu (Moje žádosti):
  // - smazané žádosti (isDeleted) se na přehledu nezobrazují
  // - čekající žádosti (pending) se zobrazí vždy
  // - pro ostatní žádosti platí pravidlo: aktuální datum <= datum od (todayIsoStr <= sDate)
  // - zamítnuté žádosti (rejected) se zobrazí vždy (dokud je datum od >= dnes)
  // - schválené nepřečtené žádosti (approved && !isRead)
  // - + schválené přečtené žádosti, které se týkají tohoto měsíce a následujícího měsíce
  const isVisibleOnDashboard = (
    startDate: string,
    endDate: string,
    status: string,
    isRead?: boolean,
    isDeleted?: boolean
  ): boolean => {
    if (isDeleted) return false;
    if (status === 'pending') return true;
    const sDate = startDate || '';
    if (sDate < todayIsoStr) return false;
    if (status === 'rejected') return true;
    if (status === 'approved') {
      if (!isRead) return true;
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

  // 1a. Moje žádosti na Přehledu (nebo žádosti prohlížené osoby v Detailu osoby na záložce Přehled)
  const dashboardMyVacations = (viewMyVacations || []).filter((r) => {
    if (!r || r.isDeleted) return false;
    return isVisibleOnDashboard(r.startDate, r.endDate || r.startDate, r.status, r.isRead, r.isDeleted);
  });

  const dashboardMyDoctors = (viewMyDoctors || []).filter((d) => {
    if (!d || d.isDeleted) return false;
    const visitDate = d.date || (d as any).startDate || '';
    return isVisibleOnDashboard(visitDate, visitDate, d.status, d.isRead, d.isDeleted);
  });

  const myDashboardCount = dashboardMyVacations.length + dashboardMyDoctors.length;

  // 1b. Žádosti kolegů na Přehledu (pouze čekající žádosti, které mohu schválit, nesmazané)
  const colleagueDashboardVacations = useMemo(() => {
    if (activePersona.role === 'colleague') return [];
    return allColleagueVacations.filter((r) => r.status === 'pending' && !r.isDeleted && !isModalReadOnly(r));
  }, [allColleagueVacations, activePersona.role, effectivePersonas, absenceTypesMap]);

  const colleagueDashboardDoctors = useMemo(() => {
    if (activePersona.role === 'colleague') return [];
    return allColleagueDoctors.filter((d) => d.status === 'pending' && !d.isDeleted && !isModalReadOnly(d));
  }, [allColleagueDoctors, activePersona.role, effectivePersonas, absenceTypesMap]);

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

  const canActivePersonaApprove =
    activePersona.role === 'team_lead' ||
    activePersona.role === 'manager' ||
    activePersona.role === 'admin' ||
    activePersona.role === 'office_manager';

  // V Detailu osoby zobrazujeme vždy jen žádosti té konkrétní osoby
  const isColleaguesTab = !inspectedPersona && activePersona.role !== 'colleague' && dashboardRequestsTab === 'colleagues';
  const displayedDashboardVacations = isColleaguesTab ? colleagueDashboardVacations : dashboardMyVacations;
  const displayedDashboardDoctors = isColleaguesTab ? colleagueDashboardDoctors : dashboardMyDoctors;
  const totalDisplayedDashboardCount = displayedDashboardVacations.length + displayedDashboardDoctors.length;

  const dashboardTimelineShifts = useMemo<ShiftBlock[]>(() => {
    const baseShifts = viewCurrentShifts.filter((s) => s.location !== 'doctor');
    const todayApprovedDocs = (viewMyDoctors || []).filter(
      (d) => d && !d.isDeleted && d.status === 'approved' && (d.date === todayIsoStr || (d as any).startDate === todayIsoStr)
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

  const canEditOwnPendingRequest = (item: LeaveRequestItem | DoctorVisitItem | null): boolean => {
    if (!item || item.status !== 'pending') return false;
    return (
      item.applicantId?.toLowerCase() === activePersona.id.toLowerCase() ||
      item.userName === activePersona.name
    );
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
      return { hasAbsence: false, label: undefined, type: undefined };
    }
      const activeLeave = (viewMyVacations || []).find((r) => {
        if (!r || r.isDeleted || r.status !== 'approved') return false;
        const cfg = resolveAbsenceTypeConfig(r.type, absenceTypesMap);
        if (cfg.isWorkMode || cfg.durationMode === 'hours') return false;
        return r.startDate <= todayIsoStr && (r.endDate || r.startDate) >= todayIsoStr;
      });
      if (activeLeave) {
        const label = getAbsenceTypeLabel(
          activeLeave.type,
          absenceTypesMap,
          viewPersona.contract === 'OSVČ'
        );
        return { hasAbsence: true, label, type: activeLeave.type as StatusType };
      }

      const pStatus = getPersonaStatus(viewPersona);
      if (
        pStatus &&
        (pStatus.locationType === 'vacation' ||
          pStatus.locationType === 'sick_day' ||
          pStatus.locationType === 'unpaid_leave' ||
          pStatus.locationType === 'illness' ||
          pStatus.locationType === 'ocr')
      ) {
        return { hasAbsence: true, label: pStatus.statusText, type: pStatus.locationType as StatusType };
      }
    return { hasAbsence: false, label: undefined, type: undefined };
  }, [viewPersona, viewMyVacations, todayIsoStr, teamPresence, vacationRequests]);


  const effectiveActiveGdprStatus = activeGdprOverview?.currentStatus ?? activePersona.gdprStatus;
  const hasActiveGdprDoc = Boolean(activeGdprOverview?.activeGdprId || activePersona.activeGdprDocumentId);
  const isGdprActionRequired = Boolean(
    activePersona.id !== 'anonymous' &&
      activePersona.id !== 'clean-uninstalled' &&
      activePersona.isApproved !== false &&
      hasActiveGdprDoc &&
      effectiveActiveGdprStatus === 'unfilled'
  );

  // Bod 2: Pokud uživatel cestuje po aplikaci a nemá vyplněné GDPR, vždy mu zobrazíme Přehled
  useEffect(() => {
    if (isGdprActionRequired) {
      if (activeNavTab !== 'dochazka') {
        setActiveNavTab('dochazka');
      }
      if (inspectedPersona !== null) {
        setInspectedPersona(null);
      }
    }
  }, [isGdprActionRequired, activeNavTab, inspectedPersona]);

  const handleSubmitGdprConsent = async (isGranted: boolean) => {
    const desiredStatus: 'granted' | 'revoked' = isGranted ? 'granted' : 'revoked';
    const currentStatus = activeGdprOverview?.currentStatus ?? activePersona.gdprStatus ?? 'unfilled';

    // Pokud uživatel vybere stejnou volbu, v jaké nyní GDPR je, nic neaktualizujeme a modál jen zavřeme (Bod 3)
    if (currentStatus === desiredStatus) {
      setIsGdprConsentModalOpen(false);
      return;
    }

    setIsSubmittingGdprConsent(true);
    try {
      const res = await api.submitGdprConsent({
        userId: activePersona.id,
        userEmail: activePersona.email,
        gdprDocumentId: activeGdprOverview?.activeGdprId || undefined,
        isGranted
      });
      if (res?.error) {
        addToast('error', 'Chyba uložení GDPR', res.error.message || 'Nepodařilo se uložit volbu GDPR.');
        return;
      }

      setActivePersona((prev) => ({ ...prev, gdprStatus: desiredStatus }));
      const [gdprRes, whoRes] = await Promise.all([
        api.getUserGdprOverview(activePersona.id),
        api.getWhoIsWhere()
      ]);
      if (gdprRes?.data) {
        setActiveGdprOverview(gdprRes.data);
      }
      if (whoRes?.data) {
        setTeamPresence(whoRes.data);
      }
      void refreshUpcomingAbsences();
      setIsGdprConsentModalOpen(false);
      addToast(
        'success',
        isGranted ? 'Souhlas GDPR udělen' : 'Nesouhlas GDPR uložen',
        isGranted
          ? 'Váš souhlas se zpracováním údajů GDPR byl uložen.'
          : 'Váš nesouhlas se zpracováním údajů GDPR byl uložen.'
      );
    } finally {
      setIsSubmittingGdprConsent(false);
    }
  };

  return (
    <div className="min-h-screen pb-24 bg-[#f8fafc] dark:bg-[#09090b] text-slate-900 dark:text-zinc-100 transition-colors">
      {/* Dev Mode Role & Persona Bar (100% full width, solid yellow like NFC simulator) */}
      <DevToolbar
        isDevVisible={isDevVisible}
        onCloseDevMode={() => setIsDevVisible(false)}
        isDbConnected={isDbConnected}
        dbMode={dbMode}
        onSwitchDatabaseMode={handleSwitchDatabaseMode}
        onWipeCleanDb={handleWipeCleanDb}
        isWipingCleanDb={isWipingCleanDb}
        onResetDevDb={handleResetDevDb}
        isResettingDevDb={isResettingDevDb}
        onClearLogs={handleClearLogs}
        isClearingLogs={isClearingLogs}
        onResetGdpr={handleResetGdpr}
        isResettingGdpr={isResettingGdpr}
        devConfig={devConfig}
        onOpenDevConfigModal={() => setIsDevConfigModalOpen(true)}
        cleanInstalled={cleanInstalled}
        cleanAdminUser={cleanAdminUser}
        dbStatus={dbStatus}
        activePersona={activePersona}
        effectivePersonas={effectivePersonas}
        onSwitchPersona={handleSwitchPersona}
      />

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
        personasList={personasList}
        getPersonaStatus={getPersonaStatus}
        onSelectPersona={(p) => setInspectedPersona(p)}
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
            <div
              className={
                isGdprActionRequired
                  ? 'opacity-40 pointer-events-none select-none transition-opacity'
                  : ''
              }
            >
              <AppNavigation
                activeTab={activeNavTab}
                onTabChange={(tab) => {
                  setInspectedPersona(null);
                  setActiveNavTab(tab);
                  setIsMobileNavOpen(false);
                }}
                userRole={activePersona.role}
                pendingRequestsCount={totalManagerPendingCount}
                pendingClosuresCount={0}
                trashCount={deletedAbsences.length + deletedTimeEntries.length}
                isMobileMenuOpen={isMobileNavOpen}
                onCloseMobileMenu={() => setIsMobileNavOpen(false)}
              />
            </div>

            {/* Hlavní obsahový sloupec */}
            <main className="flex-1 min-w-0 space-y-6">

          {/* DETAIL OSOBY NEBO ZÁLOŽKA 1: PŘEHLED DOCHÁZKY (DASHBOARD) */}
          {(isGdprActionRequired || inspectedPersona !== null || activeNavTab === 'dochazka') && (
            <DashboardView
              activePersona={viewPersona}
              viewerPersona={activePersona}
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
              realCarriedOverSaldoHours={realCarriedOverSaldoHours}
              realVacationRemaining={realVacationRemaining}
              realVacationTotal={realVacationTotal}
              realSickDaysRemaining={realSickDaysRemaining}
              realSickDaysTotal={realSickDaysTotal}
              realIllnessDays={realIllnessDays}
              realOcrDays={realOcrDays}
              realDoctorHours={realDoctorHours}
              realHomeOfficeDays={realHomeOfficeDays}
              realHomeOfficeTotal={realHomeOfficeTotal}
              realHomeOfficeUnit={realHomeOfficeUnit}
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
                  setNfcModalMode('in');
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
              allPersonVacations={viewMyVacations}
              allPersonDoctors={viewMyDoctors}
              upcomingAbsences={upcomingAbsences}
              onOpenAbsenceDetail={handleOpenAbsenceDetail}
              absencesRefreshTrigger={absencesRefreshTrigger}
              onDataChanged={() => setPersonaSyncCounter((c) => c + 1)}
              onDeleteRequest={promptDeleteAbsence}
              onDeleteAbsenceItem={promptDeleteAbsence}
              onRestoreRequest={(item) => handleRestoreAbsence(item.id)}
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
              contractTypes={contractTypes}
              handleApproveUser={handleApproveUser}
              addToast={addToast}
              isPersonDetailView={inspectedPersona !== null}
              onClosePersonDetail={() => setInspectedPersona(null)}
              onSelectPersona={(p) => setInspectedPersona(p)}
              hasFullDayAbsenceToday={fullDayAbsenceStatusToday.hasAbsence}
              fullDayAbsenceLabel={fullDayAbsenceStatusToday.label}
              fullDayAbsenceType={fullDayAbsenceStatusToday.type}
              hasApprovedHomeOfficeToday={hasApprovedHoToday}
              absenceTypesMap={absenceTypesMap}
              canTogglePermanentHomeOffice={
                inspectedPersona !== null &&
                ['admin', 'office_manager', 'manager'].includes(activePersona.role)
              }
              onTogglePermanentHomeOffice={handleTogglePermanentHomeOffice}
              onEditPerson={(p) => setEditingPersona(p)}
              onSettingsPerson={(p) => setSettingsPersona(p)}
              onDeletePerson={(p) => setDeletingPersona(p)}
              isGdprActionRequired={isGdprActionRequired}
              onOpenGdprConsentModal={() => setIsGdprConsentModalOpen(true)}
              personGdprOverview={inspectedPersona ? inspectedGdprOverview : activeGdprOverview}
              isPersonGdprLoading={isInspectedGdprLoading}
            />
          )}

          {/* ZÁLOŽKA: ŽÁDOSTI & PROVOZNÍ AGENDA */}
          {!isGdprActionRequired && inspectedPersona === null && activeNavTab === 'zadosti' && (
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
              contractTypes={contractTypes}
              handleApproveUser={handleApproveUser}
              onOpenNewRequestModal={(initialType?: any) => {
                setNewRequestInitialType(initialType || 'vacation');
                setIsNewRequestModalOpen(true);
              }}
              onOpenVacationModal={handleOpenVacationModal}
              onOpenDoctorModal={handleOpenDoctorModal}
              onApproveVacation={handleApproveVacation}
              onApproveDoctor={handleApproveDoctor}
              onDeleteRequest={promptDeleteAbsence}
              onRestoreRequest={(item) => handleRestoreAbsence(item.id)}
              addToast={addToast}
              absenceTypesMap={absenceTypesMap}
            />
          )}

          {/* ZÁLOŽKA 2: MOJE VÝKAZY */}
          {!isGdprActionRequired && inspectedPersona === null && activeNavTab === 'vykazy' && (
            <MyTimesheetView
              activePersona={activePersona}
              viewerPersona={activePersona}
              isClockedIn={isClockedIn}
              activeLocation={activeLocation}
              clockInTime={clockInTime}
              workplaceName={workplaceName}
              hoursToday={hoursToday}
              currentShifts={currentShifts}
              dailyTargetHours={realDailyTargetHours}
              myVacationRequests={myVacationRequests}
              myDoctorVisits={myDoctorVisits}
              absenceTypesMap={absenceTypesMap}
              addToast={addToast}
              onEntriesChanged={() => setPersonaSyncCounter((c) => c + 1)}
              onOpenVacationModal={handleOpenVacationModal}
              onOpenDoctorModal={handleOpenDoctorModal}
              onDeleteAbsenceRequest={promptDeleteAbsence}
            />
          )}

          {/* ZÁLOŽKA: ABSENCE (Měsíční přehled absencí) */}
          {!isGdprActionRequired && inspectedPersona === null && activeNavTab === 'absence' && (
            <AbsencesView
              personasList={personasList}
              viewerPersona={activePersona}
              absenceTypesMap={absenceTypesMap}
              onOpenAbsenceDetail={handleOpenAbsenceDetail}
              refreshTrigger={absencesRefreshTrigger}
              canDelete={activePersona.role === 'admin' || activePersona.role === 'office_manager'}
              onDeleteAbsence={promptDeleteAbsence}
            />
          )}

          {/* ZÁLOŽKA 3: OSOBY */}
          {!isGdprActionRequired && inspectedPersona === null && activeNavTab === 'osoby' && (
            <PersonsView
              personasList={personasList}
              activePersona={activePersona}
              getPersonaStatus={getPersonaStatus}
              onSelectPersona={(p) => setInspectedPersona(p)}
              contractTypes={contractTypes}
              addToast={addToast}
              onReloadUsers={async () => {
                const whoRes = await api.getWhoIsWhere();
                if (whoRes?.data) setTeamPresence(whoRes.data);
                setPersonaSyncCounter((c) => c + 1);
              }}
            />
          )}

          {/* ZÁLOŽKA 4: MĚSÍČNÍ UZÁVĚRKY */}
          {!isGdprActionRequired && inspectedPersona === null && activeNavTab === 'uzaverky' && (
            <ClosuresView
              personasList={personasList}
              activePersona={activePersona}
              baseDailyHours={companySettings?.dailyHours}
              absenceTypesMap={absenceTypesMap}
              addToast={addToast}
              onClosuresChanged={() => setPersonaSyncCounter((c) => c + 1)}
              onOpenMonthlyDetail={(p, year, monthIndex0) => {
                setSelectedMonthlyPersona(p);
                setSelectedMonthlyYear(year);
                setSelectedMonthlyMonth(monthIndex0);
                setIsMonthlyModalOpen(true);
              }}
            />
          )}

          {/* ZÁLOŽKA 5: NASTAVENÍ SYSTÉMU */}
          {!isGdprActionRequired && inspectedPersona === null && activeNavTab === 'nastaveni' && (
            <SettingsView
              activeRole={activePersona.role}
              devConfig={devConfig}
              dbMode={dbMode}
              companySettings={companySettings}
              absenceTypesMap={absenceTypesMap}
              contractTypes={contractTypes}
              onSaveCompanySettings={async (newSettings) => {
                const res = await api.updateCompanySettings(newSettings);
                if (res?.data) {
                  setCompanySettings(res.data);
                }
              }}
              onSaveAbsenceTypes={async (updatedTypes) => {
                const res = await api.updateAbsenceTypes(updatedTypes);
                if (res?.data && res.data.length > 0) {
                  const nextMap: Record<string, AbsenceTypeConfigDto> = {};
                  for (const t of res.data) {
                    nextMap[t.code] = t;
                  }
                  syncAbsenceTypeLabels(nextMap);
                  setAbsenceTypesMap(nextMap);
                  setVacationRequests((prev) =>
                    prev.map((r) => ({
                      ...r,
                      typeName:
                        r.type === 'unavailable'
                          ? 'Nedostupný'
                          : getAbsenceTypeLabel(r.type, nextMap, r.contract === 'OSVČ')
                    }))
                  );
                  setInspectedVacationRequests((prev) =>
                    prev.map((r) => ({
                      ...r,
                      typeName:
                        r.type === 'unavailable'
                          ? 'Nedostupný'
                          : getAbsenceTypeLabel(r.type, nextMap, r.contract === 'OSVČ')
                    }))
                  );
                  setDoctorVisits((prev) =>
                    prev.map((d) => ({
                      ...d,
                      typeName: getAbsenceTypeLabel(d.type || 'doctor', nextMap, d.contract === 'OSVČ')
                    }))
                  );
                  setInspectedDoctorVisits((prev) =>
                    prev.map((d) => ({
                      ...d,
                      typeName: getAbsenceTypeLabel(d.type || 'doctor', nextMap, d.contract === 'OSVČ')
                    }))
                  );
                  setPersonaSyncCounter((c) => c + 1);
                  void handleReloadUsers();
                  void refreshUpcomingAbsences();
                  addToast('success', 'Nastavení uloženo v DB', 'Číselník absencí byl uložen do databáze.');
                }
              }}
              onContractTypesChanged={async () => {
                const res = await api.getContractTypes();
                if (res?.data) {
                  setContractTypes(res.data);
                }
                setPersonaSyncCounter((c) => c + 1);
              }}
              onWorkplacesChanged={async () => {
                const res = await api.getWorkplaces();
                if (res?.data) {
                  setWorkplaces(res.data);
                }
              }}
              onGdprChanged={async () => {
                const [whoRes, gdprRes] = await Promise.all([
                  api.getWhoIsWhere(),
                  activePersona.id && activePersona.id !== 'anonymous'
                    ? api.getUserGdprOverview(activePersona.id)
                    : Promise.resolve(null)
                ]);
                if (whoRes?.data) setTeamPresence(whoRes.data);
                if (gdprRes?.data) setActiveGdprOverview(gdprRes.data);
                void refreshUpcomingAbsences();
                setPersonaSyncCounter((c) => c + 1);
              }}
              onOpenDevModal={() => setIsDevConfigModalOpen(true)}
              onSwitchDbMode={handleSwitchDatabaseMode}
              onResetDevDb={handleResetDevDb}
              onWipeCleanDb={handleWipeCleanDb}
              isResettingDevDb={isResettingDevDb}
              isWipingCleanDb={isWipingCleanDb}
              addToast={addToast}
            />
          )}

          {/* ZÁLOŽKA 6: OBSAH KOŠE (Admin & Office Manager) */}
          {!isGdprActionRequired && inspectedPersona === null && activeNavTab === 'kos' && (
            <TrashView
              personasList={personasList}
              absenceTypesMap={absenceTypesMap}
              deletedAbsences={deletedAbsences}
              deletedTimeEntries={deletedTimeEntries}
              onRestoreAbsence={handleRestoreAbsence}
              onRestoreTimeEntry={handleRestoreTimeEntry}
              onOpenAbsenceDetail={handleOpenAbsenceDetail}
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
        applicantContract={viewPersona.contract}
        applicantContractType={viewPersona.contractType}
        applicantContractTypeName={viewPersona.contractTypeName}
        isPermanentHomeOffice={viewPersona.isPermanentHomeOffice}
        managerName={inspectedPersona ? undefined : viewPersona.managerName}
        vacationRemaining={typeof realVacationRemaining === 'number' ? realVacationRemaining : viewPersona.vacationRemaining}
        vacationTotal={realVacationTotal ?? viewPersona.vacationTotal}
        sickDaysRemaining={typeof realSickDaysRemaining === 'number' ? realSickDaysRemaining : viewPersona.sickDaysRemaining}
        sickDaysTotal={realSickDaysTotal ?? viewPersona.sickDaysTotal}
        initialType={newRequestInitialType}
        isManagingOtherPerson={inspectedPersona !== null}
        canBypassAbsenceRules={Boolean(
          inspectedPersona &&
            inspectedPersona.id !== activePersona.id &&
            ['admin', 'office_manager', 'manager'].includes(activePersona.role)
        )}
        absenceTypesMap={absenceTypesMap}
        existingRequests={(viewMyVacations || []).filter((r) => !r.isDeleted)}
        existingDoctorVisits={(viewMyDoctors || []).filter((d) => !d.isDeleted)}
        todayShifts={viewCurrentShifts}
      />

      {/* MODALS: Příchod (Výběr pracoviště, NFC, Odchod z Home Office) */}
      <AttendanceClockModals
        isWorkplaceSelectModalOpen={isWorkplaceSelectModalOpen}
        onCloseWorkplaceSelectModal={() => setIsWorkplaceSelectModalOpen(false)}
        viewPersonaName={viewPersona.name}
        workplaces={workplaces}
        onClockInAction={handleClockInAction}
        isNfcModalOpen={isNfcModalOpen}
        nfcModalMode={nfcModalMode}
        onCloseNfcModal={() => setIsNfcModalOpen(false)}
        isHoLeaveModalOpen={isHoLeaveModalOpen}
        onCloseHoLeaveModal={() => setIsHoLeaveModalOpen(false)}
        pauseReturnTime={pauseReturnTime}
        onChangePauseReturnTime={setPauseReturnTime}
        onFinishClockOut={finishClockOut}
        isPermanentHomeOffice={viewPersona.isPermanentHomeOffice}
        hasApprovedHomeOfficeToday={hasApprovedHoToday}
        canLogHomeOffice={canLogHomeOffice}
      />

      {/* MODAL 7: Detail a schválení žádosti o dovolenou */}
      {selectedVacation && (
        <LeaveRequestModal
          request={selectedVacation}
          isOpen={isVacationModalOpen}
          onClose={() => {
            if (selectedVacation.isRead) {
              setVacationRequests((prev) =>
                prev.map((r) => (r.id === selectedVacation.id && !r.isRead ? { ...r, isRead: true } : r))
              );
            }
            setIsVacationModalOpen(false);
          }}
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
          personasList={effectivePersonas}
          canAdminEdit={activePersona.role === 'admin' || activePersona.role === 'office_manager'}
          canRestore={activePersona.role === 'admin' || activePersona.role === 'office_manager'}
          onRestore={() => handleRestoreAbsence(selectedVacation.id)}
          canEditOwnPending={canEditOwnPendingRequest(selectedVacation)}
          onSaveOnly={handleSaveVacationOnly}
          onValidateOverlap={handleValidateAbsenceOverlap}
          onOpenApplicantDetail={getApplicantDetailHandler(selectedVacation)}
        />
      )}

      {/* MODAL 8: Ověření propustky k lékaři */}
      {selectedDoctor && (
        <DoctorVisitModal
          request={selectedDoctor}
          isOpen={isDoctorModalOpen}
          onClose={() => {
            if (selectedDoctor.isRead) {
              setDoctorVisits((prev) =>
                prev.map((d) => (d.id === selectedDoctor.id && !d.isRead ? { ...d, isRead: true } : d))
              );
            }
            setIsDoctorModalOpen(false);
          }}
          onApprove={handleApproveDoctor}
          onReject={handleRejectDoctor}
          onRenew={handleRenewDoctor}
          readOnly={isModalReadOnly(selectedDoctor)}
          canRenew={canRenewRequest(selectedDoctor)}
          canMarkAsRead={canMarkRequestAsRead(selectedDoctor)}
          onMarkAsRead={handleMarkRequestAsRead}
          isManagingOtherPerson={inspectedPersona !== null}
          absenceTypesMap={absenceTypesMap}
          personasList={effectivePersonas}
          canAdminEdit={activePersona.role === 'admin' || activePersona.role === 'office_manager'}
          canRestore={activePersona.role === 'admin' || activePersona.role === 'office_manager'}
          onRestore={() => handleRestoreAbsence(selectedDoctor.id)}
          canEditOwnPending={canEditOwnPendingRequest(selectedDoctor)}
          onSaveOnly={handleSaveDoctorOnly}
          onValidateOverlap={handleValidateAbsenceOverlap}
          onOpenApplicantDetail={getApplicantDetailHandler(selectedDoctor)}
        />
      )}

      {/* MODAL: Potvrzení smazání záznamu */}
      <ConfirmDeleteModal
        isOpen={Boolean(pendingDeleteAbsence)}
        onClose={() => setPendingDeleteAbsence(null)}
        onConfirm={() => {
          if (pendingDeleteAbsence) {
            void handleDeleteAbsence(pendingDeleteAbsence.id);
          }
        }}
        description={pendingDeleteAbsence?.description || ''}
      />

      {/* MODAL: Editace osoby */}
      <EditUserModal
        isOpen={Boolean(editingPersona)}
        onClose={() => setEditingPersona(null)}
        user={editingPersona}
        allUsers={personasList}
        contractTypesMap={resolvedContractTypesMap}
        onUserSaved={async () => {
          const whoRes = await api.getWhoIsWhere();
          if (whoRes?.data) setTeamPresence(whoRes.data);
          if (editingPersona && inspectedPersona && editingPersona.id.toLowerCase() === inspectedPersona.id.toLowerCase()) {
            const updated = whoRes?.data?.find((u: RadarUserDto) => u.userId.toLowerCase() === editingPersona.id.toLowerCase());
            if (updated) {
              setInspectedPersona((prev) => prev ? {
                ...prev,
                name: updated.displayName || prev.name,
                firstName: updated.firstName,
                lastName: updated.lastName,
                phoneNumber: updated.phoneNumber ?? prev.phoneNumber,
                role: (updated.role || prev.role) as Persona['role'],
                contract: updated.contractKind === 'OSVČ' ? 'OSVČ' : 'HPP',
                contractType: (updated.contractType as Persona['contractType']) || prev.contractType,
                managerId: updated.managerId || prev.managerId,
                parentPersonId: updated.parentPersonId || prev.parentPersonId,
                isPermanentHomeOffice: Boolean(updated.isPermanentHomeOffice),
                isFemale: Boolean(updated.isFemale),
                employmentStartDate: updated.employmentStartDate || prev.employmentStartDate
              } : null);
            }
          }
          setPersonaSyncCounter((c) => c + 1);
        }}
        addToast={addToast}
      />

      {/* MODAL: Nastavení absencí a fondu osoby */}
      <PersonAbsenceSettingsModal
        isOpen={Boolean(settingsPersona)}
        onClose={() => setSettingsPersona(null)}
        user={settingsPersona}
        onSettingsSaved={async () => {
          const whoRes = await api.getWhoIsWhere();
          if (whoRes?.data) setTeamPresence(whoRes.data);
          setPersonaSyncCounter((c) => c + 1);
        }}
        addToast={addToast}
      />

      {/* MODAL: Potvrzení smazání / deaktivace / aktivace osoby */}
      <ConfirmDeleteModal
        isOpen={Boolean(deletingPersona)}
        onClose={() => setDeletingPersona(null)}
        title={deletingPersona?.name || 'Osoba'}
        description={
          deletingPersona?.isActive === false
            ? 'Aktivace osoby'
            : 'Deaktivace osoby'
        }
        confirmText={deletingPersona?.isActive === false ? 'Aktivovat' : 'Deaktivovat'}
        confirmColor={deletingPersona?.isActive === false ? 'emerald' : 'rose'}
        onConfirm={handleConfirmToggleActivePersona}
      />

      {/* MODAL 9: Detail měsíčního výkazu (Timesheet) */}
      <MonthlyTimesheetModal
        isOpen={isMonthlyModalOpen}
        onClose={() => {
          setIsMonthlyModalOpen(false);
          setSelectedMonthlyPersona(null);
          setSelectedMonthlyYear(undefined);
          setSelectedMonthlyMonth(undefined);
        }}
        userId={selectedMonthlyPersona?.id || activePersona.id}
        userName={selectedMonthlyPersona?.name || activePersona.name}
        userRole={selectedMonthlyPersona?.roleLabel || activePersona.roleLabel}
        contract={selectedMonthlyPersona?.contract || activePersona.contract}
        dailyHours={selectedMonthlyPersona?.dailyHours ?? (selectedMonthlyPersona?.fteCoefficient ? selectedMonthlyPersona.fteCoefficient * baseDailyHours : (selectedMonthlyPersona ? baseDailyHours : realDailyTargetHours))}
        fundHours={selectedMonthlyPersona ? undefined : realMonthFundHours}
        year={selectedMonthlyYear}
        monthIndex0={selectedMonthlyMonth}
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
        onOpenGdprModal={() => {
          setIsUserSettingsModalOpen(false);
          setIsGdprConsentModalOpen(true);
        }}
        gdprStatus={activeGdprOverview?.currentStatus ?? activePersona.gdprStatus}
        hasActiveGdpr={Boolean(activeGdprOverview?.activeGdprId)}
        addToast={addToast}
      />

      {/* MODAL: Vyjádření souhlasu / nesouhlasu s GDPR */}
      <GdprConsentModal
        isOpen={isGdprConsentModalOpen}
        onClose={() => setIsGdprConsentModalOpen(false)}
        content={activeGdprOverview?.activeContent || ''}
        validFrom={activeGdprOverview?.activeValidFrom || undefined}
        currentStatus={activeGdprOverview?.currentStatus ?? activePersona.gdprStatus ?? 'unfilled'}
        isSubmitting={isSubmittingGdprConsent}
        onChoose={handleSubmitGdprConsent}
      />


      {/* Floating NFC Simulator in Dev Mode (hidden when DEV mode is closed) */}
      {isDevVisible && <NfcDebugSimulator onSimulateClockIn={handleSimulatedNfc} />}

      {/* Toast Notifications Container */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}

export default App;

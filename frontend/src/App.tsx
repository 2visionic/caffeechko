import { useState, useEffect, useRef } from 'react';
import {
  MapPin,
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
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Sparkles,
  Smartphone,
  ShieldCheck,
  Users,
  Check,
  LayoutGrid,
  List,
  Stethoscope,
  FileCheck,
  Building2,
  Plus,
  Network,
  FileSpreadsheet,
  Clock,
  Database,
  Search
} from 'lucide-react';
import { NfcDebugSimulator } from './components/NfcDebugSimulator';
import { DeclensionModal } from './components/DeclensionModal';
import { DayTimeline, type ShiftBlock } from './components/DayTimeline';
import { LeaveRequestModal, type LeaveRequestItem } from './components/LeaveRequestModal';
import { DoctorVisitModal, type DoctorVisitItem } from './components/DoctorVisitModal';
import { NewRequestModal, type NewRequestData } from './components/NewRequestModal';
import { OrgHierarchyModal, type OrgPerson } from './components/OrgHierarchyModal';
import { MonthlyTimesheetModal } from './components/MonthlyTimesheetModal';
import { api } from './api';
import { nfcService } from './services/nfcService';

export interface Persona {
  id: string;
  name: string;
  email: string;
  phoneNumber: string;
  role: 'admin' | 'team_lead' | 'office_manager' | 'colleague';
  roleLabel: string;
  department: string;
  managerId?: string;
  managerName?: string;
  managesDepartment?: string;
  vacationRemaining: number;
  vacationTotal: number;
  sickDaysRemaining: number;
  sickDaysTotal: number;
  contract: 'HPP' | 'OSVČ';
  initialClockedIn: boolean;
  location: 'office' | 'home_office' | 'none';
  locationName: string;
  clockInTime?: string;
  hoursToday: number;
  initialShifts: ShiftBlock[];
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
    name: 'Petr Kulhánek',
    email: 'petr.kulhanek@magicware.cz',
    phoneNumber: '+420 777 123 456',
    role: 'admin',
    roleLabel: 'CEO / Administrátor',
    department: 'Vedení společnosti',
    managesDepartment: 'Vedení celé firmy',
    vacationRemaining: 25,
    vacationTotal: 25,
    sickDaysRemaining: 3,
    sickDaysTotal: 3,
    contract: 'HPP',
    initialClockedIn: true,
    location: 'office',
    locationName: 'Pobočka Praha 1 - Palmovka',
    clockInTime: '08:15',
    hoursToday: 3.75, // 3h 45m
    initialShifts: [
      {
        id: 'shift-1a',
        start: '08:15',
        end: '11:30',
        location: 'office',
        locationName: 'Pobočka Praha 1 - Palmovka',
        method: 'nfc'
      },
      {
        id: 'shift-1b',
        start: '12:00',
        end: null,
        location: 'office',
        locationName: 'Pobočka Praha 1 - Palmovka',
        method: 'nfc'
      }
    ]
  },
  {
    id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    name: 'Martina Svobodová',
    email: 'martina.svobodova@magicware.cz',
    phoneNumber: '+420 777 345 678',
    role: 'office_manager',
    roleLabel: 'Office Manager & HR',
    department: 'Provoz a lidské zdroje',
    managerId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    managerName: 'Petr Kulhánek',
    managesDepartment: 'Provoz a lidské zdroje',
    vacationRemaining: 18,
    vacationTotal: 20,
    sickDaysRemaining: 2,
    sickDaysTotal: 3,
    contract: 'HPP',
    initialClockedIn: true,
    location: 'office',
    locationName: 'Pobočka Praha 1 - Palmovka',
    clockInTime: '08:00',
    hoursToday: 4.00,
    initialShifts: [
      {
        id: 'shift-3',
        start: '08:00',
        end: null,
        location: 'office',
        locationName: 'Pobočka Praha 1 - Palmovka',
        method: 'nfc'
      }
    ]
  },
  {
    id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    name: 'Jana Nováková',
    email: 'jana.novakova@magicware.cz',
    phoneNumber: '+420 777 234 567',
    role: 'team_lead',
    roleLabel: 'Vedoucí vývoje (Tech Lead)',
    department: 'Vývoj a technologie',
    managerId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    managerName: 'Petr Kulhánek',
    managesDepartment: 'Vývoj a technologie',
    vacationRemaining: 16,
    vacationTotal: 20,
    sickDaysRemaining: 3,
    sickDaysTotal: 3,
    contract: 'HPP',
    initialClockedIn: true,
    location: 'home_office',
    locationName: 'Home Office',
    clockInTime: '08:45',
    hoursToday: 3.25,
    initialShifts: [
      {
        id: 'shift-2',
        start: '08:45',
        end: null,
        location: 'home_office',
        locationName: 'Home Office (práce z domova)',
        method: 'web'
      }
    ]
  },
  {
    id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
    name: 'Tomáš Dvořák',
    email: 'tomas.dvorak@magicware.cz',
    phoneNumber: '+420 777 456 789',
    role: 'colleague',
    roleLabel: 'Senior Backend Developer',
    department: 'Vývoj a technologie',
    managerId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    managerName: 'Jana Nováková',
    vacationRemaining: 12,
    vacationTotal: 20,
    sickDaysRemaining: 2,
    sickDaysTotal: 3,
    contract: 'HPP',
    initialClockedIn: false,
    location: 'none',
    locationName: 'Pauza do 13:30',
    hoursToday: 4.00,
    initialShifts: [
      {
        id: 'shift-4',
        start: '08:00',
        end: '12:00',
        location: 'office',
        locationName: 'Pobočka Praha 1 - Palmovka',
        method: 'nfc'
      }
    ]
  },
  {
    id: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
    name: 'Martin Kovář',
    email: 'martin.kovar@magicware.cz',
    phoneNumber: '+420 777 678 901',
    role: 'colleague',
    roleLabel: 'Frontend Developer',
    department: 'Vývoj a technologie',
    managerId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    managerName: 'Jana Nováková',
    vacationRemaining: 15,
    vacationTotal: 20,
    sickDaysRemaining: 3,
    sickDaysTotal: 3,
    contract: 'HPP',
    initialClockedIn: true,
    location: 'office',
    locationName: 'Pobočka Praha 1 - Palmovka',
    clockInTime: '09:00',
    hoursToday: 2.75,
    initialShifts: [
      {
        id: 'shift-5',
        start: '09:00',
        end: null,
        location: 'office',
        locationName: 'Pobočka Praha 1 - Palmovka',
        method: 'nfc'
      }
    ]
  },
  {
    id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    name: 'Lukáš Černý',
    email: 'lukas.cerny@magicware.cz',
    phoneNumber: '+420 777 567 890',
    role: 'colleague',
    roleLabel: 'Fullstack Developer (OSVČ)',
    department: 'Vývoj a technologie',
    managerId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    managerName: 'Jana Nováková',
    vacationRemaining: 0,
    vacationTotal: 0,
    sickDaysRemaining: 0,
    sickDaysTotal: 0,
    contract: 'OSVČ',
    initialClockedIn: false,
    location: 'none',
    locationName: 'Mimo práci',
    hoursToday: 0.00,
    initialShifts: []
  },
  {
    id: '77777777-7777-7777-7777-777777777777',
    name: 'David Sýkora',
    email: 'david.sykora@magicware.cz',
    phoneNumber: '+420 777 789 012',
    role: 'team_lead',
    roleLabel: 'Marketing & Sales Lead',
    department: 'Marketing a obchod',
    managerId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    managerName: 'Petr Kulhánek',
    managesDepartment: 'Marketing a obchod',
    vacationRemaining: 14,
    vacationTotal: 20,
    sickDaysRemaining: 2,
    sickDaysTotal: 3,
    contract: 'HPP',
    initialClockedIn: true,
    location: 'office',
    locationName: 'Pobočka Praha 1 - Palmovka',
    clockInTime: '08:30',
    hoursToday: 3.50,
    initialShifts: [
      {
        id: 'shift-6',
        start: '08:30',
        end: null,
        location: 'office',
        locationName: 'Pobočka Praha 1 - Palmovka',
        method: 'nfc'
      }
    ]
  },
  {
    id: '88888888-8888-8888-8888-888888888888',
    name: 'Eliška Králová',
    email: 'eliska.kralova@magicware.cz',
    phoneNumber: '+420 777 890 123',
    role: 'colleague',
    roleLabel: 'Brand & Content Specialist',
    department: 'Marketing a obchod',
    managerId: '77777777-7777-7777-7777-777777777777',
    managerName: 'David Sýkora',
    vacationRemaining: 17,
    vacationTotal: 20,
    sickDaysRemaining: 3,
    sickDaysTotal: 3,
    contract: 'HPP',
    initialClockedIn: true,
    location: 'home_office',
    locationName: 'Home Office',
    clockInTime: '08:15',
    hoursToday: 3.75,
    initialShifts: [
      {
        id: 'shift-7',
        start: '08:15',
        end: null,
        location: 'home_office',
        locationName: 'Home Office',
        method: 'web'
      }
    ]
  }
];

interface ToastMessage {
  id: number;
  type: 'success' | 'warning' | 'error';
  title: string;
  message: string;
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

  const [activePersona, setActivePersona] = useState<Persona>(DEV_PERSONAS[0]);

  // Current attendance state for active persona
  const [isClockedIn, setIsClockedIn] = useState(activePersona.initialClockedIn);
  const [activeLocation, setActiveLocation] = useState<'office' | 'home_office'>(
    activePersona.location === 'home_office' ? 'home_office' : 'office'
  );
  const [workplaceName, setWorkplaceName] = useState(activePersona.locationName);
  const [clockInTime, setClockInTime] = useState(activePersona.clockInTime || '08:00');
  const [hoursToday, setHoursToday] = useState(activePersona.hoursToday);
  const [currentShifts, setCurrentShifts] = useState<ShiftBlock[]>(activePersona.initialShifts);

  // Team presence view mode: 'cards' | 'rows' (default is 'rows' as requested)
  const [presenceViewMode, setPresenceViewMode] = useState<'cards' | 'rows'>('rows');

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
  const [isDeclensionModalOpen, setIsDeclensionModalOpen] = useState(false);
  const [isNewRequestModalOpen, setIsNewRequestModalOpen] = useState(false);
  const [isOrgHierarchyModalOpen, setIsOrgHierarchyModalOpen] = useState(false);
  const [isMonthlyTimesheetModalOpen, setIsMonthlyTimesheetModalOpen] = useState(false);
  const [pauseReturnTime, setPauseReturnTime] = useState('14:30');

  // Vacation requests state
  const [vacationRequests, setVacationRequests] = useState<LeaveRequestItem[]>([
    {
      id: 'vac-1',
      applicantId: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
      userName: 'Tomáš Dvořák',
      userRole: 'Senior Backend Developer',
      department: 'Vývoj a technologie',
      managerId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      managerName: 'Jana Nováková',
      type: 'vacation',
      typeName: 'Dovolená',
      startDate: '2026-10-20',
      endDate: '2026-10-24',
      daysCount: 5,
      remainingDays: 12,
      totalDays: 20,
      note: 'Plánovaná rodinná dovolená po dokončení sprintu 41.',
      status: 'pending'
    },
    {
      id: 'vac-2',
      applicantId: '88888888-8888-8888-8888-888888888888',
      userName: 'Eliška Králová',
      userRole: 'Brand & Content Specialist',
      department: 'Marketing a obchod',
      managerId: '77777777-7777-7777-7777-777777777777',
      managerName: 'David Sýkora',
      type: 'vacation',
      typeName: 'Dovolená',
      startDate: '2026-11-02',
      endDate: '2026-11-06',
      daysCount: 5,
      remainingDays: 17,
      totalDays: 20,
      note: 'Dovolená po spuštění podzimní marketingové kampaně.',
      status: 'pending'
    }
  ]);
  const [selectedVacation, setSelectedVacation] = useState<LeaveRequestItem | null>(null);
  const [isVacationModalOpen, setIsVacationModalOpen] = useState(false);

  // Doctor visits state
  const [doctorVisits, setDoctorVisits] = useState<DoctorVisitItem[]>([
    {
      id: 'doc-1',
      applicantId: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
      userName: 'Martin Kovář',
      userRole: 'Frontend Developer',
      department: 'Vývoj a technologie',
      managerId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      managerName: 'Jana Nováková',
      type: 'doctor',
      typeName: 'Lékař / Vyšetření',
      date: '2026-10-14',
      startTime: '08:30',
      endTime: '11:30',
      facilityName: 'Stomatologická klinika MUDr. Dvořáková, Praha 1',
      hasConfirmationDocument: true,
      note: 'Pravidelná kontrola u zubního lékaře a preventivní prohlídka.',
      status: 'pending'
    },
    {
      id: 'doc-2',
      applicantId: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
      userName: 'Tomáš Dvořák',
      userRole: 'Senior Backend Developer',
      department: 'Vývoj a technologie',
      managerId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      managerName: 'Jana Nováková',
      type: 'doctor',
      typeName: 'Lékař / Vyšetření',
      date: '2026-10-16',
      startTime: '09:00',
      endTime: '11:00',
      facilityName: 'Poliklinika Palmovka – Oční vyšetření',
      hasConfirmationDocument: false,
      note: 'Vyšetření zraku na doporučení praktického lékaře.',
      status: 'pending'
    }
  ]);
  const [selectedDoctor, setSelectedDoctor] = useState<DoctorVisitItem | null>(null);
  const [isDoctorModalOpen, setIsDoctorModalOpen] = useState(false);

  // Weekly calendar selection & Live Radar filter states
  const [selectedWeekDate, setSelectedWeekDate] = useState<string>('2026-10-11');
  const [teamSearchQuery, setTeamSearchQuery] = useState<string>('');
  const [teamFilterStatus, setTeamFilterStatus] = useState<'all' | 'office' | 'home_office' | 'offline'>('all');

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

  // Switch persona handler
  const handleSwitchPersona = (persona: Persona) => {
    setActivePersona(persona);
    setIsClockedIn(persona.initialClockedIn);
    setActiveLocation(persona.location === 'home_office' ? 'home_office' : 'office');
    setWorkplaceName(persona.locationName);
    setClockInTime(persona.clockInTime || '08:00');
    setHoursToday(persona.hoursToday);
    setCurrentShifts(persona.initialShifts);

    addToast(
      'success',
      'Přepnuto na osobu:',
      `${persona.name} (${persona.roleLabel} • ${persona.department})`
    );
  };

  // Backend SQLite Database connection state
  const [isDbConnected, setIsDbConnected] = useState(false);

  // Sync with real backend SQLite database upon mounting or persona switch
  useEffect(() => {
    let isMounted = true;
    async function syncBackendData() {
      try {
        const statusRes = await api.getStatus(activePersona.id);
        if (statusRes && statusRes.data && isMounted) {
          setIsDbConnected(true);
          setIsClockedIn(statusRes.data.isClockedIn);
          if (statusRes.data.totalHoursWorkedToday > 0) {
            setHoursToday(statusRes.data.totalHoursWorkedToday);
          }
        } else if (isMounted) {
          setIsDbConnected(false);
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
        if (myRes && myRes.data && isMounted && myRes.data.length > 0) {
          const myVacs = myRes.data
            .filter((r: any) => r.type === 'vacation' || r.type === 'sick_day')
            .map(normalizeVacationItem);
          const myDocs = myRes.data
            .filter((r: any) => r.type === 'doctor')
            .map(normalizeDoctorItem);
          if (myVacs.length > 0) {
            setVacationRequests((prev) => {
              const ids = new Set(myVacs.map((v: LeaveRequestItem) => v.id));
              return [...myVacs, ...prev.filter((p) => !ids.has(p.id))];
            });
          }
          if (myDocs.length > 0) {
            setDoctorVisits((prev) => {
              const ids = new Set(myDocs.map((d: DoctorVisitItem) => d.id));
              return [...myDocs, ...prev.filter((p) => !ids.has(p.id))];
            });
          }
        }

        // 2. Fetch pending approvals for managers from database
        if (['admin', 'team_lead', 'office_manager'].includes(activePersona.role)) {
          const pendingRes = await api.getPendingApprovals(activePersona.id);
          if (pendingRes && pendingRes.data && isMounted && pendingRes.data.length > 0) {
            const pendingVacs = pendingRes.data
              .filter((r: any) => r.type === 'vacation' || r.type === 'sick_day')
              .map(normalizeVacationItem);
            const pendingDocs = pendingRes.data
              .filter((r: any) => r.type === 'doctor')
              .map(normalizeDoctorItem);
            if (pendingVacs.length > 0) {
              setVacationRequests((prev) => {
                const ids = new Set(pendingVacs.map((v: LeaveRequestItem) => v.id));
                return [...pendingVacs, ...prev.filter((p) => !ids.has(p.id))];
              });
            }
            if (pendingDocs.length > 0) {
              setDoctorVisits((prev) => {
                const ids = new Set(pendingDocs.map((d: DoctorVisitItem) => d.id));
                return [...pendingDocs, ...prev.filter((p) => !ids.has(p.id))];
              });
            }
          }
        }
      } catch (err) {
        console.warn('Backend sync failed, using local state:', err);
      }
    }
    syncBackendData();
    return () => {
      isMounted = false;
    };
  }, [activePersona.id]);

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

  // Create new request from Employee Self-Service Modal
  const handleCreateNewRequest = (data: NewRequestData) => {
    setIsNewRequestModalOpen(false);

    if (data.type === 'vacation') {
      const s = new Date(data.startDate);
      const e = new Date(data.endDate);
      const daysCount = Math.max(1, Math.round((e.getTime() - s.getTime()) / (1000 * 3600 * 24)) + 1);

      const newVac: LeaveRequestItem = {
        id: `vac-${Date.now()}`,
        applicantId: activePersona.id,
        userName: activePersona.name,
        userRole: activePersona.roleLabel,
        department: activePersona.department,
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
        status: 'pending'
      };
      setVacationRequests((prev) => [newVac, ...prev]);

      // Write directly to SQLite database
      api.submitAbsence({
        userId: activePersona.id,
        typeCode: 'vacation',
        startDate: data.startDate,
        endDate: data.endDate,
        note: data.note
      });

      addToast(
        'success',
        'Žádost o dovolenou podána (uloženo v DB)',
        `Vaše žádost na termín ${formatDateCzech(data.startDate)} – ${formatDateCzech(data.endDate)} (${daysCount} dní) byla odeslána ke schválení (${activePersona.managerName || 'vedení'}) a zapsána do databáze.`
      );
    } else if (data.type === 'doctor') {
      const newDoc: DoctorVisitItem = {
        id: `doc-${Date.now()}`,
        applicantId: activePersona.id,
        userName: activePersona.name,
        userRole: activePersona.roleLabel,
        department: activePersona.department,
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
        department: activePersona.department,
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
      });

      addToast(
        'success',
        'Sick Day nahlášen (uloženo v DB)',
        `Zdravotní volno na ${formatDateCzech(data.startDate)} bylo zaevidováno v databázi a notifikováno nadřízenému (${activePersona.managerName || 'vedení'}).`
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

  // Week days mock
  const weekDays = [
    { date: '2026-10-05', dayName: 'Po', hours: 8.2, isToday: false },
    { date: '2026-10-06', dayName: 'Út', hours: 7.8, isToday: false },
    { date: '2026-10-07', dayName: 'St', hours: 8.5, isToday: false },
    { date: '2026-10-08', dayName: 'Čt', hours: 8.0, isToday: false },
    { date: '2026-10-09', dayName: 'Pá', hours: 7.5, isToday: false },
    { date: '2026-10-10', dayName: 'So', hours: 0.0, isToday: false },
    { date: '2026-10-11', dayName: 'Ne', hours: isClockedIn ? hoursToday : 0.0, isToday: true }
  ];

  // RBAC & Approval Filtering:
  // Admin & Office Manager (HR) see all pending requests across the company.
  // Team Lead sees only requests from their subordinates (where managerId matches activePersona.id).
  const isManagerOrAdmin = ['admin', 'team_lead', 'office_manager'].includes(activePersona.role);

  const pendingVacationsForManager = vacationRequests.filter((r) => {
    if (activePersona.role === 'admin' || activePersona.role === 'office_manager') return true;
    if (activePersona.role === 'team_lead') return r.managerId === activePersona.id;
    return false;
  });

  const pendingDoctorsForManager = doctorVisits.filter((d) => {
    if (activePersona.role === 'admin' || activePersona.role === 'office_manager') return true;
    if (activePersona.role === 'team_lead') return d.managerId === activePersona.id;
    return false;
  });

  const totalManagerPendingCount =
    pendingVacationsForManager.filter((r) => r.status === 'pending').length +
    pendingDoctorsForManager.filter((d) => d.status === 'pending').length;

  // Employee Self-Service: Requests submitted by the active persona
  const myVacationRequests = vacationRequests.filter(
    (r) => r.applicantId === activePersona.id || r.userName === activePersona.name
  );
  const myDoctorVisits = doctorVisits.filter(
    (d) => d.applicantId === activePersona.id || d.userName === activePersona.name
  );
  const myTotalRequestsCount = myVacationRequests.length + myDoctorVisits.length;

  // Prepare list for OrgHierarchyModal
  const orgPeopleList: OrgPerson[] = DEV_PERSONAS.map((p) => ({
    id: p.id,
    name: p.name,
    roleLabel: p.roleLabel,
    department: p.department,
    managerId: p.managerId,
    managerName: p.managerName,
    isClockedIn: p.id === activePersona.id ? isClockedIn : p.initialClockedIn,
    locationName:
      p.id === activePersona.id
        ? isClockedIn
          ? workplaceName
          : 'Mimo práci'
        : p.locationName,
    contract: p.contract
  }));

  return (
    <div className="min-h-screen pb-24 bg-[#f8fafc] dark:bg-[#09090b] text-slate-900 dark:text-zinc-100 transition-colors">
      {/* Dev Mode Role & Persona Bar */}
      <div className="bg-amber-500/10 dark:bg-amber-500/15 px-4 py-2 text-xs">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center gap-1.5 font-bold text-amber-950 dark:text-amber-300">
              <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
              <span>DEV REŽIM</span>
            </div>

            {isDbConnected ? (
              <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-900 dark:text-emerald-300 font-mono text-[10px] font-semibold">
                <Database className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                <span>SQLite DB aktivní (dochazka_dev.db)</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-950 dark:text-amber-300 font-mono text-[10px] font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                <span>Lokální paměť</span>
              </div>
            )}
          </div>

          {/* Elegant Persona Dropdown Selector */}
          <div className="relative" ref={personaDropdownRef}>
            <button
              onClick={() => setIsPersonaDropdownOpen(!isPersonaDropdownOpen)}
              className="flex items-center justify-between gap-2.5 px-3 py-1.5 rounded-2xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-950 dark:text-amber-100 font-medium transition-all shadow-sm group"
              title="Klikněte pro změnu přihlášeného testovacího uživatele"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 rounded-full bg-amber-600 text-white font-bold text-[10px] flex items-center justify-center flex-shrink-0">
                  {(activePersona.name || '?')
                    .split(' ')
                    .filter(Boolean)
                    .map((n) => n[0])
                    .join('')}
                </div>
                <span className="font-bold text-xs truncate max-w-[130px] sm:max-w-[160px]">
                  {activePersona.name}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/30 text-amber-950 dark:text-amber-200 font-semibold flex-shrink-0">
                  {activePersona.roleLabel.split('/')[0].trim()}
                </span>
              </div>
              <ChevronDown
                className={`w-3.5 h-3.5 text-amber-700 dark:text-amber-300 transition-transform flex-shrink-0 ${
                  isPersonaDropdownOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {isPersonaDropdownOpen && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-3xl bg-white dark:bg-zinc-900 shadow-2xl p-2.5 z-50 animate-in fade-in zoom-in-95 duration-150 space-y-1">
                <div className="px-3 py-2 text-[11px] font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider font-mono flex items-center justify-between">
                  <span>Vyberte testovací osobu</span>
                  <span className="text-amber-600 dark:text-amber-400 font-bold">8 rolí</span>
                </div>
                <div className="max-h-96 overflow-y-auto space-y-1 pr-1">
                  {DEV_PERSONAS.map((p) => {
                    const isSelected = p.id === activePersona.id;
                    const roleBadgeColor =
                      p.role === 'admin'
                        ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300'
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
                            ? 'bg-amber-500/15 text-amber-950 dark:text-amber-100 font-bold'
                            : 'hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-800 dark:text-zinc-200'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 ${
                              isSelected
                                ? 'bg-amber-600 text-white'
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
                              <span className="truncate opacity-80">• {p.department}</span>
                            </div>
                          </div>
                        </div>
                        {isSelected && (
                          <Check className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Header (M3 Clean Elevation, STRICTLY NO BORDER) */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md shadow-sm px-4 sm:px-6 py-3.5">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          {/* Logo & Company Instance */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-700 dark:text-amber-400 flex items-center justify-center shadow-sm">
              <Coffee className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-base leading-tight tracking-tight text-slate-900 dark:text-white">
                  caffeechko
                </h1>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-800 dark:text-amber-300 font-semibold">
                  magicware
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400">firemní docházkový systém</p>
            </div>
          </div>

          {/* Header Action Tools */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Tlačítko: Organizační struktura & Týmy */}
            <button
              onClick={() => setIsOrgHierarchyModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-zinc-300 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 rounded-full transition-colors"
              title="Zobrazit strom nadřízených a podřízených"
            >
              <Network className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span className="hidden md:inline">Hierarchie & Týmy</span>
              <span className="md:hidden">Tým</span>
            </button>

            {/* Tlačítko: Můj měsíční výkaz */}
            <button
              onClick={() => setIsMonthlyTimesheetModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-zinc-300 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 rounded-full transition-colors"
              title="Zobrazit měsíční timesheet a saldo hodin"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
              <span className="hidden sm:inline">Měsíční výkaz</span>
            </button>

            {/* Tlačítko: 7 pádů skloňování */}
            <button
              onClick={() => setIsDeclensionModalOpen(true)}
              className="hidden lg:flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-zinc-300 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 rounded-full transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>7 pádů</span>
            </button>

            {/* Dark Mode Toggle */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2.5 rounded-full bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 transition-colors"
              title={darkMode ? 'Přepnout na světlý režim' : 'Přepnout na tmavý režim'}
            >
              {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
            </button>

            {/* User Profile Badge (No borders) */}
            <div className="flex items-center gap-2.5 pl-2">
              <div className="w-9 h-9 rounded-full bg-amber-500/20 text-amber-900 dark:text-amber-300 font-bold text-xs flex items-center justify-center">
                {(activePersona.name || '?')
                  .split(' ')
                  .filter(Boolean)
                  .map((n) => n[0])
                  .join('')}
              </div>
              <div className="hidden md:block text-left">
                <div className="text-xs font-semibold leading-tight text-slate-900 dark:text-zinc-100">
                  {activePersona.name}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-zinc-400 font-medium">
                  {activePersona.managerName ? `Nadřízený: ${activePersona.managerName}` : 'Vedení společnosti'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* 1. Dnešní přítomnost (Modern MD3 Airy Timeline Card) */}
        <section className="bg-white dark:bg-zinc-900 rounded-3xl p-6 sm:p-8 shadow-sm transition-colors space-y-6">
          {/* Top row: Avatar + Jméno + Stav pod jménem (vlevo) + Odpracováno (vpravo) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="relative flex-shrink-0">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-tr from-amber-500/20 to-amber-600/30 dark:from-amber-500/30 dark:to-amber-600/20 text-amber-900 dark:text-amber-300 font-bold text-base sm:text-lg flex items-center justify-center shadow-sm">
                  {activePersona.name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')}
                </div>
                <span
                  className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full ring-2 ring-white dark:ring-zinc-900 ${
                    isClockedIn ? 'bg-emerald-500' : 'bg-slate-400'
                  }`}
                />
              </div>

              <div>
                <div className="text-sm font-semibold text-slate-600 dark:text-zinc-300 flex items-center gap-2">
                  <span>{activePersona.name}</span>
                  <span className="text-xs text-slate-400 dark:text-zinc-500 font-normal">
                    • {activePersona.roleLabel}
                  </span>
                </div>

                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-0.5">
                  {isClockedIn ? (
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

            {/* Total Hours Today */}
            <div className="flex items-center sm:text-right self-start sm:self-auto flex-shrink-0">
              <div className="px-5 py-2.5 rounded-2xl bg-slate-100/70 dark:bg-zinc-800/60">
                <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500 font-mono">
                  Celkově odpracováno
                </span>
                <div className="text-2xl sm:text-3xl font-extrabold font-mono text-slate-900 dark:text-white leading-tight">
                  {formatHoursMinutes(hoursToday)}
                </div>
              </div>
            </div>
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

          {/* Two Main Action Buttons */}
          <div className="pt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={() => setIsNfcModalOpen(true)}
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
              onClick={handleClockOutClick}
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
        </section>

        {/* 2. EMPLOYEE SELF-SERVICE: Moje žádosti & Absence (pro každého zaměstnance) */}
        <section className="bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-sm transition-colors space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Moje žádosti & Absence
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                Plánování dovolené, propustky k lékaři a sick days s přímým schválením nadřízeným
              </p>
            </div>

            {/* Hlavní akční tlačítko pro podání žádosti */}
            <button
              onClick={() => setIsNewRequestModalOpen(true)}
              className="px-4 py-2.5 rounded-2xl bg-amber-600 hover:bg-amber-700 active:scale-98 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Podat novou žádost / Lékař</span>
            </button>
          </div>

          {/* Rychlé infoboxy zůstatků a schvalovatele */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-2xl bg-amber-500/10 dark:bg-amber-500/15">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-300 block font-mono">
                Dovolená zbývá
              </span>
              <div className="text-xl font-extrabold font-mono text-amber-950 dark:text-amber-200 mt-1">
                {activePersona.vacationRemaining} / {activePersona.vacationTotal}{' '}
                <span className="text-xs font-sans font-normal text-slate-500">dní</span>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-sky-500/10 dark:bg-sky-500/15">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-sky-800 dark:text-sky-300 block font-mono">
                Sick days
              </span>
              <div className="text-xl font-extrabold font-mono text-sky-950 dark:text-sky-200 mt-1">
                {activePersona.sickDaysRemaining} / {activePersona.sickDaysTotal}{' '}
                <span className="text-xs font-sans font-normal text-slate-500">dny</span>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-100/70 dark:bg-zinc-800/60 col-span-2 sm:col-span-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400 block font-mono">
                Schvaluje váš nadřízený
              </span>
              <div className="text-sm font-bold text-slate-900 dark:text-white mt-1 flex items-center justify-between">
                <span>{activePersona.managerName || 'Vedení společnosti (CEO)'}</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                  Aktivní schvalovatel
                </span>
              </div>
            </div>
          </div>

          {/* Seznam mých podaných žádostí */}
          <div className="space-y-2.5 pt-1">
            <div className="text-xs font-semibold text-slate-500 dark:text-zinc-400 flex items-center justify-between">
              <span>Historie a stav vašich podaných žádostí ({myTotalRequestsCount}):</span>
            </div>

            {myTotalRequestsCount === 0 ? (
              <div className="p-5 rounded-2xl bg-slate-100/70 dark:bg-zinc-800/40 text-center">
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Zatím nemáte podanou žádnou žádost o volno ani nahlášeného lékaře.
                </p>
                <button
                  onClick={() => setIsNewRequestModalOpen(true)}
                  className="mt-2 text-xs text-amber-600 dark:text-amber-400 font-semibold hover:underline"
                >
                  + Naplánovat dovolenou nebo nahlásit lékaře nyní
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Moje dovolené a sick days */}
                {myVacationRequests.map((r) => (
                  <div
                    key={r.id}
                    className="p-3.5 rounded-2xl bg-slate-100/70 dark:bg-zinc-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-white">
                          {r.typeName}: {formatDateCzech(r.startDate)} {r.startDate !== r.endDate ? `– ${formatDateCzech(r.endDate)}` : ''}
                        </span>
                        <span className="font-mono font-semibold px-2 py-0.5 rounded-lg bg-white dark:bg-zinc-700">
                          {r.daysCount} {r.daysCount === 1 ? 'den' : r.daysCount < 5 ? 'dny' : 'dní'}
                        </span>
                      </div>
                      {r.note && <p className="text-slate-500 dark:text-zinc-400 italic">„{r.note}“</p>}
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {r.status === 'pending' && (
                        <span className="px-2.5 py-1 rounded-full font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>Čeká na schválení ({r.managerName || 'nadřízený'})</span>
                        </span>
                      )}
                      {r.status === 'approved' && (
                        <span className="px-2.5 py-1 rounded-full font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Schváleno</span>
                        </span>
                      )}
                      {r.status === 'rejected' && (
                        <span className="px-2.5 py-1 rounded-full font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          <span>Zamítnuto {r.rejectionReason ? `(${r.rejectionReason})` : ''}</span>
                        </span>
                      )}
                    </div>
                  </div>
                ))}

                {/* Moji lékaři */}
                {myDoctorVisits.map((d) => (
                  <div
                    key={d.id}
                    className="p-3.5 rounded-2xl bg-sky-50 dark:bg-zinc-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <Stethoscope className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                          <span>{d.typeName}: {formatDateCzech(d.date || (d as any).startDate)} ({d.startTime} – {d.endTime})</span>
                        </span>
                        <span className="font-mono text-slate-500 dark:text-zinc-400">
                          {d.facilityName}
                        </span>
                      </div>
                      {d.note && <p className="text-slate-500 dark:text-zinc-400 italic">„{d.note}“</p>}
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {d.status === 'pending' && (
                        <span className="px-2.5 py-1 rounded-full font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>Čeká na ověření ({d.managerName || 'nadřízený'})</span>
                        </span>
                      )}
                      {d.status === 'approved' && (
                        <span className="px-2.5 py-1 rounded-full font-semibold bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Uznáno (§ 199 ZP)</span>
                        </span>
                      )}
                      {d.status === 'rejected' && (
                        <span className="px-2.5 py-1 rounded-full font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          <span>Neuznáno {d.rejectionReason ? `(${d.rejectionReason})` : ''}</span>
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* 3. MANAGER OPERATIONAL AGENDA (Zobrazuje se pouze pro roli admin, team_lead nebo office_manager) */}
        {isManagerOrAdmin && (
          <section className="bg-amber-500/10 dark:bg-amber-500/15 rounded-3xl p-6 sm:p-8 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-amber-950 dark:text-amber-300 font-mono">
                  PROVOZNÍ AGENDA SCHVALOVÁNÍ ({activePersona.roleLabel.toUpperCase()})
                </h3>
              </div>
              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-amber-500/20 text-amber-950 dark:text-amber-200">
                {totalManagerPendingCount} čekající k posouzení
              </span>
            </div>

            {totalManagerPendingCount === 0 && (
              <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 text-center shadow-sm">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-800 dark:text-zinc-200">
                  Všechny žádosti vašeho týmu jsou vyřízeny
                </p>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  Jako {activePersona.roleLabel} nemáte v této chvíli žádné čekající žádosti k posouzení.
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4">
              {/* KARTA 1: ŽÁDOSTI O DOVOLENOU V TÝMU */}
              {pendingVacationsForManager.map((req) => {
                const isPending = req.status === 'pending';
                const isApproved = req.status === 'approved';
                const isRejected = req.status === 'rejected';

                return (
                  <div
                    key={req.id}
                    className="p-6 sm:p-7 rounded-3xl bg-white dark:bg-zinc-900 shadow-sm flex flex-col justify-between gap-5 transition-all"
                  >
                    <div>
                      {/* Top row: Žadatel, role a typ žádosti */}
                      <div className="flex items-center justify-between gap-3 mb-4">
                        <div className="flex items-center gap-3.5">
                          <div className="w-11 h-11 rounded-2xl bg-amber-500/15 text-amber-800 dark:text-amber-300 font-bold text-sm flex items-center justify-center flex-shrink-0">
                            {(req.userName || '?')
                              .split(' ')
                              .filter(Boolean)
                              .map((n) => n[0])
                              .join('')}
                          </div>
                          <div>
                            <div className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                              <span>{req.userName}</span>
                              {req.department && (
                                <span className="text-[11px] font-normal px-2 py-0.2 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300">
                                  {req.department}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-zinc-400">
                              {req.userRole}
                            </div>
                          </div>
                        </div>

                        <span className="text-xs font-semibold px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300">
                          {req.typeName}
                        </span>
                      </div>

                      {/* Prominent Dates & Vacation balance info */}
                      <div className="p-4 rounded-2xl bg-slate-100/70 dark:bg-zinc-800/60 space-y-2 mb-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-bold text-slate-800 dark:text-zinc-200 flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-amber-500" />
                            <span>
                              {formatDateCzech(req.startDate)}
                              {req.startDate !== req.endDate ? ` – ${formatDateCzech(req.endDate)}` : ''}
                            </span>
                          </span>
                          <span className="font-bold font-mono text-slate-900 dark:text-white bg-white dark:bg-zinc-700 px-2.5 py-0.5 rounded-lg">
                            {req.daysCount} {req.daysCount === 1 ? 'den' : req.daysCount < 5 ? 'dny' : 'dní'}
                          </span>
                        </div>

                        <div className="text-xs text-slate-500 dark:text-zinc-400 flex items-center justify-between pt-2 border-t border-slate-200/40 dark:border-zinc-700/60">
                          <span>Zůstatek dovolené žadatele:</span>
                          <span className="font-semibold font-mono text-emerald-600 dark:text-emerald-400 text-sm">
                            {req.remainingDays} / {req.totalDays} dní
                          </span>
                        </div>
                      </div>

                      {/* Poznámka žadatele */}
                      {req.note && (
                        <p className="text-xs italic text-slate-600 dark:text-zinc-300 pl-1">
                          „{req.note}“
                        </p>
                      )}

                      {/* Důvod zamítnutí */}
                      {isRejected && req.rejectionReason && (
                        <div className="mt-2.5 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-xs text-rose-700 dark:text-rose-300">
                          <span className="font-bold">Důvod zamítnutí: </span>
                          <span>{req.rejectionReason}</span>
                        </div>
                      )}
                    </div>

                    {/* Akční tlačítka schválení / neschválení */}
                    <div className="pt-3 border-t border-slate-100 dark:border-zinc-800/60 flex items-center justify-between gap-3">
                      {isPending ? (
                        <>
                          <button
                            onClick={() => handleOpenVacationModal(req)}
                            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-zinc-300 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors"
                          >
                            Detail & Upravit
                          </button>

                          <div className="flex items-center gap-2.5">
                            <button
                              onClick={() => handleOpenVacationModal(req)}
                              className="px-4 py-2 rounded-xl text-xs font-semibold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 transition-colors"
                            >
                              Neschválit
                            </button>

                            <button
                              onClick={() => handleApproveVacation(req)}
                              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-colors flex items-center gap-1.5"
                            >
                              <Check className="w-4 h-4" />
                              <span>Schválit</span>
                            </button>
                          </div>
                        </>
                      ) : isApproved ? (
                        <div className="w-full flex items-center justify-between text-xs text-emerald-600 dark:text-emerald-400 font-semibold py-1">
                          <span className="flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Dovolená byla schválena</span>
                          </span>
                          <button
                            onClick={() => handleOpenVacationModal(req)}
                            className="text-xs text-slate-500 hover:text-slate-800 dark:text-zinc-400 underline font-normal"
                          >
                            Zobrazit detail
                          </button>
                        </div>
                      ) : (
                        <div className="w-full flex items-center justify-between text-xs text-rose-600 dark:text-rose-400 font-semibold py-1">
                          <span className="flex items-center gap-1.5">
                            <AlertCircle className="w-4 h-4" />
                            <span>Žádost byla zamítnuta</span>
                          </span>
                          <button
                            onClick={() => handleOpenVacationModal(req)}
                            className="text-xs text-slate-500 hover:text-slate-800 dark:text-zinc-400 underline font-normal"
                          >
                            Zobrazit detail
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* KARTA 2: PROPUSTKY K LÉKAŘI V TÝMU */}
              {pendingDoctorsForManager.map((doc) => {
                const isPending = doc.status === 'pending';
                const isApproved = doc.status === 'approved';
                const isRejected = doc.status === 'rejected';

                return (
                  <div
                    key={doc.id}
                    className="p-6 sm:p-7 rounded-3xl bg-white dark:bg-zinc-900 shadow-sm flex flex-col justify-between gap-5 transition-all"
                  >
                    <div>
                      {/* Top row: Žadatel a typ lékař */}
                      <div className="flex items-center justify-between gap-3 mb-4">
                        <div className="flex items-center gap-3.5">
                          <div className="w-11 h-11 rounded-2xl bg-sky-500/15 text-sky-800 dark:text-sky-300 font-bold text-sm flex items-center justify-center flex-shrink-0">
                            {(doc.userName || '?')
                              .split(' ')
                              .filter(Boolean)
                              .map((n) => n[0])
                              .join('')}
                          </div>
                          <div>
                            <div className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                              <span>{doc.userName}</span>
                              {doc.department && (
                                <span className="text-[11px] font-normal px-2 py-0.2 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300">
                                  {doc.department}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-zinc-400">
                              {doc.userRole}
                            </div>
                          </div>
                        </div>

                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-full bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300">
                          <Stethoscope className="w-3.5 h-3.5" />
                          <span>{doc.typeName}</span>
                        </span>
                      </div>

                      {/* Prominent Medical info */}
                      <div className="p-4 rounded-2xl bg-slate-100/70 dark:bg-zinc-800/60 space-y-2 mb-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-bold text-slate-800 dark:text-zinc-200 flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-sky-500" />
                            <span>{formatDateCzech(doc.date || (doc as any).startDate)}</span>
                          </span>
                          <span className="font-bold font-mono text-sky-800 dark:text-sky-300 bg-sky-100/80 dark:bg-sky-950/60 px-2.5 py-0.5 rounded-lg">
                            {doc.startTime} – {doc.endTime}
                          </span>
                        </div>

                        <div className="text-xs text-slate-600 dark:text-zinc-300 flex items-center gap-1.5 pt-2 border-t border-slate-200/40 dark:border-zinc-700/60">
                          <Building2 className="w-4 h-4 text-slate-400 flex-shrink-0" />
                          <span className="font-medium text-slate-800 dark:text-zinc-200 truncate">{doc.facilityName}</span>
                        </div>

                        <div className="text-xs flex items-center justify-between pt-1 border-t border-slate-200/40 dark:border-zinc-700/60">
                          <span className="text-slate-500 dark:text-zinc-400">Zákonný nárok:</span>
                          <span className="font-semibold text-sky-600 dark:text-sky-400">
                            § 199 ZP (překážka v práci s náhradou mzdy)
                          </span>
                        </div>

                        <div className="text-xs flex items-center justify-between pt-1">
                          <span className="text-slate-500 dark:text-zinc-400">Potvrzení propustky:</span>
                          {doc.hasConfirmationDocument ? (
                            <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                              <FileCheck className="w-3.5 h-3.5" />
                              <span>Razítko lékaře doloženo</span>
                            </span>
                          ) : (
                            <span className="text-amber-600 dark:text-amber-400 font-medium">
                              Čeká na doložení propustky
                            </span>
                          )}
                        </div>
                      </div>

                      {doc.note && (
                        <p className="text-xs italic text-slate-600 dark:text-zinc-300 pl-1">
                          „{doc.note}“
                        </p>
                      )}

                      {isRejected && doc.rejectionReason && (
                        <div className="mt-2.5 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-xs text-rose-700 dark:text-rose-300">
                          <span className="font-bold">Důvod neuznání: </span>
                          <span>{doc.rejectionReason}</span>
                        </div>
                      )}
                    </div>

                    {/* Akční tlačítko lékaře - striktně "Schválit" */}
                    <div className="pt-3 border-t border-slate-100 dark:border-zinc-800/60 flex items-center justify-between gap-3">
                      {isPending ? (
                        <>
                          <button
                            onClick={() => handleOpenDoctorModal(doc)}
                            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-zinc-300 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors"
                          >
                            Detail & Ověřit
                          </button>

                          <div className="flex items-center gap-2.5">
                            <button
                              onClick={() => handleOpenDoctorModal(doc)}
                              className="px-4 py-2 rounded-xl text-xs font-semibold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 transition-colors"
                            >
                              Neschválit
                            </button>

                            <button
                              onClick={() => handleApproveDoctor(doc)}
                              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 shadow-sm transition-colors flex items-center gap-1.5"
                            >
                              <Check className="w-4 h-4" />
                              <span>Schválit</span>
                            </button>
                          </div>
                        </>
                      ) : isApproved ? (
                        <div className="w-full flex items-center justify-between text-xs text-sky-600 dark:text-sky-400 font-semibold py-1">
                          <span className="flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Propustka byla uznána</span>
                          </span>
                          <button
                            onClick={() => handleOpenDoctorModal(doc)}
                            className="text-xs text-slate-500 hover:text-slate-800 dark:text-zinc-400 underline font-normal"
                          >
                            Zobrazit detail
                          </button>
                        </div>
                      ) : (
                        <div className="w-full flex items-center justify-between text-xs text-rose-600 dark:text-rose-400 font-semibold py-1">
                          <span className="flex items-center gap-1.5">
                            <AlertCircle className="w-4 h-4" />
                            <span>Propustka nebyla uznána</span>
                          </span>
                          <button
                            onClick={() => handleOpenDoctorModal(doc)}
                            className="text-xs text-slate-500 hover:text-slate-800 dark:text-zinc-400 underline font-normal"
                          >
                            Zobrazit detail
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* 4. Týdenní kalendářní pás */}
        {(() => {
          const totalWeekHours = weekDays.reduce((acc, d) => acc + d.hours, 0);
          const weeklyTargetHours = 40.0;
          const selectedDayData = weekDays.find((d) => d.date === selectedWeekDate) || weekDays[weekDays.length - 1];
          const isSelectedWeekend = ['So', 'Ne'].includes(selectedDayData.dayName);
          const dailyTargetHours = isSelectedWeekend ? 0 : 8.0;
          const dailySaldo = selectedDayData.hours - dailyTargetHours;

          return (
            <section className="bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-sm transition-colors space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center flex-shrink-0">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                      Týdenní kalendářní pás
                    </h2>
                    <p className="text-xs text-slate-400 dark:text-zinc-500">
                      Kliknutím na den zobrazíte detail a odpracované hodiny
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {/* Weekly Progress Counter */}
                  <div className="text-right">
                    <div className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                      Týden: <span className="font-mono font-bold text-sky-600 dark:text-sky-400">{totalWeekHours.toFixed(1)}</span> / {weeklyTargetHours.toFixed(1)} h
                    </div>
                    <div className="w-32 h-1.5 bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden mt-1">
                      <div
                        className="h-full bg-sky-500 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, (totalWeekHours / weeklyTargetHours) * 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Week navigator */}
                  <div className="flex items-center gap-1 text-xs text-slate-500 bg-slate-100/70 dark:bg-zinc-800/60 px-2 py-1 rounded-xl">
                    <button className="p-0.5 hover:bg-white dark:hover:bg-zinc-700 rounded-lg transition-colors">
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <span className="font-semibold text-slate-700 dark:text-zinc-300 px-1">41. týden</span>
                    <button className="p-0.5 hover:bg-white dark:hover:bg-zinc-700 rounded-lg transition-colors">
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* 7 Days Strip */}
              <div className="grid grid-cols-7 gap-2 sm:gap-3">
                {weekDays.map((d) => {
                  const isSelected = d.date === selectedWeekDate;
                  return (
                    <button
                      key={d.date}
                      type="button"
                      onClick={() => setSelectedWeekDate(d.date)}
                      className={`p-3 rounded-2xl flex flex-col items-center justify-center text-center transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-sky-500/20 text-sky-950 dark:text-sky-200 ring-2 ring-sky-500/50 shadow-sm'
                          : d.isToday
                          ? 'bg-sky-500/10 text-sky-800 dark:text-sky-300 font-semibold hover:bg-sky-500/15'
                          : 'bg-slate-100/70 dark:bg-zinc-800/60 hover:bg-slate-200/60 dark:hover:bg-zinc-700/60 text-slate-700 dark:text-zinc-300'
                      }`}
                    >
                      <span className="text-xs font-semibold mb-1">{d.dayName}</span>
                      <span className="text-xs font-mono font-bold">
                        {d.hours > 0 ? `${d.hours.toFixed(1)}h` : '—'}
                      </span>
                      <div
                        className={`mt-1.5 h-1.5 w-1.5 rounded-full ${
                          d.hours > 0 ? 'bg-emerald-500' : 'bg-transparent'
                        }`}
                      />
                    </button>
                  );
                })}
              </div>

              {/* Selected Day Inspector */}
              <div className="p-3.5 rounded-2xl bg-slate-100/60 dark:bg-zinc-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-white dark:bg-zinc-700 text-sky-600 dark:text-sky-400 flex items-center justify-center font-bold font-mono shadow-sm">
                    {selectedDayData.dayName}
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                      <span>{formatDateCzech(selectedDayData.date)}</span>
                      {selectedDayData.isToday && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-sky-500 text-white">
                          Dnes
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-zinc-400">
                      {isSelectedWeekend
                        ? 'Víkendový den – nepracovní'
                        : selectedDayData.hours > 0
                        ? 'Odpracovaná řádná směna'
                        : 'Žádný evidovaný záznam'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs font-mono">
                  <div>
                    <span className="text-slate-400 dark:text-zinc-500 block text-[10px] uppercase">Odpracováno</span>
                    <span className="font-bold text-slate-900 dark:text-white text-sm">
                      {selectedDayData.hours.toFixed(1)} h
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 dark:text-zinc-500 block text-[10px] uppercase">Denní norma</span>
                    <span className="font-medium text-slate-600 dark:text-zinc-300">
                      {dailyTargetHours.toFixed(1)} h
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 dark:text-zinc-500 block text-[10px] uppercase">Saldo dne</span>
                    <span
                      className={`font-bold ${
                        dailySaldo > 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : dailySaldo < 0 && !isSelectedWeekend
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-slate-500'
                      }`}
                    >
                      {dailySaldo > 0 ? `+${dailySaldo.toFixed(1)} h` : `${dailySaldo.toFixed(1)} h`}
                    </span>
                  </div>
                </div>
              </div>
            </section>
          );
        })()}

        {/* 5. Hravý týmový přehled: Kdo je kde */}
        {(() => {
          // Dynamic team counts
          const inOfficeCount = DEV_PERSONAS.filter((p) => {
            const isCur = p.id === activePersona.id;
            return isCur ? (isClockedIn && activeLocation === 'office') : (p.initialClockedIn && p.location === 'office');
          }).length;

          const homeOfficeCount = DEV_PERSONAS.filter((p) => {
            const isCur = p.id === activePersona.id;
            return isCur ? (isClockedIn && activeLocation === 'home_office') : (p.initialClockedIn && p.location === 'home_office');
          }).length;

          const offlineCount = DEV_PERSONAS.length - inOfficeCount - homeOfficeCount;

          // Filter by search query and status filter
          const filteredPersonas = DEV_PERSONAS.filter((p) => {
            const q = teamSearchQuery.toLowerCase().trim();
            if (q) {
              const match =
                p.name.toLowerCase().includes(q) ||
                p.roleLabel.toLowerCase().includes(q) ||
                p.department.toLowerCase().includes(q);
              if (!match) return false;
            }

            const isCur = p.id === activePersona.id;
            const isPresent = isCur ? isClockedIn : p.initialClockedIn;
            const loc = isCur ? activeLocation : p.location;

            if (teamFilterStatus === 'office') return isPresent && loc === 'office';
            if (teamFilterStatus === 'home_office') return isPresent && loc === 'home_office';
            if (teamFilterStatus === 'offline') return !isPresent;
            return true;
          });

          return (
            <section className="bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-sm transition-colors space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 dark:bg-amber-400/15 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
                    <Coffee className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-slate-900 dark:text-white">
                        Kdo je kde
                      </h2>
                      <span className="text-[11px] font-semibold px-2 py-0.2 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300">
                        {filteredPersonas.length} / {DEV_PERSONAS.length} kolegů
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 dark:text-zinc-500">
                      Live přehled týmu – kdo je v kanceláři, kdo na dálku a kdo na pauze
                    </p>
                  </div>
                </div>

                {/* PŘEPÍNAČ: Kartičkový vs. Řádkový mód */}
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
              </div>

              {/* SEARCH & FILTER CONTROLS */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
                <div className="relative flex-1 max-w-sm">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={teamSearchQuery}
                    onChange={(e) => setTeamSearchQuery(e.target.value)}
                    placeholder="Vyhledat kolegu, roli nebo oddělení..."
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                  />
                  {teamSearchQuery && (
                    <button
                      onClick={() => setTeamSearchQuery('')}
                      className="absolute right-2.5 top-2.5 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300"
                    >
                      ×
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs">
                  <button
                    type="button"
                    onClick={() => setTeamFilterStatus('all')}
                    className={`px-3 py-1.5 rounded-xl font-medium transition-all ${
                      teamFilterStatus === 'all'
                        ? 'bg-slate-900 text-white dark:bg-white dark:text-zinc-900 shadow-sm'
                        : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200/70'
                    }`}
                  >
                    Všichni ({DEV_PERSONAS.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setTeamFilterStatus('office')}
                    className={`px-3 py-1.5 rounded-xl font-medium transition-all flex items-center gap-1.5 ${
                      teamFilterStatus === 'office'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-500/20'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>V kanceláři ({inOfficeCount})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTeamFilterStatus('home_office')}
                    className={`px-3 py-1.5 rounded-xl font-medium transition-all flex items-center gap-1.5 ${
                      teamFilterStatus === 'home_office'
                        ? 'bg-sky-600 text-white shadow-sm'
                        : 'bg-sky-500/10 text-sky-800 dark:text-sky-300 hover:bg-sky-500/20'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-sky-500" />
                    <span>Home Office ({homeOfficeCount})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTeamFilterStatus('offline')}
                    className={`px-3 py-1.5 rounded-xl font-medium transition-all flex items-center gap-1.5 ${
                      teamFilterStatus === 'offline'
                        ? 'bg-slate-600 text-white shadow-sm'
                        : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200/70'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-slate-400" />
                    <span>Mimo práci ({offlineCount})</span>
                  </button>
                </div>
              </div>

              {filteredPersonas.length === 0 && (
                <div className="py-8 text-center text-xs text-slate-400 dark:text-zinc-500">
                  Žádný kolega neodpovídá zadanému hledání nebo filtru.
                </div>
              )}

              {/* KARTIČKOVÝ MÓD */}
              {presenceViewMode === 'cards' && filteredPersonas.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 pt-1">
                  {filteredPersonas.map((p) => {
                    const isCurrent = p.id === activePersona.id;
                    let statusText = p.locationName;
                    let statusColor = 'slate';

                    if (isCurrent) {
                      if (isClockedIn) {
                        statusText = activeLocation === 'office' ? `V kanceláři (${workplaceName.split(' - ')[0]})` : 'Home Office';
                        statusColor = activeLocation === 'office' ? 'emerald' : 'sky';
                      } else {
                        statusText = 'Mimo práci';
                        statusColor = 'slate';
                      }
                    } else if (p.initialClockedIn) {
                      statusText = p.location === 'office' ? 'V kanceláři (Praha 1)' : 'Home Office';
                      statusColor = p.location === 'office' ? 'emerald' : 'sky';
                    } else if (p.locationName.includes('Pauza')) {
                      statusColor = 'amber';
                    }

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
                                  statusColor === 'emerald'
                                    ? 'bg-emerald-500'
                                    : statusColor === 'sky'
                                    ? 'bg-sky-500'
                                    : statusColor === 'amber'
                                    ? 'bg-amber-500'
                                    : 'bg-slate-400'
                                }`}
                              />
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5 truncate">
                                <span className="truncate">{p.name}</span>
                                {isCurrent && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-700 dark:text-amber-400 flex-shrink-0">
                                    Vy
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-500 dark:text-zinc-400 truncate">
                                {p.roleLabel}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 pt-3 border-t border-slate-200/40 dark:border-zinc-700/60 flex items-center justify-between gap-2">
                          <span
                            className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-semibold truncate ${
                              statusColor === 'emerald'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                : statusColor === 'sky'
                                ? 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300'
                                : statusColor === 'amber'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                : 'bg-slate-200/70 text-slate-700 dark:bg-zinc-700 dark:text-zinc-300'
                            }`}
                          >
                            {statusColor === 'emerald' && <MapPin className="w-3 h-3 flex-shrink-0" />}
                            {statusColor === 'sky' && <Home className="w-3 h-3 flex-shrink-0" />}
                            {statusColor === 'amber' && <Coffee className="w-3 h-3 flex-shrink-0" />}
                            <span className="truncate">{statusText}</span>
                          </span>

                          <div className="flex items-center gap-1 flex-shrink-0">
                            <a
                              href={`mailto:${p.email}`}
                              className="p-1.5 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-slate-200/60 dark:hover:bg-zinc-700 rounded-lg transition-colors flex-shrink-0"
                              title={`Odeslat email: ${p.email}`}
                            >
                              <Mail className="w-3.5 h-3.5" />
                            </a>
                            <a
                              href={`tel:${p.phoneNumber}`}
                              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 hover:bg-slate-200/60 dark:hover:bg-zinc-700 rounded-lg transition-colors flex-shrink-0"
                              title={`Zavolat: ${p.phoneNumber}`}
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
              {presenceViewMode === 'rows' && filteredPersonas.length > 0 && (
                <div className="divide-y divide-slate-100 dark:divide-zinc-800/60">
                  {filteredPersonas.map((p) => {
                    const isCurrent = p.id === activePersona.id;
                    let statusText = p.locationName;
                    let statusColor = 'slate';

                    if (isCurrent) {
                      if (isClockedIn) {
                        statusText = activeLocation === 'office' ? `V kanceláři (${workplaceName.split(' - ')[0]})` : 'Home Office';
                        statusColor = activeLocation === 'office' ? 'emerald' : 'sky';
                      } else {
                        statusText = 'Mimo práci';
                        statusColor = 'slate';
                      }
                    } else if (p.initialClockedIn) {
                      statusText = p.location === 'office' ? 'V kanceláři (Praha 1)' : 'Home Office';
                      statusColor = p.location === 'office' ? 'emerald' : 'sky';
                    } else if (p.locationName.includes('Pauza')) {
                      statusColor = 'amber';
                    }

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
                                statusColor === 'emerald'
                                  ? 'bg-emerald-500'
                                  : statusColor === 'sky'
                                  ? 'bg-sky-500'
                                  : statusColor === 'amber'
                                  ? 'bg-amber-500'
                                  : 'bg-slate-400'
                              }`}
                            />
                          </div>

                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-slate-900 dark:text-zinc-100 flex items-center gap-2 truncate">
                              <span className="truncate">{p.name}</span>
                              {isCurrent && (
                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-700 dark:text-amber-400 flex-shrink-0">
                                  Vy
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-zinc-400 truncate">
                              {p.roleLabel} • {p.department}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 flex-shrink-0">
                          <span
                            className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-semibold ${
                              statusColor === 'emerald'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                : statusColor === 'sky'
                                ? 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300'
                                : statusColor === 'amber'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                : 'bg-slate-200/70 text-slate-700 dark:bg-zinc-700 dark:text-zinc-300'
                            }`}
                          >
                            {statusColor === 'emerald' && <MapPin className="w-3 h-3" />}
                            {statusColor === 'sky' && <Home className="w-3 h-3" />}
                            {statusColor === 'amber' && <Coffee className="w-3 h-3" />}
                            <span>{statusText}</span>
                          </span>

                          <div className="flex items-center gap-1">
                            <a
                              href={`mailto:${p.email}`}
                              className="p-1.5 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-slate-200/60 dark:hover:bg-zinc-700 rounded-lg transition-colors"
                              title={`Odeslat email: ${p.email}`}
                            >
                              <Mail className="w-3.5 h-3.5" />
                            </a>
                            <a
                              href={`tel:${p.phoneNumber}`}
                              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 hover:bg-slate-200/60 dark:hover:bg-zinc-700 rounded-lg transition-colors"
                              title={`Zavolat: ${p.phoneNumber}`}
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
            </section>
          );
        })()}
      </main>

      {/* MODAL 1: Nová žádost o volno / lékař (Self-Service) */}
      <NewRequestModal
        isOpen={isNewRequestModalOpen}
        onClose={() => setIsNewRequestModalOpen(false)}
        onSubmit={handleCreateNewRequest}
        applicantName={activePersona.name}
        managerName={activePersona.managerName || 'Vedení společnosti'}
        vacationRemaining={activePersona.vacationRemaining}
        vacationTotal={activePersona.vacationTotal}
        sickDaysRemaining={activePersona.sickDaysRemaining}
        sickDaysTotal={activePersona.sickDaysTotal}
      />

      {/* MODAL 2: Organizační struktura & Týmy (Org Tree) */}
      <OrgHierarchyModal
        isOpen={isOrgHierarchyModalOpen}
        onClose={() => setIsOrgHierarchyModalOpen(false)}
        currentPersonaId={activePersona.id}
        people={orgPeopleList}
        onSelectPersona={(personId) => {
          const target = DEV_PERSONAS.find((p) => p.id === personId);
          if (target) {
            handleSwitchPersona(target);
            setIsOrgHierarchyModalOpen(false);
          }
        }}
      />

      {/* MODAL 3: Měsíční výkaz docházky (Timesheet & Saldo) */}
      <MonthlyTimesheetModal
        isOpen={isMonthlyTimesheetModalOpen}
        onClose={() => setIsMonthlyTimesheetModalOpen(false)}
        userName={activePersona.name}
        userRole={activePersona.roleLabel}
        contract={activePersona.contract}
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

      {/* MODAL 6: 7 pádů skloňování */}
      <DeclensionModal
        name={activePersona.name.split(' ')[0]}
        isOpen={isDeclensionModalOpen}
        onClose={() => setIsDeclensionModalOpen(false)}
        onSave={(_data) => {
          setIsDeclensionModalOpen(false);
          addToast(
            'success',
            'Skloňování uloženo',
            `Všech 7 pádů jména ${activePersona.name.split(' ')[0]} bylo uloženo do databáze.`
          );
        }}
        onIgnore={() => {
          setIsDeclensionModalOpen(false);
          addToast('warning', 'Jméno ignorováno', 'Systém se na skloňování tohoto jména již nebude dotazovat.');
        }}
      />

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

      {/* Floating NFC Simulator in Dev Mode */}
      <NfcDebugSimulator onSimulateClockIn={handleSimulatedNfc} />

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

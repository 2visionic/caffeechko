import { useState, useEffect, useMemo } from 'react';
import {
  Settings,
  Clock,
  Calendar,
  Check,
  Trash2,
  Save,
  Plus,
  Edit3,
  Briefcase,
  Sparkles,
  MapPin,
  Shield,
  Lock,
  Unlock,
  Smartphone,
  ArrowLeft,
  AlertTriangle,
  Terminal,
  RefreshCw,
  Search,
  KeyRound,
  Cpu,
  CheckCircle2,
  Info
} from 'lucide-react';
import {
  api,
  DEFAULT_ABSENCE_TYPES,
  type DevConfig,
  type DatabaseMode,
  type CompanySettingDto,
  type AbsenceTypeConfigDto,
  type ContractTypeSettingDto,
  type HolidayConfigDto,
  type WorkplaceDto
} from '../api';

interface SystemLogItem {
  id: string;
  userId?: string;
  type: string;
  status: string;
  dateTime: string;
}
import { SECTIONS } from '../config/sectionsConfig';
import {
  ABSENCE_ICON_OPTIONS,
  ABSENCE_COLOR_OPTIONS,
  resolveIconComponent,
  buildStatusVisualClasses,
  type ColorKey
} from '../config/presenceConfig';
import { nfcService } from '../services/nfcService';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { GdprSettingsTab } from './GdprSettingsTab';
import { Box, Button, SegmentedControl, Modal, Switch } from './ui';

interface SettingsViewProps {
  activeRole?: string;
  devConfig: DevConfig;
  dbMode: DatabaseMode;
  companySettings?: CompanySettingDto | null;
  absenceTypesMap?: Record<string, AbsenceTypeConfigDto>;
  contractTypes?: ContractTypeSettingDto[];
  onSaveCompanySettings?: (settings: Partial<CompanySettingDto>) => Promise<void> | void;
  onSaveAbsenceTypes?: (types: AbsenceTypeConfigDto[]) => Promise<void> | void;
  onContractTypesChanged?: () => Promise<void> | void;
  onWorkplacesChanged?: () => Promise<void> | void;
  onHolidaysChanged?: () => Promise<void> | void;
  onGdprChanged?: () => Promise<void> | void;
  onOpenDevModal?: () => void;
  onSwitchDbMode?: (mode: DatabaseMode) => void;
  onResetDevDb?: () => void;
  onWipeCleanDb?: () => void;
  isResettingDevDb?: boolean;
  isWipingCleanDb?: boolean;
  addToast?: (type: 'success' | 'warning' | 'error', title: string, message: string) => void;
}

type SettingsTabId = 'uvazky' | 'svatky' | 'pracoviste' | 'absence' | 'gdpr' | 'system';

const APP_VERSION = 'v1.4.0';

const CZECH_MONTHS = [
  'leden',
  'únor',
  'březen',
  'duben',
  'květen',
  'červen',
  'červenec',
  'srpen',
  'září',
  'říjen',
  'listopad',
  'prosinec'
];

const CZECH_MONTH_SHORT = ['LED', 'ÚNO', 'BŘE', 'DUB', 'KVĚ', 'ČER', 'ČVC', 'SRP', 'ZÁŘ', 'ŘÍJ', 'LIS', 'PRO'];


export function SettingsView({
  activeRole = 'admin',
  devConfig,
  dbMode,
  companySettings,
  absenceTypesMap = DEFAULT_ABSENCE_TYPES,
  contractTypes: initialContractTypes = [],
  onSaveCompanySettings,
  onSaveAbsenceTypes,
  onContractTypesChanged,
  onWorkplacesChanged,
  onHolidaysChanged,
  onGdprChanged,
  onOpenDevModal,
  addToast
}: SettingsViewProps) {
  const isAdmin = activeRole === 'admin';
  const [activeTab, setActiveTab] = useState<SettingsTabId>('uvazky');

  // Pokud se přepne z admina na officera a byl na tabu pracoviště, přepneme na úvazky
  useEffect(() => {
    if (!isAdmin && activeTab === 'pracoviste') {
      setActiveTab('uvazky');
    }
  }, [isAdmin, activeTab]);

  // ============================================================================
  // 1. TAB: ÚVAZKY (contract_types)
  // ============================================================================
  const [contractsList, setContractsList] = useState<ContractTypeSettingDto[]>(initialContractTypes);
  const [isLoadingContracts, setIsLoadingContracts] = useState(false);

  // Modál pro přidání / úpravu úvazku
  const [isContractModalOpen, setIsContractModalOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<ContractTypeSettingDto | null>(null);
  const [contractCode, setContractCode] = useState('');
  const [contractName, setContractName] = useState('');
  const [contractHasHoursFund, setContractHasHoursFund] = useState(true);
  const [contractCoefficient, setContractCoefficient] = useState('1');
  const [isSavingContract, setIsSavingContract] = useState(false);

  // Modál pro smazání úvazku (s detekcí kolize uživatelů)
  const [deletingContract, setDeletingContract] = useState<ContractTypeSettingDto | null>(null);
  const [replacementContractCode, setReplacementContractCode] = useState('');
  const [isDeletingContract, setIsDeletingContract] = useState(false);

  const loadContractTypes = async () => {
    setIsLoadingContracts(true);
    try {
      const res = await api.getContractTypes();
      if (res?.data) {
        setContractsList(res.data);
      }
    } finally {
      setIsLoadingContracts(false);
    }
  };

  useEffect(() => {
    loadContractTypes();
  }, []);

  useEffect(() => {
    if (initialContractTypes && initialContractTypes.length > 0 && contractsList.length === 0) {
      setContractsList(initialContractTypes);
    }
  }, [initialContractTypes]);

  const handleOpenAddContract = () => {
    setEditingContract(null);
    setContractCode('');
    setContractName('');
    setContractHasHoursFund(true);
    setContractCoefficient('1');
    setIsContractModalOpen(true);
  };

  const handleOpenEditContract = (ct: ContractTypeSettingDto) => {
    setEditingContract(ct);
    setContractCode(ct.code);
    setContractName(ct.name);
    const hasFund = (ct.coefficient ?? 0) > 0;
    setContractHasHoursFund(hasFund);
    setContractCoefficient(String(hasFund ? ct.coefficient : 1));
    setIsContractModalOpen(true);
  };

  const handleSaveContract = async () => {
    const cleanName = contractName.trim();
    const cleanCode = (editingContract ? editingContract.code : contractCode)
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_]/g, '_');

    if (!cleanName || !cleanCode) {
      addToast?.('warning', 'Chybějící údaje', 'Vyplňte prosím kód a název úvazku.');
      return;
    }

    setIsSavingContract(true);
    try {
      const coeff = contractHasHoursFund ? Math.max(0.05, Number(contractCoefficient) || 1) : 0;

      if (editingContract?.id) {
        const res = await api.updateContractType(editingContract.id, {
          code: cleanCode,
          name: cleanName,
          coefficient: coeff
        });
        if (res?.data) {
          addToast?.('success', 'Úvazek upraven', `Úvazek „${cleanName}“ byl aktualizován.`);
          await loadContractTypes();
          await onContractTypesChanged?.();
          setIsContractModalOpen(false);
        } else {
          addToast?.('error', 'Chyba při ukládání', res?.error?.message || 'Nepodařilo se uložit úvazek.');
        }
      } else {
        const res = await api.createContractType({
          code: cleanCode,
          name: cleanName,
          coefficient: coeff
        });
        if (res?.data) {
          addToast?.('success', 'Úvazek vytvořen', `Nový úvazek „${cleanName}“ byl přidán.`);
          await loadContractTypes();
          await onContractTypesChanged?.();
          setIsContractModalOpen(false);
        } else {
          addToast?.('error', 'Chyba při vytváření', res?.error?.message || 'Nepodařilo se vytvořit úvazek.');
        }
      }
    } finally {
      setIsSavingContract(false);
    }
  };

  const handlePromptDeleteContract = (ct: ContractTypeSettingDto) => {
    const others = contractsList.filter((item) => item.id !== ct.id && item.code !== ct.code);
    setReplacementContractCode(others[0]?.code || '');
    setDeletingContract(ct);
  };

  const handleConfirmDeleteContract = async () => {
    if (!deletingContract?.id) return;
    const hasUsers = (deletingContract.usersCount ?? 0) > 0;
    if (hasUsers && !replacementContractCode) {
      addToast?.('warning', 'Vyberte náhradní úvazek', 'Pro přesun dotčených uživatelů musíte vybrat cílový úvazek.');
      return;
    }

    setIsDeletingContract(true);
    try {
      const res = await api.deleteContractType(
        deletingContract.id,
        hasUsers ? replacementContractCode : undefined
      );
      if (res?.data) {
        addToast?.(
          'success',
          'Úvazek odstraněn',
          hasUsers
            ? `Úvazek „${deletingContract.name}“ byl smazán a ${deletingContract.usersCount} osob převedeno na ${replacementContractCode}.`
            : `Úvazek „${deletingContract.name}“ byl odstraněn.`
        );
        setDeletingContract(null);
        await loadContractTypes();
        await onContractTypesChanged?.();
      } else {
        addToast?.('error', 'Nelze smazat úvazek', res?.error?.message || 'Smazání úvazku selhalo.');
      }
    } finally {
      setIsDeletingContract(false);
    }
  };

  // ============================================================================
  // 2. TAB: SVÁTKY (holidays)
  // ============================================================================
  const [holidaysList, setHolidaysList] = useState<HolidayConfigDto[]>([]);
  const [isLoadingHolidays, setIsLoadingHolidays] = useState(false);
  const [isHolidayModalOpen, setIsHolidayModalOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<HolidayConfigDto | null>(null);
  const [holidayMode, setHolidayMode] = useState<'fixed' | 'easter'>('fixed');
  const [holidayDay, setHolidayDay] = useState('1');
  const [holidayMonth, setHolidayMonth] = useState('1');
  const [holidayEasterRule, setHolidayEasterRule] = useState('EASTER_FRIDAY');
  const [holidayName, setHolidayName] = useState('');
  const [holidayIsPublic, setHolidayIsPublic] = useState(true);
  const [isSavingHoliday, setIsSavingHoliday] = useState(false);
  const [deletingHoliday, setDeletingHoliday] = useState<HolidayConfigDto | null>(null);

  const loadHolidays = async () => {
    setIsLoadingHolidays(true);
    try {
      const res = await api.getHolidaysConfig();
      if (res?.data) {
        setHolidaysList(res.data);
      }
    } finally {
      setIsLoadingHolidays(false);
    }
  };

  useEffect(() => {
    loadHolidays();
  }, []);

  const handleOpenAddHoliday = () => {
    setEditingHoliday(null);
    setHolidayMode('fixed');
    setHolidayDay('1');
    setHolidayMonth('1');
    setHolidayEasterRule('EASTER_FRIDAY');
    setHolidayName('');
    setHolidayIsPublic(true);
    setIsHolidayModalOpen(true);
  };

  const handleOpenEditHoliday = (h: HolidayConfigDto) => {
    setEditingHoliday(h);
    if (h.rule && h.rule.toUpperCase().includes('EASTER')) {
      setHolidayMode('easter');
      setHolidayEasterRule(h.rule.toUpperCase());
      setHolidayDay('1');
      setHolidayMonth('4');
    } else {
      setHolidayMode('fixed');
      setHolidayDay(String(h.day ?? 1));
      setHolidayMonth(String(h.month ?? 1));
      setHolidayEasterRule('EASTER_FRIDAY');
    }
    setHolidayName(h.name);
    setHolidayIsPublic(!h.isCustomHoliday);
    setIsHolidayModalOpen(true);
  };

  const handleSaveHoliday = async () => {
    const cleanName = holidayName.trim();
    if (!cleanName) {
      addToast?.('warning', 'Chybí název svátku', 'Zadejte prosím název svátku.');
      return;
    }

    const payload: Partial<HolidayConfigDto> = {
      name: cleanName,
      isCustomHoliday: !holidayIsPublic,
      isActive: true,
      day: holidayMode === 'fixed' ? Math.min(31, Math.max(1, Number(holidayDay) || 1)) : null,
      month: holidayMode === 'fixed' ? Math.min(12, Math.max(1, Number(holidayMonth) || 1)) : null,
      rule: holidayMode === 'easter' ? holidayEasterRule : null
    };

    setIsSavingHoliday(true);
    try {
      if (editingHoliday?.id) {
        const res = await api.updateHoliday(editingHoliday.id, payload);
        if (res?.data) {
          addToast?.('success', 'Svátek upraven', `Svátek „${cleanName}“ byl aktualizován.`);
          await loadHolidays();
          await onHolidaysChanged?.();
          setIsHolidayModalOpen(false);
        } else {
          addToast?.('error', 'Chyba při ukládání', res?.error?.message || 'Nepodařilo se upravit svátek.');
        }
      } else {
        const res = await api.createHoliday(payload);
        if (res?.data) {
          addToast?.('success', 'Svátek přidán', `Svátek „${cleanName}“ byl přidán do kalendáře.`);
          await loadHolidays();
          await onHolidaysChanged?.();
          setIsHolidayModalOpen(false);
        } else {
          addToast?.('error', 'Chyba při vytváření', res?.error?.message || 'Nepodařilo se přidat svátek.');
        }
      }
    } finally {
      setIsSavingHoliday(false);
    }
  };

  const handleConfirmDeleteHoliday = async () => {
    if (!deletingHoliday?.id) return;
    const res = await api.deleteHoliday(deletingHoliday.id);
    if (res?.data) {
      addToast?.('success', 'Svátek smazán', `Svátek „${deletingHoliday.name}“ byl odebrán.`);
      setDeletingHoliday(null);
      await loadHolidays();
      await onHolidaysChanged?.();
    } else {
      addToast?.('error', 'Chyba při mazání', res?.error?.message || 'Nepodařilo se smazat svátek.');
    }
  };

  // ============================================================================
  // 3. TAB: PRACOVIŠTĚ (workplaces - POUZE ADMIN)
  // ============================================================================
  const [workplacesList, setWorkplacesList] = useState<WorkplaceDto[]>([]);
  const [isLoadingWorkplaces, setIsLoadingWorkplaces] = useState(false);
  const [selectedWorkplaceId, setSelectedWorkplaceId] = useState<string | null>(null);

  // Modál pro přidání / úpravu pracoviště
  const [isWorkplaceModalOpen, setIsWorkplaceModalOpen] = useState(false);
  const [editingWorkplace, setEditingWorkplace] = useState<WorkplaceDto | null>(null);
  const [wpName, setWpName] = useState('');
  const [wpNfcIdentifier, setWpNfcIdentifier] = useState('');
  const [wpAddress, setWpAddress] = useState('');
  const [wpIsActive, setWpIsActive] = useState<boolean>(true);
  const [isSavingWorkplace, setIsSavingWorkplace] = useState(false);
  const [deletingWorkplace, setDeletingWorkplace] = useState<WorkplaceDto | null>(null);

  // Nahrání pracoviště na NFC kartu:
  // Krok 1: Modál pro zadání hesla ke kartě
  // Krok 2: Modál s přiložením mobilu ke kartě (sonar Smartphone ikona jako u příchodu + text "Nahrát na kartu")
  const [isCardPasswordModalOpen, setIsCardPasswordModalOpen] = useState(false);
  const [cardPasswordInput, setCardPasswordInput] = useState('');
  const [isNfcWriteModalOpen, setIsNfcWriteModalOpen] = useState(false);
  const [isEncodingCard, setIsEncodingCard] = useState(false);

  const loadWorkplaces = async () => {
    if (!isAdmin) return;
    setIsLoadingWorkplaces(true);
    try {
      const res = await api.getWorkplaces(true);
      if (res?.data) {
        setWorkplacesList(res.data);
      }
    } finally {
      setIsLoadingWorkplaces(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadWorkplaces();
    }
  }, [isAdmin]);

  const selectedWorkplace = useMemo(
    () => workplacesList.find((w) => w.id === selectedWorkplaceId) || null,
    [workplacesList, selectedWorkplaceId]
  );

  const handleOpenAddWorkplace = () => {
    setEditingWorkplace(null);
    setWpName('');
    setWpNfcIdentifier(`NFC-WP-${Math.floor(100 + Math.random() * 900)}`);
    setWpAddress('');
    setWpIsActive(true);
    setIsWorkplaceModalOpen(true);
  };

  const handleOpenEditWorkplace = (wp: WorkplaceDto) => {
    setEditingWorkplace(wp);
    setWpName(wp.name);
    setWpNfcIdentifier(wp.nfcIdentifier || '');
    setWpAddress(wp.address || '');
    setWpIsActive(wp.isActive !== false);
    setIsWorkplaceModalOpen(true);
  };

  const handleSaveWorkplace = async () => {
    const cleanName = wpName.trim();
    if (!cleanName) {
      addToast?.('warning', 'Chybí název pracoviště', 'Zadejte prosím název pracoviště.');
      return;
    }

    const payload: Partial<WorkplaceDto> = {
      name: cleanName,
      nfcIdentifier: wpNfcIdentifier.trim() || `NFC-${Date.now()}`,
      address: wpAddress.trim(),
      isActive: wpIsActive
    };

    setIsSavingWorkplace(true);
    try {
      if (editingWorkplace?.id) {
        const res = await api.updateWorkplace(editingWorkplace.id, payload);
        if (res?.data) {
          addToast?.('success', 'Pracoviště upraveno', `Pracoviště „${cleanName}“ bylo uloženo.`);
          await loadWorkplaces();
          await onWorkplacesChanged?.();
          setIsWorkplaceModalOpen(false);
        } else {
          addToast?.('error', 'Chyba při ukládání', res?.error?.message || 'Nepodařilo se uložit pracoviště.');
        }
      } else {
        const res = await api.createWorkplace(payload);
        if (res?.data) {
          addToast?.('success', 'Pracoviště vytvořeno', `Pracoviště „${cleanName}“ bylo přidáno.`);
          await loadWorkplaces();
          await onWorkplacesChanged?.();
          const createdWp = res.data.find((w) => w.name === cleanName) || res.data[res.data.length - 1];
          setSelectedWorkplaceId(createdWp?.id || null);
          setIsWorkplaceModalOpen(false);
        } else {
          addToast?.('error', 'Chyba při vytváření', res?.error?.message || 'Nepodařilo se vytvořit pracoviště.');
        }
      }
    } finally {
      setIsSavingWorkplace(false);
    }
  };

  const handleConfirmDeleteWorkplace = async () => {
    if (!deletingWorkplace?.id) return;
    const res = await api.deleteWorkplace(deletingWorkplace.id);
    if (res?.data) {
      addToast?.('success', 'Pracoviště odstraněno', `Pracoviště „${deletingWorkplace.name}“ bylo smazáno.`);
      if (selectedWorkplaceId === deletingWorkplace.id) {
        setSelectedWorkplaceId(null);
      }
      setDeletingWorkplace(null);
      await loadWorkplaces();
      await onWorkplacesChanged?.();
    } else {
      addToast?.('error', 'Chyba při mazání', res?.error?.message || 'Nepodařilo se smazat pracoviště.');
    }
  };

  // Krok 1: Kliknutí na "Nahrát na kartu" -> otevře zadání hesla
  const handleStartCardEncoding = () => {
    setCardPasswordInput('');
    setIsCardPasswordModalOpen(true);
  };

  // Krok 2: Potvrzení hesla -> otevře modál se sonarem "Nahrát na kartu"
  const handleConfirmCardPassword = () => {
    if (cardPasswordInput.trim().length < 4) {
      addToast?.('warning', 'Příliš krátké heslo', 'Heslo pro zabezpečení NFC karty musí mít alespoň 4 znaky.');
      return;
    }
    setIsCardPasswordModalOpen(false);
    setIsNfcWriteModalOpen(true);
  };

  // Krok 3: Přiložení mobilu ke kartě (nebo kliknutí na sonar)
  const executeCardWrite = async (hardwareUid?: string) => {
    if (!selectedWorkplace?.id || isEncodingCard) return;
    setIsEncodingCard(true);
    try {
      const res = await api.encodeWorkplaceCard(
        selectedWorkplace.id,
        cardPasswordInput.trim(),
        hardwareUid || selectedWorkplace.nfcHardwareUid || undefined
      );

      if (res?.data) {
        addToast?.(
          'success',
          'Nahráno na NFC kartu',
          `Pracoviště „${selectedWorkplace.name}“ bylo úspěšně zapsáno a karta zabezpečena heslem.`
        );
        setIsNfcWriteModalOpen(false);
        setCardPasswordInput('');
        await loadWorkplaces();
        await onWorkplacesChanged?.();
      } else {
        addToast?.('error', 'Chyba zápisu karty', res?.error?.message || 'Nepodařilo se nahrát pracoviště na kartu.');
      }
    } finally {
      setIsEncodingCard(false);
    }
  };

  // Pokud je otevřený modál "Nahrát na kartu" a zařízení podporuje čtení NFC UID, nasloucháme přiložení karty
  useEffect(() => {
    if (!isNfcWriteModalOpen || !selectedWorkplace?.id) return;
    let active = true;

    void nfcService.initHardwareNfc();
    const unsubscribe = nfcService.subscribe((scanResult) => {
      if (!active) return;
      void executeCardWrite(scanResult.rawUid);
    });

    return () => {
      active = false;
      unsubscribe();
      void nfcService.stopHardwareNfc();
    };
  }, [isNfcWriteModalOpen, selectedWorkplace?.id]);

  // ============================================================================
  // 4. TAB: ABSENCE (absence_types s Icon, Color, IsSystem)
  // ============================================================================
  const [editableTypes, setEditableTypes] = useState<AbsenceTypeConfigDto[]>(() =>
    Object.values(absenceTypesMap)
  );

  useEffect(() => {
    setEditableTypes(Object.values(absenceTypesMap));
  }, [absenceTypesMap]);

  // Modál pro přidání / úpravu typu absence
  const [isAbsenceModalOpen, setIsAbsenceModalOpen] = useState(false);
  const [editingAbsenceType, setEditingAbsenceType] = useState<AbsenceTypeConfigDto | null>(null);
  const [absCode, setAbsCode] = useState('');
  const [absName, setAbsName] = useState('');
  const [absIcon, setAbsIcon] = useState('Palmtree');
  const [absColor, setAbsColor] = useState<ColorKey>('amber');
  const [absBudgetPeriod, setAbsBudgetPeriod] = useState<'yearly' | 'monthly' | 'weekly' | 'unlimited'>('yearly');
  const [absDefaultAllowance, setAbsDefaultAllowance] = useState('5');
  const [absDurationMode, setAbsDurationMode] = useState<'days' | 'single_day' | 'hours'>('days');
  const [absAllowOsvc, setAbsAllowOsvc] = useState(false);
  const [absIsPrivate, setAbsIsPrivate] = useState(false);
  const [absApproverRole, setAbsApproverRole] = useState<string>('manager');
  const [absMaxPerMonth, setAbsMaxPerMonth] = useState('');
  const [absDeadlineTime, setAbsDeadlineTime] = useState('');
  const [isSavingAbsence, setIsSavingAbsence] = useState(false);

  const [deletingAbsenceType, setDeletingAbsenceType] = useState<AbsenceTypeConfigDto | null>(null);

  const handleOpenAddAbsence = () => {
    setEditingAbsenceType(null);
    setAbsCode('');
    setAbsName('');
    setAbsIcon('Calendar');
    setAbsColor('amber');
    setAbsBudgetPeriod('yearly');
    setAbsDefaultAllowance('5');
    setAbsDurationMode('days');
    setAbsAllowOsvc(false);
    setAbsIsPrivate(false);
    setAbsApproverRole('manager');
    setAbsMaxPerMonth('');
    setAbsDeadlineTime('');
    setIsAbsenceModalOpen(true);
  };

  const handleOpenEditAbsence = (t: AbsenceTypeConfigDto) => {
    setEditingAbsenceType(t);
    setAbsCode(t.code);
    setAbsName(t.nameEmployee);
    setAbsIcon(t.icon || 'Palmtree');
    setAbsColor((t.color as ColorKey) || 'amber');
    const period =
      t.defaultBudgetPeriod === 'yearly' || t.defaultBudgetPeriod === 'annual'
        ? 'yearly'
        : t.defaultBudgetPeriod === 'monthly'
        ? 'monthly'
        : t.defaultBudgetPeriod === 'weekly'
        ? 'weekly'
        : 'unlimited';
    setAbsBudgetPeriod(period);
    setAbsDefaultAllowance(
      t.defaultAllowance !== null && t.defaultAllowance !== undefined ? String(t.defaultAllowance) : ''
    );
    const mode =
      t.durationMode === 'single_day' || t.durationMode === '2'
        ? 'single_day'
        : t.durationMode === 'hours' || t.durationMode === '3'
        ? 'hours'
        : 'days';
    setAbsDurationMode(mode);
    setAbsAllowOsvc(Boolean(t.allowOsvc));
    setAbsIsPrivate(Boolean(t.isPrivate));
    setAbsApproverRole(t.approverRole ?? '');
    setAbsMaxPerMonth(t.maxPerMonthLimit ? String(t.maxPerMonthLimit) : '');
    setAbsDeadlineTime(t.submissionDeadlineTime || '');
    setIsAbsenceModalOpen(true);
  };

  const handleSaveAbsenceModal = async () => {
    const cleanName = absName.trim();
    const cleanCode = (editingAbsenceType ? editingAbsenceType.code : absCode)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_');

    if (!cleanName || !cleanCode) {
      addToast?.('warning', 'Chybějící údaje', 'Vyplňte prosím kód a název absence.');
      return;
    }

    const allowanceVal =
      absBudgetPeriod === 'unlimited' || absDefaultAllowance.trim() === ''
        ? null
        : Math.max(0, Number(absDefaultAllowance));

    const updatedItem: AbsenceTypeConfigDto = {
      id: editingAbsenceType?.id,
      code: cleanCode,
      nameEmployee: cleanName,
      icon: absIcon,
      color: absColor,
      isSystem: editingAbsenceType ? Boolean(editingAbsenceType.isSystem) : false,
      allowOsvc: absAllowOsvc,
      isPrivate: absIsPrivate,
      approverRole: absApproverRole.trim() === '' ? null : absApproverRole.trim(),
      defaultBudgetPeriod: absBudgetPeriod,
      defaultAllowance: allowanceVal,
      durationMode: absDurationMode,
      submissionOffsetDays: editingAbsenceType?.submissionOffsetDays ?? 0,
      submissionDeadlineTime: absDeadlineTime.trim() || null,
      maxPerMonthLimit: absMaxPerMonth.trim() === '' ? null : Math.max(1, Number(absMaxPerMonth)),
      isActive: true
    };

    if (editingAbsenceType) {
      const origPeriod =
        editingAbsenceType.defaultBudgetPeriod === 'yearly' || editingAbsenceType.defaultBudgetPeriod === 'annual'
          ? 'yearly'
          : editingAbsenceType.defaultBudgetPeriod === 'monthly'
          ? 'monthly'
          : editingAbsenceType.defaultBudgetPeriod === 'weekly'
          ? 'weekly'
          : 'unlimited';
      const origMode =
        editingAbsenceType.durationMode === 'single_day' || editingAbsenceType.durationMode === '2'
          ? 'single_day'
          : editingAbsenceType.durationMode === 'hours' || editingAbsenceType.durationMode === '3'
          ? 'hours'
          : 'days';
      const origAllowance =
        origPeriod === 'unlimited' || editingAbsenceType.defaultAllowance === null || editingAbsenceType.defaultAllowance === undefined
          ? null
          : Number(editingAbsenceType.defaultAllowance);
      const origApprover = (editingAbsenceType.approverRole ?? '').trim() || null;
      const origDeadline = (editingAbsenceType.submissionDeadlineTime || '').trim() || null;
      const origMaxMonth = editingAbsenceType.maxPerMonthLimit ? Number(editingAbsenceType.maxPerMonthLimit) : null;

      if (
        updatedItem.nameEmployee === editingAbsenceType.nameEmployee &&
        updatedItem.icon === (editingAbsenceType.icon || 'Palmtree') &&
        updatedItem.color === (editingAbsenceType.color || 'amber') &&
        updatedItem.allowOsvc === Boolean(editingAbsenceType.allowOsvc) &&
        updatedItem.isPrivate === Boolean(editingAbsenceType.isPrivate) &&
        updatedItem.approverRole === origApprover &&
        updatedItem.defaultBudgetPeriod === origPeriod &&
        updatedItem.defaultAllowance === origAllowance &&
        updatedItem.durationMode === origMode &&
        updatedItem.submissionDeadlineTime === origDeadline &&
        updatedItem.maxPerMonthLimit === origMaxMonth
      ) {
        setIsAbsenceModalOpen(false);
        return;
      }
    }

    setIsSavingAbsence(true);
    try {
      const nextList = editingAbsenceType
        ? editableTypes.map((item) => (item.code === editingAbsenceType.code ? updatedItem : item))
        : [...editableTypes, updatedItem];

      setEditableTypes(nextList);
      if (onSaveAbsenceTypes) {
        await onSaveAbsenceTypes(nextList);
      }
      setIsAbsenceModalOpen(false);
    } finally {
      setIsSavingAbsence(false);
    }
  };

  const handleConfirmDeleteAbsence = async () => {
    if (!deletingAbsenceType) return;
    if (deletingAbsenceType.isSystem) {
      addToast?.('error', 'Systémový záznam', 'Systémové typy absencí nelze smazat.');
      setDeletingAbsenceType(null);
      return;
    }

    const targetIdOrCode = deletingAbsenceType.id || deletingAbsenceType.code;
    const res = await api.deleteAbsenceType(targetIdOrCode);
    if (res?.data) {
      const nextList = editableTypes.filter((t) => t.code !== deletingAbsenceType.code);
      setEditableTypes(nextList);
      if (onSaveAbsenceTypes) {
        await onSaveAbsenceTypes(nextList);
      }
      addToast?.('success', 'Absence smazána', `Typ absence „${deletingAbsenceType.nameEmployee}“ byl odstraněn.`);
      setDeletingAbsenceType(null);
    } else {
      addToast?.('error', 'Nelze smazat absenci', res?.error?.message || 'Smazání typu absence selhalo.');
    }
  };

  // ============================================================================
  // 5. TAB: SYSTÉM (Verze, DailyHours, WeeklyWorkDays, a Logy pro Admina)
  // ============================================================================
  const [dailyHours, setDailyHours] = useState<number>(companySettings?.dailyHours ?? 8);
  const [weeklyWorkDays, setWeeklyWorkDays] = useState<number>(companySettings?.weeklyWorkDays ?? 5);
  const [isSavingWorktime, setIsSavingWorktime] = useState(false);
  const [isWorktimeSaved, setIsWorktimeSaved] = useState(false);

  useEffect(() => {
    if (companySettings) {
      setDailyHours(companySettings.dailyHours ?? 8);
      setWeeklyWorkDays(companySettings.weeklyWorkDays ?? 5);
    }
  }, [companySettings]);

  const handleSaveWorktimeSettings = async () => {
    if (!onSaveCompanySettings) return;
    setIsSavingWorktime(true);
    try {
      await onSaveCompanySettings({
        dailyHours: Number(dailyHours) || 8,
        weeklyWorkDays: Number(weeklyWorkDays) || 5
      });
      setIsWorktimeSaved(true);
      addToast?.('success', 'Pracovní fond uložen', 'Denní úvazek a počet pracovních dnů byly aktualizovány.');
      setTimeout(() => setIsWorktimeSaved(false), 2500);
    } finally {
      setIsSavingWorktime(false);
    }
  };

  // Systémové logy (pouze pro Admina)
  const [logs, setLogs] = useState<SystemLogItem[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [logTypeFilter, setLogTypeFilter] = useState<string>('all');
  const [logSearchQuery, setLogSearchQuery] = useState<string>('');
  const [isConfirmClearLogsOpen, setIsConfirmClearLogsOpen] = useState(false);

  const loadSystemLogs = async () => {
    if (!isAdmin) return;
    setIsLoadingLogs(true);
    try {
      const res = await api.getLogs(200);
      if (res?.data) {
        setLogs(res.data);
      }
    } finally {
      setIsLoadingLogs(false);
    }
  };

  useEffect(() => {
    if (isAdmin && activeTab === 'system') {
      loadSystemLogs();
    }
  }, [isAdmin, activeTab]);

  const handleConfirmClearSystemLogs = async () => {
    const res = await api.clearLogs();
    if (res && res.data !== undefined) {
      setLogs([]);
      addToast?.('success', 'Logy promazány', `Databázová tabulka logs byla úspěšně vyčištěna (${res.data} záznamů).`);
      setIsConfirmClearLogsOpen(false);
    } else {
      addToast?.('error', 'Chyba při mazání logů', 'Nepodařilo se promazat logy.');
    }
  };

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const t = String(log.type || '').toLowerCase();
      if (logTypeFilter !== 'all' && t !== logTypeFilter) {
        return false;
      }
      if (logSearchQuery.trim() !== '') {
        const q = logSearchQuery.toLowerCase();
        const matchStatus = log.status?.toLowerCase().includes(q);
        const matchUser = log.userId?.toLowerCase().includes(q);
        return Boolean(matchStatus || matchUser);
      }
      return true;
    });
  }, [logs, logTypeFilter, logSearchQuery]);

  // Definice tabů (Pracoviště vidí pouze Admin)
  const tabs = useMemo(() => {
    const items: { id: SettingsTabId; label: string; icon: typeof Settings }[] = [
      { id: 'uvazky', label: 'Úvazky', icon: Briefcase },
      { id: 'svatky', label: 'Svátky', icon: Sparkles },
      ...(isAdmin ? [{ id: 'pracoviste' as const, label: 'Pracoviště', icon: MapPin }] : []),
      { id: 'absence', label: 'Absence', icon: Calendar },
      { id: 'gdpr', label: 'GDPR', icon: Shield },
      { id: 'system', label: 'Systém', icon: Settings }
    ];
    return items;
  }, [isAdmin]);

  return (
    <div className="space-y-6">
      {selectedWorkplace ? (
        /* DETAIL (PROFIL) PRACOVIŠTĚ - Vše součástí jednoho hlavního boxu */
        <Box className="space-y-6">
          {/* Top row: Zpět + Pracoviště (vlevo) + Akce Upravit / Odebrat (vpravo) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              <button
                type="button"
                onClick={() => setSelectedWorkplaceId(null)}
                title="Zpět na přehled pracovišť"
                className="p-1 -ml-1 text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer flex items-center justify-center flex-shrink-0"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <MapPin className="w-6 h-6" />
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
                    {selectedWorkplace.name}
                  </span>
                  <span className="font-mono text-[10px] px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-800 dark:text-amber-300">
                    {selectedWorkplace.nfcIdentifier}
                  </span>
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                      selectedWorkplace.hasCardPassword
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                        : 'bg-amber-500/15 text-amber-800 dark:text-amber-300'
                    }`}
                  >
                    {selectedWorkplace.hasCardPassword ? (
                      <>
                        <Lock className="w-3 h-3" />
                        <span>Karta nahrána</span>
                      </>
                    ) : (
                      <>
                        <Unlock className="w-3 h-3" />
                        <span>Nenahráno</span>
                      </>
                    )}
                  </span>
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      selectedWorkplace.isActive !== false
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                        : 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
                    }`}
                  >
                    {selectedWorkplace.isActive !== false ? 'Aktivní provoz' : 'Mimo provoz'}
                  </span>
                </div>

                <div className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 flex items-center gap-1.5 truncate">
                  <MapPin className="w-3.5 h-3.5 shrink-0 text-slate-400 dark:text-zinc-500" />
                  <span className="truncate">
                    {selectedWorkplace.address || 'Adresa pracoviště není vyplněna'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="surface"
                size="icon"
                icon={Edit3}
                onClick={() => handleOpenEditWorkplace(selectedWorkplace)}
                title="Upravit pracoviště"
              />
              <Button
                variant="transparent"
                color="rose"
                size="icon"
                icon={Trash2}
                onClick={() => setDeletingWorkplace(selectedWorkplace)}
                title="Odebrat pracoviště"
              />
            </div>
          </div>

          {/* Hero tlačítko Nahrát na kartu na vlastním řádku vycentrované a prodloužené */}
          <div className="flex justify-center w-full pt-2 sm:pt-4">
            <div className="w-full max-w-xl">
              <Button
                variant="filled"
                colorKey="emerald"
                size="hero"
                icon={Smartphone}
                onClick={handleStartCardEncoding}
                width="full"
                className="justify-center shadow-lg"
              >
                NAHRÁT NA KARTU
              </Button>
            </div>
          </div>

          {/* Informační pod-boxy na 100% šířky uvnitř stejného boxu */}
          <div className="space-y-4 pt-2">
            <Box
              level={2}
              header={{
                icon: MapPin,
                title: 'Informace o pracovišti',
                subtitle: 'Základní údaje, adresa a provozní stav pobočky'
              }}
              className="w-full space-y-4"
            >
              <div className="space-y-3 text-sm">
                <div className="flex flex-col sm:flex-row sm:justify-between py-2 border-b border-slate-100 dark:border-zinc-800 gap-1">
                  <span className="text-slate-500 dark:text-zinc-400">Název pracoviště:</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{selectedWorkplace.name}</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between py-2 border-b border-slate-100 dark:border-zinc-800 gap-1">
                  <span className="text-slate-500 dark:text-zinc-400">Adresa:</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{selectedWorkplace.address || '—'}</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between py-2 gap-1">
                  <span className="text-slate-500 dark:text-zinc-400">Stav:</span>
                  <span className={`font-semibold ${selectedWorkplace.isActive !== false ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {selectedWorkplace.isActive !== false ? 'Aktivní provoz' : 'Mimo provoz'}
                  </span>
                </div>
              </div>
            </Box>

            <Box
              level={2}
              header={{
                icon: Cpu,
                title: 'NFC Hardware & Identifikátor',
                subtitle: 'Technická konfigurace fyzického NFC tagu pro docházkový kiosek a mobilní příchody'
              }}
              className="w-full space-y-4"
            >
              <div className="space-y-3 text-sm">
                <div className="flex flex-col sm:flex-row sm:justify-between py-2 border-b border-slate-100 dark:border-zinc-800 gap-1">
                  <span className="text-slate-500 dark:text-zinc-400">NFC Identifikátor (URL payload):</span>
                  <span className="font-mono font-bold text-amber-600 dark:text-amber-400">{selectedWorkplace.nfcIdentifier}</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between py-2 border-b border-slate-100 dark:border-zinc-800 gap-1">
                  <span className="text-slate-500 dark:text-zinc-400">Hardware UID karty:</span>
                  <span className="font-mono font-semibold text-slate-900 dark:text-white">{selectedWorkplace.nfcHardwareUid || 'Dosud nespárováno'}</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between py-2 gap-1">
                  <span className="text-slate-500 dark:text-zinc-400">Systémové ID:</span>
                  <span className="font-mono text-xs text-slate-500 dark:text-zinc-400">{selectedWorkplace.id}</span>
                </div>
              </div>
            </Box>

            <Box
              level={2}
              header={{
                icon: Shield,
                title: 'Kryptografické zabezpečení a zámek karty',
                subtitle: 'Ochrana fyzické NFC karty před neoprávněným přepsáním a podvržením docházky'
              }}
              className="w-full space-y-4"
            >
              <div className="space-y-3 text-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between py-2 border-b border-slate-100 dark:border-zinc-800 gap-2">
                  <span className="text-slate-500 dark:text-zinc-400">Stav ochrany heslem:</span>
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-bold w-fit ${
                      selectedWorkplace.hasCardPassword
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                        : 'bg-amber-500/15 text-amber-800 dark:text-amber-300'
                    }`}
                  >
                    {selectedWorkplace.hasCardPassword ? 'Zaheslováno (SHA-256)' : 'Dosud bez hesla'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed pt-1">
                  {selectedWorkplace.hasCardPassword
                    ? 'Karta pracoviště je chráněna heslem proti přepsání. Pro nahrání nové karty nebo změnu hesla klikněte na „Nahrát na kartu“.'
                    : 'Karta zatím nemá nastavené heslo. Kliknutím na „Nahrát na kartu“ zvolíte heslo a přiložením mobilu kartu nahrajete a uzamknete.'}
                </p>
              </div>
            </Box>
          </div>
        </Box>
      ) : (
        /* JEDEN SPOLEČNÝ BOX S TABY JAKO JINDE V APLIKACI */
        <Box
          header={{
            icon: SECTIONS.settings.icon,
            title: 'Nastavení systému',
            subtitle: 'Konfigurace úvazků, svátků, pracovišť, číselníku absencí a systémových parametrů'
          }}
          className="space-y-6"
        >
          {/* PŘEPÍNAČ TABŮ */}
          <SegmentedControl
            full
            value={activeTab}
            onChange={(val) => setActiveTab(val as SettingsTabId)}
            className="w-full"
            options={tabs.map((t) => ({
              id: t.id,
              label: t.label,
            icon: t.icon
          }))}
        />

        {/* ====================================================================
            TAB 1: ÚVAZKY (contract_types) - Admin & Officer
           ==================================================================== */}
        {activeTab === 'uvazky' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button
                variant="filled"
                color="primary"
                size="normal"
                icon={Plus}
                onClick={handleOpenAddContract}
                className="whitespace-nowrap flex-shrink-0"
              >
                Úvazek
              </Button>
            </div>

            {isLoadingContracts ? (
              <div className="p-8 text-center text-xs text-slate-400 dark:text-zinc-500">
                Načítání úvazků z databáze...
              </div>
            ) : (
              <div className="space-y-2.5">
                {contractsList.map((ct) => {
                  const hasFund = (ct.coefficient ?? 0) > 0;

                  return (
                    <div
                      key={ct.id || ct.code}
                      onClick={() => handleOpenEditContract(ct)}
                      className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-100/80 dark:hover:bg-zinc-800/70 transition-colors cursor-pointer w-full"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-slate-900 dark:text-white">
                            {ct.name}
                          </span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-sky-500/15 text-sky-700 dark:text-sky-300">
                            {ct.usersCount ?? 0} {ct.usersCount === 1 ? 'osoba' : (ct.usersCount ?? 0) >= 2 && (ct.usersCount ?? 0) <= 4 ? 'osoby' : 'osob'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                          Koeficient úvazku:{' '}
                          <strong className="text-slate-700 dark:text-zinc-200 font-mono">
                            {ct.coefficient.toFixed(2)}
                          </strong>
                          {' • '}
                          Denní norma:{' '}
                          <strong className="text-slate-700 dark:text-zinc-200">
                            {hasFund ? `${((companySettings?.dailyHours ?? 8) * ct.coefficient).toFixed(1)} h / den` : 'Nehlídá se'}
                          </strong>
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="surface"
                          size="icon-sm"
                          icon={Edit3}
                          onClick={() => handleOpenEditContract(ct)}
                          title="Upravit úvazek"
                        />
                        <Button
                          variant="transparent"
                          color="rose"
                          size="icon-sm"
                          icon={Trash2}
                          onClick={() => handlePromptDeleteContract(ct)}
                          disabled={contractsList.length <= 1}
                          title="Odebrat úvazek"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ====================================================================
            TAB 2: SVÁTKY (holidays) - Admin & Officer
           ==================================================================== */}
        {activeTab === 'svatky' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button
                variant="filled"
                color="primary"
                size="normal"
                icon={Plus}
                onClick={handleOpenAddHoliday}
                className="whitespace-nowrap flex-shrink-0"
              >
                Svátek
              </Button>
            </div>

            {isLoadingHolidays ? (
              <div className="p-8 text-center text-xs text-slate-400 dark:text-zinc-500">
                Načítání svátků z databáze...
              </div>
            ) : (
              <div className="flex flex-col gap-2.5 w-full">
                {holidaysList.map((h) => {
                  const isEaster = Boolean(h.rule && h.rule.toUpperCase().includes('EASTER'));
                  const monthIdx = (h.month ?? 1) - 1;
                  const monthShort = CZECH_MONTH_SHORT[monthIdx] || `${h.month}.`;
                  const dateLabel = isEaster
                    ? h.rule?.toUpperCase().includes('FRIDAY') || h.rule?.toUpperCase() === 'EASTER-2'
                      ? 'Velký pátek (pohyblivý)'
                      : 'Velikonoční pondělí (pohyblivý)'
                    : `${h.day}. ${CZECH_MONTHS[(h.month ?? 1) - 1] || `${h.month}.`}`;

                  return (
                    <div
                      key={h.id}
                      onClick={() => handleOpenEditHoliday(h)}
                      className="p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-800/40 flex items-center justify-between gap-3 hover:bg-slate-100/80 dark:hover:bg-zinc-800/70 transition-colors cursor-pointer w-full"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-2xl bg-amber-500/15 text-amber-700 dark:text-amber-300 flex flex-col items-center justify-center shrink-0">
                          {isEaster ? (
                            <>
                              <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                              <span className="text-[9px] font-bold uppercase tracking-wider leading-none mt-0.5 text-amber-800 dark:text-amber-300">
                                JARO
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="text-base sm:text-lg font-normal leading-none text-slate-900 dark:text-white">
                                {h.day}
                              </span>
                              <span className="text-[9px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300 leading-none mt-0.5">
                                {monthShort}
                              </span>
                            </>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {h.name}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[11px] text-slate-500 dark:text-zinc-400">
                              {dateLabel}
                            </span>
                            <span
                              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                                h.isCustomHoliday
                                  ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300'
                                  : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                              }`}
                            >
                              {h.isCustomHoliday ? 'Firemní volno' : 'Státní svátek'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="surface"
                          size="icon-sm"
                          icon={Edit3}
                          onClick={() => handleOpenEditHoliday(h)}
                          title="Upravit svátek"
                        />
                        <Button
                          variant="transparent"
                          color="rose"
                          size="icon-sm"
                          icon={Trash2}
                          onClick={() => setDeletingHoliday(h)}
                          title="Odebrat svátek"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ====================================================================
            TAB 3: PRACOVIŠTĚ (workplaces) - POUZE ADMIN
           ==================================================================== */}
        {activeTab === 'pracoviste' && isAdmin && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button
                variant="filled"
                color="primary"
                size="normal"
                icon={Plus}
                onClick={handleOpenAddWorkplace}
                className="whitespace-nowrap flex-shrink-0"
              >
                Pracoviště
              </Button>
            </div>

            {isLoadingWorkplaces ? (
              <div className="p-8 text-center text-xs text-slate-400 dark:text-zinc-500">
                Načítání pracovišť z databáze...
              </div>
            ) : (
              <div className="flex flex-col gap-3 w-full">
                {workplacesList.map((wp) => (
                  <div
                    key={wp.id || wp.name}
                    onClick={() => setSelectedWorkplaceId(wp.id || null)}
                    className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/40 hover:bg-slate-100 dark:hover:bg-zinc-800/80 transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 group w-full"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                        <MapPin className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors truncate">
                            {wp.name}
                          </span>
                          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-200/70 dark:bg-zinc-700/60 text-slate-600 dark:text-zinc-300">
                            {wp.nfcIdentifier}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-zinc-400 truncate mt-0.5">
                          {wp.address || 'Adresa neuvedena'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0 ${
                          wp.hasCardPassword
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                            : 'bg-amber-500/15 text-amber-800 dark:text-amber-300'
                        }`}
                      >
                        {wp.hasCardPassword ? (
                          <>
                            <Lock className="w-3 h-3" />
                            <span>Karta nahrána</span>
                          </>
                        ) : (
                          <>
                            <Unlock className="w-3 h-3" />
                            <span>Nenahráno</span>
                          </>
                        )}
                      </span>

                      <div
                        className="flex items-center gap-1.5 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          variant="surface"
                          size="icon-sm"
                          icon={Edit3}
                          onClick={() => handleOpenEditWorkplace(wp)}
                          title="Upravit pracoviště"
                        />
                        <Button
                          variant="transparent"
                          color="rose"
                          size="icon-sm"
                          icon={Trash2}
                          onClick={() => setDeletingWorkplace(wp)}
                          title="Odebrat pracoviště"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ====================================================================
            TAB 4: ABSENCE (absence_types s Icon, Color, IsSystem) - Admin & Officer
           ==================================================================== */}
        {activeTab === 'absence' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button
                variant="filled"
                color="primary"
                size="normal"
                icon={Plus}
                onClick={handleOpenAddAbsence}
                className="whitespace-nowrap flex-shrink-0"
              >
                Absence
              </Button>
            </div>

            <div className="space-y-2.5">
              {editableTypes.map((absType) => {
                const IconComp = resolveIconComponent(absType.icon);
                const visual = buildStatusVisualClasses((absType.color as ColorKey) || 'amber');
                const isSystemRecord = Boolean(absType.isSystem);
                const isUnlimited = absType.defaultBudgetPeriod === 'unlimited';
                const isYearly =
                  absType.defaultBudgetPeriod === 'yearly' || absType.defaultBudgetPeriod === 'annual';
                const periodLabel = isYearly
                  ? `${absType.defaultAllowance ?? 0} dní / rok`
                  : absType.defaultBudgetPeriod === 'weekly'
                  ? `${absType.defaultAllowance ?? 0} dní / týden`
                  : 'Neomezeno';
                const approverRoleLabel =
                  absType.approverRole === 'team_lead'
                    ? 'Vedoucí'
                    : absType.approverRole === 'manager'
                    ? 'Manažer'
                    : absType.approverRole === 'office_manager'
                    ? 'Office Manager'
                    : absType.approverRole === 'admin'
                    ? 'Administrátor'
                    : 'Automaticky';

                return (
                  <div
                    key={absType.code}
                    onClick={() => handleOpenEditAbsence(absType)}
                    className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-100/80 dark:hover:bg-zinc-800/70 transition-colors cursor-pointer w-full"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="relative shrink-0">
                        <div
                          className={`w-10 h-10 rounded-2xl flex items-center justify-center ${visual.badgeClass}`}
                        >
                          <IconComp className="w-5 h-5" />
                        </div>
                        {isSystemRecord && (
                          <span
                            title="Systémový záznam"
                            className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white flex items-center justify-center ring-2 ring-white dark:ring-zinc-900 shadow-xs"
                          >
                            <Lock className="w-2.5 h-2.5" />
                          </span>
                        )}
                      </div>
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-slate-900 dark:text-white">
                            {absType.nameEmployee}
                          </span>
                          {absType.allowOsvc && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300">
                              I pro OSVČ
                            </span>
                          )}
                          {absType.isPrivate && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300">
                              Důvěrná
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                          Schvaluje:{' '}
                          <strong className="text-slate-700 dark:text-zinc-200">
                            {approverRoleLabel}
                          </strong>
                          {' • '}
                          Výchozí limit:{' '}
                          <strong className="text-slate-700 dark:text-zinc-200">
                            {isUnlimited ? 'Neomezeno' : periodLabel}
                          </strong>
                          {' • '}
                          Režim:{' '}
                          {absType.durationMode === 'days' || absType.durationMode === '1'
                            ? 'Datum Od–Do'
                            : absType.durationMode === 'single_day' || absType.durationMode === '2'
                            ? 'Pouze 1 den'
                            : 'Čas Od–Do'}
                          {absType.maxPerMonthLimit ? ` • Max. ${absType.maxPerMonthLimit}×/měsíc` : ''}
                          {absType.submissionDeadlineTime ? ` • Uzávěrka do ${absType.submissionDeadlineTime}` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="surface"
                        size="icon-sm"
                        icon={Edit3}
                        onClick={() => handleOpenEditAbsence(absType)}
                        title="Upravit absenci"
                      />
                      {!isSystemRecord && (
                        <Button
                          variant="transparent"
                          color="rose"
                          size="icon-sm"
                          icon={Trash2}
                          onClick={() => setDeletingAbsenceType(absType)}
                          title="Odebrat absenci"
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ====================================================================
            TAB 5: SYSTÉM (Verze, DailyHours, WeeklyWorkDays, Logy pro Admina)
           ==================================================================== */}
        {activeTab === 'system' && (
          <div className="space-y-4 w-full">
            {/* 1. Verze aplikace */}
            <div className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                  Informace o instanci
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-900 dark:text-white">
                    Verze systému
                  </span>
                  <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-xl bg-amber-500/15 text-amber-800 dark:text-amber-300">
                    {APP_VERSION}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 pt-0.5">
                  Firma: <strong className="text-slate-700 dark:text-zinc-200">{devConfig.companyName || 'caffeechko s.r.o.'}</strong>
                  {' • '}
                  Doména: <span className="font-mono">@{devConfig.googleWorkspaceDomain || 'firma.cz'}</span>
                  {' • '}
                  DB: <code className="font-mono text-xs">{dbMode === 'dev' ? 'dochazka_dev.db' : 'dochazka_clean.db'}</code>
                </p>
              </div>

              {isAdmin && onOpenDevModal && (
                <Button
                  variant="surface"
                  size="sm"
                  onClick={onOpenDevModal}
                  className="self-start sm:self-auto shrink-0"
                >
                  Konfigurace domény
                </Button>
              )}
            </div>

            {/* 2. Úprava DailyHours a WeeklyWorkDays */}
            <div className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/40 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-amber-500" />
                    <span>Základní pracovní fond (DailyHours & WeeklyWorkDays)</span>
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                    Tyto parametry určují standardní týdenní normu ({(dailyHours * weeklyWorkDays).toFixed(1)} h / týden při 100% úvazku)
                  </p>
                </div>
                <Button
                  variant="filled"
                  colorKey={isWorktimeSaved ? 'emerald' : 'primary'}
                  size="sm"
                  icon={isWorktimeSaved ? Check : Save}
                  loading={isSavingWorktime}
                  onClick={handleSaveWorktimeSettings}
                >
                  {isWorktimeSaved ? 'Uloženo' : 'Uložit fond'}
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-white dark:bg-zinc-900/70 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">
                      Denní úvazek (DailyHours)
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-zinc-400">
                      Hodin na 1 pracovní den
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min="1"
                      max="12"
                      step="0.5"
                      value={dailyHours}
                      onChange={(e) => setDailyHours(Number(e.target.value))}
                      className="w-16 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-zinc-800 text-xs font-bold text-center text-slate-900 dark:text-white focus:outline-none"
                    />
                    <span className="text-xs text-slate-500 font-semibold">h</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-white dark:bg-zinc-900/70 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">
                      Pracovní dny (WeeklyWorkDays)
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-zinc-400">
                      Počet pracovních dnů v týdnu
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min="1"
                      max="7"
                      value={weeklyWorkDays}
                      onChange={(e) => setWeeklyWorkDays(Number(e.target.value))}
                      className="w-16 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-zinc-800 text-xs font-bold text-center text-slate-900 dark:text-white focus:outline-none"
                    />
                    <span className="text-xs text-slate-500 font-semibold">dnů</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. SYSTÉMOVÉ LOGY Z TABULKY LOGS (VIDÍ POUZE ADMIN) */}
            {isAdmin && (
              <div className="w-full p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-zinc-800/40 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Terminal className="w-4 h-4 text-amber-500" />
                      <span>Systémové a auditní logy ({filteredLogs.length})</span>
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-zinc-400">
                      Záznamy z tabulky logs (API požadavky, autentizace, NFC operace a systémové události)
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      variant="surface"
                      size="sm"
                      icon={RefreshCw}
                      loading={isLoadingLogs}
                      onClick={loadSystemLogs}
                    >
                      Obnovit
                    </Button>
                    <Button
                      variant="filled"
                      colorKey="rose"
                      size="sm"
                      icon={Trash2}
                      onClick={() => setIsConfirmClearLogsOpen(true)}
                      disabled={logs.length === 0}
                    >
                      Promazat logy
                    </Button>
                  </div>
                </div>

                {/* Filtry logů */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {(['all', 'api', 'auth', 'nfc', 'web'] as const).map((t) => {
                      const isSelected = logTypeFilter === t;
                      const switchColorClass =
                        t === 'nfc'
                          ? isSelected
                            ? 'bg-purple-600 text-white shadow-sm'
                            : 'bg-purple-500/15 text-purple-700 dark:text-purple-300 hover:bg-purple-500/25'
                          : t === 'auth'
                          ? isSelected
                            ? 'bg-amber-500 text-slate-950 shadow-sm'
                            : 'bg-amber-500/15 text-amber-800 dark:text-amber-300 hover:bg-amber-500/25'
                          : t === 'api'
                          ? isSelected
                            ? 'bg-sky-600 text-white shadow-sm'
                            : 'bg-sky-500/15 text-sky-700 dark:text-sky-300 hover:bg-sky-500/25'
                          : t === 'web'
                          ? isSelected
                            ? 'bg-slate-700 text-white dark:bg-zinc-200 dark:text-slate-900 shadow-sm'
                            : 'bg-slate-200 dark:bg-zinc-700 text-slate-700 dark:text-zinc-300 hover:bg-slate-300 dark:hover:bg-zinc-600'
                          : isSelected
                          ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                          : 'bg-white dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200/70';

                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setLogTypeFilter(t)}
                          className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${switchColorClass}`}
                        >
                          {t === 'all' ? 'Všechny' : t.toUpperCase()}
                        </button>
                      );
                    })}
                  </div>

                  <div className="relative min-w-[220px]">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Hledat v logách..."
                      value={logSearchQuery}
                      onChange={(e) => setLogSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-white dark:bg-zinc-900 text-xs text-slate-900 dark:text-white focus:outline-none"
                    />
                  </div>
                </div>

                {/* Výpis logů */}
                {filteredLogs.length === 0 ? (
                  <div className="p-8 rounded-2xl bg-white/70 dark:bg-zinc-900/50 text-center text-xs text-slate-400 dark:text-zinc-500">
                    Žádné záznamy v tabulce logů neodpovídají filtru.
                  </div>
                ) : (
                  <div className="max-h-[420px] overflow-y-auto space-y-1.5 pr-1">
                    {filteredLogs.map((log) => {
                      const typeStr = String(log.type || 'web').toLowerCase();
                      const statusText = String(log.status || '');
                      const isError =
                        statusText.toLowerCase().includes('err') ||
                        statusText.toLowerCase().includes('fail') ||
                        statusText.toLowerCase().includes('400') ||
                        statusText.toLowerCase().includes('403') ||
                        statusText.toLowerCase().includes('500');
                      const typeBadgeClass =
                        typeStr === 'nfc'
                          ? 'bg-purple-500/15 text-purple-700 dark:text-purple-300'
                          : typeStr === 'auth'
                          ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300'
                          : typeStr === 'api'
                          ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300'
                          : 'bg-slate-200 dark:bg-zinc-700 text-slate-700 dark:text-zinc-300';

                      const dt = log.dateTime ? new Date(log.dateTime) : null;
                      const formattedTime =
                        dt && !Number.isNaN(dt.getTime())
                          ? `${dt.getDate()}.${dt.getMonth() + 1}. ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}:${String(dt.getSeconds()).padStart(2, '0')}`
                          : log.dateTime;

                      return (
                        <div
                          key={log.id}
                          className="p-2.5 rounded-xl bg-white dark:bg-zinc-900/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono"
                        >
                          <div className="flex items-start sm:items-center gap-2.5 min-w-0">
                            <span
                              className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md shrink-0 ${typeBadgeClass}`}
                            >
                              {typeStr}
                            </span>
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${
                                isError ? 'bg-rose-500' : 'bg-emerald-500'
                              }`}
                            />
                            <div className="min-w-0 truncate">
                              <span
                                className={`font-semibold ${
                                  isError
                                    ? 'text-rose-600 dark:text-rose-400'
                                    : 'text-slate-900 dark:text-zinc-100'
                                }`}
                              >
                                {statusText}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 text-[10px] text-slate-400 dark:text-zinc-500">
                            {log.userId && log.userId !== '0' && (
                              <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 truncate max-w-[120px]">
                                {log.userId.slice(0, 8)}
                              </span>
                            )}
                            <span>{formattedTime}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ====================================================================
            6. TAB: GDPR (gdpr_documents & gdpr_sends)
           ==================================================================== */}
        {activeTab === 'gdpr' && (
          <GdprSettingsTab
            onGdprChanged={onGdprChanged}
            addToast={addToast}
          />
        )}
      </Box>
      )}

      {/* ========================================================================
          MODÁLY PRO ÚVAZKY
         ======================================================================== */}
      <Modal
        isOpen={isContractModalOpen}
        onClose={() => setIsContractModalOpen(false)}
        title={editingContract ? (contractName.trim() || editingContract.name || 'Pracovní úvazek') : 'Pracovní úvazek'}
        subtitle={editingContract ? 'Upravit pracovní úvazek' : 'Nový pracovní úvazek'}
        icon={Briefcase}
        iconBgClass="bg-amber-500/15 text-amber-700 dark:text-amber-400"
        size="md"
        footer={
          <>
            <Button
              variant="filled"
              color="primary"
              size="normal"
              icon={Check}
              loading={isSavingContract}
              onClick={handleSaveContract}
              width="full"
            >
              Uložit
            </Button>
            <Button
              variant="transparent"
              color="rose"
              size="normal"
              onClick={() => setIsContractModalOpen(false)}
              width="full"
            >
              Zrušit
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Kód úvazku
              </label>
              <input
                type="text"
                disabled={Boolean(editingContract)}
                placeholder="např. HPP_75"
                value={contractCode}
                onChange={(e) => setContractCode(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-xs font-mono font-bold text-slate-900 dark:text-white disabled:opacity-60 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Název úvazku
              </label>
              <input
                type="text"
                placeholder="např. Zkrácený úvazek (75 %)"
                value={contractName}
                onChange={(e) => setContractName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-xs font-bold text-slate-900 dark:text-white focus:outline-none"
              />
            </div>
          </div>

          <div
            onClick={() => setContractHasHoursFund((prev) => !prev)}
            className="flex items-center justify-between gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/50 cursor-pointer"
          >
            <span className="text-xs font-semibold text-slate-800 dark:text-zinc-200">
              Tento úvazek má předepsaný hodinový fond (zaměstnanecký poměr)
            </span>
            <Switch
              checked={contractHasHoursFund}
              onChange={(checked) => setContractHasHoursFund(checked)}
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Koeficient úvazku (1.0 = 100 % fondu, 0.5 = 50 % fondu)
            </label>
            <input
              type="number"
              step="0.05"
              min="0"
              max="2"
              disabled={!contractHasHoursFund}
              value={contractHasHoursFund ? contractCoefficient : '0'}
              onChange={(e) => setContractCoefficient(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-xs font-bold text-center text-slate-900 dark:text-white disabled:opacity-50 focus:outline-none"
            />
          </div>
        </div>
      </Modal>

      {/* Modál pro odebrání úvazku (s detekcí kolize uživatelů!) */}
      <Modal
        isOpen={Boolean(deletingContract)}
        onClose={() => setDeletingContract(null)}
        title={deletingContract?.name || 'Pracovní úvazek'}
        subtitle="Odebrat pracovní úvazek"
        icon={AlertTriangle}
        iconBgClass="bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400"
        size="md"
        footer={
          <>
            <Button
              variant="filled"
              color="rose"
              size="normal"
              icon={Trash2}
              loading={isDeletingContract}
              onClick={handleConfirmDeleteContract}
              width="full"
            >
              {(deletingContract?.usersCount ?? 0) > 0
                ? 'Přesunout a smazat'
                : 'Smazat úvazek'}
            </Button>
            <Button
              variant="transparent"
              color="rose"
              size="normal"
              onClick={() => setDeletingContract(null)}
              width="full"
            >
              Zrušit
            </Button>
          </>
        }
      >
        {deletingContract && (
          <div className="space-y-4">
            {(deletingContract.usersCount ?? 0) > 0 ? (
              <>
                <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-900 dark:text-rose-200 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide text-rose-700 dark:text-rose-300">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>DŮRAZNÉ UPOZORNĚNÍ NA KOLIZI V DOCHÁZCE</span>
                  </div>
                  <p className="text-xs leading-relaxed font-medium">
                    Tento úvazek (<strong>{deletingContract.name}</strong>) má aktuálně přiřazeno{' '}
                    <strong>{deletingContract.usersCount} uživatelů</strong>.
                  </p>
                  <p className="text-xs leading-relaxed font-bold">
                    Hromadný přesun dotčených osob na jiný úvazek změní jejich týdenní hodinový fond a nároky, což může způsobit nesoulad v celé docházce, saldu hodin a měsíčních uzávěrkách!
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-900 dark:text-white mb-1.5">
                    Vyberte náhradní úvazek, do kterého se dotčení uživatelé přesunou:
                  </label>
                  <select
                    value={replacementContractCode}
                    onChange={(e) => setReplacementContractCode(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-zinc-800 text-xs font-bold text-slate-900 dark:text-white focus:outline-none"
                  >
                    {contractsList
                      .filter((c) => c.id !== deletingContract.id && c.code !== deletingContract.code)
                      .map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.name} ({c.code}) — {c.coefficient > 0 ? `Fond ${Math.round(c.coefficient * 100)} %` : 'Bez fondu'}
                        </option>
                      ))}
                  </select>
                </div>
              </>
            ) : (
              <p className="text-xs text-slate-600 dark:text-zinc-300 leading-relaxed">
                K úvazku <strong>{deletingContract.name} ({deletingContract.code})</strong> není přiřazen žádný uživatel. Opravdu si přejete tento záznam trvale odstranit z databáze?
              </p>
            )}
          </div>
        )}
      </Modal>

      {/* ========================================================================
          MODÁLY PRO SVÁTKY
         ======================================================================== */}
      <Modal
        isOpen={isHolidayModalOpen}
        onClose={() => setIsHolidayModalOpen(false)}
        title={editingHoliday ? (holidayName.trim() || editingHoliday.name || 'Svátek') : 'Svátek'}
        subtitle={editingHoliday ? 'Upravit svátek' : 'Nový svátek'}
        icon={Sparkles}
        iconBgClass="bg-amber-500/15 text-amber-700 dark:text-amber-400"
        size="md"
        footer={
          <>
            <Button
              variant="filled"
              color="primary"
              size="normal"
              icon={Check}
              loading={isSavingHoliday}
              onClick={handleSaveHoliday}
              width="full"
            >
              Uložit
            </Button>
            <Button
              variant="transparent"
              color="rose"
              size="normal"
              onClick={() => setIsHolidayModalOpen(false)}
              width="full"
            >
              Zrušit
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Název svátku
            </label>
            <input
              type="text"
              placeholder="např. Den české státnosti"
              value={holidayName}
              onChange={(e) => setHolidayName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-xs font-bold text-slate-900 dark:text-white focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-100 dark:bg-zinc-800">
            <button
              type="button"
              onClick={() => setHolidayMode('fixed')}
              className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                holidayMode === 'fixed'
                  ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500'
              }`}
            >
              Pevné datum v roce
            </button>
            <button
              type="button"
              onClick={() => setHolidayMode('easter')}
              className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                holidayMode === 'easter'
                  ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500'
              }`}
            >
              Pohyblivý (Velikonoce)
            </button>
          </div>

          {holidayMode === 'fixed' ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Den v měsíci (1–31)
                </label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={holidayDay}
                  onChange={(e) => setHolidayDay(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-xs font-bold text-center text-slate-900 dark:text-white focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Měsíc
                </label>
                <select
                  value={holidayMonth}
                  onChange={(e) => setHolidayMonth(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-xs font-bold text-slate-900 dark:text-white focus:outline-none"
                >
                  {CZECH_MONTHS.map((mName, idx) => {
                    const capMonth = mName.charAt(0).toUpperCase() + mName.slice(1);
                    return (
                      <option key={mName} value={idx + 1}>
                        {capMonth}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Velikonoční pravidlo
              </label>
              <select
                value={holidayEasterRule}
                onChange={(e) => setHolidayEasterRule(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-xs font-bold text-slate-900 dark:text-white focus:outline-none"
              >
                <option value="EASTER_FRIDAY">Velký pátek (EASTER_FRIDAY)</option>
                <option value="EASTER_MONDAY">Velikonoční pondělí (EASTER_MONDAY)</option>
              </select>
            </div>
          )}

          <div
            onClick={() => setHolidayIsPublic((prev) => !prev)}
            className="flex items-center justify-between gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/50 cursor-pointer"
          >
            <span className="text-xs font-semibold text-slate-800 dark:text-zinc-200">
              Oficiální státní svátek
            </span>
            <Switch
              checked={holidayIsPublic}
              onChange={(checked) => setHolidayIsPublic(checked)}
            />
          </div>
        </div>
      </Modal>

      <ConfirmDeleteModal
        isOpen={Boolean(deletingHoliday)}
        onClose={() => setDeletingHoliday(null)}
        onConfirm={handleConfirmDeleteHoliday}
        title={`Odebrat svátek „${deletingHoliday?.name || ''}“?`}
        description="Svátek bude odstraněn z tabulky holidays a přestane se započítávat jako volný sváteční den."
      />

      {/* ========================================================================
          MODÁLY PRO PRACOVIŠTĚ & NAHRÁNÍ NA KARTU (POUZE ADMIN)
         ======================================================================== */}
      <Modal
        isOpen={isWorkplaceModalOpen}
        onClose={() => setIsWorkplaceModalOpen(false)}
        title={editingWorkplace ? (wpName.trim() || editingWorkplace.name || 'Pracoviště') : 'Pracoviště'}
        subtitle={editingWorkplace ? 'Upravit pracoviště' : 'Nové pracoviště'}
        icon={MapPin}
        iconBgClass="bg-amber-500/15 text-amber-700 dark:text-amber-400"
        size="md"
        footer={
          <>
            <Button
              variant="filled"
              color="primary"
              size="normal"
              icon={Check}
              loading={isSavingWorkplace}
              onClick={handleSaveWorkplace}
              width="full"
            >
              Uložit
            </Button>
            <Button
              variant="transparent"
              color="rose"
              size="normal"
              onClick={() => setIsWorkplaceModalOpen(false)}
              width="full"
            >
              Zrušit
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Název pracoviště
              </label>
              <input
                type="text"
                placeholder="např. Centrála Praha – Karlín"
                value={wpName}
                onChange={(e) => setWpName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-xs font-bold text-slate-900 dark:text-white focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                NFC Identifikátor
              </label>
              <input
                type="text"
                placeholder="např. NFC-KARLIN-01"
                value={wpNfcIdentifier}
                onChange={(e) => setWpNfcIdentifier(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Ulice a město (Adresa)
            </label>
            <input
              type="text"
              placeholder="např. Rohanské nábřeží 678/23, Praha 8"
              value={wpAddress}
              onChange={(e) => setWpAddress(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none"
            />
          </div>

          <div
            onClick={() => setWpIsActive((prev) => !prev)}
            className="flex items-center justify-between gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/50 cursor-pointer"
          >
            <div>
              <span className="text-xs font-semibold text-slate-800 dark:text-zinc-200 block">
                Aktivní provoz pracoviště
              </span>
              <span className="text-[11px] text-slate-500 dark:text-zinc-400 block">
                Při vypnutém provozu nelze na této pobočce evidovat docházku
              </span>
            </div>
            <Switch
              checked={wpIsActive}
              onChange={(checked) => setWpIsActive(checked)}
            />
          </div>
        </div>
      </Modal>

      {/* Krok 1: Modál pro zadání hesla ke kartě před nahráním */}
      <Modal
        isOpen={isCardPasswordModalOpen}
        onClose={() => setIsCardPasswordModalOpen(false)}
        title="Nahrát na kartu"
        subtitle={selectedWorkplace ? selectedWorkplace.name : 'Zabezpečení NFC karty heslem'}
        icon={KeyRound}
        iconBgClass="bg-amber-500/15 text-amber-700 dark:text-amber-400"
        size="sm"
        footer={
          <>
            <Button
              variant="filled"
              color="primary"
              size="normal"
              icon={Check}
              onClick={handleConfirmCardPassword}
              width="full"
            >
              Potvrdit heslo
            </Button>
            <Button
              variant="transparent"
              color="rose"
              size="normal"
              onClick={() => setIsCardPasswordModalOpen(false)}
              width="full"
            >
              Zrušit
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="p-3.5 rounded-2xl bg-amber-500/10 text-xs text-slate-700 dark:text-zinc-300 space-y-1.5 leading-relaxed">
            <div className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-300">
              <Info className="w-4 h-4 shrink-0" />
              <span>Jak funguje heslo NFC karty?</span>
            </div>
            <p className="text-[11px]">
              • <strong>Nová (čistá) karta bez hesla:</strong> Zadaným heslem se karta poprvé uzamkne proti přepsání a nahraje se na ni identifikátor pracoviště.
              <br />• <strong>Již zaheslovaná karta:</strong> Zadané heslo odemkne zápis a aktualizuje záznam pracoviště.
            </p>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Zadejte heslo karty (min. 4 znaky)
            </label>
            <input
              type="password"
              autoFocus
              value={cardPasswordInput}
              onChange={(e) => setCardPasswordInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleConfirmCardPassword();
                }
              }}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-zinc-800 text-sm font-mono font-bold text-slate-900 dark:text-white focus:outline-none"
            />
          </div>
        </div>
      </Modal>

      {/* Krok 2: Modál s přiložením mobilu ke kartě (STEJNÁ SONAROVÁ IKONA JAKO U PŘÍCHODU) */}
      <Modal
        isOpen={isNfcWriteModalOpen}
        onClose={() => setIsNfcWriteModalOpen(false)}
        title="Nahrát na kartu"
        subtitle="Přiložte k NFC kartě"
        icon={Smartphone}
        size="sm"
        footer={
          <Button
            variant="transparent"
            color="rose"
            size="normal"
            onClick={() => setIsNfcWriteModalOpen(false)}
            width="full"
          >
            Zrušit
          </Button>
        }
      >
        <div className="text-center space-y-4">
          <div className="relative w-32 h-32 mx-auto mt-2 mb-6 flex items-center justify-center">
            <span
              className="absolute w-16 h-16 rounded-full animate-sonar-1 pointer-events-none bg-amber-500/25 dark:bg-amber-400/20 border border-amber-500/40 dark:border-amber-400/35"
            />
            <span
              className="absolute w-16 h-16 rounded-full animate-sonar-2 pointer-events-none bg-amber-500/20 dark:bg-amber-400/15 border border-amber-500/35 dark:border-amber-400/30"
            />
            <span
              className="absolute w-16 h-16 rounded-full animate-sonar-3 pointer-events-none bg-amber-500/15 dark:bg-amber-400/10 border border-amber-500/25 dark:border-amber-400/20"
            />
            <button
              type="button"
              onClick={() => {
                if (import.meta.env.DEV) {
                  executeCardWrite();
                }
              }}
              disabled={isEncodingCard || !import.meta.env.DEV}
              title={import.meta.env.DEV ? "Kliknutím nahrajete profil pracoviště na kartu (DEV simulace)" : undefined}
              className={`relative z-10 w-20 h-20 rounded-full bg-amber-50 dark:bg-amber-950/80 border border-amber-500/30 dark:border-amber-400/30 shadow-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shadow-lg transition-all group ${
                import.meta.env.DEV ? 'cursor-pointer hover:scale-105 active:scale-95' : 'cursor-default'
              }`}
            >
              <Smartphone className="w-10 h-10 group-hover:scale-110 transition-transform" />
            </button>
          </div>

          <div className="space-y-1.5">
            <div className="text-sm font-bold text-slate-900 dark:text-white">
              Nahrát na kartu: {selectedWorkplace?.name}
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
              Přiložte zadní stranu mobilního telefonu k NFC kartě pracoviště pro zapsání šifrovaného profilu a uzamčení heslem.
            </p>
            {import.meta.env.DEV && (
              <p className="text-[11px] text-amber-500 dark:text-amber-400 font-semibold pt-1">
                (Pro potvrzení zápisu můžete také kliknout přímo na sonarovou ikonu výše)
              </p>
            )}
          </div>

          {isEncodingCard && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-xs font-bold">
              <CheckCircle2 className="w-4 h-4 animate-spin" />
              <span>Zapisuji na NFC kartu...</span>
            </div>
          )}
        </div>
      </Modal>

      <ConfirmDeleteModal
        isOpen={Boolean(deletingWorkplace)}
        onClose={() => setDeletingWorkplace(null)}
        onConfirm={handleConfirmDeleteWorkplace}
        title={`Smazat pracoviště „${deletingWorkplace?.name || ''}“?`}
        description="Pracoviště bude odstraněno ze seznamu poboček v databázi."
      />

      {/* ========================================================================
          MODÁLY PRO ABSENCE (absence_types s výběrem ikony a barvy)
         ======================================================================== */}
      <Modal
        isOpen={isAbsenceModalOpen}
        onClose={() => setIsAbsenceModalOpen(false)}
        title={editingAbsenceType ? (absName.trim() || editingAbsenceType.nameEmployee || 'Absence') : 'Absence'}
        subtitle={editingAbsenceType ? 'Upravit typ absence' : 'Nová absence'}
        icon={resolveIconComponent(absIcon)}
        iconBgClass={buildStatusVisualClasses((absColor as ColorKey) || 'amber').badgeClass}
        size="lg"
        footer={
          <>
            <Button
              variant="filled"
              color="primary"
              size="normal"
              icon={Check}
              loading={isSavingAbsence}
              onClick={handleSaveAbsenceModal}
              width="full"
            >
              Uložit
            </Button>
            <Button
              variant="transparent"
              color="rose"
              size="normal"
              onClick={() => setIsAbsenceModalOpen(false)}
              width="full"
            >
              Zrušit
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Kód absence (ID)
              </label>
              <input
                type="text"
                disabled={Boolean(editingAbsenceType)}
                placeholder="např. study_leave"
                value={absCode}
                onChange={(e) => setAbsCode(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-xs font-mono font-bold text-slate-900 dark:text-white disabled:opacity-60 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Zobrazovaný název
              </label>
              <input
                type="text"
                placeholder="např. Studijní volno"
                value={absName}
                onChange={(e) => setAbsName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-xs font-bold text-slate-900 dark:text-white focus:outline-none"
              />
            </div>
          </div>

          {/* Výběr ikony */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Ikona absence
            </label>
            <div className="grid grid-cols-6 sm:grid-cols-8 gap-2">
              {ABSENCE_ICON_OPTIONS.map((opt) => {
                const IconItem = resolveIconComponent(opt.value);
                const isSelected = absIcon === opt.value;
                const selectedColorVis = buildStatusVisualClasses((absColor as ColorKey) || 'amber');
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setAbsIcon(opt.value)}
                    title={opt.label}
                    className={`h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                      isSelected
                        ? `${selectedColorVis.badgeClass} ring-2 ring-current`
                        : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200/80 dark:hover:bg-zinc-700/80'
                    }`}
                  >
                    <IconItem className="w-5 h-5" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Výběr barvy */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Barva v kalendáři a přehledech
            </label>
            <div className="flex items-center gap-2.5 flex-wrap">
              {ABSENCE_COLOR_OPTIONS.map((cOpt) => {
                const isSelected = absColor === cOpt.value;
                return (
                  <button
                    key={cOpt.value}
                    type="button"
                    onClick={() => setAbsColor(cOpt.value)}
                    title={cOpt.label}
                    className={`w-8 h-8 rounded-full ${cOpt.dotClass} flex items-center justify-center transition-transform hover:scale-110 active:scale-95 cursor-pointer ${
                      isSelected
                        ? 'ring-2 ring-offset-2 ring-slate-900 dark:ring-white dark:ring-offset-zinc-900 scale-105'
                        : 'opacity-85 hover:opacity-100'
                    }`}
                  >
                    {isSelected && <Check className="w-4 h-4 text-white drop-shadow-xs" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Role schvalování a Období rozpočtu */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Role schvalování
              </label>
              <select
                value={absApproverRole}
                onChange={(e) => setAbsApproverRole(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-xs font-bold text-slate-900 dark:text-white focus:outline-none"
              >
                <option value="">Automaticky se schvaluje (bez role)</option>
                <option value="team_lead">Vedoucí (přiřazená osoba)</option>
                <option value="manager">Manažer (přiřazená osoba)</option>
                <option value="office_manager">Office Manager (role)</option>
                <option value="admin">Administrátor (role)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Období rozpočtu
              </label>
              <select
                value={absBudgetPeriod}
                onChange={(e) => setAbsBudgetPeriod(e.target.value as 'yearly' | 'monthly' | 'weekly' | 'unlimited')}
                className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-xs font-bold text-slate-900 dark:text-white focus:outline-none"
              >
                <option value="yearly">Roční limit (dní/rok)</option>
                <option value="monthly">Měsíční limit (dní/měsíc)</option>
                <option value="weekly">Týdenní limit (dní/týden)</option>
                <option value="unlimited">Neomezeno</option>
              </select>
            </div>
          </div>

          {/* Výchozí nárok a Režim trvání na 50% šířky */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Výchozí nárok
              </label>
              <input
                type="number"
                min="0"
                max="365"
                disabled={absBudgetPeriod === 'unlimited'}
                placeholder={absBudgetPeriod === 'unlimited' ? 'Neomezeno' : '0'}
                value={absBudgetPeriod === 'unlimited' ? '' : absDefaultAllowance}
                onChange={(e) => setAbsDefaultAllowance(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-xs font-bold text-center text-slate-900 dark:text-white disabled:opacity-50 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Režim trvání
              </label>
              <select
                value={absDurationMode}
                onChange={(e) => setAbsDurationMode(e.target.value as 'days' | 'single_day' | 'hours')}
                className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-xs font-bold text-slate-900 dark:text-white focus:outline-none"
              >
                <option value="days">Datum Od – Do</option>
                <option value="single_day">Pouze 1 den</option>
                <option value="hours">Čas Od – Do (hodiny)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Max. počet žádostí za měsíc (volitelné)
              </label>
              <input
                type="number"
                min="1"
                max="31"
                placeholder="Bez měsíčního limitu"
                value={absMaxPerMonth}
                onChange={(e) => setAbsMaxPerMonth(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-xs font-bold text-slate-900 dark:text-white focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Časová uzávěrka v daný den (např. 09:00)
              </label>
              <input
                type="text"
                placeholder="Bez uzávěrky"
                value={absDeadlineTime}
                onChange={(e) => setAbsDeadlineTime(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none"
              />
            </div>
          </div>

          <div
            onClick={() => setAbsAllowOsvc((prev) => !prev)}
            className="flex items-center justify-between gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/50 cursor-pointer"
          >
            <span className="text-xs font-semibold text-slate-800 dark:text-zinc-200">
              Povoleno i pro externisty (OSVČ)
            </span>
            <Switch
              checked={absAllowOsvc}
              onChange={(checked) => setAbsAllowOsvc(checked)}
            />
          </div>

          <div
            onClick={() => setAbsIsPrivate((prev) => !prev)}
            className="flex items-center justify-between gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/50 cursor-pointer"
          >
            <div className="space-y-0.5">
              <span className="block text-xs font-semibold text-slate-800 dark:text-zinc-200">
                Důvěrná absence (soukromá)
              </span>
              <span className="block text-[11px] text-slate-500 dark:text-zinc-400">
                Ostatní uživatelé (mimo přímého vedoucího, manažera, Officera a Admina) uvidí u této absence v červené barvě „Nedostupný“
              </span>
            </div>
            <Switch
              checked={absIsPrivate}
              onChange={(checked) => setAbsIsPrivate(checked)}
            />
          </div>
        </div>
      </Modal>

      <ConfirmDeleteModal
        isOpen={Boolean(deletingAbsenceType)}
        onClose={() => setDeletingAbsenceType(null)}
        onConfirm={handleConfirmDeleteAbsence}
        title={`Smazat typ absence „${deletingAbsenceType?.nameEmployee || ''}“?`}
        description="Tento vlastní typ absence bude odstraněn z číselníku."
      />

      {/* Potvrzení promazání systémových logů */}
      <ConfirmDeleteModal
        isOpen={isConfirmClearLogsOpen}
        onClose={() => setIsConfirmClearLogsOpen(false)}
        onConfirm={handleConfirmClearSystemLogs}
        title="Promazat všechny systémové logy?"
        description={`Všech ${logs.length} záznamů v tabulce logs bude trvale vymazáno (dostupné i v produkčním režimu).`}
      />
    </div>
  );
}

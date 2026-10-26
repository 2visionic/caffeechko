import { useState, useEffect } from 'react';
import { UserPlus, Check, Mars, Venus, ArrowRight, ArrowLeft, Info, Calendar } from 'lucide-react';
import { Modal, Button, Switch } from './ui';
import { api, getAbsenceTypeLabel, type CreateUserDto, type AbsenceTypeConfigDto } from '../api';
import type { Persona } from '../App';

export interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  allUsers: Persona[];
  contractTypesMap?: Record<string, string>;
  contractTypes?: Array<{ code: string; name: string; coefficient?: number }>;
  onUserCreated?: () => Promise<void> | void;
  addToast: (type: 'success' | 'warning' | 'error', title: string, message: string) => void;
}

export function CreateUserModal({
  isOpen,
  onClose,
  allUsers,
  contractTypesMap = {},
  contractTypes = [],
  onUserCreated,
  addToast
}: CreateUserModalProps) {
  const currentYear = new Date().getFullYear();

  // Wizard step (1 = personal info, 2 = absence settings)
  const [step, setStep] = useState<1 | 2>(1);

  // Step 1: Personal info
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isDisplayNameCustom, setIsDisplayNameCustom] = useState(false);
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [role, setRole] = useState('colleague');
  const [contractKind, setContractKind] = useState('employee');
  const [contractTypeCode, setContractTypeCode] = useState('full_time');
  const [managerId, setManagerId] = useState<string>('');
  const [parentPersonId, setParentPersonId] = useState<string>('');
  const [isFemale, setIsFemale] = useState(false);
  const [isPermanentHomeOffice, setIsPermanentHomeOffice] = useState(false);
  const [employmentStartDate, setEmploymentStartDate] = useState('');

  // Step 2: Absence settings
  const [vacationBase, setVacationBase] = useState<number>(20);
  const [vacationCarriedOver, setVacationCarriedOver] = useState<number>(0);
  const [sickDaysTotal, setSickDaysTotal] = useState<number>(3);
  const [hoPeriod, setHoPeriod] = useState<'unlimited' | 'weekly' | 'yearly' | 'disabled'>('unlimited');
  const [hoLimit, setHoLimit] = useState<number>(2);
  const [compensatoryLeaveEnabled, setCompensatoryLeaveEnabled] = useState<boolean>(false);
  const [absenceTypeDefs, setAbsenceTypeDefs] = useState<Record<string, AbsenceTypeConfigDto>>({});

  // User has manually touched absence fields (to not overwrite if they go back & forth)
  const [hasManuallyEditedAbsence, setHasManuallyEditedAbsence] = useState(false);

  const [isSaving, setIsSaving] = useState(false);

  // Load absence types
  useEffect(() => {
    if (isOpen) {
      void api.getAbsenceTypes().then((res) => {
        if (res?.data) {
          const map: Record<string, AbsenceTypeConfigDto> = {};
          for (const t of res.data) {
            map[t.code] = t;
          }
          setAbsenceTypeDefs(map);
        }
      });
    }
  }, [isOpen]);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setFirstName('');
      setLastName('');
      setDisplayName('');
      setIsDisplayNameCustom(false);
      setEmail('');
      setPhoneNumber('');
      setRole('colleague');
      setContractKind('employee');
      setContractTypeCode('full_time');
      setManagerId('');
      setParentPersonId('');
      setIsFemale(false);
      setIsPermanentHomeOffice(false);
      setEmploymentStartDate('');

      setVacationBase(20);
      setVacationCarriedOver(0);
      setSickDaysTotal(3);
      setHoPeriod('unlimited');
      setHoLimit(2);
      setCompensatoryLeaveEnabled(false);
      setHasManuallyEditedAbsence(false);
    }
  }, [isOpen]);

  const handleFirstNameChange = (val: string) => {
    setFirstName(val);
    if (!isDisplayNameCustom) {
      setDisplayName(`${val} ${lastName}`.trim());
    }
  };

  const handleLastNameChange = (val: string) => {
    setLastName(val);
    if (!isDisplayNameCustom) {
      setDisplayName(`${firstName} ${val}`.trim());
    }
    if (val.trim().endsWith('á')) {
      setIsFemale(true);
    }
  };

  const currentFallback = `${firstName} ${lastName}`.trim();

  const handleDisplayNameFocus = () => {
    if (!isDisplayNameCustom || displayName.trim() === currentFallback) {
      setDisplayName('');
    }
  };

  const handleDisplayNameBlur = () => {
    if (!displayName.trim()) {
      setDisplayName(currentFallback);
      setIsDisplayNameCustom(false);
    } else if (displayName.trim() !== currentFallback) {
      setIsDisplayNameCustom(true);
    }
  };

  const getFteCoefficient = (code: string): number => {
    const found = contractTypes.find((c) => c.code.toLowerCase() === code.toLowerCase());
    if (found && typeof found.coefficient === 'number') {
      return found.coefficient;
    }
    if (code === 'half_time') return 0.5;
    if (code === 'part_time') return 0.25;
    if (code === 'dpp_dpc') return 0.0;
    return 1.0;
  };

  // Proration calculation helper (respects contractKind, contractTypeCode coefficient, and absenceTypes defaults)
  const getProrationInfo = () => {
    const isOsvc = contractKind === 'osvc';
    const coeff = getFteCoefficient(contractTypeCode);
    const vacDef = absenceTypeDefs.vacation;
    const sickDef = absenceTypeDefs.sick_day;

    const baseVacDefault = vacDef?.defaultAllowance ?? 20;
    const baseSickDefault = sickDef?.defaultAllowance ?? 3;

    const fullYearVac = isOsvc && !vacDef?.allowOsvc ? 0 : Math.round(baseVacDefault * coeff * 10) / 10;
    const fullYearSick = isOsvc && !sickDef?.allowOsvc ? 0 : Math.round(baseSickDefault * coeff * 10) / 10;

    if (!employmentStartDate) {
      return {
        isProrated: false,
        targetYear: currentYear,
        monthsRemaining: 12,
        vac: fullYearVac,
        sick: fullYearSick
      };
    }

    const [yStr, mStr] = employmentStartDate.split('-');
    const y = Number(yStr) || currentYear;
    const m = Number(mStr);
    if (!m || m <= 1 || y < currentYear) {
      return {
        isProrated: false,
        targetYear: y,
        monthsRemaining: 12,
        vac: fullYearVac,
        sick: fullYearSick
      };
    }

    const monthsRemaining = Math.max(1, 12 - m + 1);
    const proratedVac = Math.round((fullYearVac * monthsRemaining) / 12);
    const proratedSick = Math.round((fullYearSick * monthsRemaining) / 12);
    return {
      isProrated: monthsRemaining < 12,
      targetYear: y,
      monthsRemaining,
      vac: proratedVac,
      sick: proratedSick
    };
  };

  const proration = getProrationInfo();

  const handleGoToStep2 = () => {
    if (!firstName.trim()) {
      addToast('error', 'Vyplňte jméno', 'Křestní jméno nesmí být prázdné.');
      return;
    }
    if (!lastName.trim()) {
      addToast('error', 'Vyplňte příjmení', 'Příjmení nesmí být prázdné.');
      return;
    }

    // Auto-compute default / prorated allowance if not manually edited yet
    if (!hasManuallyEditedAbsence) {
      setVacationBase(proration.vac);
      setSickDaysTotal(proration.sick);
    }

    setStep(2);
  };

  const handleCreate = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const finalDisplay = displayName.trim() || currentFallback;
      const payload: CreateUserDto = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        displayName: finalDisplay,
        email: email.trim() || undefined,
        phoneNumber: phoneNumber.trim() || undefined,
        role,
        contractKind,
        contractTypeCode,
        managerId: managerId || null,
        parentPersonId: parentPersonId || null,
        isFemale,
        isPermanentHomeOffice,
        employmentStartDate: employmentStartDate || undefined,

        vacationBase,
        vacationCarriedOver,
        sickDaysTotal,
        homeOfficePeriod: hoPeriod,
        homeOfficeDaysLimit: hoPeriod === 'weekly' || hoPeriod === 'yearly' ? hoLimit : hoPeriod === 'disabled' ? 0 : undefined,
        compensatoryLeaveEnabled: contractKind === 'osvc' ? false : compensatoryLeaveEnabled
      };

      const res = await api.createUser(payload);
      if (res && !res.error) {
        addToast('success', 'Osoba vytvořena', `Nová osoba „${finalDisplay}“ byla úspěšně přidána do docházky.`);
        onClose();
        if (onUserCreated) {
          await onUserCreated();
        }
      } else {
        addToast('error', 'Chyba vytvoření', res?.error?.message || 'Nepodařilo se vytvořit osobu.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const eligibleManagers = allUsers.filter((u) => u.id !== 'anonymous');

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Nová osoba"
      subtitle={step === 1 ? 'Osobní údaje a zařazení' : 'Nastavení absencí'}
      icon={UserPlus}
      iconBgClass="bg-amber-500/15 text-amber-700 dark:text-amber-400"
      size="lg"
      footer={
        step === 1 ? (
          <>
            <Button
              variant="filled"
              color="primary"
              size="normal"
              icon={ArrowRight}
              onClick={handleGoToStep2}
              width="full"
            >
              Pokračovat k nastavení absencí
            </Button>
            <Button
              variant="transparent"
              color="rose"
              size="normal"
              onClick={onClose}
              width="full"
            >
              Zrušit
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="filled"
              color="primary"
              size="normal"
              icon={Check}
              onClick={handleCreate}
              disabled={isSaving}
              width="full"
            >
              {isSaving ? 'Vytvářím...' : 'Vytvořit osobu'}
            </Button>
            <Button
              variant="outline"
              size="normal"
              icon={ArrowLeft}
              onClick={() => setStep(1)}
              disabled={isSaving}
              width="full"
            >
              Zpět k údajům
            </Button>
          </>
        )
      }
    >
      {/* KROK 1: OSOBNÍ ÚDAJE */}
      {step === 1 && (
        <div className="space-y-4 py-1 animate-in fade-in">
          {/* 1. Jméno a Příjmení */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 font-mono mb-1.5">
                Křestní jméno *
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => handleFirstNameChange(e.target.value)}
                placeholder="např. Jan"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-zinc-800 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 font-mono mb-1.5">
                Příjmení *
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => handleLastNameChange(e.target.value)}
                placeholder="např. Novák"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-zinc-800 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40"
              />
            </div>
          </div>

          {/* 2. Zobrazované jméno */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 font-mono">
                Zobrazované jméno
              </label>
              {isDisplayNameCustom && (
                <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400">
                  Vlastní formát
                </span>
              )}
            </div>
            <input
              type="text"
              value={displayName}
              onChange={(e) => {
                setDisplayName(e.target.value);
                setIsDisplayNameCustom(true);
              }}
              onFocus={handleDisplayNameFocus}
              onBlur={handleDisplayNameBlur}
              placeholder={currentFallback || 'Jméno Příjmení'}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-zinc-800 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40"
            />
          </div>

          {/* 3. Role v systému a Pohlaví */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 font-mono mb-1.5">
                Role v systému
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-zinc-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none"
              >
                <option value="colleague">Uživatel</option>
                <option value="team_lead">Vedoucí</option>
                <option value="manager">Manažer</option>
                <option value="office_manager">Office Manager</option>
                <option value="admin">Administrátor</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 font-mono mb-1.5">
                Pohlaví
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setIsFemale(false)}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    !isFemale
                      ? 'bg-sky-500/15 text-sky-900 dark:text-sky-200 ring-2 ring-sky-500/40'
                      : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200/60 dark:hover:bg-zinc-700/60'
                  }`}
                >
                  <Mars className="w-4 h-4 text-sky-500 shrink-0" />
                  <span>Muž</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsFemale(true)}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    isFemale
                      ? 'bg-pink-500/15 text-pink-900 dark:text-pink-200 ring-2 ring-pink-500/40'
                      : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200/60 dark:hover:bg-zinc-700/60'
                  }`}
                >
                  <Venus className="w-4 h-4 text-pink-500 shrink-0" />
                  <span>Žena</span>
                </button>
              </div>
            </div>
          </div>

          {/* 4. Úvazek: ContractKind + ContractType */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 font-mono mb-1.5">
                Druh vztahu
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setContractKind('employee')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    contractKind === 'employee'
                      ? 'bg-amber-500/20 text-amber-900 dark:text-amber-200 ring-2 ring-amber-500/40'
                      : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400'
                  }`}
                >
                  HPP
                </button>
                <button
                  type="button"
                  onClick={() => setContractKind('osvc')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    contractKind === 'osvc'
                      ? 'bg-amber-500/20 text-amber-900 dark:text-amber-200 ring-2 ring-amber-500/40'
                      : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400'
                  }`}
                >
                  OSVČ
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 font-mono mb-1.5">
                Typ úvazku (fond)
              </label>
              <select
                value={contractTypeCode}
                onChange={(e) => setContractTypeCode(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-zinc-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none"
              >
                {Object.keys(contractTypesMap).length > 0 ? (
                  Object.entries(contractTypesMap).map(([code, name]) => (
                    <option key={code} value={code}>
                      {name}
                    </option>
                  ))
                ) : (
                  <>
                    <option value="full_time">Plný úvazek (1.0)</option>
                    <option value="half_time">Poloviční úvazek (0.5)</option>
                    <option value="part_time">Částečný úvazek (0.25)</option>
                  </>
                )}
              </select>
            </div>
          </div>

          {/* 5. Nadřízený a Vedoucí */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 font-mono mb-1.5">
                Přímý nadřízený (Manažer)
              </label>
              <select
                value={managerId}
                onChange={(e) => setManagerId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-zinc-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none"
              >
                <option value="">Vedení společnosti (výchozí)</option>
                {eligibleManagers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.roleLabel || u.role})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 font-mono mb-1.5">
                Vedoucí týmu (Parent Person)
              </label>
              <select
                value={parentPersonId}
                onChange={(e) => setParentPersonId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-zinc-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none"
              >
                <option value="">Bez přiřazeného vedoucího</option>
                {eligibleManagers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.roleLabel || u.role})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 6. E-mail (100% šířka) */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 font-mono mb-1.5">
              E-mail
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jan.novak@firma.cz"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-zinc-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40"
            />
          </div>

          {/* 7. Telefon a Datum nástupu */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 font-mono mb-1.5">
                Telefonní číslo
              </label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+420 777 000 000"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-zinc-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 font-mono mb-1.5">
                Datum nástupu
              </label>
              <input
                type="date"
                value={employmentStartDate}
                onChange={(e) => setEmploymentStartDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-zinc-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40"
              />
            </div>
          </div>

          {/* Trvalý Home Office switch */}
          <div className="pt-2">
            <Switch
              checked={isPermanentHomeOffice}
              onChange={setIsPermanentHomeOffice}
              color="amber"
              label="Trvalý Home Office"
            />
          </div>
        </div>
      )}

      {/* KROK 2: NASTAVENÍ ABSENCÍ */}
      {step === 2 && (
        <div className="space-y-4 py-1 animate-in fade-in">
          {/* Proration notice */}
          {proration.isProrated ? (
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
              <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold">
                  Automatický poměrný přepočet podle data nástupu
                </div>
                <div className="text-[11px] text-amber-800/90 dark:text-amber-300 mt-0.5">
                  Datum nástupu je evidováno v roce {proration.targetYear} ({employmentStartDate}). V tomto roce zbývá {proration.monthsRemaining} {proration.monthsRemaining === 1 ? 'měsíc' : proration.monthsRemaining < 5 ? 'měsíce' : 'měsíců'}.
                  Nárok byl poměrně přepočten na <strong>{proration.vac} dnů dovolené</strong> a <strong>{proration.sick} dny sick days</strong>. Hodnoty můžete upravit.
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-2xl bg-slate-100 dark:bg-zinc-800 text-xs text-slate-600 dark:text-zinc-300 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
              <span>Nastavení základního fondu absencí pro rok {proration.targetYear}.</span>
            </div>
          )}

          {/* Dovolená */}
          <div className="p-3.5 rounded-2xl bg-slate-100/70 dark:bg-zinc-800/70 space-y-3">
            <div className="text-xs font-bold text-slate-900 dark:text-white uppercase font-mono tracking-wider">
              {getAbsenceTypeLabel('vacation', absenceTypeDefs, contractKind === 'osvc')}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-slate-500 dark:text-zinc-400 mb-1">
                  Základní roční nárok (dnů):
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={vacationBase}
                  onChange={(e) => {
                    setVacationBase(Number(e.target.value));
                    setHasManuallyEditedAbsence(true);
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-zinc-800 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-500 dark:text-zinc-400 mb-1">
                  Převedeno z loňska (dnů):
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={vacationCarriedOver}
                  onChange={(e) => {
                    setVacationCarriedOver(Number(e.target.value));
                    setHasManuallyEditedAbsence(true);
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-zinc-800 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                />
              </div>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-zinc-400">
              Celkový disponibilní fond: <strong>{vacationBase + vacationCarriedOver} dnů</strong>
            </div>
          </div>

          {/* Sick Days */}
          <div className="p-3.5 rounded-2xl bg-slate-100/70 dark:bg-zinc-800/70 space-y-3">
            <div className="text-xs font-bold text-slate-900 dark:text-white uppercase font-mono tracking-wider">
              {getAbsenceTypeLabel('sick_day', absenceTypeDefs, contractKind === 'osvc')}
            </div>
            <div>
              <label className="block text-[11px] text-slate-500 dark:text-zinc-400 mb-1">
                Počet dnů pro rok {proration.targetYear}:
              </label>
              <input
                type="number"
                min="0"
                max="50"
                value={sickDaysTotal}
                onChange={(e) => {
                  setSickDaysTotal(Number(e.target.value));
                  setHasManuallyEditedAbsence(true);
                }}
                className="w-full sm:w-1/2 px-3.5 py-2.5 rounded-xl bg-white dark:bg-zinc-800 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40"
              />
            </div>
          </div>

          {/* Home Office */}
          <div className="p-3.5 rounded-2xl bg-slate-100/70 dark:bg-zinc-800/70 space-y-3">
            <div className="text-xs font-bold text-slate-900 dark:text-white uppercase font-mono tracking-wider">
              {getAbsenceTypeLabel('home_office', absenceTypeDefs, contractKind === 'osvc')} – Režim a čerpání
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => {
                  setHoPeriod('unlimited');
                  setHasManuallyEditedAbsence(true);
                }}
                className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  hoPeriod === 'unlimited'
                    ? 'bg-amber-500/20 text-amber-900 dark:text-amber-200 ring-2 ring-amber-500/40'
                    : 'bg-white dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200/60 dark:hover:bg-zinc-700/60'
                }`}
              >
                Neomezeno
              </button>

              <button
                type="button"
                onClick={() => {
                  setHoPeriod('weekly');
                  setHasManuallyEditedAbsence(true);
                }}
                className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  hoPeriod === 'weekly'
                    ? 'bg-amber-500/20 text-amber-900 dark:text-amber-200 ring-2 ring-amber-500/40'
                    : 'bg-white dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200/60 dark:hover:bg-zinc-700/60'
                }`}
              >
                Týdenní limit
              </button>

              <button
                type="button"
                onClick={() => {
                  setHoPeriod('yearly');
                  setHasManuallyEditedAbsence(true);
                }}
                className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  hoPeriod === 'yearly'
                    ? 'bg-amber-500/20 text-amber-900 dark:text-amber-200 ring-2 ring-amber-500/40'
                    : 'bg-white dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200/60 dark:hover:bg-zinc-700/60'
                }`}
              >
                Roční limit
              </button>

              <button
                type="button"
                onClick={() => {
                  setHoPeriod('disabled');
                  setHasManuallyEditedAbsence(true);
                }}
                className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  hoPeriod === 'disabled'
                    ? 'bg-rose-500/20 text-rose-900 dark:text-rose-200 ring-2 ring-rose-500/40'
                    : 'bg-white dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200/60 dark:hover:bg-zinc-700/60'
                }`}
              >
                Zakázáno
              </button>
            </div>

            {(hoPeriod === 'weekly' || hoPeriod === 'yearly') && (
              <div className="pt-1">
                <label className="block text-[11px] text-slate-500 dark:text-zinc-400 mb-1">
                  {hoPeriod === 'weekly' ? 'Týdenní limit (dnů/týden):' : 'Roční limit (dnů/rok):'}
                </label>
                <input
                  type="number"
                  min="1"
                  max={hoPeriod === 'weekly' ? 7 : 365}
                  value={hoLimit}
                  onChange={(e) => {
                    setHoLimit(Number(e.target.value));
                    setHasManuallyEditedAbsence(true);
                  }}
                  className="w-full sm:w-1/2 px-3.5 py-2.5 rounded-xl bg-white dark:bg-zinc-800 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                />
              </div>
            )}
          </div>

          {/* Náhradní volno (čerpání z FlexiTime) */}
          {contractKind !== 'osvc' && (
            <div
              onClick={() => setCompensatoryLeaveEnabled((prev) => !prev)}
              className="p-3.5 rounded-2xl bg-slate-100/70 dark:bg-zinc-800/70 flex items-center justify-between gap-3 cursor-pointer"
            >
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-slate-900 dark:text-white uppercase font-mono tracking-wider">
                  {getAbsenceTypeLabel('compensatory_leave', absenceTypeDefs, false)} (čerpání z FlexiTime)
                </div>
                <div className="text-[11px] text-slate-500 dark:text-zinc-400">
                  Povolit této osobě placené náhradní volno ve dnech čerpané z FlexiTime přesčasů
                </div>
              </div>
              <Switch
                checked={compensatoryLeaveEnabled}
                onChange={(val) => setCompensatoryLeaveEnabled(val)}
              />
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

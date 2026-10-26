import { useState, useEffect } from 'react';
import {
  Check,
  FileCheck,
  AlertCircle,
  Calendar
} from 'lucide-react';
import {
  getStatusConfig,
  type AbsenceType,
  type StatusType
} from '../config/presenceConfig';
import {
  resolveAbsenceTypeConfig,
  resolveAbsenceTypeLabel,
  getAbsenceTypeLabel,
  getMinAllowedDateForAbsenceType,
  isAbsenceTypeDeadlinePassedToday,
  getLocalTodayIso,
  addDaysToLocalIso,
  countWorkingDays,
  addWorkingDaysToLocalIso,
  type AbsenceTypeConfigDto
} from '../api';
import { Modal, Button, Textarea, StatPill } from './ui';
import { ApplicantCard } from './ApplicantCard';
import { formatOvertime } from '../types/attendance';

export type RequestTypeOption = AbsenceType | 'home_office' | string;

export interface NewRequestData {
  type: RequestTypeOption;
  startDate: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  facilityName?: string;
  hasConfirmationDocument?: boolean;
  note?: string;
}

interface NewRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: NewRequestData) => void;
  applicantName: string;
  applicantRole?: string;
  applicantContract?: 'HPP' | 'OSVČ' | string;
  applicantContractType?: string;
  applicantContractTypeName?: string;
  isPermanentHomeOffice?: boolean;
  managerName?: string;
  vacationRemaining?: number;
  vacationTotal?: number;
  sickDaysRemaining?: number;
  sickDaysTotal?: number;
  /** Maximální počet dnů náhradního volna dostupný ze salda (po odečtení čekajících a schválených žádostí) */
  compensatoryLeaveMaxDays?: number;
  /** Dostupný počet hodin v saldu pro náhradní volno */
  compensatoryLeaveAvailableSaldoHours?: number;
  /** Denní fond hodin dle úvazku osoby (např. 8h plný, 4h poloviční, 2h čtvrtinový) */
  dailyTargetHours?: number;
  initialType?: RequestTypeOption;
  /** Zda žádost zadává oprávněná osoba (Vedoucí/Manažer/Officer/Admin) za jinou osobu v Detailu osoby */
  isManagingOtherPerson?: boolean;
  /** Zda přihlášená role v Detailu osoby (Admin/Officer/Manažer) zadává absenci bez časových/offsetových pravidel (platí pouze limity kapacity/délky) */
  canBypassAbsenceRules?: boolean;
  /** Konfigurace typů absencí z DB */
  absenceTypesMap?: Record<string, AbsenceTypeConfigDto>;
  /** Existující celodenní žádosti cílové osoby pro okamžitou kontrolu překryvu */
  existingRequests?: Array<{
    id?: string;
    type: string;
    status: string;
    startDate: string;
    endDate?: string;
    isDeleted?: boolean;
  }>;
  /** Existující hodinové absence (lékař) cílové osoby pro okamžitou kontrolu překryvu */
  existingDoctorVisits?: Array<{
    id?: string;
    status: string;
    date: string;
    startTime: string;
    endTime: string;
    isDeleted?: boolean;
  }>;
  /** Dnešní směny (přítomnost) cílové osoby (směna začínající v 00:00 je pokračování ze včerejška a patří do předchozího dne) */
  todayShifts?: Array<{
    start: string;
    end: string | null;
    location: string;
  }>;
}

export function NewRequestModal({
  isOpen,
  onClose,
  onSubmit,
  applicantName,
  applicantRole = 'Uživatel',
  applicantContract,
  applicantContractType,
  applicantContractTypeName,
  isPermanentHomeOffice,
  vacationRemaining,
  vacationTotal,
  sickDaysRemaining,
  sickDaysTotal,
  compensatoryLeaveMaxDays,
  compensatoryLeaveAvailableSaldoHours,
  dailyTargetHours = 8,
  initialType = 'vacation',
  isManagingOtherPerson = false,
  canBypassAbsenceRules = false,
  absenceTypesMap,
  existingRequests = [],
  existingDoctorVisits = [],
  todayShifts = []
}: NewRequestModalProps) {
  const todayIso = getLocalTodayIso();
  const [requestType, setRequestType] = useState<RequestTypeOption>(initialType);
  const [startDate, setStartDate] = useState(todayIso);
  const [endDate, setEndDate] = useState(todayIso);
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('12:00');
  const [note, setNote] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const currentYear = new Date().getFullYear();

  useEffect(() => {
    if (isOpen && initialType) {
      const rule = resolveAbsenceTypeConfig(initialType, absenceTypesMap);
      const minDate = getMinAllowedDateForAbsenceType(rule, canBypassAbsenceRules);
      let defaultDate = minDate || getLocalTodayIso();

      // Pokud má vybraná absence zapnuto přepnutí/posun při vyčerpání (např. dovolená) a zůstatek pro aktuální rok je vyčerpán (<= 0),
      // předvyplníme datum od 1. 1. následujícího roku, aby si uživatel mohl zadat čerpání na příští rok
      const switchOnExhausted = rule.switchToUnpaidOnExhausted ?? initialType === 'vacation';
      if (switchOnExhausted && initialType === 'vacation' && (vacationRemaining ?? 0) <= 0) {
        const nextYearStart = `${currentYear + 1}-01-01`;
        defaultDate = minDate && minDate > nextYearStart ? minDate : nextYearStart;
      }

      setRequestType(initialType);
      setStartDate(defaultDate);
      setEndDate(defaultDate);
      setErrorMsg('');
    }
  }, [isOpen, initialType, isManagingOtherPerson, canBypassAbsenceRules, absenceTypesMap, vacationRemaining, currentYear]);

  if (!isOpen) return null;

  const currentCfg = getStatusConfig(requestType as StatusType);
  const CurrentIcon = currentCfg.icon;
  const isApplicantOsvc = applicantContract === 'OSVČ';
  const typeRule = resolveAbsenceTypeConfig(requestType, absenceTypesMap);
  const typeLabel = resolveAbsenceTypeLabel(typeRule, isApplicantOsvc) || currentCfg.label;
  const unpaidLeaveLabel =
    getAbsenceTypeLabel('unpaid_leave', absenceTypesMap, isApplicantOsvc) || 'Neplacené volno';
  const minAllowedDate = getMinAllowedDateForAbsenceType(typeRule, canBypassAbsenceRules);
  const isMultiDayMode = typeRule.durationMode === 'days' || typeRule.durationMode === 'both';
  const isSingleDayMode = typeRule.durationMode === 'single_day';
  const isHoursMode = typeRule.durationMode === 'hours';
  const isWorkMode = Boolean(typeRule.isWorkMode ?? requestType === 'home_office');
  const isPaidAbsence = typeRule.isPaid !== undefined ? Boolean(typeRule.isPaid) : requestType !== 'unpaid_leave';
  const drawsFromSaldo = Boolean(
    typeRule.drawsFromSaldo ?? requestType === 'compensatory_leave'
  );
  const switchToUnpaidOnExhausted = Boolean(
    typeRule.switchToUnpaidOnExhausted ?? requestType === 'vacation'
  );
  const rawInfoText = (typeRule.infoText ?? '').trim();
  const infoTextLines = rawInfoText
    ? rawInfoText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    : [];

  // Pokud má jednodenní absence (sick_day) SubmissionOffsetDays = 0, pro běžného uživatele (a vedoucího) nemá výběr data a zapisuje se dnešní datum.
  // Role Admin, Office Manager a Manažer v Detailu osoby (canBypassAbsenceRules) mohou zvolit jakékoliv datum (1 den).
  const isFixedTodaySingleDay =
    !canBypassAbsenceRules &&
    isSingleDayMode &&
    (typeRule.submissionOffsetDays ?? 0) === 0;

  const isDeadlinePassed = isAbsenceTypeDeadlinePassedToday(typeRule, isManagingOtherPerson || canBypassAbsenceRules);
  const deadlineFormatted = typeRule.submissionDeadlineTime
    ? typeRule.submissionDeadlineTime.slice(0, 5)
    : '09:00';

  const hasVacationIndicator =
    requestType === 'vacation' &&
    vacationRemaining !== undefined &&
    vacationTotal !== undefined &&
    vacationTotal > 0;

  const isVacationExhausted = hasVacationIndicator && (vacationRemaining ?? 0) <= 0;

  const hasSickDayIndicator =
    requestType === 'sick_day' &&
    sickDaysRemaining !== undefined &&
    sickDaysTotal !== undefined &&
    sickDaysTotal > 0;

  const calculateDays = (start: string, end: string) => {
    return countWorkingDays(start, end);
  };

  const getVacationRemainingForYear = (yr: number): number => {
    if (yr === currentYear) {
      return vacationRemaining ?? 0;
    }
    const baseTotal = vacationTotal ?? 20;
    const usedInYear = existingRequests
      .filter(
        (r) =>
          !r.isDeleted &&
          r.type === 'vacation' &&
          (r.status === 'approved' || r.status === 'pending') &&
          String(r.startDate || '').startsWith(String(yr))
      )
      .reduce((sum, r) => sum + countWorkingDays(r.startDate, r.endDate || r.startDate), 0);
    return Math.max(0, baseTotal - usedInYear);
  };

  const getMaxVacationAllowedForStart = (startIso: string) => {
    const yr = Number(startIso.slice(0, 4)) || currentYear;
    return getVacationRemainingForYear(yr);
  };

  const handleStartDateChange = (newStart: string) => {
    const clampedStart = minAllowedDate && newStart < minAllowedDate ? minAllowedDate : newStart;
    setStartDate(clampedStart);
    setErrorMsg('');
    if (isMultiDayMode) {
      let nextEnd = endDate < clampedStart ? clampedStart : endDate;
      if (requestType === 'vacation') {
        const sYr = Number(clampedStart.slice(0, 4)) || currentYear;
        const eYr = Number(nextEnd.slice(0, 4)) || sYr;
        if (sYr === eYr) {
          const maxVac = getMaxVacationAllowedForStart(clampedStart);
          if (maxVac > 0) {
            const span = calculateDays(clampedStart, nextEnd);
            if (span > maxVac) {
              nextEnd = addWorkingDaysToLocalIso(clampedStart, maxVac);
            }
          }
        } else if (eYr > sYr) {
          const maxStartYr = getVacationRemainingForYear(sYr);
          const maxEndYr = getVacationRemainingForYear(eYr);
          const spanStartYr = calculateDays(clampedStart, `${sYr}-12-31`);
          const spanEndYr = calculateDays(`${eYr}-01-01`, nextEnd);
          if (maxStartYr > 0 && spanStartYr > maxStartYr) {
            nextEnd = addWorkingDaysToLocalIso(clampedStart, maxStartYr);
          } else if (maxEndYr > 0 && spanEndYr > maxEndYr) {
            nextEnd = addWorkingDaysToLocalIso(`${eYr}-01-01`, maxEndYr);
          }
        }
      } else if (drawsFromSaldo) {
        const maxComp = Math.max(0, compensatoryLeaveMaxDays ?? 0);
        if (maxComp > 0) {
          const span = calculateDays(clampedStart, nextEnd);
          if (span > maxComp) {
            nextEnd = addWorkingDaysToLocalIso(clampedStart, maxComp);
          }
        } else {
          nextEnd = clampedStart;
        }
      }
      if (nextEnd !== endDate) {
        setEndDate(nextEnd);
      }
    } else {
      setEndDate(clampedStart);
    }
  };

  const handleEndDateChange = (newEnd: string) => {
    let clampedEnd = minAllowedDate && newEnd < minAllowedDate ? minAllowedDate : newEnd;
    if (clampedEnd < startDate) {
      clampedEnd = startDate;
    }
    if (requestType === 'vacation') {
      const sYr = Number(startDate.slice(0, 4)) || currentYear;
      const eYr = Number(clampedEnd.slice(0, 4)) || sYr;
      if (sYr === eYr) {
        const maxVac = getMaxVacationAllowedForStart(startDate);
        if (maxVac > 0) {
          const span = calculateDays(startDate, clampedEnd);
          if (span > maxVac) {
            clampedEnd = addWorkingDaysToLocalIso(startDate, maxVac);
          }
        }
      } else if (eYr > sYr) {
        const maxStartYr = getVacationRemainingForYear(sYr);
        const maxEndYr = getVacationRemainingForYear(eYr);
        const spanStartYr = calculateDays(startDate, `${sYr}-12-31`);
        const spanEndYr = calculateDays(`${eYr}-01-01`, clampedEnd);
        if (maxStartYr > 0 && spanStartYr > maxStartYr) {
          clampedEnd = addWorkingDaysToLocalIso(startDate, maxStartYr);
        } else if (maxEndYr > 0 && spanEndYr > maxEndYr) {
          clampedEnd = addWorkingDaysToLocalIso(`${eYr}-01-01`, maxEndYr);
        }
      }
    } else if (drawsFromSaldo) {
      const maxComp = Math.max(0, compensatoryLeaveMaxDays ?? 0);
      if (maxComp > 0) {
        const span = calculateDays(startDate, clampedEnd);
        if (span > maxComp) {
          clampedEnd = addWorkingDaysToLocalIso(startDate, maxComp);
        }
      } else {
        clampedEnd = startDate;
      }
    }
    setEndDate(clampedEnd);
    setErrorMsg('');
  };

  const effectiveStartForCount = isFixedTodaySingleDay ? todayIso : startDate;
  const effectiveEndForCount = isMultiDayMode ? endDate : effectiveStartForCount;
  const daysCount = isHoursMode ? 0 : calculateDays(effectiveStartForCount, effectiveEndForCount);

  const startYear = Number(effectiveStartForCount.slice(0, 4)) || currentYear;
  const endYear = Number(effectiveEndForCount.slice(0, 4)) || startYear;
  const isCrossYear =
    !isHoursMode &&
    isMultiDayMode &&
    endYear > startYear &&
    effectiveEndForCount >= effectiveStartForCount;
  const daysInStartYear = isCrossYear
    ? calculateDays(effectiveStartForCount, `${startYear}-12-31`)
    : daysCount;
  const daysInEndYear = isCrossYear
    ? calculateDays(`${endYear}-01-01`, effectiveEndForCount)
    : 0;

  const formatCzechDaysLabel = (count: number) =>
    `${count} ${count === 1 ? 'den' : count >= 2 && count <= 4 ? 'dny' : 'dní'}`;

  const formatCzechDateDisplay = (iso: string) => {
    const [y, m, d] = iso.split('-');
    if (!y || !m || !d) return iso;
    return `${Number(d)}. ${Number(m)}. ${y}`;
  };

  const parseMinutes = (hhmm?: string) => {
    if (!hhmm) return 0;
    const [h, m] = hhmm.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (isDeadlinePassed) {
      setErrorMsg(`Žádost typu ${typeLabel} lze v daný den zadat pouze do ${deadlineFormatted}.`);
      return;
    }

    const effectiveStart = isFixedTodaySingleDay ? todayIso : startDate;
    const effectiveEnd = isMultiDayMode ? endDate : effectiveStart;

    if (minAllowedDate && effectiveStart < minAllowedDate) {
      setErrorMsg(
        typeRule.submissionOffsetDays > 0
          ? `Žádost typu ${typeLabel} je nutné zadat alespoň ${typeRule.submissionOffsetDays} ${
              typeRule.submissionOffsetDays === 1 ? 'den' : typeRule.submissionOffsetDays < 5 ? 'dny' : 'dní'
            } předem (nejdříve od ${formatCzechDateDisplay(minAllowedDate)}).`
          : `Datum nemůže být v minulosti.`
      );
      return;
    }

    if (isMultiDayMode) {
      if (new Date(effectiveEnd) < new Date(effectiveStart)) {
        setErrorMsg('Datum ukončení nemůže předcházet datu začátku.');
        return;
      }
    }

    if (!isHoursMode && daysCount <= 0) {
      setErrorMsg('Zvolený termín připadá pouze na víkend nebo státní svátek (0 pracovních dnů).');
      return;
    }

    if (requestType === 'vacation') {
      if (isCrossYear) {
        const maxStart = getVacationRemainingForYear(startYear);
        if (daysInStartYear > maxStart) {
          setErrorMsg(
            `Nemáte dostatečný zůstatek dovolené pro rok ${startYear} (požadováno: ${formatCzechDaysLabel(daysInStartYear)}, zbývá: ${formatCzechDaysLabel(maxStart)}).`
          );
          return;
        }
        const maxEnd = getVacationRemainingForYear(endYear);
        if (daysInEndYear > maxEnd) {
          setErrorMsg(
            `Nemáte dostatečný zůstatek dovolené pro rok ${endYear} (požadováno: ${formatCzechDaysLabel(daysInEndYear)}, zbývá: ${formatCzechDaysLabel(maxEnd)}).`
          );
          return;
        }
      } else {
        const reqYear = Number(effectiveStart.slice(0, 4)) || currentYear;
        const maxAllowed = getVacationRemainingForYear(reqYear);
        if (daysCount > maxAllowed) {
          setErrorMsg(
            `Nemáte dostatečný zůstatek dovolené pro rok ${reqYear} (požadováno: ${formatCzechDaysLabel(daysCount)}, zbývá: ${formatCzechDaysLabel(maxAllowed)}).`
          );
          return;
        }
      }
    }

    if (hasSickDayIndicator && (sickDaysRemaining ?? 0) <= 0) {
      setErrorMsg('Nemáte dostatečný zůstatek Sick Days.');
      return;
    }

    if (drawsFromSaldo) {
      const maxComp = Math.max(0, compensatoryLeaveMaxDays ?? 0);
      if (maxComp <= 0 || daysCount > maxComp) {
        setErrorMsg(
          `Nemáte dostatečné saldo přesčasů pro čerpání ${typeLabel} (požadováno: ${formatCzechDaysLabel(daysCount)}, dostupné ze salda: max. ${formatCzechDaysLabel(maxComp)}).`
        );
        return;
      }
    }

    // 1. Kontrola překryvu s jinými aktivními absencemi (schválenými nebo čekajícími, mimo smazaných)
    // Výjimka: Režim práce (např. Home Office) nekoliduje s hodinovou absencí (např. Lékař)
    const overlappingLeave = existingRequests.find((req) => {
      if (req.isDeleted) return false;
      if (req.status !== 'approved' && req.status !== 'pending') return false;
      const reqRule = resolveAbsenceTypeConfig(req.type, absenceTypesMap);
      const reqIsHours = reqRule.durationMode === 'hours';
      const reqIsWorkMode = Boolean(reqRule.isWorkMode ?? req.type === 'home_office');
      const curIsHours = isHoursMode;
      if (
        (isWorkMode && reqIsHours) ||
        (reqIsWorkMode && curIsHours)
      ) {
        return false;
      }
      const rStart = req.startDate;
      const rEnd = req.endDate || req.startDate;
      return rStart <= effectiveEnd && rEnd >= effectiveStart;
    });

    if (overlappingLeave) {
      const exCfg = getStatusConfig(overlappingLeave.type as StatusType);
      const exLabel =
        getAbsenceTypeLabel(overlappingLeave.type, absenceTypesMap, isApplicantOsvc) || exCfg.label;
      setErrorMsg(
        `Ve zvoleném termínu již existuje jiná absence (${exLabel}: ${formatCzechDateDisplay(overlappingLeave.startDate)}).`
      );
      return;
    }

    const overlappingDoc = existingDoctorVisits.find((doc) => {
      if (doc.isDeleted) return false;
      if (doc.status !== 'approved' && doc.status !== 'pending') return false;
      if (isWorkMode) return false;
      if (doc.date < effectiveStart || doc.date > effectiveEnd) return false;
      if (isHoursMode) {
        return parseMinutes(startTime) < parseMinutes(doc.endTime) && parseMinutes(endTime) > parseMinutes(doc.startTime);
      }
      return true;
    });

    if (overlappingDoc) {
      setErrorMsg(
        `Ve zvoleném termínu již existuje časová propustka (${formatCzechDateDisplay(overlappingDoc.date)} ${overlappingDoc.startTime}–${overlappingDoc.endTime}).`
      );
      return;
    }

    // 2. Kontrola překryvu s dnešní přítomností (směny přes půlnoc začínající v 00:00 se počítají do předchozího dne)
    const yesterdayIso = addDaysToLocalIso(todayIso, -1);
    for (const s of todayShifts) {
      if (s.location === 'doctor') continue;
      const shiftOriginDate = s.start === '00:00' ? yesterdayIso : todayIso;
      if (shiftOriginDate >= effectiveStart && shiftOriginDate <= effectiveEnd) {
        if (isHoursMode && shiftOriginDate === todayIso && s.start !== '00:00') {
          const sStart = parseMinutes(s.start);
          const sEnd = s.end ? parseMinutes(s.end) : 1440;
          if (parseMinutes(startTime) < sEnd && parseMinutes(endTime) > sStart) {
            setErrorMsg(`Ve zvoleném čase již existuje zapsaná přítomnost (${s.start}–${s.end || 'probíhá'}).`);
            return;
          }
        } else if (!isHoursMode && !isWorkMode) {
          setErrorMsg(
            `Ve zvoleném termínu (${formatCzechDateDisplay(shiftOriginDate)}) již existuje zapsaná přítomnost v práci.`
          );
          return;
        }
      }
    }

    onSubmit({
      type: requestType,
      startDate: effectiveStart,
      endDate: effectiveEnd,
      startTime: isHoursMode ? startTime : undefined,
      endTime: isHoursMode ? endTime : undefined,
      note: note.trim()
    });

    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={typeLabel}
      subtitle="Nová žádost"
      icon={CurrentIcon}
      iconBgClass={currentCfg.statIconBgClass}
      size="lg"
      footer={
        <>
          <Button
            variant="filled"
            color="primary"
            size="normal"
            width="full"
            icon={Check}
            disabled={
              isDeadlinePassed ||
              (hasSickDayIndicator && (sickDaysRemaining ?? 0) <= 0) ||
              (requestType === 'vacation' && Number(startDate.slice(0, 4)) === currentYear && (vacationRemaining ?? 0) <= 0) ||
              (drawsFromSaldo && ((compensatoryLeaveMaxDays ?? 0) <= 0 || daysCount > (compensatoryLeaveMaxDays ?? 0)))
            }
            onClick={handleSubmit}
          >
            Odeslat žádost
          </Button>
          <Button
            variant="transparent"
            color="rose"
            size="normal"
            width="full"
            onClick={onClose}
          >
            Zrušit
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Karta žadatele (sjednocená s detailem žádosti) */}
        <ApplicantCard
          name={applicantName}
          role={applicantRole}
          contract={applicantContract}
          contractType={applicantContractType}
          contractTypeName={applicantContractTypeName}
          isPermanentHomeOffice={isPermanentHomeOffice}
          rightContent={
            hasVacationIndicator ? (
              <StatPill
                activityType="vacation"
                value={vacationRemaining!}
                total={vacationTotal!}
                unit="d"
                layout="horizontal"
              />
            ) : hasSickDayIndicator ? (
              <StatPill
                activityType="sick_day"
                value={sickDaysRemaining!}
                total={sickDaysTotal!}
                unit="d"
                layout="horizontal"
              />
            ) : drawsFromSaldo ? (
              <div className="text-right">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-100 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300">
                  <FileCheck className="w-3.5 h-3.5" />
                  <span>
                    Max. {formatCzechDaysLabel(Math.max(0, compensatoryLeaveMaxDays ?? 0))} ze salda (
                    {formatOvertime(compensatoryLeaveAvailableSaldoHours ?? 0)})
                  </span>
                </span>
                <div className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1">
                  Placená absence (1 den = {dailyTargetHours}h salda)
                </div>
              </div>
            ) : isHoursMode ? (
              <div className="text-right">
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                    isPaidAbsence
                      ? 'bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300'
                      : 'bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300'
                  }`}
                >
                  <FileCheck className="w-3.5 h-3.5" />
                  <span>{isPaidAbsence ? 'S náhradou mzdy' : 'Bez náhrady mzdy'}</span>
                </span>
                <div className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1">
                  Nezkracuje dovolenou
                </div>
              </div>
            ) : undefined
          }
        />

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 1. ČASOVÁ ABSENCE (durationMode === 'hours', např. Lékař) */}
          {isHoursMode && (
            <div className="space-y-3 animate-in fade-in">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <span className="block text-[11px] text-slate-500 dark:text-zinc-400 mb-1">Datum:</span>
                  <input
                    type="date"
                    value={startDate}
                    min={minAllowedDate}
                    onChange={(e) => handleStartDateChange(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200/70 focus:bg-white dark:bg-zinc-800 dark:hover:bg-zinc-700/70 dark:focus:bg-zinc-800 border border-transparent focus:border-slate-300 dark:focus:border-zinc-600 text-xs font-mono text-slate-900 dark:text-white focus:outline-none transition-colors"
                    required
                  />
                </div>
                <div>
                  <span className="block text-[11px] text-slate-500 dark:text-zinc-400 mb-1">Čas od:</span>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200/70 focus:bg-white dark:bg-zinc-800 dark:hover:bg-zinc-700/70 dark:focus:bg-zinc-800 border border-transparent focus:border-slate-300 dark:focus:border-zinc-600 text-xs font-mono text-slate-900 dark:text-white focus:outline-none transition-colors"
                    required
                  />
                </div>
                <div>
                  <span className="block text-[11px] text-slate-500 dark:text-zinc-400 mb-1">Čas do (odhad):</span>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200/70 focus:bg-white dark:bg-zinc-800 dark:hover:bg-zinc-700/70 dark:focus:bg-zinc-800 border border-transparent focus:border-slate-300 dark:focus:border-zinc-600 text-xs font-mono text-slate-900 dark:text-white focus:outline-none transition-colors"
                    required
                  />
                </div>
              </div>
            </div>
          )}

          {/* 2. JEDNODENNÍ ABSENCE (durationMode === 'single_day', např. Sick day) */}
          {!isHoursMode && isSingleDayMode && (
            <div className="space-y-3 animate-in fade-in">
              {isFixedTodaySingleDay ? (
                <div className="p-3.5 rounded-2xl bg-rose-500/10 flex items-center justify-between gap-3 text-xs text-rose-900 dark:text-rose-300">
                  <div className="flex items-center gap-2 font-medium">
                    <Calendar className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                    <span>Datum čerpání (dnes):</span>
                  </div>
                  <span className="font-bold font-mono">
                    {formatCzechDateDisplay(todayIso)}
                    {!isManagingOtherPerson && typeRule.submissionDeadlineTime ? ` (hlášení do ${deadlineFormatted})` : ''}
                  </span>
                </div>
              ) : (
                <div>
                  <span className="block text-[11px] text-slate-500 dark:text-zinc-400 mb-1">
                    Datum (1 den):
                  </span>
                  <input
                    type="date"
                    value={startDate}
                    min={minAllowedDate}
                    onChange={(e) => handleStartDateChange(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200/70 focus:bg-white dark:bg-zinc-800 dark:hover:bg-zinc-700/70 dark:focus:bg-zinc-800 border border-transparent focus:border-slate-300 dark:focus:border-zinc-600 text-xs font-mono text-slate-900 dark:text-white focus:outline-none transition-colors"
                    required
                  />
                </div>
              )}
            </div>
          )}

          {/* 3. VÍCEDENNÍ ABSENCE (durationMode === 'days', např. Dovolená, Home Office, Nemoc, Neplacené volno i vlastní typy) */}
          {!isHoursMode && !isSingleDayMode && (
            <div className="space-y-3 animate-in fade-in">
              {switchToUnpaidOnExhausted && isVacationExhausted && (
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs text-amber-900 dark:text-amber-300 font-medium">
                    <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span>
                      {typeLabel} pro rok {currentYear} byla vyčerpána. Níže můžete zadat termín na rok {currentYear + 1}, nebo přepnout na {unpaidLeaveLabel}.
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="filled"
                    colorKey="amber"
                    size="xs"
                    onClick={() => {
                      const unpaidRule = resolveAbsenceTypeConfig('unpaid_leave', absenceTypesMap);
                      const unpaidMin = getMinAllowedDateForAbsenceType(unpaidRule, canBypassAbsenceRules);
                      const nextDate = unpaidMin || getLocalTodayIso();
                      setRequestType('unpaid_leave');
                      setStartDate(nextDate);
                      setEndDate(nextDate);
                      setErrorMsg('');
                    }}
                    className="shrink-0"
                  >
                    Přepnout na {unpaidLeaveLabel}
                  </Button>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="block text-[11px] text-slate-500 dark:text-zinc-400 mb-1">Datum od:</span>
                  <input
                    type="date"
                    value={startDate}
                    min={switchToUnpaidOnExhausted && isVacationExhausted ? `${currentYear + 1}-01-01` : minAllowedDate}
                    onChange={(e) => handleStartDateChange(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200/70 focus:bg-white dark:bg-zinc-800 dark:hover:bg-zinc-700/70 dark:focus:bg-zinc-800 border border-transparent focus:border-slate-300 dark:focus:border-zinc-600 text-xs font-mono text-slate-900 dark:text-white focus:outline-none transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    required
                  />
                </div>
                <div>
                  <span className="block text-[11px] text-slate-500 dark:text-zinc-400 mb-1">
                    Datum do:
                  </span>
                  <input
                    type="date"
                    value={endDate}
                    min={switchToUnpaidOnExhausted && isVacationExhausted ? `${currentYear + 1}-01-01` : startDate || minAllowedDate}
                    max={
                      drawsFromSaldo && (compensatoryLeaveMaxDays ?? 0) > 0
                        ? addWorkingDaysToLocalIso(startDate, compensatoryLeaveMaxDays!)
                        : undefined
                    }
                    onChange={(e) => handleEndDateChange(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200/70 focus:bg-white dark:bg-zinc-800 dark:hover:bg-zinc-700/70 dark:focus:bg-zinc-800 border border-transparent focus:border-slate-300 dark:focus:border-zinc-600 text-xs font-mono text-slate-900 dark:text-white focus:outline-none transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    required
                  />
                </div>
              </div>

              {!(switchToUnpaidOnExhausted && isVacationExhausted && Number(startDate.slice(0, 4)) === currentYear) &&
                (infoTextLines.length === 0 || drawsFromSaldo) && (
                  isCrossYear && requestType === 'vacation' ? (
                    <div className="space-y-2">
                      <div className="p-3 rounded-xl flex items-center justify-between text-xs bg-amber-500/10 text-amber-900 dark:text-amber-300">
                        <span className="font-medium">
                          Čerpání pro rok {startYear}:
                        </span>
                        <span className="font-bold font-mono">
                          {formatCzechDaysLabel(daysInStartYear)}
                          {hasVacationIndicator
                            ? ` (zůstatek ${startYear} pak: ${formatCzechDaysLabel(Math.max(0, getVacationRemainingForYear(startYear) - daysInStartYear))})`
                            : ''}
                        </span>
                      </div>
                      <div className="p-3 rounded-xl flex items-center justify-between text-xs bg-amber-500/10 text-amber-900 dark:text-amber-300">
                        <span className="font-medium">
                          Čerpání pro rok {endYear}:
                        </span>
                        <span className="font-bold font-mono">
                          {formatCzechDaysLabel(daysInEndYear)}
                          {hasVacationIndicator
                            ? ` (zůstatek ${endYear} pak: ${formatCzechDaysLabel(Math.max(0, getVacationRemainingForYear(endYear) - daysInEndYear))})`
                            : ''}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`p-3 rounded-xl flex items-center justify-between text-xs ${
                        isWorkMode
                          ? 'bg-emerald-500/10 text-emerald-900 dark:text-emerald-300'
                          : drawsFromSaldo
                          ? 'bg-teal-500/10 text-teal-900 dark:text-teal-300'
                          : !isPaidAbsence
                          ? 'bg-purple-500/10 text-purple-900 dark:text-purple-300'
                          : 'bg-amber-500/10 text-amber-900 dark:text-amber-300'
                      }`}
                    >
                      <span className="font-medium">
                        {isWorkMode
                          ? `Délka (${typeLabel}):`
                          : !isPaidAbsence
                          ? 'Délka neplaceného volna:'
                          : 'Délka plánovaného čerpání:'}
                      </span>
                      <span className="font-bold font-mono">
                        {formatCzechDaysLabel(daysCount)}
                        {hasVacationIndicator
                          ? ` (zůstatek${startYear !== currentYear ? ` ${startYear}` : ''} pak: ${formatCzechDaysLabel(Math.max(0, getVacationRemainingForYear(startYear) - daysCount))})`
                          : drawsFromSaldo
                          ? ` / max. ${formatCzechDaysLabel(Math.max(0, compensatoryLeaveMaxDays ?? 0))} (zbude ${formatOvertime(Math.max(0, (compensatoryLeaveAvailableSaldoHours ?? 0) - daysCount * dailyTargetHours))})`
                          : ''}
                      </span>
                    </div>
                  )
                )}
            </div>
          )}

          {/* Dynamický informační box z databáze (infoText u Lékaře, Nemoci nebo jakékoliv jiné absence) */}
          {infoTextLines.length > 0 && (
            <div className={`p-3 rounded-xl text-xs ${currentCfg.statIconBgClass}`}>
              <div className="flex items-center gap-1.5 font-semibold">
                <CurrentIcon className="w-3.5 h-3.5 shrink-0" />
                <span>{infoTextLines[0]}</span>
              </div>
              {infoTextLines.length > 1 && (
                <div className="text-[11px] opacity-90 mt-0.5 leading-relaxed">
                  {infoTextLines.slice(1).join(' ')}
                </div>
              )}
            </div>
          )}

          {/* Common Note */}
          <Textarea
            label="Poznámka k žádosti"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Doplňující informace, předání úkolů během nepřítomnosti..."
          />

          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-rose-500/10 text-xs text-rose-700 dark:text-rose-300 font-medium">
              {errorMsg}
            </div>
          )}
        </form>
      </div>
    </Modal>
  );
}

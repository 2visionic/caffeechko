import { useState, useEffect } from 'react';
import { Check, X, Clock, AlertCircle, AlertTriangle, RotateCcw, Calendar, History } from 'lucide-react';
import { getStatusConfig } from '../config/presenceConfig';
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
  formatRecordEditLog,
  type AbsenceTypeConfigDto,
  type RecordEditLogDto
} from '../api';
import { Modal, Button, Textarea, StatPill } from './ui';
import { ApplicantCard } from './ApplicantCard';

export interface LeaveRequestItem {
  id: string;
  applicantId?: string;
  userName: string;
  userRole: string;
  managerId?: string;
  managerName?: string;
  parentPersonId?: string;
  parentPersonName?: string;
  contract?: 'HPP' | 'OSVČ';
  contractType?: 'full_time' | 'half_time' | 'part_time' | string;
  contractTypeName?: string;
  isPermanentHomeOffice?: boolean;
  type: 'vacation' | 'sick_day' | 'unpaid_leave' | 'illness' | 'home_office' | string;
  typeName: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  daysCount: number;
  remainingDays: number;
  totalDays: number;
  note?: string;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  isRead?: boolean;
  createdAt?: string;
  approvedByName?: string;
  approvedByIsFemale?: boolean | null;
  approvedAt?: string;
  isDeleted?: boolean;
  deletedAt?: string;
  editLogs?: RecordEditLogDto[];
  isLockedByClosure?: boolean;
  editableMinEndDate?: string | null;
}

interface LeaveRequestModalProps {
  request: LeaveRequestItem;
  isOpen: boolean;
  onClose: () => void;
  onApprove: (updatedRequest: LeaveRequestItem) => Promise<boolean | string | void> | boolean | string | void;
  onReject: (requestId: string, reason: string) => void;
  onRenew?: (updatedRequest: LeaveRequestItem) => Promise<boolean | string | void> | boolean | string | void;
  onSaveOnly?: (updatedRequest: LeaveRequestItem) => Promise<boolean | string | void> | boolean | string | void;
  onDelete?: (requestId: string) => Promise<boolean | void> | void;
  onValidateOverlap?: (params: {
    id: string;
    applicantId?: string;
    userName: string;
    startDate: string;
    endDate: string;
    startTime?: string | null;
    endTime?: string | null;
  }) => Promise<string | null> | string | null;
  onOpenApplicantDetail?: () => void;
  readOnly?: boolean;
  canRenew?: boolean;
  canEditOwnPending?: boolean;
  canAdminEdit?: boolean;
  canDelete?: boolean;
  dailyHours?: number;
  canMarkAsRead?: boolean;
  onMarkAsRead?: (requestId: string) => void;
  /** Zda operaci provádí oprávněná osoba v Detailu osoby */
  isManagingOtherPerson?: boolean;
  /** Konfigurace typů absencí z DB */
  absenceTypesMap?: Record<string, AbsenceTypeConfigDto>;
  /** Seznam osob pro dohledání konkrétního schvalovatele dle role (např. Office Manager, Administrátor, Vedoucí) */
  personasList?: Array<{ id: string; name: string; role: string; parentPersonId?: string; parentPersonName?: string; managerId?: string; managerName?: string }>;
  canRestore?: boolean;
  onRestore?: () => void;
}

export function LeaveRequestModal({
  request,
  isOpen,
  onClose,
  onApprove,
  onReject,
  onRenew,
  onSaveOnly,
  onValidateOverlap,
  onOpenApplicantDetail,
  readOnly = false,
  canRenew = false,
  canEditOwnPending = false,
  canAdminEdit = false,
  isManagingOtherPerson = false,
  absenceTypesMap,
  personasList = [],
  canRestore = false,
  onRestore
}: LeaveRequestModalProps) {
  const [effectiveType, setEffectiveType] = useState<LeaveRequestItem['type']>(request.type);
  const [startDate, setStartDate] = useState(request.startDate || '');
  const [endDate, setEndDate] = useState(request.endDate || request.startDate || '');
  const [note, setNote] = useState(request.note || '');
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isEditLogOpen, setIsEditLogOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const rule = resolveAbsenceTypeConfig(request.type, absenceTypesMap);
      const isApplicantSelfRenew = Boolean(
        canRenew && request.status === 'rejected' && !isManagingOtherPerson && !canAdminEdit
      );
      const standardMinDate = isApplicantSelfRenew
        ? getMinAllowedDateForAbsenceType(rule, false)
        : undefined;
      const minDate =
        standardMinDate && request.startDate && request.startDate < standardMinDate
          ? request.startDate
          : standardMinDate;

      let initStart = request.startDate || getLocalTodayIso();
      let initEnd = request.endDate || initStart;

      if (minDate && initStart < minDate) {
        initStart = minDate;
        if (initEnd < initStart) initEnd = initStart;
      }
      if (rule.durationMode === 'single_day') {
        initEnd = initStart;
      }

      setEffectiveType(request.type);
      setStartDate(initStart);
      setEndDate(initEnd);
      setNote(request.note || '');
      setIsRejecting(false);
      setRejectionReason('');
      setErrorMsg('');
      setIsEditLogOpen(false);
    }
  }, [
    isOpen,
    request.id,
    request.type,
    request.startDate,
    request.endDate,
    request.note,
    canRenew,
    canEditOwnPending,
    canAdminEdit,
    request.status,
    isManagingOtherPerson,
    absenceTypesMap
  ]);

  if (!isOpen) return null;

  const cfg = getStatusConfig(effectiveType);
  const TypeIcon = cfg.icon;
  const isApplicantOsvc = request.contract === 'OSVČ';
  const typeRule = resolveAbsenceTypeConfig(effectiveType, absenceTypesMap);
  const typeLabel =
    resolveAbsenceTypeLabel(typeRule, isApplicantOsvc) ||
    (effectiveType === request.type && request.typeName ? request.typeName : cfg.label);
  const unpaidLeaveLabel =
    getAbsenceTypeLabel('unpaid_leave', absenceTypesMap, isApplicantOsvc) || 'Neplacené volno';
  const isSingleDayMode = typeRule.durationMode === 'single_day';

  const isDeletedRecord = Boolean(request.isDeleted);
  const isClosureLocked = Boolean(request.isLockedByClosure);
  const editableMinEndDate = request.editableMinEndDate || null;
  const isPartialClosureLock = !isClosureLocked && Boolean(editableMinEndDate);

  const isManagerEditingPending = !isDeletedRecord && !isClosureLocked && !readOnly && request.status === 'pending';
  const isApplicantRenewingRejected = !isDeletedRecord && !isClosureLocked && Boolean(canRenew && request.status === 'rejected' && onRenew);
  const isApplicantEditingOwnPending = !isDeletedRecord && !isClosureLocked && Boolean(
    canEditOwnPending && request.status === 'pending' && onSaveOnly
  );
  const isAdminEditingRecord = !isDeletedRecord && !isClosureLocked && Boolean(
    canAdminEdit && (request.status === 'pending' || request.status === 'approved')
  );
  const canSaveOnlyRecord = !isDeletedRecord && !isClosureLocked && Boolean(
    (isAdminEditingRecord || isApplicantEditingOwnPending) && onSaveOnly
  );
  const canEditFields = !isDeletedRecord && !isClosureLocked && (
    isManagerEditingPending ||
    isApplicantRenewingRejected ||
    isApplicantEditingOwnPending ||
    isAdminEditingRecord
  );

  // Omezení kalendáře platí při obnově vlastní zamítnuté žádosti nebo úpravě vlastní čekající žádosti (mimo Detail osoby a mimo Admin/Officer)
  const restrictCalendar =
    (isApplicantRenewingRejected || isApplicantEditingOwnPending) &&
    !isManagingOtherPerson &&
    !canAdminEdit;
  const standardMinAllowedDate = restrictCalendar
    ? getMinAllowedDateForAbsenceType(typeRule, false)
    : undefined;
  const minAllowedDate =
    standardMinAllowedDate &&
    isApplicantRenewingRejected &&
    request.startDate &&
    request.startDate < standardMinAllowedDate
      ? request.startDate
      : standardMinAllowedDate;

  const isFixedTodaySingleDay =
    restrictCalendar &&
    isSingleDayMode &&
    (typeRule.submissionOffsetDays ?? 0) === 0 &&
    Boolean(typeRule.submissionDeadlineTime) &&
    !(isApplicantRenewingRejected && request.startDate && request.startDate < getLocalTodayIso());

  const isDeadlinePassed = restrictCalendar
    ? isAbsenceTypeDeadlinePassedToday(typeRule, false)
    : false;
  const deadlineFormatted = typeRule.submissionDeadlineTime
    ? typeRule.submissionDeadlineTime.slice(0, 5)
    : '09:00';
  const todayIso = getLocalTodayIso();

  const calculateDays = (start: string, end: string) => {
    return countWorkingDays(start, end);
  };

  const originalWorkingDays = calculateDays(
    request.startDate,
    request.endDate || request.startDate
  );

  // U schválené nebo čekající žádosti je její původní počet dnů již odečten v request.remainingDays,
  // proto celkový dostupný limit pro tuto žádost je remainingDays + originalWorkingDays (max totalDays).
  const maxAllowedDays =
    request.status === 'approved' || request.status === 'pending'
      ? Math.min(
          request.totalDays > 0 ? request.totalDays : request.remainingDays + originalWorkingDays,
          request.remainingDays + originalWorkingDays
        )
      : request.remainingDays;

  const hasVacationLimit =
    (effectiveType === 'vacation' || effectiveType === 'sick_day') && request.totalDays > 0;
  const isVacationExhausted =
    canEditFields &&
    effectiveType === 'vacation' &&
    hasVacationLimit &&
    maxAllowedDays <= 0;

  const handleStartDateChange = (newStart: string) => {
    const clampedStart = minAllowedDate && newStart < minAllowedDate ? minAllowedDate : newStart;
    setStartDate(clampedStart);
    setErrorMsg('');
    if (isSingleDayMode) {
      setEndDate(clampedStart);
      return;
    }
    let nextEnd = endDate < clampedStart ? clampedStart : endDate;
    if (hasVacationLimit && maxAllowedDays > 0) {
      const span = calculateDays(clampedStart, nextEnd);
      if (span > maxAllowedDays) {
        nextEnd = addWorkingDaysToLocalIso(clampedStart, maxAllowedDays);
      }
    }
    if (nextEnd !== endDate) {
      setEndDate(nextEnd);
    }
  };

  const handleEndDateChange = (newEnd: string) => {
    const effectiveMinEnd = editableMinEndDate || minAllowedDate;
    const clampedEnd = effectiveMinEnd && newEnd < effectiveMinEnd ? effectiveMinEnd : newEnd;
    setEndDate(clampedEnd);
    setErrorMsg('');
    if (isPartialClosureLock) {
      return;
    }
    if (isSingleDayMode) {
      setStartDate(clampedEnd);
      return;
    }
    let nextStart = clampedEnd < startDate ? clampedEnd : startDate;
    if (hasVacationLimit && maxAllowedDays > 0) {
      while (nextStart < clampedEnd && calculateDays(nextStart, clampedEnd) > maxAllowedDays) {
        nextStart = addDaysToLocalIso(nextStart, 1);
      }
    }
    if (minAllowedDate && nextStart < minAllowedDate) {
      nextStart = minAllowedDate;
    }
    if (nextStart !== startDate) {
      setStartDate(nextStart);
    }
  };

  const effectiveStartForCount = isFixedTodaySingleDay ? todayIso : startDate;
  const effectiveEndForCount = isSingleDayMode ? effectiveStartForCount : endDate;
  const currentDays = calculateDays(effectiveStartForCount, effectiveEndForCount);

  const formatCzechDateDisplay = (iso: string) => {
    const [y, m, d] = iso.split('-');
    if (!y || !m || !d) return iso;
    return `${Number(d)}. ${Number(m)}. ${y}`;
  };

  const checkOverlapInModal = async (sDate: string, eDate: string): Promise<boolean> => {
    if (!onValidateOverlap) return true;
    const err = await onValidateOverlap({
      id: request.id,
      applicantId: request.applicantId,
      userName: request.userName,
      startDate: sDate,
      endDate: eDate
    });
    if (err) {
      setErrorMsg(err);
      return false;
    }
    return true;
  };

  const handleApproveClick = async () => {
    if (currentDays <= 0) {
      setErrorMsg('Zvolený termín připadá pouze na víkend nebo státní svátek (0 pracovních dnů).');
      return;
    }
    if (hasVacationLimit && currentDays > maxAllowedDays) {
      setErrorMsg(`Nelze schválit více dnů, než je k dispozici v ročním limitu (${maxAllowedDays} d, požadováno ${currentDays} d).`);
      return;
    }
    const finalEnd = isSingleDayMode ? startDate : endDate;
    const isOk = await checkOverlapInModal(startDate, finalEnd);
    if (!isOk) return;

    const res = await onApprove({
      ...request,
      type: effectiveType,
      typeName: typeLabel,
      startDate,
      endDate: finalEnd,
      daysCount: currentDays,
      status: 'approved'
    });
    if (typeof res === 'string') {
      setErrorMsg(res);
      return;
    }
    if (res !== false) {
      onClose();
    }
  };

  const handleSaveOnlyClick = async () => {
    if (!onSaveOnly) return;
    const finalStart = isFixedTodaySingleDay ? todayIso : startDate;
    const finalEnd = isSingleDayMode ? finalStart : endDate;
    const datesChanged =
      finalStart !== request.startDate || finalEnd !== (request.endDate || request.startDate);
    const typeChanged = effectiveType !== request.type;
    const noteChanged = note.trim() !== (request.note || '').trim();

    if (!datesChanged && !typeChanged && !noteChanged) {
      onClose();
      return;
    }

    if (restrictCalendar && datesChanged) {
      if (isDeadlinePassed) {
        setErrorMsg(`Žádost typu ${typeLabel} lze v daný den upravit pouze do ${deadlineFormatted}.`);
        return;
      }
      if (minAllowedDate && finalStart < minAllowedDate) {
        setErrorMsg(
          typeRule.submissionOffsetDays > 0
            ? `Žádost typu ${typeLabel} je nutné zadat alespoň ${typeRule.submissionOffsetDays} ${
                typeRule.submissionOffsetDays === 1 ? 'den' : typeRule.submissionOffsetDays < 5 ? 'dny' : 'dní'
              } předem (nejdříve od ${formatCzechDateDisplay(minAllowedDate)}).`
            : 'Datum nemůže být v minulosti.'
        );
        return;
      }
    }
    if (currentDays <= 0) {
      setErrorMsg('Zvolený termín připadá pouze na víkend nebo státní svátek (0 pracovních dnů).');
      return;
    }
    if (hasVacationLimit && currentDays > maxAllowedDays) {
      setErrorMsg(`Nelze uložit více dnů, než je k dispozici v ročním limitu (${maxAllowedDays} d, požadováno ${currentDays} d).`);
      return;
    }
    const isOk = await checkOverlapInModal(finalStart, finalEnd);
    if (!isOk) return;

    const res = await onSaveOnly({
      ...request,
      type: effectiveType,
      typeName: typeLabel,
      startDate: finalStart,
      endDate: finalEnd,
      daysCount: currentDays,
      note: note.trim()
    });
    if (typeof res === 'string') {
      setErrorMsg(res);
      return;
    }
    if (res !== false) {
      onClose();
    }
  };

  const handleRenewClick = async () => {
    if (!onRenew) return;
    if (isDeadlinePassed) {
      setErrorMsg(`Žádost typu ${typeLabel} lze v daný den obnovit pouze do ${deadlineFormatted}.`);
      return;
    }
    const finalStart = isFixedTodaySingleDay ? todayIso : startDate;
    const finalEnd = isSingleDayMode ? finalStart : endDate;

    if (minAllowedDate && finalStart < minAllowedDate) {
      setErrorMsg(
        isApplicantRenewingRejected &&
          request.startDate &&
          minAllowedDate === request.startDate &&
          standardMinAllowedDate &&
          request.startDate < standardMinAllowedDate
          ? `U obnovované žádosti lze zadat nejnižší datum začátku ${formatCzechDateDisplay(minAllowedDate)}.`
          : typeRule.submissionOffsetDays > 0
          ? `Žádost typu ${typeLabel} je nutné zadat alespoň ${typeRule.submissionOffsetDays} ${
              typeRule.submissionOffsetDays === 1 ? 'den' : typeRule.submissionOffsetDays < 5 ? 'dny' : 'dní'
            } předem (nejdříve od ${formatCzechDateDisplay(minAllowedDate)}).`
          : 'Datum nemůže být v minulosti.'
      );
      return;
    }
    if (currentDays <= 0) {
      setErrorMsg('Zvolený termín připadá pouze na víkend nebo státní svátek (0 pracovních dnů).');
      return;
    }
    if (hasVacationLimit && currentDays > maxAllowedDays) {
      setErrorMsg(`Nemáte dostatečný zůstatek (požadováno: ${currentDays} d, k dispozici: ${maxAllowedDays} d).`);
      return;
    }
    const isOk = await checkOverlapInModal(finalStart, finalEnd);
    if (!isOk) return;

    const res = await onRenew({
      ...request,
      type: effectiveType,
      typeName: typeLabel,
      startDate: finalStart,
      endDate: finalEnd,
      daysCount: currentDays,
      note: note.trim(),
      status: 'pending',
      rejectionReason: undefined
    });
    if (typeof res === 'string') {
      setErrorMsg(res);
      return;
    }
    if (res !== false) {
      onClose();
    }
  };

  const handleConfirmReject = () => {
    if (!rejectionReason.trim()) {
      setErrorMsg('Musíte uvést důvod zamítnutí pro kolegu.');
      return;
    }
    onReject(request.id, rejectionReason.trim());
    onClose();
  };

  const editLogs = request.editLogs || [];
  const hasEditLogs = editLogs.length > 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={typeLabel}
      subtitle="Detail žádosti"
      icon={TypeIcon}
      iconBgClass={cfg.statIconBgClass}
      size="lg"
      footer={
        isDeletedRecord ? (
          <>
            {canRestore && !isClosureLocked && !editableMinEndDate && onRestore && (
              <Button
                variant="filled"
                color="emerald"
                size="normal"
                width="full"
                icon={RotateCcw}
                onClick={() => {
                  onRestore();
                  onClose();
                }}
              >
                Obnovit záznam
              </Button>
            )}
            <Button
              variant="transparent"
              color="rose"
              size="normal"
              width="full"
              onClick={onClose}
            >
              Zavřít
            </Button>
          </>
        ) : isRejecting ? (
          <>
            <Button
              variant="filled"
              color="rose"
              size="normal"
              width="full"
              icon={X}
              onClick={handleConfirmReject}
            >
              Potvrdit zamítnutí
            </Button>
            <Button
              variant="transparent"
              color="rose"
              size="normal"
              width="full"
              onClick={() => setIsRejecting(false)}
            >
              Zpět
            </Button>
          </>
        ) : !readOnly && request.status === 'pending' ? (
          <>
            <div className="flex items-center gap-3 w-full">
              <Button
                variant="outline"
                color="rose"
                size="normal"
                width="half"
                icon={X}
                onClick={() => setIsRejecting(true)}
              >
                Neschválit
              </Button>
              <Button
                variant="filled"
                color="emerald"
                size="normal"
                width="half"
                icon={Check}
                disabled={isVacationExhausted}
                onClick={handleApproveClick}
              >
                Schválit
              </Button>
            </div>
            <Button
              variant="transparent"
              color="rose"
              size="normal"
              width="full"
              onClick={onClose}
              className="mt-2 sm:mt-3"
            >
              Zavřít
            </Button>
          </>
        ) : isApplicantRenewingRejected ? (
          <>
            <Button
              variant="filled"
              color="primary"
              size="normal"
              width="full"
              icon={RotateCcw}
              disabled={isVacationExhausted || isDeadlinePassed}
              onClick={handleRenewClick}
            >
              Obnovit žádost
            </Button>
            <Button
              variant="transparent"
              color="rose"
              size="normal"
              width="full"
              onClick={onClose}
            >
              Zavřít
            </Button>
          </>
        ) : canSaveOnlyRecord ? (
          <>
            <Button
              variant="filled"
              color="primary"
              size="normal"
              width="full"
              icon={Check}
              onClick={handleSaveOnlyClick}
            >
              Uložit
            </Button>
            <Button
              variant="transparent"
              color="rose"
              size="normal"
              width="full"
              onClick={onClose}
            >
              Zavřít
            </Button>
          </>
        ) : (
          <Button
            variant="transparent"
            color="rose"
            size="normal"
            width="full"
            onClick={onClose}
          >
            Zavřít
          </Button>
        )
      }
    >
      <div className="space-y-4">
        {isDeletedRecord && (
          <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              {isClosureLocked || editableMinEndDate
                ? 'Tento záznam byl smazán a spadá do již uzavřeného měsíce – nelze jej již upravovat ani obnovit.'
                : 'Tento záznam byl smazán a nelze jej upravovat.'}
            </span>
          </div>
        )}
        {isClosureLocked && !isDeletedRecord && (
          <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Tato absence spadá do již uzavřeného měsíce a nelze ji měnit ani smazat.</span>
          </div>
        )}
        {isPartialClosureLock && !isDeletedRecord && editableMinEndDate && (
          <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              Začátek této vícedenní absence zasahuje do uzavřeného měsíce. Záznam nelze smazat ani měnit datum začátku – lze pouze zkrátit datum konce nejdříve na konec uzavřeného měsíce ({formatCzechDateDisplay(editableMinEndDate)}).
            </span>
          </div>
        )}
        {/* Applicant info card */}
        <ApplicantCard
          name={request.userName}
          role={request.userRole}
          contract={request.contract}
          contractType={request.contractType}
          contractTypeName={request.contractTypeName}
          isPermanentHomeOffice={request.isPermanentHomeOffice}
          onClick={onOpenApplicantDetail}
          rightContent={
            (effectiveType === 'vacation' || effectiveType === 'sick_day') && request.totalDays > 0 ? (
              <StatPill
                activityType={effectiveType}
                value={request.remainingDays}
                total={request.totalDays}
                unit="d"
                layout="horizontal"
              />
            ) : undefined
          }
        />

        {/* Exhausted vacation warning + switch to Unpaid Leave */}
        {isVacationExhausted && (
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-amber-900 dark:text-amber-300 font-medium">
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>Dovolená byla vyčerpána (zbývá 0 dní).</span>
            </div>
            <Button
              type="button"
              variant="filled"
              colorKey="amber"
              size="xs"
              onClick={() => {
                const unpaidRule = resolveAbsenceTypeConfig('unpaid_leave', absenceTypesMap);
                const unpaidMin = restrictCalendar
                  ? getMinAllowedDateForAbsenceType(unpaidRule, false)
                  : undefined;
                setEffectiveType('unpaid_leave');
                if (unpaidMin && startDate < unpaidMin) {
                  setStartDate(unpaidMin);
                  if (endDate < unpaidMin) setEndDate(unpaidMin);
                }
                setErrorMsg('');
              }}
              className="shrink-0"
            >
              Přepnout na {unpaidLeaveLabel}
            </Button>
          </div>
        )}

        {/* Dates editing */}
        <div className="space-y-3">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500 font-mono">
            {!canEditFields
              ? 'Termín nepřítomnosti'
              : isApplicantRenewingRejected
              ? 'Termín nepřítomnosti (úprava se uloží při obnovení žádosti)'
              : 'Termín nepřítomnosti (možnost upravit)'}
          </label>

          {isFixedTodaySingleDay ? (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 flex items-center justify-between gap-3 text-xs text-rose-900 dark:text-rose-300">
              <div className="flex items-center gap-2 font-medium">
                <Calendar className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                <span>Datum čerpání (dnes):</span>
              </div>
              <span className="font-bold font-mono">
                {formatCzechDateDisplay(todayIso)} (hlášení do {deadlineFormatted})
              </span>
            </div>
          ) : isSingleDayMode ? (
            <div>
              <span className="block text-[11px] text-slate-500 mb-1">Datum (1 den):</span>
              <input
                type="date"
                value={startDate}
                min={minAllowedDate}
                disabled={!canEditFields || isVacationExhausted}
                onChange={(e) => handleStartDateChange(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 border border-transparent hover:border-slate-300 dark:hover:border-zinc-700 focus:border-amber-500/50 focus:bg-white dark:focus:bg-zinc-900 transition-colors text-sm font-mono text-slate-900 dark:text-white focus:outline-none disabled:opacity-75 disabled:cursor-not-allowed"
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="block text-[11px] text-slate-500 mb-1">Datum od:</span>
                <input
                  type="date"
                  value={startDate}
                  min={minAllowedDate}
                  disabled={!canEditFields || isVacationExhausted || isPartialClosureLock}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 border border-transparent hover:border-slate-300 dark:hover:border-zinc-700 focus:border-amber-500/50 focus:bg-white dark:focus:bg-zinc-900 transition-colors text-sm font-mono text-slate-900 dark:text-white focus:outline-none disabled:opacity-75 disabled:cursor-not-allowed"
                />
              </div>
              <div>
                <span className="block text-[11px] text-slate-500 mb-1">Datum do:</span>
                <input
                  type="date"
                  value={endDate}
                  min={editableMinEndDate || minAllowedDate}
                  disabled={!canEditFields || isVacationExhausted}
                  onChange={(e) => handleEndDateChange(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 border border-transparent hover:border-slate-300 dark:hover:border-zinc-700 focus:border-amber-500/50 focus:bg-white dark:focus:bg-zinc-900 transition-colors text-sm font-mono text-slate-900 dark:text-white focus:outline-none disabled:opacity-75 disabled:cursor-not-allowed"
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-slate-600 dark:text-zinc-400 bg-amber-500/10 px-3 py-2 rounded-xl">
            <div className="flex items-center gap-1.5 font-medium text-amber-950 dark:text-amber-300">
              <Clock className="w-3.5 h-3.5" />
              <span>Celková délka čerpání:</span>
            </div>
            <span className="font-bold font-mono text-amber-800 dark:text-amber-300">
              {currentDays} {currentDays === 1 ? 'den' : currentDays < 5 ? 'dny' : 'dní'}
            </span>
          </div>
        </div>

        {/* Note from colleague (editable when renewing a rejected request or editing own pending request) */}
        {isApplicantRenewingRejected || isApplicantEditingOwnPending ? (
          <Textarea
            label={
              isApplicantRenewingRejected
                ? 'Poznámka k žádosti (možnost upravit pro obnovení)'
                : 'Poznámka k žádosti (možnost upravit)'
            }
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Doplňte poznámku nebo vysvětlení k žádosti..."
          />
        ) : (
          request.note && (
            <div className="space-y-1">
              <span className="block text-xs font-semibold text-slate-500 dark:text-zinc-400">
                Poznámka žadatele:
              </span>
              <p className="p-3 rounded-xl bg-slate-100/70 dark:bg-zinc-800/80 text-xs italic text-slate-700 dark:text-zinc-300">
                "{request.note}"
              </p>
            </div>
          )
        )}

        {/* Existing rejection reason when request is rejected */}
        {request.status === 'rejected' && request.rejectionReason && (
          <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-rose-700 dark:text-rose-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Důvod zamítnutí:</span>
            </div>
            <p className="text-xs text-rose-800 dark:text-rose-200 leading-relaxed">
              {request.rejectionReason}
            </p>
          </div>
        )}

        {errorMsg && !isRejecting && (
          <div className="p-2.5 rounded-xl bg-rose-500/10 text-xs text-rose-700 dark:text-rose-300 font-medium">
            {errorMsg}
          </div>
        )}

        {/* Rejection input area if in reject mode */}
        {isRejecting && (
          <div className="space-y-3 p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 animate-in fade-in">
            <div className="flex items-center gap-1.5 text-xs font-bold text-rose-700 dark:text-rose-400">
              <AlertCircle className="w-4 h-4" />
              <span>Uveďte povinný důvod zamítnutí pro kolegu:</span>
            </div>
            <Textarea
              rows={2}
              value={rejectionReason}
              onChange={(e) => {
                setRejectionReason(e.target.value);
                setErrorMsg('');
              }}
              error={errorMsg}
              placeholder="Např. Kolize s plánovaným releasem nebo kapacitní výpadek týmu..."
            />
          </div>
        )}

        {/* Vycentrovaný stav / řešitel (Čeká na schválení, Schválil/Schválila, Zamítl/Zamítla) + ikona logu úprav s rozbalovacím seznamem */}
        {(() => {
          let statusText = '';
          let StatusIcon: any = null;
          let statusColorClass = '';

          const resolveConfiguredApproverLabel = (): string => {
            const approverRole = (
              typeRule.approverRole !== undefined
                ? typeRule.approverRole || ''
                : effectiveType === 'illness' || effectiveType === 'ocr'
                ? 'office_manager'
                : 'manager'
            )
              .trim()
              .toLowerCase();

            const applicantPersona = personasList.find(
              (p) =>
                (request.applicantId && p.id.toLowerCase() === request.applicantId.toLowerCase()) ||
                p.name === request.userName
            );

            if (approverRole === 'office_manager') {
              const officers = personasList.filter((p) => p.role === 'office_manager');
              return officers.length === 1 ? officers[0].name : 'Office Manager';
            }
            if (approverRole === 'admin') {
              const admins = personasList.filter((p) => p.role === 'admin');
              return admins.length === 1 ? admins[0].name : 'Administrátor';
            }
            if (approverRole === 'team_lead') {
              return (
                request.parentPersonName ||
                applicantPersona?.parentPersonName ||
                'Vedoucí'
              );
            }
            return (
              request.managerName ||
              applicantPersona?.managerName ||
              'Nadřízený'
            );
          };

          if (request.status === 'pending') {
            const pendingApprover = resolveConfiguredApproverLabel();
            statusText = `Čeká na schválení: ${pendingApprover}`;
            StatusIcon = Clock;
            statusColorClass = 'text-amber-600 dark:text-amber-400';
          } else if (request.status === 'approved' || request.status === 'rejected') {
            const rawReactionDate = request.approvedAt || request.createdAt;
            let formattedReactionDate = '';
            if (rawReactionDate) {
              const dt = new Date(rawReactionDate);
              if (!Number.isNaN(dt.getTime())) {
                const day = dt.getDate();
                const month = dt.getMonth() + 1;
                const year = dt.getFullYear();
                const hh = String(dt.getHours()).padStart(2, '0');
                const mm = String(dt.getMinutes()).padStart(2, '0');
                formattedReactionDate =
                  hh === '00' && mm === '00'
                    ? `${day}. ${month}. ${year}`
                    : `${day}. ${month}. ${year} ${hh}:${mm}`;
              }
            }
            const resolverLabel =
              request.approvedByName ||
              (request.status === 'approved' ? 'Automaticky schváleno' : resolveConfiguredApproverLabel());
            const isFem =
              request.approvedByIsFemale ??
              (request.approvedByName ? request.approvedByName.trim().endsWith('á') : false);
            const actionPrefix =
              request.status === 'rejected'
                ? isFem
                  ? 'Zamítla'
                  : 'Zamítl'
                : isFem
                ? 'Schválila'
                : 'Schválil';

            statusText = `${
              request.approvedByName ? `${actionPrefix}: ${resolverLabel}` : resolverLabel
            }${formattedReactionDate ? ` • ${formattedReactionDate}` : ''}`;

            if (request.status === 'approved') {
              StatusIcon = Check;
              statusColorClass = 'text-emerald-600 dark:text-emerald-400';
            } else {
              StatusIcon = X;
              statusColorClass = 'text-rose-600 dark:text-rose-400';
            }
          }

          if (!statusText && !hasEditLogs) return null;

          return (
            <div className="pt-1 space-y-1.5">
              <div className="flex items-center justify-center gap-1.5 text-center text-[11px] font-medium">
                {StatusIcon && <StatusIcon className={`w-3.5 h-3.5 shrink-0 ${statusColorClass}`} />}
                {statusText && <span className={statusColorClass}>{statusText}</span>}
                {hasEditLogs && (
                  <button
                    type="button"
                    onClick={() => setIsEditLogOpen((prev) => !prev)}
                    className="inline-flex items-center gap-1 ml-1 px-1.5 py-0.5 rounded-lg not-italic font-mono text-[10px] bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors cursor-pointer"
                    title="Zobrazit historii úprav"
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>{editLogs.length}</span>
                  </button>
                )}
              </div>

              {hasEditLogs && isEditLogOpen && (
                <div className="rounded-xl bg-slate-100/80 dark:bg-zinc-800/60 px-3 py-2 space-y-0.5 text-[11px] font-mono text-slate-500 dark:text-zinc-400 text-center">
                  {editLogs.map((log) => (
                    <div key={log.id}>
                      {formatRecordEditLog(log)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </Modal>
  );
}

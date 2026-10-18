import { useState, useEffect } from 'react';
import { Check, X, Clock, AlertCircle, RotateCcw, Calendar, History } from 'lucide-react';
import { getStatusConfig } from '../config/presenceConfig';
import {
  resolveAbsenceTypeConfig,
  getMinAllowedDateForAbsenceType,
  isAbsenceTypeDeadlinePassedToday,
  getLocalTodayIso,
  addDaysToLocalIso,
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
  editLogs?: RecordEditLogDto[];
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
  canAdminEdit?: boolean;
  canDelete?: boolean;
  dailyHours?: number;
  canMarkAsRead?: boolean;
  onMarkAsRead?: (requestId: string) => void;
  /** Zda operaci provádí oprávněná osoba v Detailu osoby */
  isManagingOtherPerson?: boolean;
  /** Konfigurace typů absencí z DB */
  absenceTypesMap?: Record<string, AbsenceTypeConfigDto>;
}

function formatDateTimeCompact(iso?: string | null): string {
  if (!iso) return '';
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return '';
  const day = dt.getDate();
  const month = dt.getMonth() + 1;
  const year = dt.getFullYear();
  const hh = String(dt.getHours()).padStart(2, '0');
  const mm = String(dt.getMinutes()).padStart(2, '0');
  return `${day}. ${month}. ${year} ${hh}:${mm}`;
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
  canAdminEdit = false,
  isManagingOtherPerson = false,
  absenceTypesMap
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
      const minDate = isApplicantSelfRenew
        ? getMinAllowedDateForAbsenceType(rule, false)
        : undefined;

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
    canAdminEdit,
    request.status,
    isManagingOtherPerson,
    absenceTypesMap
  ]);

  if (!isOpen) return null;

  const cfg = getStatusConfig(effectiveType);
  const TypeIcon = cfg.icon;
  const typeRule = resolveAbsenceTypeConfig(effectiveType, absenceTypesMap);
  const typeLabel =
    typeRule.nameEmployee ||
    (effectiveType === request.type && request.typeName ? request.typeName : cfg.label);
  const unpaidLeaveLabel =
    resolveAbsenceTypeConfig('unpaid_leave', absenceTypesMap).nameEmployee || 'Neplacené volno';
  const isSingleDayMode = typeRule.durationMode === 'single_day';

  const isManagerEditingPending = !readOnly && request.status === 'pending';
  const isApplicantRenewingRejected = Boolean(canRenew && request.status === 'rejected' && onRenew);
  const isAdminEditingRecord = Boolean(
    canAdminEdit && (request.status === 'pending' || request.status === 'approved')
  );
  const canEditFields = isManagerEditingPending || isApplicantRenewingRejected || isAdminEditingRecord;

  // Omezení kalendáře platí při obnově vlastní zamítnuté žádosti (mimo Detail osoby a mimo Admin/Officer)
  const restrictCalendar = isApplicantRenewingRejected && !isManagingOtherPerson && !canAdminEdit;
  const minAllowedDate = restrictCalendar
    ? getMinAllowedDateForAbsenceType(typeRule, false)
    : undefined;

  const isFixedTodaySingleDay =
    restrictCalendar &&
    isSingleDayMode &&
    (typeRule.submissionOffsetDays ?? 0) === 0 &&
    Boolean(typeRule.submissionDeadlineTime);

  const isDeadlinePassed = restrictCalendar
    ? isAbsenceTypeDeadlinePassedToday(typeRule, false)
    : false;
  const deadlineFormatted = typeRule.submissionDeadlineTime
    ? typeRule.submissionDeadlineTime.slice(0, 5)
    : '09:00';
  const todayIso = getLocalTodayIso();

  const hasVacationLimit = effectiveType === 'vacation' && request.totalDays > 0;
  const isVacationExhausted =
    canEditFields &&
    request.status !== 'approved' &&
    hasVacationLimit &&
    request.remainingDays <= 0;

  const calculateDays = (start: string, end: string) => {
    const s = new Date(start);
    const e = new Date(end);
    const diff = Math.max(1, Math.round((e.getTime() - s.getTime()) / (1000 * 3600 * 24)) + 1);
    return diff;
  };

  const handleStartDateChange = (newStart: string) => {
    const clampedStart = minAllowedDate && newStart < minAllowedDate ? minAllowedDate : newStart;
    setStartDate(clampedStart);
    setErrorMsg('');
    if (isSingleDayMode) {
      setEndDate(clampedStart);
      return;
    }
    let nextEnd = endDate < clampedStart ? clampedStart : endDate;
    if (hasVacationLimit && request.status !== 'approved' && request.remainingDays > 0) {
      const span = calculateDays(clampedStart, nextEnd);
      if (span > request.remainingDays) {
        nextEnd = addDaysToLocalIso(clampedStart, request.remainingDays - 1);
      }
    }
    if (nextEnd !== endDate) {
      setEndDate(nextEnd);
    }
  };

  const handleEndDateChange = (newEnd: string) => {
    const clampedEnd = minAllowedDate && newEnd < minAllowedDate ? minAllowedDate : newEnd;
    setEndDate(clampedEnd);
    setErrorMsg('');
    if (isSingleDayMode) {
      setStartDate(clampedEnd);
      return;
    }
    let nextStart = clampedEnd < startDate ? clampedEnd : startDate;
    if (hasVacationLimit && request.status !== 'approved' && request.remainingDays > 0) {
      const span = calculateDays(nextStart, clampedEnd);
      if (span > request.remainingDays) {
        nextStart = addDaysToLocalIso(clampedEnd, -(request.remainingDays - 1));
      }
    }
    if (minAllowedDate && nextStart < minAllowedDate) {
      nextStart = minAllowedDate;
    }
    if (nextStart !== startDate) {
      setStartDate(nextStart);
    }
  };

  const currentDays = isSingleDayMode ? 1 : calculateDays(startDate, endDate);

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
    if (hasVacationLimit && currentDays > request.remainingDays) {
      setErrorMsg(`Nelze schválit více dnů, než je k dispozici (${request.remainingDays} d).`);
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
    const finalEnd = isSingleDayMode ? startDate : endDate;
    const isOk = await checkOverlapInModal(startDate, finalEnd);
    if (!isOk) return;

    const res = await onSaveOnly({
      ...request,
      type: effectiveType,
      typeName: typeLabel,
      startDate,
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
        typeRule.submissionOffsetDays > 0
          ? `Žádost typu ${typeLabel} je nutné zadat alespoň ${typeRule.submissionOffsetDays} ${
              typeRule.submissionOffsetDays === 1 ? 'den' : typeRule.submissionOffsetDays < 5 ? 'dny' : 'dní'
            } předem (nejdříve od ${formatCzechDateDisplay(minAllowedDate)}).`
          : 'Datum nemůže být v minulosti.'
      );
      return;
    }
    if (hasVacationLimit && currentDays > request.remainingDays) {
      setErrorMsg(`Nemáte dostatečný zůstatek dovolené (požadováno: ${currentDays}, zbývá: ${request.remainingDays}).`);
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

  const subtitleText = `${typeLabel} • ${
    effectiveType === 'sick_day'
      ? `Čerpání ${typeLabel}`
      : effectiveType === 'illness'
      ? 'Omluvená nepřítomnost (DPN)'
      : effectiveType === 'unpaid_leave'
      ? 'Neplacené volno dle dohody'
      : effectiveType === 'home_office'
      ? 'Práce z domova'
      : 'Čerpání ze zůstatku dovolené'
  }`;

  const editLogs = request.editLogs || [];
  const hasEditLogs = editLogs.length > 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Detail žádosti – ${typeLabel}`}
      subtitle={subtitleText}
      icon={TypeIcon}
      iconBgClass={cfg.statIconBgClass}
      size="lg"
      footer={
        isApplicantRenewingRejected ? (
          <div className="flex flex-col items-center gap-2.5 w-full">
            <div className="flex items-center justify-center gap-3 w-full">
              <Button
                variant="filled"
                colorKey="primary"
                size="lg"
                icon={RotateCcw}
                disabled={isVacationExhausted || isDeadlinePassed}
                onClick={handleRenewClick}
                className="min-w-[160px]"
              >
                Obnovit žádost
              </Button>
            </div>
            <div className="flex items-center justify-center gap-3 w-full pt-0.5">
              <button
                type="button"
                onClick={onClose}
                className="text-xs font-semibold text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 transition-colors cursor-pointer px-2 py-1"
              >
                Zavřít
              </button>
              {isAdminEditingRecord && onSaveOnly && (
                <>
                  <span className="text-slate-300 dark:text-zinc-700 select-none">|</span>
                  <button
                    type="button"
                    onClick={handleSaveOnlyClick}
                    className="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 transition-colors cursor-pointer px-2 py-1"
                  >
                    Pouze uložit
                  </button>
                </>
              )}
            </div>
          </div>
        ) : !readOnly && request.status === 'pending' && !isRejecting ? (
          <div className="flex flex-col items-center gap-2.5 w-full">
            <div className="grid grid-cols-2 gap-3 w-full max-w-md mx-auto">
              <Button
                variant="outline"
                colorKey="rose"
                size="lg"
                icon={X}
                onClick={() => setIsRejecting(true)}
                fullWidth
              >
                Neschválit
              </Button>
              <Button
                variant="filled"
                colorKey="emerald"
                size="lg"
                icon={Check}
                disabled={isVacationExhausted}
                onClick={handleApproveClick}
                fullWidth
              >
                Schválit
              </Button>
            </div>
            <div className="flex items-center justify-center gap-3 w-full pt-0.5">
              <button
                type="button"
                onClick={onClose}
                className="text-xs font-semibold text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 transition-colors cursor-pointer px-2 py-1"
              >
                Zavřít
              </button>
              {isAdminEditingRecord && onSaveOnly && (
                <>
                  <span className="text-slate-300 dark:text-zinc-700 select-none">|</span>
                  <button
                    type="button"
                    onClick={handleSaveOnlyClick}
                    className="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 transition-colors cursor-pointer px-2 py-1"
                  >
                    Pouze uložit
                  </button>
                </>
              )}
            </div>
          </div>
        ) : !isRejecting ? (
          <div className="flex items-center justify-center gap-3 w-full">
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-semibold text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 transition-colors cursor-pointer px-2 py-1"
            >
              Zavřít
            </button>
            {isAdminEditingRecord && onSaveOnly && (
              <>
                <span className="text-slate-300 dark:text-zinc-700 select-none">|</span>
                <button
                  type="button"
                  onClick={handleSaveOnlyClick}
                  className="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 transition-colors cursor-pointer px-2 py-1"
                >
                  Pouze uložit
                </button>
              </>
            )}
          </div>
        ) : undefined
      }
    >
      <div className="space-y-4">
        {/* Applicant info card */}
        <ApplicantCard
          name={request.userName}
          role={request.userRole}
          contract={request.contract}
          contractType={request.contractType}
          contractTypeName={request.contractTypeName}
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
                className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-75 disabled:cursor-not-allowed"
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
                  disabled={!canEditFields || isVacationExhausted}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-75 disabled:cursor-not-allowed"
                />
              </div>
              <div>
                <span className="block text-[11px] text-slate-500 mb-1">Datum do:</span>
                <input
                  type="date"
                  value={endDate}
                  min={minAllowedDate}
                  disabled={!canEditFields || isVacationExhausted}
                  onChange={(e) => handleEndDateChange(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-75 disabled:cursor-not-allowed"
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

        {/* Note from colleague (editable when renewing a rejected request) */}
        {isApplicantRenewingRejected ? (
          <Textarea
            label="Poznámka k žádosti (možnost upravit pro obnovení)"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Doplňte poznámku nebo vysvětlení k obnovené žádosti..."
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

            <div className="flex items-center justify-end gap-2 pt-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsRejecting(false)}
              >
                Zpět
              </Button>
              <Button
                variant="filled"
                colorKey="rose"
                size="sm"
                icon={X}
                onClick={handleConfirmReject}
              >
                Potvrdit zamítnutí
              </Button>
            </div>
          </div>
        )}

        {/* Vycentrovaný řešitel (Schválil/Schválila, Zamítl/Zamítla) + ikona logu úprav s rozbalovacím seznamem (1 log = 1 řádek) */}
        {(() => {
          const hasResolverInfo =
            (request.status === 'approved' || request.status === 'rejected') &&
            Boolean(request.approvedByName || request.approvedAt || request.createdAt);

          if (!hasResolverInfo && !hasEditLogs) return null;

          let resolverText = '';
          if (hasResolverInfo) {
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
              (request.status === 'approved' ? 'Automaticky schváleno' : request.managerName || 'Nadřízený');
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

            resolverText = `${
              request.approvedByName ? `${actionPrefix}: ${resolverLabel}` : resolverLabel
            }${formattedReactionDate ? ` • ${formattedReactionDate}` : ''}`;
          }

          return (
            <div className="pt-1 space-y-1.5">
              <div className="flex items-center justify-center gap-2 text-center text-[11px] italic text-slate-400 dark:text-zinc-500">
                {resolverText && <span>{resolverText}</span>}
                {hasEditLogs && (
                  <button
                    type="button"
                    onClick={() => setIsEditLogOpen((prev) => !prev)}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg not-italic font-mono text-[10px] bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors cursor-pointer"
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
                    <div key={log.id} className="truncate">
                      {formatDateTimeCompact(log.editedAt)} • {log.editedByName}
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

import { useState, useEffect } from 'react';
import { Check, X, Clock, AlertCircle, RotateCcw, Calendar } from 'lucide-react';
import { getStatusConfig } from '../config/presenceConfig';
import {
  resolveAbsenceTypeConfig,
  getMinAllowedDateForAbsenceType,
  isAbsenceTypeDeadlinePassedToday,
  getLocalTodayIso,
  addDaysToLocalIso,
  type AbsenceTypeConfigDto
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
  approvedAt?: string;
}

interface LeaveRequestModalProps {
  request: LeaveRequestItem;
  isOpen: boolean;
  onClose: () => void;
  onApprove: (updatedRequest: LeaveRequestItem) => void;
  onReject: (requestId: string, reason: string) => void;
  onRenew?: (updatedRequest: LeaveRequestItem) => void;
  readOnly?: boolean;
  canRenew?: boolean;
  dailyHours?: number;
  canMarkAsRead?: boolean;
  onMarkAsRead?: (requestId: string) => void;
  /** Zda operaci provádí oprávněná osoba v Detailu osoby */
  isManagingOtherPerson?: boolean;
  /** Konfigurace typů absencí z DB */
  absenceTypesMap?: Record<string, AbsenceTypeConfigDto>;
}

export function LeaveRequestModal({
  request,
  isOpen,
  onClose,
  onApprove,
  onReject,
  onRenew,
  readOnly = false,
  canRenew = false,
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

  useEffect(() => {
    if (isOpen) {
      const rule = resolveAbsenceTypeConfig(request.type, absenceTypesMap);
      const isApplicantSelfRenew = Boolean(canRenew && request.status === 'rejected' && !isManagingOtherPerson);
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
    }
  }, [isOpen, request.id, request.type, request.startDate, request.endDate, request.note, canRenew, request.status, isManagingOtherPerson, absenceTypesMap]);

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
  const canEditFields = isManagerEditingPending || isApplicantRenewingRejected;

  // Omezení kalendáře platí při obnově vlastní zamítnuté žádosti (mimo Detail osoby)
  const restrictCalendar = isApplicantRenewingRejected && !isManagingOtherPerson;
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
  const isVacationExhausted = canEditFields && hasVacationLimit && request.remainingDays <= 0;

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
    if (hasVacationLimit && request.remainingDays > 0) {
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
    if (hasVacationLimit && request.remainingDays > 0) {
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

  const handleApproveClick = () => {
    if (hasVacationLimit && currentDays > request.remainingDays) {
      setErrorMsg(`Nelze schválit více dnů, než je k dispozici (${request.remainingDays} d).`);
      return;
    }
    const finalEnd = isSingleDayMode ? startDate : endDate;
    onApprove({
      ...request,
      type: effectiveType,
      typeName: typeLabel,
      startDate,
      endDate: finalEnd,
      daysCount: currentDays,
      status: 'approved'
    });
    onClose();
  };

  const handleRenewClick = () => {
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
    onRenew({
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
    onClose();
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
          <div className="grid grid-cols-2 gap-3 w-full">
            <Button
              variant="ghost"
              size="lg"
              onClick={onClose}
              fullWidth
            >
              Zavřít
            </Button>
            <Button
              variant="filled"
              colorKey="primary"
              size="lg"
              icon={RotateCcw}
              disabled={isVacationExhausted || isDeadlinePassed}
              onClick={handleRenewClick}
              fullWidth
            >
              Obnovit žádost
            </Button>
          </div>
        ) : readOnly || request.status !== 'pending' ? (
          <div className="w-full">
            <Button
              variant="ghost"
              size="lg"
              onClick={onClose}
              fullWidth
            >
              Zavřít
            </Button>
          </div>
        ) : !isRejecting ? (
          <div className="grid grid-cols-2 gap-3 w-full">
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

        {/* Jméno řešitele a datum reakce malým písmem v italicu na konci před patičkou modalu */}
        {(request.status === 'approved' || request.status === 'rejected') &&
          (request.approvedByName || request.approvedAt || request.createdAt) && (() => {
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
            const actionPrefix = request.status === 'rejected' ? 'Zamítl(a)' : 'Schválil(a)';

            return (
              <div className="pt-1 text-right text-[11px] italic text-slate-400 dark:text-zinc-500">
                {request.approvedByName
                  ? `${actionPrefix}: ${resolverLabel}`
                  : resolverLabel}
                {formattedReactionDate ? ` • ${formattedReactionDate}` : ''}
              </div>
            );
          })()}
      </div>
    </Modal>
  );
}

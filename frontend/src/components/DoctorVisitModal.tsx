import { useState, useEffect } from 'react';
import { Check, X, Clock, AlertCircle, AlertTriangle, RotateCcw, History } from 'lucide-react';
import { getStatusConfig } from '../config/presenceConfig';
import {
  resolveAbsenceTypeConfig,
  resolveAbsenceTypeLabel,
  getMinAllowedDateForAbsenceType,
  getLocalTodayIso,
  formatRecordEditLog,
  type AbsenceTypeConfigDto,
  type RecordEditLogDto
} from '../api';
import { Modal, Button, Textarea } from './ui';
import { ApplicantCard } from './ApplicantCard';

export interface DoctorVisitRequestItem {
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
  type: 'doctor' | string;
  typeName?: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  facilityName?: string;
  hasConfirmationDocument: boolean;
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

export type DoctorVisitItem = DoctorVisitRequestItem;

interface DoctorVisitModalProps {
  request: DoctorVisitRequestItem;
  isOpen: boolean;
  onClose: () => void;
  onApprove: (updatedRequest: DoctorVisitRequestItem) => Promise<boolean | string | void> | boolean | string | void;
  onReject: (requestId: string, reason: string) => void;
  onRenew?: (updatedRequest: DoctorVisitRequestItem) => Promise<boolean | string | void> | boolean | string | void;
  onSaveOnly?: (updatedRequest: DoctorVisitRequestItem) => Promise<boolean | string | void> | boolean | string | void;
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
  canMarkAsRead?: boolean;
  onMarkAsRead?: (requestId: string) => void;
  canRestore?: boolean;
  onRestore?: () => void;
  /** Zda operaci provádí oprávněná osoba v Detailu osoby */
  isManagingOtherPerson?: boolean;
  /** Konfigurace typů absencí z DB */
  absenceTypesMap?: Record<string, AbsenceTypeConfigDto>;
  /** Seznam osob pro dohledání konkrétního schvalovatele dle role */
  personasList?: Array<{ id: string; name: string; role: string; parentPersonId?: string; parentPersonName?: string; managerId?: string; managerName?: string }>;
}

export function DoctorVisitModal({
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
  canRestore = false,
  onRestore,
  isManagingOtherPerson = false,
  absenceTypesMap,
  personasList = []
}: DoctorVisitModalProps) {
  const [date, setDate] = useState(request.date || (request as any).startDate || '');
  const [startTime, setStartTime] = useState(request.startTime || '08:00');
  const [endTime, setEndTime] = useState(request.endTime || '12:00');
  const [note, setNote] = useState(request.note || '');
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isEditLogOpen, setIsEditLogOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const rule = resolveAbsenceTypeConfig(request.type || 'doctor', absenceTypesMap);
      const isApplicantSelfRenew = Boolean(
        canRenew && request.status === 'rejected' && !isManagingOtherPerson && !canAdminEdit
      );
      const origDate = request.date || (request as any).startDate;
      const standardMinDate = isApplicantSelfRenew
        ? getMinAllowedDateForAbsenceType(rule, false)
        : undefined;
      const minDate =
        standardMinDate && origDate && origDate < standardMinDate
          ? origDate
          : standardMinDate;

      let initDate = origDate || getLocalTodayIso();
      if (minDate && initDate < minDate) {
        initDate = minDate;
      }

      setDate(initDate);
      setStartTime(request.startTime || '08:00');
      setEndTime(request.endTime || '12:00');
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
    request.date,
    request.startTime,
    request.endTime,
    request.note,
    canRenew,
    canEditOwnPending,
    canAdminEdit,
    request.status,
    isManagingOtherPerson,
    absenceTypesMap
  ]);

  if (!isOpen) return null;

  const cfg = getStatusConfig(request.type || 'doctor');
  const TypeIcon = cfg.icon;
  const isApplicantOsvc = request.contract === 'OSVČ';
  const typeRule = resolveAbsenceTypeConfig(request.type || 'doctor', absenceTypesMap);
  const typeLabel = resolveAbsenceTypeLabel(typeRule, isApplicantOsvc) || request.typeName || cfg.label;
  const isPaidAbsence = typeRule.isPaid !== undefined ? Boolean(typeRule.isPaid) : true;

  const isDeletedRecord = Boolean(request.isDeleted);
  const isClosureLocked = Boolean(request.isLockedByClosure);
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

  const restrictCalendar =
    (isApplicantRenewingRejected || isApplicantEditingOwnPending) &&
    !isManagingOtherPerson &&
    !canAdminEdit;
  const origRequestDate = request.date || (request as any).startDate;
  const standardMinAllowedDate = restrictCalendar
    ? getMinAllowedDateForAbsenceType(typeRule, false)
    : undefined;
  const minAllowedDate =
    standardMinAllowedDate &&
    isApplicantRenewingRejected &&
    origRequestDate &&
    origRequestDate < standardMinAllowedDate
      ? origRequestDate
      : standardMinAllowedDate;

  const parseMinutes = (timeStr: string) => {
    const [h, m] = (timeStr || '00:00').split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  const durationMin = Math.max(0, parseMinutes(endTime) - parseMinutes(startTime));

  const formatMinutesToHours = (min: number) => {
    const h = Math.floor(min / 60);
    const m = min % 60;
    if (m === 0) return `${h} h`;
    return `${h} h ${m} min`;
  };

  const formatCzechDateDisplay = (isoDate: string) => {
    const [y, m, d] = isoDate.split('-');
    return y && m && d ? `${Number(d)}. ${Number(m)}. ${y}` : isoDate;
  };

  const checkOverlapInModal = async (d: string, sTime: string, eTime: string): Promise<boolean> => {
    if (!onValidateOverlap) return true;
    const err = await onValidateOverlap({
      id: request.id,
      applicantId: request.applicantId,
      userName: request.userName,
      startDate: d,
      endDate: d,
      startTime: sTime,
      endTime: eTime
    });
    if (err) {
      setErrorMsg(err);
      return false;
    }
    return true;
  };

  const handleApproveClick = async () => {
    const isOk = await checkOverlapInModal(date, startTime, endTime);
    if (!isOk) return;

    const res = await onApprove({
      ...request,
      date,
      startTime,
      endTime,
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
    const origDate = request.date || (request as any).startDate || '';
    const origStartTime = request.startTime || '08:00';
    const origEndTime = request.endTime || '12:00';
    const origNote = (request.note || '').trim();

    if (
      date === origDate &&
      startTime === origStartTime &&
      endTime === origEndTime &&
      note.trim() === origNote
    ) {
      onClose();
      return;
    }

    if (restrictCalendar && date !== origDate && minAllowedDate && date < minAllowedDate) {
      setErrorMsg('Datum nemůže být v minulosti.');
      return;
    }
    if (parseMinutes(endTime) <= parseMinutes(startTime)) {
      setErrorMsg('Čas ukončení musí být po čase začátku.');
      return;
    }
    const isOk = await checkOverlapInModal(date, startTime, endTime);
    if (!isOk) return;

    const res = await onSaveOnly({
      ...request,
      date,
      startTime,
      endTime,
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
    if (minAllowedDate && date < minAllowedDate) {
      setErrorMsg(
        isApplicantRenewingRejected &&
          origRequestDate &&
          minAllowedDate === origRequestDate &&
          standardMinAllowedDate &&
          origRequestDate < standardMinAllowedDate
          ? `U obnovované žádosti lze zadat nejnižší datum ${formatCzechDateDisplay(minAllowedDate)}.`
          : typeRule.submissionOffsetDays > 0
          ? `Žádost typu ${typeLabel} je nutné zadat alespoň ${typeRule.submissionOffsetDays} ${
              typeRule.submissionOffsetDays === 1 ? 'den' : typeRule.submissionOffsetDays < 5 ? 'dny' : 'dní'
            } předem (nejdříve od ${formatCzechDateDisplay(minAllowedDate)}).`
          : 'Datum nemůže být v minulosti.'
      );
      return;
    }
    const isOk = await checkOverlapInModal(date, startTime, endTime);
    if (!isOk) return;

    const res = await onRenew({
      ...request,
      date,
      startTime,
      endTime,
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
      setErrorMsg('Musíte uvést důvod zamítnutí propustky.');
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
            {canRestore && !isClosureLocked && onRestore && (
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
              Potvrdit neuznání
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
                color="sky"
                size="normal"
                width="half"
                icon={Check}
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
              {isClosureLocked
                ? 'Tento záznam byl smazán a spadá do již uzavřeného měsíce – nelze jej již upravovat ani obnovit.'
                : 'Tento záznam byl smazán a nelze jej upravovat.'}
            </span>
          </div>
        )}
        {/* Colleague Info Banner */}
        <ApplicantCard
          name={request.userName}
          role={request.userRole}
          contract={request.contract}
          contractType={request.contractType}
          contractTypeName={request.contractTypeName}
          isPermanentHomeOffice={request.isPermanentHomeOffice}
          onClick={onOpenApplicantDetail}
        />

        {/* Date and Time Fields */}
        <div className="space-y-3">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500 font-mono">
            {!canEditFields
              ? 'Parametry vyšetření'
              : isApplicantRenewingRejected
              ? 'Parametry vyšetření (úprava se uloží při obnovení žádosti)'
              : 'Parametry vyšetření (možnost upravit)'}
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <span className="block text-[11px] text-slate-500 mb-1">Datum:</span>
              <input
                type="date"
                value={date}
                min={minAllowedDate}
                disabled={!canEditFields}
                onChange={(e) => {
                  const nextVal = minAllowedDate && e.target.value < minAllowedDate ? minAllowedDate : e.target.value;
                  setDate(nextVal);
                  setErrorMsg('');
                }}
                className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 border border-transparent hover:border-slate-300 dark:hover:border-zinc-700 focus:border-amber-500/50 focus:bg-white dark:focus:bg-zinc-900 transition-colors text-xs font-mono text-slate-900 dark:text-white focus:outline-none disabled:opacity-75 disabled:cursor-not-allowed"
              />
            </div>
            <div>
              <span className="block text-[11px] text-slate-500 mb-1">Čas od:</span>
              <input
                type="time"
                value={startTime}
                disabled={!canEditFields}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 border border-transparent hover:border-slate-300 dark:hover:border-zinc-700 focus:border-amber-500/50 focus:bg-white dark:focus:bg-zinc-900 transition-colors text-xs font-mono text-slate-900 dark:text-white focus:outline-none disabled:opacity-75 disabled:cursor-not-allowed"
              />
            </div>
            <div>
              <span className="block text-[11px] text-slate-500 mb-1">Čas do:</span>
              <input
                type="time"
                value={endTime}
                disabled={!canEditFields}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 border border-transparent hover:border-slate-300 dark:hover:border-zinc-700 focus:border-amber-500/50 focus:bg-white dark:focus:bg-zinc-900 transition-colors text-xs font-mono text-slate-900 dark:text-white focus:outline-none disabled:opacity-75 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          {/* Time duration banner */}
          <div className="flex items-center justify-between text-xs text-slate-600 dark:text-zinc-400 bg-sky-500/10 px-3 py-2.5 rounded-xl">
            <div className="flex items-center gap-1.5 font-medium text-sky-950 dark:text-sky-300">
              <Clock className="w-3.5 h-3.5" />
              <span>Uznaná doba ({typeLabel}):</span>
            </div>
            <span className="font-bold font-mono text-sky-800 dark:text-sky-300">
              {formatMinutesToHours(durationMin)}{' '}
              {isPaidAbsence ? 's náhradou mzdy' : 'bez náhrady mzdy'}
            </span>
          </div>
        </div>

        {/* Note from colleague */}
        {isApplicantRenewingRejected || isApplicantEditingOwnPending ? (
          <Textarea
            label={
              isApplicantRenewingRejected
                ? 'Důvod vyšetření / poznámka žadatele (možnost upravit pro obnovení)'
                : 'Důvod vyšetření / poznámka žadatele (možnost upravit)'
            }
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Doplňte poznámku k žádosti..."
          />
        ) : (
          request.note && (
            <div className="space-y-1">
              <span className="block text-xs font-semibold text-slate-500 dark:text-zinc-400">
                Důvod vyšetření / poznámka žadatele:
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

        {/* Rejection input area */}
        {isRejecting && (
          <div className="space-y-3 p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 animate-in fade-in">
            <div className="flex items-center gap-1.5 text-xs font-bold text-rose-700 dark:text-rose-400">
              <AlertCircle className="w-4 h-4" />
              <span>Důvod neuznání propustky:</span>
            </div>
            <Textarea
              rows={2}
              value={rejectionReason}
              onChange={(e) => {
                setRejectionReason(e.target.value);
                setErrorMsg('');
              }}
              error={errorMsg}
              placeholder="Např. Nedoloženo razítko lékaře v termínu..."
            />
          </div>
        )}

        {/* Vycentrovaný stav / řešitel (Čeká na schválení, Schválil/Schválila, Zamítl/Zamítla) + ikona logu úprav s rozbalovacím seznamem */}
        {(() => {
          let statusText = '';
          let StatusIcon: any = null;
          let statusColorClass = '';

          const resolveConfiguredApproverLabel = (): string => {
            const approverRole = (typeRule.approverRole || 'manager').trim().toLowerCase();
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

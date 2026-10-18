import { useState, useEffect } from 'react';
import { Check, X, Clock, FileCheck, AlertCircle, RotateCcw, History } from 'lucide-react';
import { getStatusConfig } from '../config/presenceConfig';
import {
  resolveAbsenceTypeConfig,
  getMinAllowedDateForAbsenceType,
  getLocalTodayIso,
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
  editLogs?: RecordEditLogDto[];
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
  canAdminEdit?: boolean;
  canDelete?: boolean;
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
  canAdminEdit = false,
  isManagingOtherPerson = false,
  absenceTypesMap
}: DoctorVisitModalProps) {
  const [date, setDate] = useState(request.date || (request as any).startDate || '');
  const [startTime, setStartTime] = useState(request.startTime || '08:00');
  const [endTime, setEndTime] = useState(request.endTime || '12:00');
  const [hasDoc, setHasDoc] = useState(Boolean(request.hasConfirmationDocument ?? true));
  const [note, setNote] = useState(request.note || '');
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isEditLogOpen, setIsEditLogOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const rule = resolveAbsenceTypeConfig('doctor', absenceTypesMap);
      const isApplicantSelfRenew = Boolean(
        canRenew && request.status === 'rejected' && !isManagingOtherPerson && !canAdminEdit
      );
      const minDate = isApplicantSelfRenew
        ? getMinAllowedDateForAbsenceType(rule, false)
        : undefined;

      let initDate = request.date || (request as any).startDate || getLocalTodayIso();
      if (minDate && initDate < minDate) {
        initDate = minDate;
      }

      setDate(initDate);
      setStartTime(request.startTime || '08:00');
      setEndTime(request.endTime || '12:00');
      setHasDoc(Boolean(request.hasConfirmationDocument ?? true));
      setNote(request.note || '');
      setIsRejecting(false);
      setRejectionReason('');
      setErrorMsg('');
      setIsEditLogOpen(false);
    }
  }, [
    isOpen,
    request.id,
    request.date,
    request.startTime,
    request.endTime,
    request.hasConfirmationDocument,
    request.note,
    canRenew,
    canAdminEdit,
    request.status,
    isManagingOtherPerson,
    absenceTypesMap
  ]);

  if (!isOpen) return null;

  const cfg = getStatusConfig('doctor');
  const TypeIcon = cfg.icon;
  const typeRule = resolveAbsenceTypeConfig('doctor', absenceTypesMap);
  const typeLabel = typeRule.nameEmployee || request.typeName || cfg.label;

  const isManagerEditingPending = !readOnly && request.status === 'pending';
  const isApplicantRenewingRejected = Boolean(canRenew && request.status === 'rejected' && onRenew);
  const isAdminEditingRecord = Boolean(
    canAdminEdit && (request.status === 'pending' || request.status === 'approved')
  );
  const canEditFields = isManagerEditingPending || isApplicantRenewingRejected || isAdminEditingRecord;

  const restrictCalendar = isApplicantRenewingRejected && !isManagingOtherPerson && !canAdminEdit;
  const minAllowedDate = restrictCalendar
    ? getMinAllowedDateForAbsenceType(typeRule, false)
    : undefined;

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
      hasConfirmationDocument: hasDoc,
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
    const isOk = await checkOverlapInModal(date, startTime, endTime);
    if (!isOk) return;

    const res = await onSaveOnly({
      ...request,
      date,
      startTime,
      endTime,
      hasConfirmationDocument: hasDoc,
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
      setErrorMsg('Datum nemůže být v minulosti.');
      return;
    }
    const isOk = await checkOverlapInModal(date, startTime, endTime);
    if (!isOk) return;

    const res = await onRenew({
      ...request,
      date,
      startTime,
      endTime,
      hasConfirmationDocument: hasDoc,
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
      title={`Detail žádosti – ${typeLabel}`}
      subtitle="Překážka v práci s náhradou mzdy (§ 199 ZP)"
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
                colorKey="sky"
                size="lg"
                icon={Check}
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
        {/* Colleague Info Banner */}
        <ApplicantCard
          name={request.userName}
          role={request.userRole}
          contract={request.contract}
          contractType={request.contractType}
          contractTypeName={request.contractTypeName}
          onClick={onOpenApplicantDetail}
          rightContent={
            <div className="text-right">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300">
                <FileCheck className="w-3.5 h-3.5" />
                <span>S náhradou mzdy</span>
              </span>
              <div className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1">
                Nezkracuje dovolenou
              </div>
            </div>
          }
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
                className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-75 disabled:cursor-not-allowed"
              />
            </div>
            <div>
              <span className="block text-[11px] text-slate-500 mb-1">Čas od:</span>
              <input
                type="time"
                value={startTime}
                disabled={!canEditFields}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-75 disabled:cursor-not-allowed"
              />
            </div>
            <div>
              <span className="block text-[11px] text-slate-500 mb-1">Čas do:</span>
              <input
                type="time"
                value={endTime}
                disabled={!canEditFields}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-75 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          {/* Time duration banner */}
          <div className="flex items-center justify-between text-xs text-slate-600 dark:text-zinc-400 bg-sky-500/10 px-3 py-2.5 rounded-xl">
            <div className="flex items-center gap-1.5 font-medium text-sky-950 dark:text-sky-300">
              <Clock className="w-3.5 h-3.5" />
              <span>Uznaná doba návštěvy lékaře:</span>
            </div>
            <span className="font-bold font-mono text-sky-800 dark:text-sky-300">
              {formatMinutesToHours(durationMin)} s náhradou mzdy
            </span>
          </div>

          {/* Confirmation document checkbox */}
          <label className={`flex items-start gap-2.5 p-3 rounded-xl bg-slate-100/70 dark:bg-zinc-800/80 select-none ${!canEditFields ? 'opacity-75 cursor-not-allowed' : 'cursor-pointer'}`}>
            <input
              type="checkbox"
              checked={hasDoc}
              disabled={!canEditFields}
              onChange={(e) => setHasDoc(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-none bg-slate-200 dark:bg-zinc-700 disabled:cursor-not-allowed"
            />
            <div className="text-xs">
              <span className="font-semibold text-slate-900 dark:text-white block">
                Lékařské potvrzení (propustka s razítkem) předloženo
              </span>
              <span className="text-slate-500 dark:text-zinc-400 text-[11px]">
                Kolega doložil fyzické nebo naskenované potvrzení od ošetřujícího lékaře
              </span>
            </div>
          </label>
        </div>

        {/* Note from colleague */}
        {isApplicantRenewingRejected ? (
          <Textarea
            label="Důvod vyšetření / poznámka žadatele (možnost upravit pro obnovení)"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Doplňte poznámku k obnovené žádosti..."
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
                Potvrdit neuznání
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

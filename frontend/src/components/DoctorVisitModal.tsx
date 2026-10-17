import { useState, useEffect } from 'react';
import { Check, X, Clock, FileCheck, Building2, AlertCircle, RotateCcw } from 'lucide-react';
import { getStatusConfig } from '../config/presenceConfig';
import { Modal, UserAvatar, Button, Input, Textarea } from './ui';

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
  type: 'doctor';
  typeName?: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  facilityName: string;
  hasConfirmationDocument: boolean;
  note?: string;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  isRead?: boolean;
  createdAt?: string;
}

export type DoctorVisitItem = DoctorVisitRequestItem;

interface DoctorVisitModalProps {
  request: DoctorVisitRequestItem;
  isOpen: boolean;
  onClose: () => void;
  onApprove: (updatedRequest: DoctorVisitRequestItem) => void;
  onReject: (requestId: string, reason: string) => void;
  onRenew?: (updatedRequest: DoctorVisitRequestItem) => void;
  readOnly?: boolean;
  canRenew?: boolean;
  canMarkAsRead?: boolean;
  onMarkAsRead?: (requestId: string) => void;
}

export function DoctorVisitModal({
  request,
  isOpen,
  onClose,
  onApprove,
  onReject,
  onRenew,
  readOnly = false,
  canRenew = false
}: DoctorVisitModalProps) {
  const [date, setDate] = useState(request.date || (request as any).startDate || '');
  const [startTime, setStartTime] = useState(request.startTime || '08:00');
  const [endTime, setEndTime] = useState(request.endTime || '12:00');
  const [facilityName, setFacilityName] = useState(request.facilityName || 'Zdravotnické zařízení / Ordinace');
  const [hasDoc, setHasDoc] = useState(Boolean(request.hasConfirmationDocument ?? true));
  const [note, setNote] = useState(request.note || '');
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      setDate(request.date || (request as any).startDate || '');
      setStartTime(request.startTime || '08:00');
      setEndTime(request.endTime || '12:00');
      setFacilityName(request.facilityName || 'Zdravotnické zařízení / Ordinace');
      setHasDoc(Boolean(request.hasConfirmationDocument ?? true));
      setNote(request.note || '');
      setIsRejecting(false);
      setRejectionReason('');
      setErrorMsg('');
    }
  }, [
    isOpen,
    request.id,
    request.date,
    request.startTime,
    request.endTime,
    request.facilityName,
    request.hasConfirmationDocument,
    request.note
  ]);

  if (!isOpen) return null;

  const cfg = getStatusConfig('doctor');
  const TypeIcon = cfg.icon;

  const isManagerEditingPending = !readOnly && request.status === 'pending';
  const isApplicantRenewingRejected = Boolean(canRenew && request.status === 'rejected' && onRenew);
  const canEditFields = isManagerEditingPending || isApplicantRenewingRejected;

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

  const handleApproveClick = () => {
    onApprove({
      ...request,
      date,
      startTime,
      endTime,
      facilityName,
      hasConfirmationDocument: hasDoc,
      status: 'approved'
    });
    onClose();
  };

  const handleRenewClick = () => {
    if (!onRenew) return;
    if (!facilityName.trim()) {
      setErrorMsg('Vyplňte prosím název zdravotnického zařízení nebo jméno lékaře.');
      return;
    }
    onRenew({
      ...request,
      date,
      startTime,
      endTime,
      facilityName: facilityName.trim(),
      hasConfirmationDocument: hasDoc,
      note: note.trim(),
      status: 'pending',
      rejectionReason: undefined
    });
    onClose();
  };

  const handleConfirmReject = () => {
    if (!rejectionReason.trim()) {
      setErrorMsg('Musíte uvést důvod zamítnutí propustky.');
      return;
    }
    onReject(request.id, rejectionReason.trim());
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Ověření propustky k lékaři"
      subtitle="Překážka v práci s náhradou mzdy (§ 199 ZP)"
      icon={TypeIcon}
      iconBgClass={cfg.statIconBgClass}
      size="lg"
      footer={
        isApplicantRenewingRejected ? (
          <div className="grid grid-cols-2 gap-3 w-full">
            <Button
              variant="surface"
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
              onClick={handleRenewClick}
              fullWidth
            >
              Obnovit žádost
            </Button>
          </div>
        ) : readOnly || request.status !== 'pending' ? (
          <div className="w-full">
            <Button
              variant="surface"
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
              colorKey="sky"
              size="lg"
              icon={Check}
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
        {/* Colleague Info Banner */}
        <div className="bg-slate-100/70 dark:bg-zinc-800/60 p-4 rounded-2xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <UserAvatar name={request.userName} size="md" />
            <div>
              <div className="font-bold text-sm text-slate-900 dark:text-white">
                {request.userName}
              </div>
              <div className="text-xs text-slate-500 dark:text-zinc-400">
                {request.userRole}
              </div>
            </div>
          </div>

          <div className="text-right">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300">
              <FileCheck className="w-3.5 h-3.5" />
              <span>S náhradou mzdy</span>
            </span>
            <div className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1">
              Nezkracuje dovolenou
            </div>
          </div>
        </div>

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
                disabled={!canEditFields}
                onChange={(e) => setDate(e.target.value)}
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

          {/* Health facility name */}
          <Input
            label="Zdravotnické zařízení / Lékař"
            icon={Building2}
            value={facilityName}
            disabled={!canEditFields}
            onChange={(e) => setFacilityName(e.target.value)}
            placeholder="Název polikliniky nebo jméno ošetřujícího lékaře"
          />

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
      </div>
    </Modal>
  );
}

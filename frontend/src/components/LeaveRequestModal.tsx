import { useState } from 'react';
import { Check, X, Clock, AlertCircle } from 'lucide-react';
import { getStatusConfig } from '../config/presenceConfig';
import { Modal, UserAvatar, Button, Textarea, StatPill } from './ui';

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
  type: 'vacation' | 'sick_day' | 'unpaid_leave' | 'illness' | 'home_office';
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
}

interface LeaveRequestModalProps {
  request: LeaveRequestItem;
  isOpen: boolean;
  onClose: () => void;
  onApprove: (updatedRequest: LeaveRequestItem) => void;
  onReject: (requestId: string, reason: string) => void;
  readOnly?: boolean;
  dailyHours?: number;
  canMarkAsRead?: boolean;
  onMarkAsRead?: (requestId: string) => void;
}

export function LeaveRequestModal({
  request,
  isOpen,
  onClose,
  onApprove,
  onReject,
  readOnly = false,
  dailyHours = 8,
  canMarkAsRead = false,
  onMarkAsRead
}: LeaveRequestModalProps) {
  const [startDate, setStartDate] = useState(request.startDate || '');
  const [endDate, setEndDate] = useState(request.endDate || request.startDate || '');
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const cfg = getStatusConfig(request.type);
  const TypeIcon = cfg.icon;

  const calculateDays = (start: string, end: string) => {
    const s = new Date(start);
    const e = new Date(end);
    const diff = Math.max(1, Math.round((e.getTime() - s.getTime()) / (1000 * 3600 * 24)) + 1);
    return diff;
  };

  const currentDays = calculateDays(startDate, endDate);

  const handleApproveClick = () => {
    onApprove({
      ...request,
      startDate,
      endDate,
      daysCount: currentDays,
      status: 'approved'
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

  const subtitleText = `${request.typeName || cfg.label} • ${
    request.type === 'sick_day'
      ? 'Čerpání sick day'
      : request.type === 'illness'
      ? 'Omluvená nepřítomnost (DPN)'
      : request.type === 'unpaid_leave'
      ? 'Neplacené volno dle dohody'
      : 'Čerpání ze zůstatku dovolené'
  }`;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Detail žádosti – ${cfg.label}`}
      subtitle={subtitleText}
      icon={TypeIcon}
      iconBgClass={cfg.statIconBgClass}
      size="lg"
      footer={
        readOnly || request.status !== 'pending' ? (
          canMarkAsRead && onMarkAsRead ? (
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
                colorKey="emerald"
                size="lg"
                icon={Check}
                onClick={() => {
                  onMarkAsRead(request.id);
                  onClose();
                }}
                fullWidth
              >
                Označit jako přečtené
              </Button>
            </div>
          ) : (
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
          )
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
              onClick={handleApproveClick}
              fullWidth
            >
              Schválit dovolenou
            </Button>
          </div>
        ) : undefined
      }
    >
      <div className="space-y-4">
        {/* Applicant info card */}
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

          {(request.type === 'vacation' || request.type === 'sick_day') && request.totalDays > 0 && (
            <StatPill
              activityType={request.type}
              value={request.remainingDays}
              total={request.totalDays}
              unit="d"
              layout="horizontal"
            />
          )}
        </div>

        {/* Dates editing */}
        <div className="space-y-3">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500 font-mono">
            {readOnly || request.status !== 'pending' ? 'Termín nepřítomnosti' : 'Termín dovolené (možnost upravit)'}
          </label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="block text-[11px] text-slate-500 mb-1">Datum od:</span>
              <input
                type="date"
                value={startDate}
                disabled={readOnly || request.status !== 'pending'}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-75 disabled:cursor-not-allowed"
              />
            </div>
            <div>
              <span className="block text-[11px] text-slate-500 mb-1">Datum do:</span>
              <input
                type="date"
                value={endDate}
                disabled={readOnly || request.status !== 'pending'}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-75 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-600 dark:text-zinc-400 bg-amber-500/10 px-3 py-2 rounded-xl">
            <div className="flex items-center gap-1.5 font-medium text-amber-950 dark:text-amber-300">
              <Clock className="w-3.5 h-3.5" />
              <span>Celková délka čerpání:</span>
            </div>
            <span className="font-bold font-mono text-amber-800 dark:text-amber-300">
              {currentDays} {currentDays === 1 ? 'den' : currentDays < 5 ? 'dny' : 'dní'} (cca {Math.round(currentDays * dailyHours * 10) / 10}h)
            </span>
          </div>
        </div>

        {/* Note from colleague */}
        {request.note && (
          <div className="space-y-1">
            <span className="block text-xs font-semibold text-slate-500 dark:text-zinc-400">
              Poznámka žadatele:
            </span>
            <p className="p-3 rounded-xl bg-slate-100/70 dark:bg-zinc-800/80 text-xs italic text-slate-700 dark:text-zinc-300">
              "{request.note}"
            </p>
          </div>
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
      </div>
    </Modal>
  );
}

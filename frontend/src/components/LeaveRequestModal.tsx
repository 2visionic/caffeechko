import { useState } from 'react';
import { Calendar, Check, X, Clock, AlertCircle } from 'lucide-react';

export interface LeaveRequestItem {
  id: string;
  applicantId?: string;
  userName: string;
  userRole: string;
  managerId?: string;
  managerName?: string;
  department?: string;
  type: 'vacation' | 'sick_day';
  typeName: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  daysCount: number;
  remainingDays: number;
  totalDays: number;
  note: string;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
}

interface LeaveRequestModalProps {
  request: LeaveRequestItem;
  isOpen: boolean;
  onClose: () => void;
  onApprove: (updatedRequest: LeaveRequestItem) => void;
  onReject: (requestId: string, reason: string) => void;
}

export function LeaveRequestModal({
  request,
  isOpen,
  onClose,
  onApprove,
  onReject
}: LeaveRequestModalProps) {
  const [startDate, setStartDate] = useState(request.startDate || '');
  const [endDate, setEndDate] = useState(request.endDate || request.startDate || '');
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  // Simple day count calculation
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-zinc-900 w-full max-w-lg rounded-3xl p-6 sm:p-7 shadow-2xl animate-in zoom-in-95 duration-200 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800/80 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-700 dark:text-amber-400 flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Detail žádosti o dovolenou
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                {request.typeName} • Čerpání ze zůstatku dovolené
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Applicant info & vacation balance */}
        <div className="bg-slate-100/70 dark:bg-zinc-800/60 p-4 rounded-2xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-zinc-700 flex items-center justify-center font-bold text-sm text-slate-700 dark:text-zinc-200">
              {(request.userName || '?').split(' ').filter(Boolean).map((n) => n[0]).join('')}
            </div>
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
            <div className="text-[11px] text-slate-400 dark:text-zinc-500">Zůstatek dovolené</div>
            <div className="text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400">
              {request.remainingDays} / {request.totalDays} dní
            </div>
          </div>
        </div>

        {/* Dates editing */}
        <div className="space-y-3">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500 font-mono">
            Termín dovolené (možnost upravit)
          </label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="block text-[11px] text-slate-500 mb-1">Datum od:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
            <div>
              <span className="block text-[11px] text-slate-500 mb-1">Datum do:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-600 dark:text-zinc-400 bg-amber-500/10 px-3 py-2 rounded-xl">
            <div className="flex items-center gap-1.5 font-medium text-amber-950 dark:text-amber-300">
              <Clock className="w-3.5 h-3.5" />
              <span>Celková délka čerpání:</span>
            </div>
            <span className="font-bold font-mono text-amber-800 dark:text-amber-300">
              {currentDays} {currentDays === 1 ? 'den' : currentDays < 5 ? 'dny' : 'dní'} (cca {currentDays * 8}h)
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

        {/* Rejection input area if in reject mode */}
        {isRejecting ? (
          <div className="space-y-2 p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/30 animate-in fade-in">
            <div className="flex items-center gap-1.5 text-xs font-bold text-rose-700 dark:text-rose-400">
              <AlertCircle className="w-4 h-4" />
              <span>Uveďte povinný důvod zamítnutí pro kolegu:</span>
            </div>
            <textarea
              rows={2}
              value={rejectionReason}
              onChange={(e) => {
                setRejectionReason(e.target.value);
                setErrorMsg('');
              }}
              placeholder="Např. Kolize s plánovaným releasem verze 2.0 nebo kapacitní výpadek týmu..."
              className="w-full p-2.5 rounded-xl bg-white dark:bg-zinc-900 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500 resize-none"
            />
            {errorMsg && (
              <span className="text-[11px] text-rose-600 dark:text-rose-400 font-medium block">
                {errorMsg}
              </span>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                onClick={() => setIsRejecting(false)}
                className="px-3 py-1.5 rounded-xl text-xs font-medium text-slate-600 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-800"
              >
                Zpět
              </button>
              <button
                onClick={handleConfirmReject}
                className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-sm flex items-center gap-1.5"
              >
                <X className="w-3.5 h-3.5" />
                <span>Potvrdit zamítnutí</span>
              </button>
            </div>
          </div>
        ) : (
          /* Normal Action Buttons: Schválit / Zamítnout / Zrušit */
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              onClick={() => setIsRejecting(true)}
              className="h-12 rounded-2xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 font-semibold text-sm flex items-center justify-center gap-2 transition-all"
            >
              <X className="w-4 h-4" />
              <span>Neschválit</span>
            </button>

            <button
              onClick={handleApproveClick}
              className="h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-md shadow-emerald-600/25 transition-all"
            >
              <Check className="w-4 h-4" />
              <span>Schválit dovolenou</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

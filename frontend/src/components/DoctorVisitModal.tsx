import { useState } from 'react';
import { Stethoscope, Check, X, Clock, AlertCircle, FileCheck, Building2 } from 'lucide-react';

export interface DoctorVisitItem {
  id: string;
  applicantId?: string;
  userName: string;
  userRole: string;
  managerId?: string;
  managerName?: string;
  department?: string;
  type: 'doctor';
  typeName: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm e.g. "08:30"
  endTime: string;   // HH:mm e.g. "11:30"
  facilityName: string;
  hasConfirmationDocument: boolean;
  note: string;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
}

interface DoctorVisitModalProps {
  request: DoctorVisitItem;
  isOpen: boolean;
  onClose: () => void;
  onApprove: (updatedRequest: DoctorVisitItem) => void;
  onReject: (requestId: string, reason: string) => void;
}

function parseMinutes(timeStr?: string): number {
  if (!timeStr || typeof timeStr !== 'string') return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function formatMinutesToHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

export function DoctorVisitModal({
  request,
  isOpen,
  onClose,
  onApprove,
  onReject
}: DoctorVisitModalProps) {
  const [date, setDate] = useState(request.date || (request as any).startDate || '');
  const [startTime, setStartTime] = useState(request.startTime || '08:00');
  const [endTime, setEndTime] = useState(request.endTime || '12:00');
  const [facilityName, setFacilityName] = useState(request.facilityName || 'Zdravotnické zařízení / Ordinace');
  const [hasDoc, setHasDoc] = useState(Boolean(request.hasConfirmationDocument ?? true));
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const durationMin = Math.max(0, parseMinutes(endTime) - parseMinutes(startTime));

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

  const handleConfirmReject = () => {
    if (!rejectionReason.trim()) {
      setErrorMsg('Musíte uvést důvod zamítnutí propustky.');
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
            <div className="w-10 h-10 rounded-2xl bg-sky-500/15 text-sky-600 dark:text-sky-400 flex items-center justify-center">
              <Stethoscope className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Ověření propustky k lékaři
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Překážka v práci s náhradou mzdy (§ 199 ZP)
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

        {/* Colleague Info Banner (NO vacation balance!) */}
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
            Parametry vyšetření (možnost upravit)
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <span className="block text-[11px] text-slate-500 mb-1">Datum:</span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
            <div>
              <span className="block text-[11px] text-slate-500 mb-1">Čas od:</span>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
            <div>
              <span className="block text-[11px] text-slate-500 mb-1">Čas do:</span>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>

          {/* Health facility name */}
          <div>
            <span className="block text-[11px] text-slate-500 mb-1">Zdravotnické zařízení / Lékař:</span>
            <div className="relative">
              <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={facilityName}
                onChange={(e) => setFacilityName(e.target.value)}
                placeholder="Název polikliniky nebo jméno ošetřujícího lékaře"
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
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
          <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-100/70 dark:bg-zinc-800/80 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={hasDoc}
              onChange={(e) => setHasDoc(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-none bg-slate-200 dark:bg-zinc-700"
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
        {request.note && (
          <div className="space-y-1">
            <span className="block text-xs font-semibold text-slate-500 dark:text-zinc-400">
              Důvod vyšetření / poznámka žadatele:
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
              <span>Důvod neuznání propustky:</span>
            </div>
            <textarea
              rows={2}
              value={rejectionReason}
              onChange={(e) => {
                setRejectionReason(e.target.value);
                setErrorMsg('');
              }}
              placeholder="Např. Nedoloženo razítko lékaře v termínu nebo soukromá aktivita bez nároku na náhradu mzdy..."
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
                <span>Potvrdit neuznání</span>
              </button>
            </div>
          </div>
        ) : (
          /* Normal Action Buttons: Potvrdit propustku / Neuznat */
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
              className="h-12 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-md shadow-sky-600/25 transition-all"
            >
              <Check className="w-4 h-4" />
              <span>Schválit</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

import { useState } from 'react';
import { Calendar, Stethoscope, Home, AlertOctagon, Check, X, Clock, Building2, Sparkles } from 'lucide-react';

export type RequestType = 'vacation' | 'doctor' | 'sick_day' | 'home_office';

export interface NewRequestData {
  type: RequestType;
  startDate: string;
  endDate: string;
  startTime?: string;
  endTime?: string;
  facilityName?: string;
  hasConfirmationDocument?: boolean;
  note: string;
}

interface NewRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: NewRequestData) => void;
  applicantName: string;
  managerName?: string;
  vacationRemaining: number;
  vacationTotal: number;
  sickDaysRemaining: number;
  sickDaysTotal: number;
}

function calculateDays(start: string, end: string) {
  if (!start || !end) return 1;
  const s = new Date(start);
  const e = new Date(end);
  return Math.max(1, Math.round((e.getTime() - s.getTime()) / (1000 * 3600 * 24)) + 1);
}

export function NewRequestModal({
  isOpen,
  onClose,
  onSubmit,
  applicantName,
  vacationRemaining,
  vacationTotal,
  sickDaysRemaining,
  sickDaysTotal
}: NewRequestModalProps) {
  const [requestType, setRequestType] = useState<RequestType>('vacation');
  const [startDate, setStartDate] = useState('2026-10-26');
  const [endDate, setEndDate] = useState('2026-10-30');
  const [startTime, setStartTime] = useState('08:30');
  const [endTime, setEndTime] = useState('11:30');
  const [facilityName, setFacilityName] = useState('');
  const [hasDoc, setHasDoc] = useState(false);
  const [note, setNote] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const daysCount = requestType === 'vacation' ? calculateDays(startDate, endDate) : 1;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (requestType === 'vacation' && daysCount > vacationRemaining) {
      setErrorMsg(`Požadovaný počet dní (${daysCount}) přesahuje váš zbývající zůstatek dovolené (${vacationRemaining} dní).`);
      return;
    }
    if (requestType === 'doctor' && !facilityName.trim()) {
      setErrorMsg('Uveďte prosím název zdravotnického zařízení nebo jméno lékaře.');
      return;
    }

    onSubmit({
      type: requestType,
      startDate,
      endDate: requestType === 'vacation' ? endDate : startDate,
      startTime: requestType === 'doctor' ? startTime : undefined,
      endTime: requestType === 'doctor' ? endTime : undefined,
      facilityName: requestType === 'doctor' ? facilityName.trim() : undefined,
      hasConfirmationDocument: requestType === 'doctor' ? hasDoc : undefined,
      note: note.trim()
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-zinc-900 w-full max-w-lg rounded-3xl p-6 sm:p-7 shadow-2xl animate-in zoom-in-95 duration-200 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200/40 dark:border-zinc-700/60 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Nová žádost / Nahlášení absence
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Žadatel: <span className="font-semibold text-slate-800 dark:text-zinc-200">{applicantName}</span>
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


        {/* Request Type Selector */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button
            type="button"
            onClick={() => { setRequestType('vacation'); setErrorMsg(''); }}
            className={`p-3 rounded-2xl text-center transition-all flex flex-col items-center gap-1.5 ${
              requestType === 'vacation'
                ? 'bg-amber-500/20 text-amber-900 dark:text-amber-300 font-bold ring-2 ring-amber-500/30 shadow-sm'
                : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200/70 dark:hover:bg-zinc-700/60'
            }`}
          >
            <Calendar className="w-4 h-4 text-amber-500" />
            <span className="text-xs">Dovolená</span>
          </button>

          <button
            type="button"
            onClick={() => { setRequestType('doctor'); setErrorMsg(''); }}
            className={`p-3 rounded-2xl text-center transition-all flex flex-col items-center gap-1.5 ${
              requestType === 'doctor'
                ? 'bg-sky-500/20 text-sky-900 dark:text-sky-300 font-bold ring-2 ring-sky-500/30 shadow-sm'
                : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200/70 dark:hover:bg-zinc-700/60'
            }`}
          >
            <Stethoscope className="w-4 h-4 text-sky-500" />
            <span className="text-xs">Lékař</span>
          </button>

          <button
            type="button"
            onClick={() => { setRequestType('sick_day'); setErrorMsg(''); }}
            className={`p-3 rounded-2xl text-center transition-all flex flex-col items-center gap-1.5 ${
              requestType === 'sick_day'
                ? 'bg-rose-500/20 text-rose-900 dark:text-rose-300 font-bold ring-2 ring-rose-500/30 shadow-sm'
                : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200/70 dark:hover:bg-zinc-700/60'
            }`}
          >
            <AlertOctagon className="w-4 h-4 text-rose-500" />
            <span className="text-xs">Sick Day</span>
          </button>

          <button
            type="button"
            onClick={() => { setRequestType('home_office'); setErrorMsg(''); }}
            className={`p-3 rounded-2xl text-center transition-all flex flex-col items-center gap-1.5 ${
              requestType === 'home_office'
                ? 'bg-emerald-500/20 text-emerald-900 dark:text-emerald-300 font-bold ring-2 ring-emerald-500/30 shadow-sm'
                : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200/70 dark:hover:bg-zinc-700/60'
            }`}
          >
            <Home className="w-4 h-4 text-emerald-500" />
            <span className="text-xs">Home Office</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 1. DOVOLENÁ SPECIFIC FORM */}
          {requestType === 'vacation' && (
            <div className="space-y-3 animate-in fade-in">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="block text-[11px] text-slate-500 dark:text-zinc-400 mb-1">Datum od:</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    required
                  />
                </div>
                <div>
                  <span className="block text-[11px] text-slate-500 dark:text-zinc-400 mb-1">Datum do:</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    required
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-100/80 dark:bg-zinc-800/80 flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-zinc-400">Zbývající zůstatek dovolené:</span>
                <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400">
                  {vacationRemaining} / {vacationTotal} dní
                </span>
              </div>

              <div className="p-3 rounded-xl bg-amber-500/10 flex items-center justify-between text-xs text-amber-900 dark:text-amber-300">
                <span className="font-medium">Délka plánovaného čerpání:</span>
                <span className="font-bold font-mono">
                  {daysCount} {daysCount === 1 ? 'den' : daysCount < 5 ? 'dny' : 'dní'} (zůstatek pak: {vacationRemaining - daysCount} dní)
                </span>
              </div>
            </div>
          )}

          {/* 2. LÉKAŘ / VYŠETŘENÍ SPECIFIC FORM */}
          {requestType === 'doctor' && (
            <div className="space-y-3 animate-in fade-in">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <span className="block text-[11px] text-slate-500 dark:text-zinc-400 mb-1">Datum:</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    required
                  />
                </div>
                <div>
                  <span className="block text-[11px] text-slate-500 dark:text-zinc-400 mb-1">Čas od:</span>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    required
                  />
                </div>
                <div>
                  <span className="block text-[11px] text-slate-500 dark:text-zinc-400 mb-1">Čas do (odhad):</span>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    required
                  />
                </div>
              </div>

              <div>
                <span className="block text-[11px] text-slate-500 dark:text-zinc-400 mb-1">
                  Zdravotnické zařízení / Ordinace:
                </span>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={facilityName}
                    onChange={(e) => setFacilityName(e.target.value)}
                    placeholder="Např. Stomatologie Palmovka, MUDr. Novák"
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    required
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-sky-500/10 text-xs text-sky-900 dark:text-sky-300">
                <div className="flex items-center gap-1.5 font-semibold">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Zákonná překážka v práci s náhradou mzdy (§ 199 ZP)</span>
                </div>
                <div className="text-[11px] text-sky-700/80 dark:text-sky-400 mt-0.5">
                  Lékařská návštěva nekrátí fond dovolené. Po návratu doložíte razítko propustky.
                </div>
              </div>

              <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-100/70 dark:bg-zinc-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasDoc}
                  onChange={(e) => setHasDoc(e.target.checked)}
                  className="rounded text-sky-600 focus:ring-sky-500 w-4 h-4"
                />
                <span className="text-xs text-slate-700 dark:text-zinc-300 font-medium">
                  Mám již elektronické nebo papírové potvrzení s razítkem k doložení
                </span>
              </label>
            </div>
          )}

          {/* 3. SICK DAY SPECIFIC FORM */}
          {requestType === 'sick_day' && (
            <div className="space-y-3 animate-in fade-in">
              <div>
                <span className="block text-[11px] text-slate-500 dark:text-zinc-400 mb-1">Datum:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                  required
                />
              </div>

              <div className="p-3 rounded-xl bg-slate-100/80 dark:bg-zinc-800/80 flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-zinc-400">Váš zůstatek Sick Days:</span>
                <span className="font-bold font-mono text-rose-600 dark:text-rose-400">
                  {sickDaysRemaining} / {sickDaysTotal} dní v roce
                </span>
              </div>
            </div>
          )}

          {/* 4. HOME OFFICE SPECIFIC FORM */}
          {requestType === 'home_office' && (
            <div className="space-y-3 animate-in fade-in">
              <div>
                <span className="block text-[11px] text-slate-500 dark:text-zinc-400 mb-1">Datum práce z domova:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>
            </div>
          )}

          {/* Common Note */}
          <div>
            <span className="block text-[11px] text-slate-500 dark:text-zinc-400 mb-1">
              Poznámka k žádosti:
            </span>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Doplňující informace, předání úkolů během nepřítomnosti..."
              className="w-full p-2.5 rounded-xl bg-slate-100 dark:bg-zinc-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
            />
          </div>

          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-rose-500/10 text-xs text-rose-700 dark:text-rose-300 font-medium">
              {errorMsg}
            </div>
          )}

          {/* Actions */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="py-2.5 rounded-xl text-xs font-medium text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800"
            >
              Zrušit
            </button>

            <button
              type="submit"
              className="py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-md shadow-amber-600/20 flex items-center justify-center gap-1.5 transition-all"
            >
              <Check className="w-4 h-4" />
              <span>Odeslat žádost nadřízenému</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

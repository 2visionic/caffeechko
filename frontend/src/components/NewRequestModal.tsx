import { useState, useEffect } from 'react';
import {
  Check,
  Clock,
  Building2,
  Bandage
} from 'lucide-react';
import {
  getStatusConfig,
  type AbsenceType,
  type StatusType
} from '../config/presenceConfig';
import { Modal, Button, Input, Textarea } from './ui';

export type RequestTypeOption = AbsenceType | 'home_office';

export interface NewRequestData {
  type: RequestTypeOption;
  startDate: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  facilityName?: string;
  hasConfirmationDocument?: boolean;
  note?: string;
}

interface NewRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: NewRequestData) => void;
  applicantName: string;
  managerName?: string;
  vacationRemaining?: number;
  vacationTotal?: number;
  sickDaysRemaining?: number;
  sickDaysTotal?: number;
  initialType?: RequestTypeOption;
}

const REQUEST_TYPES: RequestTypeOption[] = [
  'vacation',
  'doctor',
  'sick_day',
  'home_office',
  'illness',
  'unpaid_leave'
];

export function NewRequestModal({
  isOpen,
  onClose,
  onSubmit,
  applicantName,
  vacationRemaining = 18,
  vacationTotal = 25,
  sickDaysRemaining = 3,
  sickDaysTotal = 5,
  initialType = 'vacation'
}: NewRequestModalProps) {
  const [requestType, setRequestType] = useState<RequestTypeOption>(initialType);
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('12:00');
  const [facilityName, setFacilityName] = useState('');
  const [hasDoc, setHasDoc] = useState(false);
  const [note, setNote] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen && initialType) {
      setRequestType(initialType);
      setErrorMsg('');
    }
  }, [isOpen, initialType]);

  if (!isOpen) return null;

  const currentCfg = getStatusConfig(requestType as StatusType);
  const CurrentIcon = currentCfg.icon;

  const calculateDays = (start: string, end: string) => {
    const s = new Date(start);
    const e = new Date(end);
    const diff = Math.max(1, Math.round((e.getTime() - s.getTime()) / (1000 * 3600 * 24)) + 1);
    return diff;
  };

  const daysCount = requestType === 'vacation' || requestType === 'illness' || requestType === 'unpaid_leave'
    ? calculateDays(startDate, endDate)
    : 1;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (requestType === 'vacation' || requestType === 'illness' || requestType === 'unpaid_leave') {
      if (new Date(endDate) < new Date(startDate)) {
        setErrorMsg('Datum ukončení nemůže předcházet datu začátku.');
        return;
      }
    }

    if (requestType === 'vacation' && daysCount > vacationRemaining) {
      setErrorMsg(`Nemáte dostatečný zůstatek dovolené (požadováno: ${daysCount}, zbývá: ${vacationRemaining}).`);
      return;
    }

    if (requestType === 'sick_day' && sickDaysRemaining <= 0) {
      setErrorMsg('Nemáte dostatečný zůstatek Sick Days.');
      return;
    }

    if (requestType === 'doctor') {
      if (!facilityName.trim()) {
        setErrorMsg('Vyplňte prosím název zdravotnického zařízení nebo jméno lékaře.');
        return;
      }
    }

    onSubmit({
      type: requestType,
      startDate,
      endDate: (requestType === 'vacation' || requestType === 'illness' || requestType === 'unpaid_leave') ? endDate : startDate,
      startTime: requestType === 'doctor' ? startTime : undefined,
      endTime: requestType === 'doctor' ? endTime : undefined,
      facilityName: requestType === 'doctor' ? facilityName.trim() : undefined,
      hasConfirmationDocument: requestType === 'doctor' ? hasDoc : undefined,
      note: note.trim()
    });

    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Nová žádost – ${currentCfg.label}`}
      subtitle={`Žadatel: ${applicantName}`}
      icon={CurrentIcon}
      iconBgClass={currentCfg.statIconBgClass}
      size="lg"
      footer={
        <div className="grid grid-cols-2 gap-3 w-full">
          <Button variant="ghost" size="md" onClick={onClose} fullWidth>
            Zrušit
          </Button>
          <Button
            variant="filled"
            colorKey="primary"
            size="md"
            icon={Check}
            onClick={handleSubmit}
            fullWidth
          >
            Odeslat žádost
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Request Type Selector (100% unified from presenceConfig) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {REQUEST_TYPES.map((type) => {
            const cfg = getStatusConfig(type);
            const TypeIcon = cfg.icon;
            const isSelected = requestType === type;
            return (
              <button
                key={type}
                type="button"
                onClick={() => {
                  setRequestType(type);
                  setErrorMsg('');
                }}
                className={`p-2.5 rounded-2xl text-center transition-all flex flex-col items-center gap-1.5 cursor-pointer ${
                  isSelected
                    ? cfg.buttonActiveClass
                    : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200/70 dark:hover:bg-zinc-700/60'
                }`}
              >
                <TypeIcon className={`w-4 h-4 ${isSelected ? cfg.iconColorClass : 'text-slate-500 dark:text-zinc-400'}`} />
                <span className="text-xs">{cfg.shortLabel}</span>
              </button>
            );
          })}
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

              <Input
                label="Zdravotnické zařízení / Ordinace"
                icon={Building2}
                value={facilityName}
                onChange={(e) => setFacilityName(e.target.value)}
                placeholder="Např. Stomatologie Palmovka, MUDr. Novák"
                required
              />

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

          {/* 5. NEMOC SPECIFIC FORM */}
          {requestType === 'illness' && (
            <div className="space-y-3 animate-in fade-in">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="block text-[11px] text-slate-500 dark:text-zinc-400 mb-1">Datum od:</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                    required
                  />
                </div>
                <div>
                  <span className="block text-[11px] text-slate-500 dark:text-zinc-400 mb-1">Předpokládané datum do:</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                    required
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-red-500/10 text-xs text-red-900 dark:text-red-300">
                <div className="flex items-center gap-1.5 font-semibold">
                  <Bandage className="w-3.5 h-3.5" />
                  <span>Dočasná pracovní neschopnost (nemocenská / eNeschopenka)</span>
                </div>
                <div className="text-[11px] text-red-700/80 dark:text-red-400 mt-0.5">
                  Absence z důvodu nemoci nečerpá zůstatek dovolené ani sick days. Číslo rozhodnutí o DPN můžete uvést do poznámky níže.
                </div>
              </div>
            </div>
          )}

          {/* 6. NEPLACENÉ VOLNO SPECIFIC FORM */}
          {requestType === 'unpaid_leave' && (
            <div className="space-y-3 animate-in fade-in">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="block text-[11px] text-slate-500 dark:text-zinc-400 mb-1">Datum od:</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    required
                  />
                </div>
                <div>
                  <span className="block text-[11px] text-slate-500 dark:text-zinc-400 mb-1">Datum do:</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    required
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-purple-500/10 flex items-center justify-between text-xs text-purple-900 dark:text-purple-300">
                <span className="font-medium">Délka neplaceného volna:</span>
                <span className="font-bold font-mono">
                  {daysCount} {daysCount === 1 ? 'den' : daysCount < 5 ? 'dny' : 'dní'}
                </span>
              </div>
            </div>
          )}

          {/* Common Note */}
          <Textarea
            label="Poznámka k žádosti"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Doplňující informace, předání úkolů během nepřítomnosti..."
          />

          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-rose-500/10 text-xs text-rose-700 dark:text-rose-300 font-medium">
              {errorMsg}
            </div>
          )}
        </form>
      </div>
    </Modal>
  );
}

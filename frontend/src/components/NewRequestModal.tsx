import { useState, useEffect } from 'react';
import {
  Check,
  Clock,
  Building2,
  Bandage,
  FileCheck,
  AlertCircle,
  Calendar
} from 'lucide-react';
import {
  getStatusConfig,
  type AbsenceType,
  type StatusType
} from '../config/presenceConfig';
import {
  resolveAbsenceTypeConfig,
  getMinAllowedDateForAbsenceType,
  isAbsenceTypeDeadlinePassedToday,
  getLocalTodayIso,
  addDaysToLocalIso,
  type AbsenceTypeConfigDto
} from '../api';
import { Modal, Button, Input, Textarea, StatPill, UserAvatar } from './ui';

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
  applicantRole?: string;
  managerName?: string;
  vacationRemaining?: number;
  vacationTotal?: number;
  sickDaysRemaining?: number;
  sickDaysTotal?: number;
  initialType?: RequestTypeOption;
  /** Zda žádost zadává oprávněná osoba (Vedoucí/Manažer/Officer/Admin) za jinou osobu v Detailu osoby */
  isManagingOtherPerson?: boolean;
  /** Konfigurace typů absencí z DB */
  absenceTypesMap?: Record<string, AbsenceTypeConfigDto>;
}

export function NewRequestModal({
  isOpen,
  onClose,
  onSubmit,
  applicantName,
  applicantRole = 'Kolega',
  vacationRemaining,
  vacationTotal,
  sickDaysRemaining,
  sickDaysTotal,
  initialType = 'vacation',
  isManagingOtherPerson = false,
  absenceTypesMap
}: NewRequestModalProps) {
  const todayIso = getLocalTodayIso();
  const [requestType, setRequestType] = useState<RequestTypeOption>(initialType);
  const [startDate, setStartDate] = useState(todayIso);
  const [endDate, setEndDate] = useState(todayIso);
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('12:00');
  const [facilityName, setFacilityName] = useState('');
  const [hasDoc, setHasDoc] = useState(false);
  const [note, setNote] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen && initialType) {
      const rule = resolveAbsenceTypeConfig(initialType, absenceTypesMap);
      const minDate = getMinAllowedDateForAbsenceType(rule, isManagingOtherPerson);
      const defaultDate = minDate || getLocalTodayIso();
      setRequestType(initialType);
      setStartDate(defaultDate);
      setEndDate(defaultDate);
      setErrorMsg('');
    }
  }, [isOpen, initialType, isManagingOtherPerson, absenceTypesMap]);

  if (!isOpen) return null;

  const currentCfg = getStatusConfig(requestType as StatusType);
  const CurrentIcon = currentCfg.icon;
  const typeRule = resolveAbsenceTypeConfig(requestType, absenceTypesMap);
  const minAllowedDate = getMinAllowedDateForAbsenceType(typeRule, isManagingOtherPerson);
  const isMultiDayMode = typeRule.durationMode === 'days' || typeRule.durationMode === 'both';
  const isSingleDayMode = typeRule.durationMode === 'single_day';
  const isHoursMode = typeRule.durationMode === 'hours';

  // Pokud má jednodenní absence (sick_day) SubmissionOffsetDays = 0 a SubmissionDeadlineTime, pak mimo Detail osoby nemá výběr data a zapisuje se dnešní datum
  const isFixedTodaySingleDay =
    !isManagingOtherPerson &&
    isSingleDayMode &&
    (typeRule.submissionOffsetDays ?? 0) === 0 &&
    Boolean(typeRule.submissionDeadlineTime);

  const isDeadlinePassed = isAbsenceTypeDeadlinePassedToday(typeRule, isManagingOtherPerson);
  const deadlineFormatted = typeRule.submissionDeadlineTime
    ? typeRule.submissionDeadlineTime.slice(0, 5)
    : '09:00';

  const hasVacationIndicator =
    requestType === 'vacation' &&
    vacationRemaining !== undefined &&
    vacationTotal !== undefined &&
    vacationTotal > 0;

  const isVacationExhausted = hasVacationIndicator && (vacationRemaining ?? 0) <= 0;

  const hasSickDayIndicator =
    requestType === 'sick_day' &&
    sickDaysRemaining !== undefined &&
    sickDaysTotal !== undefined &&
    sickDaysTotal > 0;

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
    if (isMultiDayMode) {
      let nextEnd = endDate < clampedStart ? clampedStart : endDate;
      if (hasVacationIndicator && (vacationRemaining ?? 0) > 0) {
        const span = calculateDays(clampedStart, nextEnd);
        if (span > vacationRemaining!) {
          nextEnd = addDaysToLocalIso(clampedStart, vacationRemaining! - 1);
        }
      }
      if (nextEnd !== endDate) {
        setEndDate(nextEnd);
      }
    } else {
      setEndDate(clampedStart);
    }
  };

  const handleEndDateChange = (newEnd: string) => {
    const clampedEnd = minAllowedDate && newEnd < minAllowedDate ? minAllowedDate : newEnd;
    setEndDate(clampedEnd);
    setErrorMsg('');
    if (isMultiDayMode) {
      let nextStart = clampedEnd < startDate ? clampedEnd : startDate;
      if (hasVacationIndicator && (vacationRemaining ?? 0) > 0) {
        const span = calculateDays(nextStart, clampedEnd);
        if (span > vacationRemaining!) {
          nextStart = addDaysToLocalIso(clampedEnd, -(vacationRemaining! - 1));
        }
      }
      if (minAllowedDate && nextStart < minAllowedDate) {
        nextStart = minAllowedDate;
      }
      if (nextStart !== startDate) {
        setStartDate(nextStart);
      }
    } else {
      setStartDate(clampedEnd);
    }
  };

  const daysCount = isMultiDayMode ? calculateDays(startDate, endDate) : 1;

  const formatCzechDateDisplay = (iso: string) => {
    const [y, m, d] = iso.split('-');
    if (!y || !m || !d) return iso;
    return `${Number(d)}. ${Number(m)}. ${y}`;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (isDeadlinePassed) {
      setErrorMsg(`Žádost typu ${currentCfg.label} lze v daný den zadat pouze do ${deadlineFormatted}.`);
      return;
    }

    const effectiveStart = isFixedTodaySingleDay ? todayIso : startDate;
    const effectiveEnd = isMultiDayMode ? endDate : effectiveStart;

    if (minAllowedDate && effectiveStart < minAllowedDate) {
      setErrorMsg(
        typeRule.submissionOffsetDays > 0
          ? `Žádost typu ${currentCfg.label} je nutné zadat alespoň ${typeRule.submissionOffsetDays} ${
              typeRule.submissionOffsetDays === 1 ? 'den' : typeRule.submissionOffsetDays < 5 ? 'dny' : 'dní'
            } předem (nejdříve od ${formatCzechDateDisplay(minAllowedDate)}).`
          : `Datum nemůže být v minulosti.`
      );
      return;
    }

    if (isMultiDayMode) {
      if (new Date(effectiveEnd) < new Date(effectiveStart)) {
        setErrorMsg('Datum ukončení nemůže předcházet datu začátku.');
        return;
      }
    }

    if (hasVacationIndicator && daysCount > (vacationRemaining ?? 0)) {
      setErrorMsg(`Nemáte dostatečný zůstatek dovolené (požadováno: ${daysCount}, zbývá: ${vacationRemaining}).`);
      return;
    }

    if (hasSickDayIndicator && (sickDaysRemaining ?? 0) <= 0) {
      setErrorMsg('Nemáte dostatečný zůstatek Sick Days.');
      return;
    }

    if (isHoursMode || requestType === 'doctor') {
      if (!facilityName.trim()) {
        setErrorMsg('Vyplňte prosím název zdravotnického zařízení nebo jméno lékaře.');
        return;
      }
    }

    onSubmit({
      type: requestType,
      startDate: effectiveStart,
      endDate: effectiveEnd,
      startTime: isHoursMode || requestType === 'doctor' ? startTime : undefined,
      endTime: isHoursMode || requestType === 'doctor' ? endTime : undefined,
      facilityName: isHoursMode || requestType === 'doctor' ? facilityName.trim() : undefined,
      hasConfirmationDocument: isHoursMode || requestType === 'doctor' ? hasDoc : undefined,
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
            disabled={isVacationExhausted || isDeadlinePassed}
            onClick={handleSubmit}
            fullWidth
          >
            Odeslat žádost
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Karta žadatele (sjednocená s detailem žádosti) */}
        <div className="bg-slate-100/70 dark:bg-zinc-800/60 p-4 rounded-2xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <UserAvatar name={applicantName} size="md" />
            <div>
              <div className="font-bold text-sm text-slate-900 dark:text-white">
                {applicantName}
              </div>
              <div className="text-xs text-slate-500 dark:text-zinc-400">
                {applicantRole}
              </div>
            </div>
          </div>

          {hasVacationIndicator && (
            <StatPill
              activityType="vacation"
              value={vacationRemaining!}
              total={vacationTotal!}
              unit="d"
              layout="horizontal"
            />
          )}

          {hasSickDayIndicator && (
            <StatPill
              activityType="sick_day"
              value={sickDaysRemaining!}
              total={sickDaysTotal!}
              unit="d"
              layout="horizontal"
            />
          )}

          {requestType === 'doctor' && (
            <div className="text-right">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300">
                <FileCheck className="w-3.5 h-3.5" />
                <span>S náhradou mzdy</span>
              </span>
              <div className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1">
                Nezkracuje dovolenou
              </div>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 1. DOVOLENÁ SPECIFIC FORM */}
          {requestType === 'vacation' && (
            <div className="space-y-3 animate-in fade-in">
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
                      const unpaidMin = getMinAllowedDateForAbsenceType(unpaidRule, isManagingOtherPerson);
                      const nextDate = unpaidMin || getLocalTodayIso();
                      setRequestType('unpaid_leave');
                      setStartDate(nextDate);
                      setEndDate(nextDate);
                      setErrorMsg('');
                    }}
                    className="shrink-0"
                  >
                    Přepnout na Neplacené volno
                  </Button>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="block text-[11px] text-slate-500 dark:text-zinc-400 mb-1">Datum od:</span>
                  <input
                    type="date"
                    value={startDate}
                    min={minAllowedDate}
                    disabled={isVacationExhausted}
                    onChange={(e) => handleStartDateChange(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-60 disabled:cursor-not-allowed"
                    required
                  />
                </div>
                <div>
                  <span className="block text-[11px] text-slate-500 dark:text-zinc-400 mb-1">Datum do:</span>
                  <input
                    type="date"
                    value={endDate}
                    min={minAllowedDate}
                    disabled={isVacationExhausted}
                    onChange={(e) => handleEndDateChange(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-60 disabled:cursor-not-allowed"
                    required
                  />
                </div>
              </div>

              {!isVacationExhausted && (
                <div className="p-3 rounded-xl bg-amber-500/10 flex items-center justify-between text-xs text-amber-900 dark:text-amber-300">
                  <span className="font-medium">Délka plánovaného čerpání:</span>
                  <span className="font-bold font-mono">
                    {daysCount} {daysCount === 1 ? 'den' : daysCount < 5 ? 'dny' : 'dní'}
                    {hasVacationIndicator ? ` (zůstatek pak: ${Math.max(0, (vacationRemaining ?? 0) - daysCount)} dní)` : ''}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* 2. LÉKAŘ / VYŠETŘENÍ SPECIFIC FORM (Časová absence) */}
          {requestType === 'doctor' && (
            <div className="space-y-3 animate-in fade-in">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <span className="block text-[11px] text-slate-500 dark:text-zinc-400 mb-1">Datum:</span>
                  <input
                    type="date"
                    value={startDate}
                    min={minAllowedDate}
                    onChange={(e) => handleStartDateChange(e.target.value)}
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

          {/* 3. SICK DAY SPECIFIC FORM (Jednodenní absence) */}
          {requestType === 'sick_day' && (
            <div className="space-y-3 animate-in fade-in">
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
              ) : (
                <div>
                  <span className="block text-[11px] text-slate-500 dark:text-zinc-400 mb-1">
                    Datum (1 den):
                  </span>
                  <input
                    type="date"
                    value={startDate}
                    min={minAllowedDate}
                    onChange={(e) => handleStartDateChange(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                    required
                  />
                </div>
              )}
            </div>
          )}

          {/* 4. HOME OFFICE SPECIFIC FORM (Vícedenní absence dle absence_types) */}
          {requestType === 'home_office' && (
            <div className="space-y-3 animate-in fade-in">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="block text-[11px] text-slate-500 dark:text-zinc-400 mb-1">Datum od:</span>
                  <input
                    type="date"
                    value={startDate}
                    min={minAllowedDate}
                    onChange={(e) => handleStartDateChange(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>
                <div>
                  <span className="block text-[11px] text-slate-500 dark:text-zinc-400 mb-1">Datum do:</span>
                  <input
                    type="date"
                    value={endDate}
                    min={minAllowedDate}
                    onChange={(e) => handleEndDateChange(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-emerald-500/10 flex items-center justify-between text-xs text-emerald-900 dark:text-emerald-300">
                <span className="font-medium">Délka práce z domova:</span>
                <span className="font-bold font-mono">
                  {daysCount} {daysCount === 1 ? 'den' : daysCount < 5 ? 'dny' : 'dní'}
                </span>
              </div>
            </div>
          )}

          {/* 5. NEMOC SPECIFIC FORM (Vícedenní absence) */}
          {requestType === 'illness' && (
            <div className="space-y-3 animate-in fade-in">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="block text-[11px] text-slate-500 dark:text-zinc-400 mb-1">Datum od:</span>
                  <input
                    type="date"
                    value={startDate}
                    min={minAllowedDate}
                    onChange={(e) => handleStartDateChange(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                    required
                  />
                </div>
                <div>
                  <span className="block text-[11px] text-slate-500 dark:text-zinc-400 mb-1">Předpokládané datum do:</span>
                  <input
                    type="date"
                    value={endDate}
                    min={minAllowedDate}
                    onChange={(e) => handleEndDateChange(e.target.value)}
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

          {/* 6. NEPLACENÉ VOLNO SPECIFIC FORM (Vícedenní absence) */}
          {requestType === 'unpaid_leave' && (
            <div className="space-y-3 animate-in fade-in">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="block text-[11px] text-slate-500 dark:text-zinc-400 mb-1">Datum od:</span>
                  <input
                    type="date"
                    value={startDate}
                    min={minAllowedDate}
                    onChange={(e) => handleStartDateChange(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    required
                  />
                </div>
                <div>
                  <span className="block text-[11px] text-slate-500 dark:text-zinc-400 mb-1">Datum do:</span>
                  <input
                    type="date"
                    value={endDate}
                    min={minAllowedDate}
                    onChange={(e) => handleEndDateChange(e.target.value)}
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

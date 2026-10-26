import { useState, useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { getStatusConfig } from '../config/presenceConfig';
import {
  resolveAbsenceTypeConfig,
  resolveAbsenceTypeLabel,
  isAbsenceTypeDeadlinePassedToday,
  type AbsenceTypeConfigDto
} from '../api';
import type { RequestTypeOption } from './NewRequestModal';
import type { LeaveRequestItem } from './LeaveRequestModal';
import { Button } from './ui';

export const QUICK_REQUEST_TYPES: readonly RequestTypeOption[] = [
  'vacation',
  'sick_day',
  'illness',
  'doctor',
  'unpaid_leave',
  'home_office'
] as const;

export interface QuickRequestActionsProps {
  onSelectType: (type: RequestTypeOption) => void;
  /** Zda ovládáme jinou osobu v Detailu osoby (žlutá tlačítka s černým textem a černou ikonou) */
  isManagingOtherPerson?: boolean;
  /** Zda je cílová osoba OSVČ (filtruje absence dle allowOsvc z absence_types) */
  isOsvc?: boolean;
  /** Konfigurace typů absencí z DB */
  absenceTypesMap?: Record<string, AbsenceTypeConfigDto>;
  /** Zbývající dovolená */
  vacationRemaining?: number | string;
  /** Celkový nárok dovolené */
  vacationTotal?: number;
  /** Zbývající sick days */
  sickDaysRemaining?: number | string;
  /** Celkový nárok sick days */
  sickDaysTotal?: number;
  /** Týdenní limit Home Office (pokud je nastaveno 0, je vyčerpáno/nepovoleno) */
  homeOfficeWeeklyLimit?: number;
  /** Existující žádosti dané osoby pro kontrolu měsíčních limitů (maxPerMonthLimit) */
  userRequests?: LeaveRequestItem[];
  /** Zda má osoba trvalý Home Office (tlačítko žádosti o Home Office zmizí) */
  isPermanentHomeOffice?: boolean;
  /** Zda má osoba povolené Náhradní volno (čerpání ze salda) */
  compensatoryLeaveEnabled?: boolean;
  /** Maximální počet dnů náhradního volna, který lze aktuálně čerpat ze salda (min. +8h na 1 den, po odečtení čekajících a schválených žádostí) */
  compensatoryLeaveMaxDays?: number;
  /** Dostupný počet hodin v saldu pro čerpání náhradního volna (po odečtení čekajících a schválených žádostí) */
  compensatoryLeaveAvailableSaldoHours?: number;
  /** Režim zobrazení: 'grid' (mřížka tlačítek na Přehledu) nebo 'dropdown' (tlačítko Podat žádost s kontextovým menu na stránce Žádosti) */
  mode?: 'grid' | 'dropdown';
  className?: string;
}

/**
 * Sdílená navigace rychlých akčních tlačítek pro vytvoření žádosti / absence.
 * Používá se na Přehledu (DashboardView), v Detailu osoby i na stránce Moje žádosti (RequestsView).
 */
export function QuickRequestActions({
  onSelectType,
  isManagingOtherPerson = false,
  isOsvc = false,
  absenceTypesMap,
  vacationRemaining,
  vacationTotal,
  sickDaysRemaining,
  sickDaysTotal,
  homeOfficeWeeklyLimit,
  userRequests = [],
  isPermanentHomeOffice = false,
  compensatoryLeaveEnabled = false,
  compensatoryLeaveMaxDays,
  compensatoryLeaveAvailableSaldoHours: _compensatoryLeaveAvailableSaldoHours,
  mode = 'grid',
  className = ''
}: QuickRequestActionsProps) {
  const [now, setNow] = useState(() => new Date());
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!isDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isDropdownOpen]);

  const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const extraCustomTypes = absenceTypesMap
    ? Object.keys(absenceTypesMap).filter(
        (code) => !QUICK_REQUEST_TYPES.includes(code) && absenceTypesMap[code]?.isActive !== false
      )
    : [];

  const allQuickTypes = [...QUICK_REQUEST_TYPES, ...extraCustomTypes];

  const visibleTypes = allQuickTypes.filter((type) => {
    const typeRule = resolveAbsenceTypeConfig(type, absenceTypesMap);
    if (typeRule.isActive === false) return false;
    if (isOsvc && !typeRule.allowOsvc) return false;
    if (type === 'home_office' && isPermanentHomeOffice) return false;
    if ((type === 'compensatory_leave' || typeRule.drawsFromSaldo) && !compensatoryLeaveEnabled) {
      return false;
    }
    return true;
  });

  if (visibleTypes.length === 0) return null;

  const actionItems = visibleTypes.map((type) => {
    const cfg = getStatusConfig(type);
    const typeRule = resolveAbsenceTypeConfig(type, absenceTypesMap);
    const typeLabel = resolveAbsenceTypeLabel(typeRule, isOsvc) || cfg.label;
    const isDeadlinePassed = isAbsenceTypeDeadlinePassedToday(
      typeRule,
      isManagingOtherPerson,
      now
    );
    const deadlineLabel = typeRule.submissionDeadlineTime
      ? typeRule.submissionDeadlineTime.slice(0, 5)
      : '';

    const isVacationExhausted =
      type === 'vacation' &&
      vacationTotal !== undefined &&
      vacationTotal !== null &&
      (vacationRemaining === '—' || Number(vacationRemaining) <= 0);

    const isSickDayExhausted =
      type === 'sick_day' &&
      sickDaysTotal !== undefined &&
      sickDaysTotal !== null &&
      (sickDaysRemaining === '—' || Number(sickDaysRemaining) <= 0);

    const isHoExhausted =
      type === 'home_office' &&
      homeOfficeWeeklyLimit !== undefined &&
      homeOfficeWeeklyLimit !== null &&
      Number(homeOfficeWeeklyLimit) <= 0;

    let isMonthlyLimitExhausted = false;
    if (
      typeRule.maxPerMonthLimit !== undefined &&
      typeRule.maxPerMonthLimit !== null &&
      typeRule.maxPerMonthLimit > 0 &&
      typeRule.durationMode === 'single_day' &&
      (typeRule.submissionOffsetDays ?? 0) === 0
    ) {
      const usedThisMonth = userRequests
        .filter(
          (r) =>
            !r.isDeleted &&
            r.type === type &&
            (r.status === 'approved' || r.status === 'pending') &&
            (r.startDate || '').startsWith(currentYearMonth)
        )
        .reduce((sum, r) => sum + (r.daysCount || 1), 0);

      if (usedThisMonth >= typeRule.maxPerMonthLimit) {
        isMonthlyLimitExhausted = true;
      }
    }

    const isCompensatoryType =
      type === 'compensatory_leave' || Boolean(typeRule.drawsFromSaldo);
    const isCompensatoryExhausted =
      isCompensatoryType &&
      (compensatoryLeaveMaxDays === undefined ||
        compensatoryLeaveMaxDays === null ||
        Number(compensatoryLeaveMaxDays) <= 0);

    // Požadavek uživatele: tlačítko dovolené při vyčerpání budgetu NENÍ neaktivní,
    // uživatel si tak může zadat dovolenou na příští rok (v modálu se předvyplní 01.01. dalšího roku).
    const isExhausted =
      (type !== 'vacation' && isVacationExhausted) ||
      isSickDayExhausted ||
      isHoExhausted ||
      isMonthlyLimitExhausted ||
      isCompensatoryExhausted;
    const isDisabled = isExhausted || isDeadlinePassed;

    const tooltipTitle =
      type === 'vacation' && isVacationExhausted
        ? `${typeLabel} pro letošní rok je vyčerpána – můžete zadat termín na příští rok`
        : isCompensatoryExhausted
        ? `${typeLabel} lze čerpat pouze při dostatečném saldu na alespoň 1 den úvazku (zbývá 0 dnů)`
        : isExhausted
        ? `${typeLabel} – vyčerpán limit (zbývá 0)`
        : isDeadlinePassed
        ? `Nahlášení ${typeLabel} v daný den je možné pouze do ${deadlineLabel}`
        : undefined;

    return {
      type,
      cfg,
      typeLabel,
      isDisabled,
      isExhausted,
      isDeadlinePassed,
      deadlineLabel,
      tooltipTitle
    };
  });

  if (mode === 'dropdown') {
    return (
      <div className={`relative inline-block ${className}`.trim()} ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setIsDropdownOpen((prev) => !prev)}
          className="h-10 px-4 text-sm font-bold rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-900 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:active:bg-zinc-600 text-white shadow-sm inline-flex items-center justify-center gap-2 transition-all cursor-pointer select-none"
        >
          <span>Podat žádost</span>
          <ChevronDown
            className={`w-4 h-4 text-emerald-500 stroke-[2.5] transition-transform duration-150 ${
              isDropdownOpen ? 'rotate-180' : ''
            }`}
          />
        </button>

        {isDropdownOpen && (
          <div className="absolute left-0 top-full mt-2 w-60 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
            {actionItems.map((item) => {
              const Icon = item.cfg.icon;
              return (
                <button
                  key={item.type}
                  type="button"
                  disabled={item.isDisabled}
                  title={item.tooltipTitle}
                  onClick={() => {
                    if (item.isDisabled) return;
                    setIsDropdownOpen(false);
                    onSelectType(item.type);
                  }}
                  className={`w-full px-3.5 py-2.5 text-left text-sm font-medium flex items-center justify-between gap-2.5 transition-colors ${
                    item.isDisabled
                      ? 'opacity-45 cursor-not-allowed text-slate-400 dark:text-zinc-500'
                      : 'text-slate-800 dark:text-zinc-100 hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon className={`w-4 h-4 shrink-0 ${item.cfg.iconColorClass}`} />
                    <span className="truncate">{item.typeLabel}</span>
                  </div>
                  {item.isDeadlinePassed && (
                    <span className="text-[10px] font-mono text-slate-400 dark:text-zinc-500 shrink-0">
                      do {item.deadlineLabel}
                    </span>
                  )}
                  {!item.isDeadlinePassed && item.isExhausted && (
                    <span className="text-[10px] font-mono text-slate-400 dark:text-zinc-500 shrink-0">
                      vyčerpáno
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 ${className}`.trim()}>
      {actionItems.map((item) => (
        <Button
          key={item.type}
          variant={isManagingOtherPerson ? 'filled' : 'default'}
          colorKey={isManagingOtherPerson ? 'amber' : item.cfg.colorKey}
          iconClassName={isManagingOtherPerson ? 'text-slate-950' : ''}
          size="md"
          icon={item.cfg.icon}
          disabled={item.isDisabled}
          title={item.tooltipTitle}
          onClick={() => {
            if (item.isDisabled) return;
            onSelectType(item.type);
          }}
          fullWidth
        >
          {item.typeLabel}
        </Button>
      ))}
    </div>
  );
}

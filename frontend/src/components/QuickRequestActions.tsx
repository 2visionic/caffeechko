import { useState, useEffect } from 'react';
import { getStatusConfig } from '../config/presenceConfig';
import {
  resolveAbsenceTypeConfig,
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
  className = ''
}: QuickRequestActionsProps) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const visibleTypes = QUICK_REQUEST_TYPES.filter((type) => {
    const typeRule = resolveAbsenceTypeConfig(type, absenceTypesMap);
    if (isOsvc && !typeRule.allowOsvc) return false;

    // Skrýt tlačítko, pokud má absence omezenou kapacitu a je vyčerpána
    if (type === 'vacation') {
      if (
        vacationTotal !== undefined &&
        vacationTotal !== null &&
        (vacationRemaining === '—' || Number(vacationRemaining) <= 0)
      ) {
        return false;
      }
    }

    if (type === 'sick_day') {
      if (
        sickDaysTotal !== undefined &&
        sickDaysTotal !== null &&
        (sickDaysRemaining === '—' || Number(sickDaysRemaining) <= 0)
      ) {
        return false;
      }
    }

    if (type === 'home_office') {
      if (homeOfficeWeeklyLimit !== undefined && homeOfficeWeeklyLimit !== null && Number(homeOfficeWeeklyLimit) <= 0) {
        return false;
      }
    }

    // Kontrola obecného měsíčního limitu (maxPerMonthLimit) pro absence vázané na aktuální den/měsíc
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
            r.type === type &&
            (r.status === 'approved' || r.status === 'pending') &&
            (r.startDate || '').startsWith(currentYearMonth)
        )
        .reduce((sum, r) => sum + (r.daysCount || 1), 0);

      if (usedThisMonth >= typeRule.maxPerMonthLimit) {
        return false;
      }
    }

    return true;
  });

  if (visibleTypes.length === 0) return null;

  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 ${className}`.trim()}>
      {visibleTypes.map((type) => {
        const cfg = getStatusConfig(type);
        const typeRule = resolveAbsenceTypeConfig(type, absenceTypesMap);
        const typeLabel = typeRule.nameEmployee || cfg.label;
        const isDeadlinePassed = isAbsenceTypeDeadlinePassedToday(
          typeRule,
          isManagingOtherPerson,
          now
        );
        const deadlineLabel = typeRule.submissionDeadlineTime
          ? typeRule.submissionDeadlineTime.slice(0, 5)
          : '';

        return (
          <Button
            key={type}
            variant={isManagingOtherPerson ? 'filled' : 'default'}
            colorKey={isManagingOtherPerson ? 'amber' : cfg.colorKey}
            iconClassName={isManagingOtherPerson ? 'text-slate-950' : ''}
            size="md"
            icon={cfg.icon}
            disabled={isDeadlinePassed}
            title={
              isDeadlinePassed
                ? `Nahlášení ${typeLabel} v daný den je možné pouze do ${deadlineLabel}`
                : undefined
            }
            onClick={() => {
              if (isDeadlinePassed) return;
              onSelectType(type);
            }}
            fullWidth
          >
            {typeLabel}
          </Button>
        );
      })}
    </div>
  );
}

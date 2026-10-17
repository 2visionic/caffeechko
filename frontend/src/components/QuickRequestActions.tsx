import { useState, useEffect } from 'react';
import { getStatusConfig } from '../config/presenceConfig';
import {
  resolveAbsenceTypeConfig,
  isAbsenceTypeDeadlinePassedToday,
  type AbsenceTypeConfigDto
} from '../api';
import type { RequestTypeOption } from './NewRequestModal';
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
  /** Konfigurace typů absencí z DB */
  absenceTypesMap?: Record<string, AbsenceTypeConfigDto>;
  className?: string;
}

/**
 * Sdílená navigace rychlých akčních tlačítek pro vytvoření žádosti / absence.
 * Používá se na Přehledu (DashboardView), v Detailu osoby i na stránce Moje žádosti (RequestsView).
 */
export function QuickRequestActions({
  onSelectType,
  isManagingOtherPerson = false,
  absenceTypesMap,
  className = ''
}: QuickRequestActionsProps) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 ${className}`.trim()}>
      {QUICK_REQUEST_TYPES.map((type) => {
        const cfg = getStatusConfig(type);
        const typeRule = resolveAbsenceTypeConfig(type, absenceTypesMap);
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
                ? `Nahlášení ${cfg.label} v daný den je možné pouze do ${deadlineLabel}`
                : undefined
            }
            onClick={() => {
              if (isDeadlinePassed) return;
              onSelectType(type);
            }}
            fullWidth
          >
            {cfg.label}
          </Button>
        );
      })}
    </div>
  );
}

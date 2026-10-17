import { getStatusConfig } from '../config/presenceConfig';
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
  className?: string;
}

/**
 * Sdílená navigace rychlých akčních tlačítek pro vytvoření žádosti / absence.
 * Používá se na Přehledu (DashboardView), v Detailu osoby i na stránce Moje žádosti (RequestsView).
 */
export function QuickRequestActions({
  onSelectType,
  isManagingOtherPerson = false,
  className = ''
}: QuickRequestActionsProps) {
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 ${className}`.trim()}>
      {QUICK_REQUEST_TYPES.map((type) => {
        const cfg = getStatusConfig(type);
        return (
          <Button
            key={type}
            variant={isManagingOtherPerson ? 'filled' : 'default'}
            colorKey={isManagingOtherPerson ? 'amber' : cfg.colorKey}
            iconClassName={isManagingOtherPerson ? 'text-slate-950' : ''}
            size="md"
            icon={cfg.icon}
            onClick={() => onSelectType(type)}
            fullWidth
          >
            {cfg.label}
          </Button>
        );
      })}
    </div>
  );
}

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
  className?: string;
}

/**
 * Sdílená navigace rychlých akčních tlačítek pro vytvoření žádosti / absence.
 * Používá se na Přehledu (DashboardView) i na stránce Moje žádosti (RequestsView).
 */
export function QuickRequestActions({ onSelectType, className = '' }: QuickRequestActionsProps) {
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 ${className}`.trim()}>
      {QUICK_REQUEST_TYPES.map((type) => {
        const cfg = getStatusConfig(type);
        return (
          <Button
            key={type}
            variant="default"
            colorKey={cfg.colorKey}
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

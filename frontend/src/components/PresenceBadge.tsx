import type { StatusType, StatusConfig } from '../config/presenceConfig';
import { getStatusConfig } from '../config/presenceConfig';

export interface PresenceBadgeProps {
  /** Raw type string (e.g. 'office', 'home_office', 'vacation', 'sick_day', 'illness', 'doctor', 'unpaid_leave', 'offline') */
  type: string | undefined | null;
  /** Optional custom label to override config default label */
  customLabel?: string;
  /**
   * Visual variant:
   * - 'pill' (default): background pill with text color, icon, and label
   * - 'text': icon in colored square box + plain text label (no surrounding pill)
   * - 'chip': interactive filter chip (with active/inactive classes)
   * - 'icon-box': only the colored square box with icon (e.g. for modal headers)
   */
  variant?: 'pill' | 'text' | 'chip' | 'icon-box';
  /** Whether to render the Lucide icon (default true) */
  showIcon?: boolean;
  /** Whether to render a colored status dot (default false) */
  showDot?: boolean;
  /** Active state for filter chips */
  active?: boolean;
  /** Size variant */
  size?: 'xs' | 'sm' | 'md' | 'lg';
  /** Extra container className */
  className?: string;
  /** Extra icon className */
  iconClassName?: string;
}

/**
 * Unified Presence & Absence Badge component.
 * Ensures 100% consistent colors, icons, and styling everywhere in the application.
 */
export function PresenceBadge({
  type,
  customLabel,
  variant = 'pill',
  showIcon = true,
  showDot = false,
  active = false,
  size = 'md',
  className = '',
  iconClassName = ''
}: PresenceBadgeProps) {
  const cfg: StatusConfig = getStatusConfig(type);
  const Icon = cfg.icon;
  const label = customLabel || cfg.label;

  // Icon Box variant (e.g. for modal headers or stats cards)
  if (variant === 'icon-box') {
    const sizeClasses = {
      xs: 'w-7 h-7 rounded-lg',
      sm: 'w-8 h-8 rounded-xl',
      md: 'w-9 h-9 rounded-2xl',
      lg: 'w-10 h-10 rounded-2xl'
    }[size];

    const iconSizes = {
      xs: 'w-3.5 h-3.5',
      sm: 'w-4 h-4',
      md: 'w-4.5 h-4.5',
      lg: 'w-5 h-5'
    }[size];

    return (
      <div
        className={`${sizeClasses} ${cfg.statIconBgClass} flex items-center justify-center flex-shrink-0 ${className}`}
      >
        <Icon className={`${iconSizes} ${iconClassName}`} />
      </div>
    );
  }

  // Text variant (plain text label with colored icon box, e.g. in requests tables)
  if (variant === 'text') {
    return (
      <div className={`flex items-center gap-2.5 ${className}`}>
        <div
          className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.statIconBgClass}`}
        >
          <Icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${iconClassName}`} />
        </div>
        <span className="font-semibold text-xs text-slate-800 dark:text-zinc-200 truncate">
          {label}
        </span>
      </div>
    );
  }

  // Filter Chip variant (used in Kdo je kde and PersonsView filters)
  if (variant === 'chip') {
    return (
      <span
        className={`px-3 py-1.5 rounded-xl font-medium transition-all inline-flex items-center gap-1.5 text-xs ${
          active ? cfg.chipActiveClass : cfg.chipInactiveClass
        } ${className}`}
      >
        {showDot && <span className={`w-2 h-2 rounded-full ${cfg.dotClass}`} />}
        {showIcon && <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${iconClassName}`} />}
        <span>{label}</span>
      </span>
    );
  }

  // Default: Pill variant
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-semibold ${cfg.badgeClass} ${className}`}
    >
      {showDot && <span className={`w-2 h-2 rounded-full ${cfg.dotClass}`} />}
      {showIcon && <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${iconClassName}`} />}
      <span>{label}</span>
    </span>
  );
}

/**
 * Direct Status Icon component with guaranteed icon & color matching.
 */
export function StatusIcon({
  type,
  className = 'w-4 h-4',
  withColor = true
}: {
  type: string | undefined | null;
  className?: string;
  withColor?: boolean;
}) {
  const cfg = getStatusConfig(type);
  const Icon = cfg.icon;
  return <Icon className={`${className} ${withColor ? cfg.iconColorClass : ''}`} />;
}

export type { StatusType, StatusConfig };

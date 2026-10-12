import React, { type ComponentType } from 'react';
import type { LucideProps } from 'lucide-react';
import {
  getStatusConfig,
  getColorClasses,
  type StatusType,
  type ColorKey
} from '../../config/presenceConfig';

export interface StatPillProps {
  /** If provided, automatically loads icon, color, and fallback label from the activity dictionary */
  activityType?: StatusType;
  /** Explicit icon override */
  icon?: ComponentType<LucideProps>;
  /** Explicit colorKey override ('emerald', 'sky', 'amber', 'rose', 'indigo', etc.) */
  colorKey?: ColorKey;
  /** Main stat value (e.g. 24, '+14.5', 2, 0) */
  value: string | number;
  /** Denominator / limit (e.g. 168 in '24/168', 3 in '2/3') */
  total?: string | number;
  /** Unit indicator (e.g. 'h' or 'd') */
  unit?: string;
  /** Label underneath (e.g. 'říjen', 'Přesčas', 'Dovolená', 'Sick days') */
  label?: string;
  /** Custom text color for the value (e.g. text-emerald-600) */
  valueColorClass?: string;
  /** Click handler if interactive */
  onClick?: () => void;
  className?: string;
}

/**
 * Standard macro stat item (used in attendance overview and KPI bars).
 * Fixes vertical misalignment with strict baseline and fixed row heights.
 */
export const StatPill: React.FC<StatPillProps> = ({
  activityType,
  icon: customIcon,
  colorKey: customColorKey,
  value,
  total,
  unit,
  label,
  valueColorClass,
  onClick,
  className = ''
}) => {
  const cfg = activityType ? getStatusConfig(activityType) : null;
  const Icon = customIcon || cfg?.icon;
  const activeColorKey = customColorKey || cfg?.colorKey || 'amber';
  const displayLabel = label || cfg?.shortLabel || cfg?.label || '';
  const colors = getColorClasses(activeColorKey);
  const iconBg = cfg?.statIconBgClass || colors.bg;

  return (
    <div
      onClick={onClick}
      className={`flex flex-col items-center text-center group min-w-[62px] sm:min-w-[72px] ${
        onClick ? 'cursor-pointer' : ''
      } ${className}`}
    >
      {/* 1. Circle Icon */}
      {Icon && (
        <div
          className={`w-8.5 h-8.5 sm:w-9 sm:h-9 rounded-full ${iconBg} flex items-center justify-center mb-1.5 transition-transform group-hover:scale-105 shadow-xs`}
        >
          <Icon className="w-4 h-4" />
        </div>
      )}

      {/* 2. Number & Unit Row (Strict fixed height & baseline alignment) */}
      <div className="h-5 flex items-baseline justify-center gap-0.5 leading-none">
        <span
          className={`text-xs sm:text-sm font-bold font-mono tracking-tight ${
            valueColorClass || 'text-slate-900 dark:text-white'
          }`}
        >
          {value}
        </span>

        {total !== undefined && (
          <span className="text-[11px] sm:text-xs font-normal font-mono text-slate-400 dark:text-zinc-500">
            /{total}
          </span>
        )}

        {unit && (
          <span className="text-[10px] sm:text-[11px] font-normal font-mono text-slate-400 dark:text-zinc-500 ml-0.5">
            {unit}
          </span>
        )}
      </div>

      {/* 3. Label Row (Strict fixed height to eliminate vertical jumps) */}
      <div className="h-4 flex items-center justify-center text-[10px] sm:text-[11px] text-slate-500 dark:text-zinc-400 font-medium mt-1 leading-tight whitespace-nowrap">
        {displayLabel}
      </div>
    </div>
  );
};

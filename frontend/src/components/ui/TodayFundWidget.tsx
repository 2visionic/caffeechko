import React from 'react';

export interface TodayFundWidgetProps {
  /** Worked hours string (e.g. '0h 0m' or '3h 15m') */
  worked: string;
  /** Target daily fund string (e.g. '8h') */
  target?: string;
  /** Sub-label underneath (default 'Dnes') */
  label?: string;
  /** Whether the user is actively clocked in */
  isClockedIn?: boolean;
  /** Optional click handler */
  onClick?: () => void;
  className?: string;
}

/**
 * Modern M3 Today Fund widget.
 * Sits next to the user name in the hero header.
 * Displays worked time vs daily target (e.g. 0h 0m / 8h) with 'Dnes' label below.
 */
export const TodayFundWidget: React.FC<TodayFundWidgetProps> = ({
  worked,
  target = '8h',
  label = 'Dnes',
  isClockedIn = false,
  onClick,
  className = ''
}) => {
  return (
    <div
      onClick={onClick}
      className={`px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-2xl bg-slate-100/90 dark:bg-zinc-800/80 flex flex-col items-end justify-center flex-shrink-0 select-none transition-colors ${
        onClick ? 'cursor-pointer hover:bg-slate-200/70 dark:hover:bg-zinc-700/70' : ''
      } ${className}`}
    >
      {/* 1. Value ratio row */}
      <div className="flex items-baseline gap-1 font-mono leading-tight">
        <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white tracking-tight">
          {worked}
        </span>
        <span className="text-[11px] sm:text-xs text-slate-400 dark:text-zinc-500 font-normal">
          / {target}
        </span>
      </div>

      {/* 2. Label row below */}
      <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-medium text-slate-500 dark:text-zinc-400 mt-0.5 leading-none">
        {isClockedIn && (
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        )}
        <span>{label}</span>
      </div>
    </div>
  );
};

import React from 'react';

/**
 * Returns capitalized Czech name of the day with date (e.g. 'Středa 14.10.').
 */
export const getCzechWeekdayName = (date: Date = new Date()): string => {
  const day = new Intl.DateTimeFormat('cs-CZ', { weekday: 'long' }).format(date);
  const capitalizedDay = day.charAt(0).toUpperCase() + day.slice(1);
  return `${capitalizedDay} ${date.getDate()}.${date.getMonth() + 1}.`;
};

export interface TodayFundWidgetProps {
  /** Worked hours string (e.g. '0h 0m' or '3h 15m') */
  worked: string;
  /** Target daily fund string (e.g. '8h') */
  target?: string;
  /** Sub-label underneath (defaults to current Czech weekday name, e.g. 'Úterý') */
  label?: string;
  /** Whether the user is actively clocked in */
  isClockedIn?: boolean;
  /** Optional click handler */
  onClick?: () => void;
  className?: string;
}

/**
 * Modern Today Fund typography widget.
 * Sits next to the user name in the hero header.
 * Clean, borderless and background-free presentation with bold legible typography.
 */
export const TodayFundWidget: React.FC<TodayFundWidgetProps> = ({
  worked,
  target = '8h',
  label = getCzechWeekdayName(),
  isClockedIn = false,
  onClick,
  className = ''
}) => {
  const displayTarget = target.replace(/\s*00m$/, '');

  return (
    <div
      onClick={onClick}
      className={`flex flex-col items-end justify-center flex-shrink-0 select-none ${
        onClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''
      } ${className}`}
    >
      {/* 1. Value ratio row (prominent typography without surface background box) */}
      <div className="flex items-baseline gap-1.5 font-mono leading-none">
        <span className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          {worked}
        </span>
        <span className="text-sm sm:text-base font-medium text-slate-400 dark:text-zinc-500">
          / {displayTarget}
        </span>
      </div>

      {/* 2. Label row below */}
      <div className="flex items-center gap-1.5 text-xs sm:text-sm font-medium text-slate-500 dark:text-zinc-400 mt-1 leading-none">
        {isClockedIn && (
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        )}
        <span>{label}</span>
      </div>
    </div>
  );
};

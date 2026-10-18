import { type ComponentType, type ReactNode } from 'react';
import type { LucideProps } from 'lucide-react';

export interface SegmentedControlOption<T extends string = string> {
  id: T;
  label: ReactNode;
  icon?: ComponentType<LucideProps>;
  badge?: ReactNode | number | string;
  badgeClass?: string;
  title?: string;
}

export interface SegmentedControlProps<T extends string = string> {
  options: SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** When true, spans full width with equal-width options */
  full?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

export function SegmentedControl<T extends string = string>({
  options,
  value,
  onChange,
  full = false,
  size = 'md',
  className = ''
}: SegmentedControlProps<T>) {
  const sizeClasses =
    size === 'sm'
      ? 'px-3 py-1.5 text-xs'
      : 'px-3.5 py-2 text-xs font-semibold';

  return (
    <div
      role="tablist"
      className={`p-1 bg-slate-100 dark:bg-zinc-800 rounded-2xl ${
        full ? 'w-full flex items-center gap-1.5' : 'inline-flex items-center gap-1.5 w-fit self-start sm:self-auto'
      } ${className}`}
    >
      {options.map((opt) => {
        const isActive = opt.id === value;
        const Icon = opt.icon;

        return (
          <button
            key={opt.id}
            role="tab"
            type="button"
            aria-selected={isActive}
            title={opt.title}
            onClick={() => onChange(opt.id)}
            className={`rounded-xl transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap active:scale-98 ${sizeClasses} ${
              full ? 'flex-1 justify-center' : ''
            } ${
              isActive
                ? 'bg-white dark:bg-zinc-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-zinc-700/50'
            }`}
          >
            {Icon && (
              <Icon
                className={`w-3.5 h-3.5 flex-shrink-0 ${
                  isActive ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400 dark:text-zinc-500'
                }`}
              />
            )}
            <span>{opt.label}</span>
            {opt.badge !== undefined && opt.badge !== null && (
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold leading-none ${
                  opt.badgeClass || 'bg-amber-500 text-white'
                }`}
              >
                {opt.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

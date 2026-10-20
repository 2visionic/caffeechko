import React from 'react';

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  color?: 'amber' | 'emerald' | 'sky' | 'rose' | 'indigo';
  label?: React.ReactNode;
  className?: string;
}

const ACTIVE_BG_MAP: Record<NonNullable<SwitchProps['color']>, string> = {
  amber: 'bg-amber-500',
  emerald: 'bg-emerald-500',
  sky: 'bg-sky-500',
  rose: 'bg-rose-500',
  indigo: 'bg-indigo-500'
};

export const Switch: React.FC<SwitchProps> = ({
  checked,
  onChange,
  disabled = false,
  color = 'amber',
  label,
  className = ''
}) => {
  const activeBg = ACTIVE_BG_MAP[color] || ACTIVE_BG_MAP.amber;

  const buttonEl = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) {
          onChange(!checked);
        }
      }}
      className={`relative inline-flex h-4.5 w-8 shrink-0 items-center rounded-full p-0.5 transition-colors duration-200 focus:outline-none ${
        checked ? activeBg : 'bg-slate-300 dark:bg-zinc-700'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${!label ? className : ''}`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-xs transition-transform duration-200 ${
          checked ? 'translate-x-3.5' : 'translate-x-0'
        }`}
      />
    </button>
  );

  if (!label) {
    return buttonEl;
  }

  return (
    <div
      onClick={() => {
        if (!disabled) {
          onChange(!checked);
        }
      }}
      className={`inline-flex items-center gap-2.5 select-none ${
        disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
      } ${className}`}
    >
      {buttonEl}
      <div className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
        {label}
      </div>
    </div>
  );
};


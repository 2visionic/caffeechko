import { forwardRef, type InputHTMLAttributes, type ComponentType, type ReactNode } from 'react';
import type { LucideProps } from 'lucide-react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  icon?: ComponentType<LucideProps>;
  rightElement?: ReactNode;
  fullWidth?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    label,
    error,
    helperText,
    icon: Icon,
    rightElement,
    fullWidth = true,
    className = '',
    id,
    disabled,
    ...props
  },
  ref
) {
  const inputId = id || (label ? `input-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

  return (
    <div className={`${fullWidth ? 'w-full' : ''} space-y-1.5`}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-semibold text-slate-700 dark:text-zinc-300"
        >
          {label}
        </label>
      )}

      <div className="relative flex items-center">
        {Icon && (
          <div className="absolute left-3.5 text-slate-400 pointer-events-none flex items-center">
            <Icon className="w-4 h-4" />
          </div>
        )}

        <input
          ref={ref}
          id={inputId}
          disabled={disabled}
          className={`w-full rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-white text-sm py-2.5 ${
            Icon ? 'pl-10' : 'pl-3.5'
          } ${rightElement ? 'pr-10' : 'pr-3.5'} border-0 focus:ring-2 focus:ring-amber-500 outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-zinc-500 ${
            error ? 'ring-2 ring-rose-500' : ''
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
          {...props}
        />

        {rightElement && (
          <div className="absolute right-3 flex items-center">{rightElement}</div>
        )}
      </div>

      {error && (
        <p className="text-[11px] font-medium text-rose-600 dark:text-rose-400">
          {error}
        </p>
      )}

      {!error && helperText && (
        <p className="text-[11px] text-slate-500 dark:text-zinc-400">{helperText}</p>
      )}
    </div>
  );
});

Input.displayName = 'Input';

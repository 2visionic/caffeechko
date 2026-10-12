import { forwardRef, type TextareaHTMLAttributes } from 'react';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  fullWidth?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  {
    label,
    error,
    helperText,
    fullWidth = true,
    className = '',
    id,
    disabled,
    rows = 3,
    ...props
  },
  ref
) {
  const textareaId = id || (label ? `textarea-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

  return (
    <div className={`${fullWidth ? 'w-full' : ''} space-y-1.5`}>
      {label && (
        <label
          htmlFor={textareaId}
          className="block text-xs font-semibold text-slate-700 dark:text-zinc-300"
        >
          {label}
        </label>
      )}

      <textarea
        ref={ref}
        id={textareaId}
        rows={rows}
        disabled={disabled}
        className={`w-full rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-white text-sm p-3.5 border-0 focus:ring-2 focus:ring-amber-500 outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-zinc-500 ${
          error ? 'ring-2 ring-rose-500' : ''
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
        {...props}
      />

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

Textarea.displayName = 'Textarea';

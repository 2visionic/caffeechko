import { CheckCircle2, AlertCircle, AlertOctagon, X } from 'lucide-react';

export type ToastType = 'success' | 'warning' | 'error';

export interface ToastItem {
  id: number;
  type: ToastType;
  title: string;
  message: string;
}

export interface ToastContainerProps {
  toasts: ToastItem[];
  onDismiss?: (id: number) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-label="Systémová oznámení"
      className="fixed bottom-6 right-6 z-50 space-y-2 max-w-sm pointer-events-none select-none"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto p-4 rounded-2xl shadow-xl flex items-start gap-3 animate-in slide-in-from-bottom-5 duration-200 ${
            t.type === 'success'
              ? 'bg-emerald-600 text-white shadow-emerald-950/20'
              : t.type === 'warning'
              ? 'bg-amber-500 text-zinc-950 font-medium shadow-amber-950/20'
              : 'bg-rose-600 text-white shadow-rose-950/20'
          }`}
        >
          {t.type === 'success' && <CheckCircle2 className="w-5 h-5 flex-shrink-0" />}
          {t.type === 'warning' && <AlertCircle className="w-5 h-5 flex-shrink-0 text-zinc-950" />}
          {t.type === 'error' && <AlertOctagon className="w-5 h-5 flex-shrink-0" />}

          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm leading-tight">{t.title}</div>
            <div className="text-xs opacity-90 mt-0.5 break-words">{t.message}</div>
          </div>

          {onDismiss && (
            <button
              type="button"
              onClick={() => onDismiss(t.id)}
              className="p-1 -mr-1 -mt-1 opacity-70 hover:opacity-100 transition-opacity"
              title="Zavřít oznámení"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

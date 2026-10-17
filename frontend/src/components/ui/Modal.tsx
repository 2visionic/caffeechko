import { useEffect, type ReactNode, type ComponentType } from 'react';
import { X, type LucideProps } from 'lucide-react';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';

export interface ModalProps {
  /** Whether the modal is visible */
  isOpen: boolean;
  /** Callback invoked when the modal requests to be closed */
  onClose: () => void;
  /** Modal title */
  title: ReactNode;
  /** Optional subtitle or description */
  subtitle?: ReactNode;
  /** Optional icon in the header */
  icon?: ComponentType<LucideProps>;
  /** Optional background / text color classes for the header icon tile */
  iconBgClass?: string;
  /** Size scale of the dialog */
  size?: ModalSize;
  /** Content of the modal */
  children: ReactNode;
  /** Optional footer action bar */
  footer?: ReactNode;
  /** Whether clicking the backdrop closes the modal (default true) */
  closeOnBackdrop?: boolean;
  /** Extra container className */
  className?: string;
}

const SIZE_CLASSES: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl'
};

export function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  icon: Icon,
  iconBgClass = 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  size = 'lg',
  children,
  footer,
  closeOnBackdrop = true,
  className = ''
}: ModalProps) {
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll while modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.lg;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => {
        if (closeOnBackdrop && e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className={`bg-white dark:bg-zinc-900 w-full ${sizeClass} max-h-[90vh] flex flex-col rounded-3xl p-6 sm:p-7 shadow-2xl animate-in zoom-in-95 duration-200 ${className}`}
        style={{ border: 'none' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {Icon && (
              <div
                className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 ${iconBgClass}`}
              >
                <Icon className="w-5 h-5" />
              </div>
            )}
            <div className="min-w-0">
              <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
                {title}
              </h3>
              {subtitle && (
                <div className="text-xs text-slate-500 dark:text-zinc-400 truncate mt-0.5">
                  {subtitle}
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors flex-shrink-0 ml-2"
            title="Zavřít"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body (s horizontální safe-zone px-1.5 -mx-1.5 proti oříznutí outline / focus ringu) */}
        <div className="overflow-y-auto py-4 px-1.5 -mx-1.5 flex-1 space-y-4">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="pt-3 flex items-center justify-end gap-2.5 flex-shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

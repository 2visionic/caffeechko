import { forwardRef, type ButtonHTMLAttributes, type ComponentType } from 'react';
import { Loader2, type LucideProps } from 'lucide-react';
import type { ColorKey } from '../../config/presenceConfig';

export type ButtonVariant = 'filled' | 'surface' | 'outline' | 'default' | 'ghost';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'hero' | 'icon' | 'icon-sm' | 'icon-lg';
export type ButtonColorKey = ColorKey | 'primary';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual variant of the button */
  variant?: ButtonVariant;
  /** Size scale */
  size?: ButtonSize;
  /** Semantic color key (used for filled bg, default icon color, or accent tone) */
  colorKey?: ButtonColorKey;
  /** Lucide icon component */
  icon?: ComponentType<LucideProps>;
  /** Position of the icon */
  iconPosition?: 'left' | 'right';
  /** Extra class for the icon */
  iconClassName?: string;
  /** Whether the button is in a loading state */
  loading?: boolean;
  /** Full width expansion */
  fullWidth?: boolean;
}

const FILLED_COLOR_CLASSES: Record<ButtonColorKey, string> = {
  primary: 'bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 font-bold shadow-sm',
  amber: 'bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 font-bold shadow-sm',
  emerald: 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold shadow-sm',
  rose: 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-semibold shadow-sm',
  red: 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-semibold shadow-sm',
  sky: 'bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white font-semibold shadow-sm',
  indigo: 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold shadow-sm',
  purple: 'bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white font-semibold shadow-sm',
  slate: 'bg-slate-800 hover:bg-slate-900 active:bg-slate-950 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-white font-semibold shadow-sm'
};

const DEFAULT_ICON_COLOR_CLASSES: Record<ButtonColorKey, string> = {
  primary: 'text-amber-500 dark:text-amber-400',
  amber: 'text-amber-500 dark:text-amber-400',
  emerald: 'text-emerald-600 dark:text-emerald-400',
  rose: 'text-rose-600 dark:text-rose-400',
  red: 'text-rose-600 dark:text-rose-400',
  sky: 'text-sky-500 dark:text-sky-400',
  indigo: 'text-indigo-500 dark:text-indigo-400',
  purple: 'text-purple-500 dark:text-purple-400',
  slate: 'text-slate-600 dark:text-zinc-400'
};

const OUTLINE_COLOR_CLASSES: Record<ButtonColorKey, string> = {
  primary: 'border-amber-500/40 text-amber-800 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/30',
  amber: 'border-amber-500/40 text-amber-800 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/30',
  emerald: 'border-emerald-500/40 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30',
  rose: 'border-rose-500/40 text-rose-800 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/30',
  red: 'border-rose-500/40 text-rose-800 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/30',
  sky: 'border-sky-500/40 text-sky-800 dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-sky-950/30',
  indigo: 'border-indigo-500/40 text-indigo-800 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/30',
  purple: 'border-purple-500/40 text-purple-800 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/30',
  slate: 'border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800'
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  xs: 'h-7 px-2.5 text-xs rounded-lg gap-1.5',
  sm: 'h-8 px-3 text-xs font-medium rounded-xl gap-1.5',
  md: 'h-10 px-4 text-xs font-semibold rounded-xl gap-2',
  lg: 'h-12 px-5 text-sm font-semibold rounded-2xl gap-2.5',
  hero: 'h-16 px-6 text-lg font-semibold rounded-full gap-3 shadow-md',
  icon: 'w-10 h-10 p-0 rounded-xl justify-center',
  'icon-sm': 'w-8 h-8 p-0 rounded-lg justify-center',
  'icon-lg': 'w-12 h-12 p-0 rounded-2xl justify-center'
};

const ICON_SIZE_CLASSES: Record<ButtonSize, string> = {
  xs: 'w-3.5 h-3.5',
  sm: 'w-4 h-4',
  md: 'w-4.5 h-4.5',
  lg: 'w-5 h-5',
  hero: 'w-6 h-6',
  icon: 'w-5 h-5',
  'icon-sm': 'w-4 h-4',
  'icon-lg': 'w-6 h-6'
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'default',
    size = 'md',
    colorKey,
    icon: Icon,
    iconPosition = 'left',
    iconClassName = '',
    loading = false,
    disabled = false,
    fullWidth = false,
    className = '',
    children,
    type = 'button',
    ...props
  },
  ref
) {
  const isIconOnly = size.startsWith('icon');

  // Compute variant classes
  let variantClass = '';
  let defaultIconColor = '';

  switch (variant) {
    case 'filled': {
      const key = colorKey || 'primary';
      variantClass = FILLED_COLOR_CLASSES[key];
      break;
    }
    case 'surface': {
      if (colorKey && colorKey !== 'slate') {
        // Light tonal surface tinted by colorKey
        const key = colorKey;
        const colorToneMap: Record<string, string> = {
          emerald: 'bg-emerald-500/10 hover:bg-emerald-500/15 text-emerald-900 dark:text-emerald-300',
          rose: 'bg-rose-500/10 hover:bg-rose-500/15 text-rose-900 dark:text-rose-300',
          sky: 'bg-sky-500/10 hover:bg-sky-500/15 text-sky-900 dark:text-sky-300',
          amber: 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-950 dark:text-amber-300',
          primary: 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-950 dark:text-amber-300',
          indigo: 'bg-indigo-500/10 hover:bg-indigo-500/15 text-indigo-900 dark:text-indigo-300',
          purple: 'bg-purple-500/10 hover:bg-purple-500/15 text-purple-900 dark:text-purple-300'
        };
        variantClass = colorToneMap[key] || 'bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200';
      } else {
        variantClass = 'bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200';
      }
      break;
    }
    case 'outline': {
      const key = colorKey || 'slate';
      variantClass = `bg-transparent border ${OUTLINE_COLOR_CLASSES[key]}`;
      break;
    }
    case 'ghost': {
      variantClass = 'bg-transparent hover:bg-slate-100 dark:hover:bg-zinc-800/80 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100';
      if (colorKey) {
        defaultIconColor = DEFAULT_ICON_COLOR_CLASSES[colorKey];
      }
      break;
    }
    case 'default':
    default: {
      // Neutral gray/surface container background, theme-based text, inherited color for icon
      variantClass = 'bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300';
      if (colorKey) {
        defaultIconColor = DEFAULT_ICON_COLOR_CLASSES[colorKey];
      }
      break;
    }
  }

  const baseClasses = 'inline-flex items-center select-none font-sans transition-all duration-150 active:scale-[0.98] outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900';
  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;
  const iconSizeClass = ICON_SIZE_CLASSES[size] || ICON_SIZE_CLASSES.md;
  const stateClass = (disabled || loading) ? 'opacity-50 pointer-events-none cursor-not-allowed active:scale-100' : 'cursor-pointer';
  const widthClass = fullWidth ? 'w-full justify-center' : '';

  const renderIcon = () => {
    if (loading) {
      return <Loader2 className={`${iconSizeClass} animate-spin flex-shrink-0`} />;
    }
    if (Icon) {
      return <Icon className={`${iconSizeClass} flex-shrink-0 ${defaultIconColor} ${iconClassName}`} />;
    }
    return null;
  };

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={`${baseClasses} ${variantClass} ${sizeClass} ${stateClass} ${widthClass} ${className}`}
      {...props}
    >
      {iconPosition === 'left' && renderIcon()}
      {!isIconOnly && children && <span>{children}</span>}
      {isIconOnly && !children && renderIcon()}
      {iconPosition === 'right' && renderIcon()}
    </button>
  );
});

Button.displayName = 'Button';

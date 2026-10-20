import { forwardRef, type ButtonHTMLAttributes, type ComponentType } from 'react';
import { Loader2, type LucideProps } from 'lucide-react';
import type { ColorKey } from '../../config/presenceConfig';

export type ButtonVariant = 'transparent' | 'outline' | 'filled' | 'surface' | 'ghost' | 'text' | 'default';
export type ButtonSize = 'small' | 'normal' | 'big' | 'sm' | 'md' | 'lg' | 'xs' | 'hero' | 'icon' | 'icon-sm' | 'icon-lg';
export type ButtonWidth = 'full' | 'half' | 'auto';
export type ButtonColorKey = ColorKey | 'primary' | 'red';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * Styl tlačítka:
   * - 'transparent': bez rámečku a bez pozadí (čistý text s hover efektem)
   * - 'outline': průhledné pozadí s tenkým rámečkem
   * - 'filled': plné barevné pozadí (výchozí pro primární akce)
   * - 'surface': jemné tónované podbarvení dle barvy
   */
  variant?: ButtonVariant;
  /**
   * Velikost tlačítka:
   * - 'small' (sm): výška 32px (kompaktní tlačítko)
   * - 'normal' (md): výška 40px (výchozí standardní velikost)
   * - 'big' (lg): výška 48px (velké výrazné tlačítko)
   */
  size?: ButtonSize;
  /**
   * Šířka tlačítka:
   * - 'full': 100% šířka kontejneru
   * - 'half': 50% šířka (ideální pro 2 tlačítka vedle sebe v modálu)
   * - 'auto': přizpůsobeno obsahu/textu
   */
  width?: ButtonWidth;
  /**
   * Barva tlačítka:
   * - 'primary' / 'amber': žlutá/jantarová (hlavní firemní barva)
   * - 'rose' / 'red': červená (pro Zrušit, Zavřít, Smazat)
   * - 'emerald': zelená (pro Schválit, Potvrdit)
   * - 'sky': modrá
   * - 'slate': neutrální šedá
   */
  color?: ButtonColorKey;
  /** Alias pro prop color */
  colorKey?: ButtonColorKey;
  /** Lucide ikona */
  icon?: ComponentType<LucideProps>;
  /** Umístění ikony: 'left' | 'right' */
  iconPosition?: 'left' | 'right';
  /** Dodatečná třída pro ikonu */
  iconClassName?: string;
  /** Zda je tlačítko ve stavu načítání */
  loading?: boolean;
  /** Zpětná kompatibilita pro width="full" */
  fullWidth?: boolean;
}

const FILLED_COLOR_CLASSES: Record<ButtonColorKey, string> = {
  primary: 'bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 font-bold shadow-sm',
  amber: 'bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 font-bold shadow-sm',
  orange: 'bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white font-semibold shadow-sm',
  emerald: 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold shadow-sm',
  green: 'bg-green-600 hover:bg-green-700 active:bg-green-800 text-white font-semibold shadow-sm',
  lime: 'bg-lime-500 hover:bg-lime-600 active:bg-lime-700 text-slate-950 font-bold shadow-sm',
  teal: 'bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white font-semibold shadow-sm',
  cyan: 'bg-cyan-600 hover:bg-cyan-700 active:bg-cyan-800 text-white font-semibold shadow-sm',
  rose: 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-semibold shadow-sm',
  red: 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-semibold shadow-sm',
  pink: 'bg-pink-600 hover:bg-pink-700 active:bg-pink-800 text-white font-semibold shadow-sm',
  fuchsia: 'bg-fuchsia-600 hover:bg-fuchsia-700 active:bg-fuchsia-800 text-white font-semibold shadow-sm',
  sky: 'bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white font-semibold shadow-sm',
  blue: 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold shadow-sm',
  indigo: 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold shadow-sm',
  violet: 'bg-violet-600 hover:bg-violet-700 active:bg-violet-800 text-white font-semibold shadow-sm',
  purple: 'bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white font-semibold shadow-sm',
  slate: 'bg-slate-800 hover:bg-slate-900 active:bg-slate-950 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-white font-semibold shadow-sm',
  zinc: 'bg-zinc-800 hover:bg-zinc-900 active:bg-zinc-950 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-white font-semibold shadow-sm'
};

const DEFAULT_ICON_COLOR_CLASSES: Record<ButtonColorKey, string> = {
  primary: 'text-amber-500 dark:text-amber-400',
  amber: 'text-amber-500 dark:text-amber-400',
  orange: 'text-orange-500 dark:text-orange-400',
  emerald: 'text-emerald-600 dark:text-emerald-400',
  green: 'text-green-600 dark:text-green-400',
  lime: 'text-lime-600 dark:text-lime-400',
  teal: 'text-teal-600 dark:text-teal-400',
  cyan: 'text-cyan-600 dark:text-cyan-400',
  rose: 'text-rose-600 dark:text-rose-400',
  red: 'text-rose-600 dark:text-rose-400',
  pink: 'text-pink-600 dark:text-pink-400',
  fuchsia: 'text-fuchsia-600 dark:text-fuchsia-400',
  sky: 'text-sky-500 dark:text-sky-400',
  blue: 'text-blue-600 dark:text-blue-400',
  indigo: 'text-indigo-500 dark:text-indigo-400',
  violet: 'text-violet-500 dark:text-violet-400',
  purple: 'text-purple-500 dark:text-purple-400',
  slate: 'text-slate-600 dark:text-zinc-400',
  zinc: 'text-zinc-600 dark:text-zinc-400'
};

const OUTLINE_COLOR_CLASSES: Record<ButtonColorKey, string> = {
  primary: 'border-amber-500/40 text-amber-800 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/30',
  amber: 'border-amber-500/40 text-amber-800 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/30',
  orange: 'border-orange-500/40 text-orange-800 dark:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-950/30',
  emerald: 'border-emerald-500/40 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30',
  green: 'border-green-500/40 text-green-800 dark:text-green-300 hover:bg-green-50 dark:hover:bg-green-950/30',
  lime: 'border-lime-500/40 text-lime-800 dark:text-lime-300 hover:bg-lime-50 dark:hover:bg-lime-950/30',
  teal: 'border-teal-500/40 text-teal-800 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950/30',
  cyan: 'border-cyan-500/40 text-cyan-800 dark:text-cyan-300 hover:bg-cyan-50 dark:hover:bg-cyan-950/30',
  rose: 'border-rose-500/40 text-rose-800 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/30',
  red: 'border-rose-500/40 text-rose-800 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/30',
  pink: 'border-pink-500/40 text-pink-800 dark:text-pink-300 hover:bg-pink-50 dark:hover:bg-pink-950/30',
  fuchsia: 'border-fuchsia-500/40 text-fuchsia-800 dark:text-fuchsia-300 hover:bg-fuchsia-50 dark:hover:bg-fuchsia-950/30',
  sky: 'border-sky-500/40 text-sky-800 dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-sky-950/30',
  blue: 'border-blue-500/40 text-blue-800 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/30',
  indigo: 'border-indigo-500/40 text-indigo-800 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/30',
  violet: 'border-violet-500/40 text-violet-800 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-950/30',
  purple: 'border-purple-500/40 text-purple-800 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/30',
  slate: 'border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800',
  zinc: 'border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
};

const SIZE_CLASSES: Record<string, string> = {
  xs: 'h-7 px-2.5 text-xs rounded-lg gap-1.5',
  sm: 'h-8 px-3 text-xs font-medium rounded-xl gap-1.5',
  small: 'h-8 px-3 text-xs font-medium rounded-xl gap-1.5',
  md: 'h-10 px-4 text-sm font-semibold rounded-xl gap-2',
  normal: 'h-10 px-4 text-sm font-semibold rounded-xl gap-2',
  lg: 'h-12 px-5 text-sm font-semibold rounded-2xl gap-2.5',
  big: 'h-12 px-5 text-sm font-semibold rounded-2xl gap-2.5',
  hero: 'h-16 px-6 text-lg font-semibold rounded-full gap-3 shadow-md',
  icon: 'w-10 h-10 p-0 rounded-xl justify-center',
  'icon-sm': 'w-8 h-8 p-0 rounded-lg justify-center',
  'icon-lg': 'w-12 h-12 p-0 rounded-2xl justify-center'
};

const ICON_SIZE_CLASSES: Record<string, string> = {
  xs: 'w-3.5 h-3.5',
  sm: 'w-4 h-4',
  small: 'w-4 h-4',
  md: 'w-4.5 h-4.5',
  normal: 'w-4.5 h-4.5',
  lg: 'w-5 h-5',
  big: 'w-5 h-5',
  hero: 'w-6 h-6',
  icon: 'w-5 h-5',
  'icon-sm': 'w-4 h-4',
  'icon-lg': 'w-6 h-6'
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'default',
    size = 'normal',
    width = 'auto',
    color,
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
  const resolvedColor = color || colorKey;
  const isIconOnly = size.startsWith('icon');

  // Compute variant classes
  let variantClass = '';
  let defaultIconColor = '';

  switch (variant) {
    case 'filled': {
      const key = resolvedColor || 'primary';
      variantClass = FILLED_COLOR_CLASSES[key] || FILLED_COLOR_CLASSES.primary;
      break;
    }
    case 'surface': {
      if (resolvedColor && resolvedColor !== 'slate') {
        const key = resolvedColor;
        const colorToneMap: Record<string, string> = {
          emerald: 'bg-emerald-500/10 hover:bg-emerald-500/15 text-emerald-900 dark:text-emerald-300',
          rose: 'bg-rose-500/10 hover:bg-rose-500/15 text-rose-900 dark:text-rose-300',
          red: 'bg-rose-500/10 hover:bg-rose-500/15 text-rose-900 dark:text-rose-300',
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
      if (resolvedColor) {
        defaultIconColor = DEFAULT_ICON_COLOR_CLASSES[resolvedColor] || '';
      }
      break;
    }
    case 'outline': {
      const key = resolvedColor || 'slate';
      variantClass = `bg-transparent border ${OUTLINE_COLOR_CLASSES[key] || OUTLINE_COLOR_CLASSES.slate}`;
      break;
    }
    case 'transparent':
    case 'text':
    case 'ghost': {
      if (resolvedColor === 'rose' || resolvedColor === 'red') {
        variantClass = 'bg-transparent text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 font-medium transition-colors';
      } else if (resolvedColor === 'emerald') {
        variantClass = 'bg-transparent text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 font-medium transition-colors';
      } else if (resolvedColor === 'primary' || resolvedColor === 'amber') {
        variantClass = 'bg-transparent text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 font-medium transition-colors';
      } else if (resolvedColor === 'sky') {
        variantClass = 'bg-transparent text-sky-600 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300 font-medium transition-colors';
      } else {
        variantClass = 'bg-transparent text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-100 font-medium transition-colors';
      }
      if (resolvedColor) {
        defaultIconColor = DEFAULT_ICON_COLOR_CLASSES[resolvedColor] || '';
      }
      break;
    }
    case 'default':
    default: {
      variantClass = 'bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-900 dark:text-white';
      if (resolvedColor) {
        defaultIconColor = DEFAULT_ICON_COLOR_CLASSES[resolvedColor] || '';
      }
      break;
    }
  }

  const baseClasses = 'inline-flex items-center justify-center select-none font-sans transition-all duration-150 active:scale-[0.98] outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900';
  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.normal;
  const iconSizeClass = ICON_SIZE_CLASSES[size] || ICON_SIZE_CLASSES.normal;
  const stateClass = (disabled || loading) ? 'opacity-50 pointer-events-none cursor-not-allowed active:scale-100' : 'cursor-pointer';

  // Compute width class
  const resolvedWidth = width || (fullWidth ? 'full' : 'auto');
  const widthClass =
    resolvedWidth === 'full'
      ? 'w-full'
      : resolvedWidth === 'half'
      ? 'w-full sm:w-1/2 flex-1'
      : '';

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
      {isIconOnly ? (
        Icon || loading ? renderIcon() : children
      ) : (
        <>
          {iconPosition === 'left' && renderIcon()}
          {children && <span>{children}</span>}
          {iconPosition === 'right' && renderIcon()}
        </>
      )}
    </button>
  );
});

Button.displayName = 'Button';

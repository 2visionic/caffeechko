import type { ComponentType } from 'react';
import {
  MapPin,
  Home,
  Palmtree,
  Thermometer,
  Pill,
  Stethoscope,
  CalendarX,
  UserX,
  Coffee,
  Footprints,
  DoorOpen,
  Sparkles,
  Briefcase,
  GraduationCap,
  Baby,
  Heart,
  Plane,
  Award,
  Clock,
  Umbrella,
  BookOpen,
  Calendar,
  type LucideProps
} from 'lucide-react';

export type PresenceType = 'office' | 'home_office' | 'offline';
export type AbsenceType = 'vacation' | 'sick_day' | 'illness' | 'doctor' | 'unpaid_leave' | string;
export type StatusType = PresenceType | AbsenceType | 'break' | 'holiday';

export type ActivityCategory = 'work' | 'absence' | 'break' | 'offline';

export type ColorKey =
  | 'emerald'
  | 'green'
  | 'lime'
  | 'teal'
  | 'cyan'
  | 'sky'
  | 'blue'
  | 'indigo'
  | 'violet'
  | 'purple'
  | 'fuchsia'
  | 'pink'
  | 'rose'
  | 'red'
  | 'orange'
  | 'amber'
  | 'slate'
  | 'zinc';

export const ABSENCE_ICON_MAP: Record<string, ComponentType<LucideProps>> = {
  Palmtree,
  Thermometer,
  Stethoscope,
  Home,
  CalendarX,
  Pill,
  Briefcase,
  GraduationCap,
  Baby,
  Heart,
  Plane,
  Award,
  Clock,
  Sparkles,
  Umbrella,
  BookOpen,
  Calendar,
  MapPin,
  Coffee
};

export const ABSENCE_ICON_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'Palmtree', label: 'Palma (Dovolená)' },
  { value: 'Thermometer', label: 'Teploměr (Sick day)' },
  { value: 'Stethoscope', label: 'Fonendoskop (Lékař)' },
  { value: 'Home', label: 'Domov (Home Office)' },
  { value: 'CalendarX', label: 'Kalendář s křížkem (Neplacené)' },
  { value: 'Pill', label: 'Pilulka (Nemoc)' },
  { value: 'GraduationCap', label: 'Studium / Školení' },
  { value: 'Briefcase', label: 'Pracovní cesta' },
  { value: 'Baby', label: 'Ošetřování / Rodina' },
  { value: 'Heart', label: 'Srdce / Péče' },
  { value: 'Plane', label: 'Letadlo / Cesta' },
  { value: 'Award', label: 'Ocenění / Sabbatical' },
  { value: 'Clock', label: 'Hodiny / Náhradní volno' },
  { value: 'Umbrella', label: 'Deštník / Volno' },
  { value: 'BookOpen', label: 'Kniha / Samostudium' },
  { value: 'Sparkles', label: 'Hvězdičky / Speciální' }
];

export const ABSENCE_COLOR_OPTIONS: Array<{ value: ColorKey; label: string; dotClass: string }> = [
  { value: 'amber', label: 'Jantarová (Amber)', dotClass: 'bg-amber-500' },
  { value: 'orange', label: 'Oranžová (Orange)', dotClass: 'bg-orange-500' },
  { value: 'rose', label: 'Růžovo-červená (Rose)', dotClass: 'bg-rose-500' },
  { value: 'red', label: 'Červená (Red)', dotClass: 'bg-red-500' },
  { value: 'pink', label: 'Růžová (Pink)', dotClass: 'bg-pink-500' },
  { value: 'fuchsia', label: 'Fuchsiová (Fuchsia)', dotClass: 'bg-fuchsia-500' },
  { value: 'purple', label: 'Fialová (Purple)', dotClass: 'bg-purple-500' },
  { value: 'violet', label: 'Fialkově modrá (Violet)', dotClass: 'bg-violet-500' },
  { value: 'indigo', label: 'Indigová (Indigo)', dotClass: 'bg-indigo-500' },
  { value: 'blue', label: 'Královská modrá (Blue)', dotClass: 'bg-blue-600' },
  { value: 'sky', label: 'Blankytná (Sky)', dotClass: 'bg-sky-500' },
  { value: 'cyan', label: 'Azurová (Cyan)', dotClass: 'bg-cyan-500' },
  { value: 'teal', label: 'Tyrkysová (Teal)', dotClass: 'bg-teal-500' },
  { value: 'emerald', label: 'Smaragdová (Emerald)', dotClass: 'bg-emerald-500' },
  { value: 'green', label: 'Zelená (Green)', dotClass: 'bg-green-600' },
  { value: 'lime', label: 'Limetková (Lime)', dotClass: 'bg-lime-500' },
  { value: 'slate', label: 'Břidlicová (Slate)', dotClass: 'bg-slate-500' },
  { value: 'zinc', label: 'Tmavě šedá (Zinc)', dotClass: 'bg-zinc-600' }
];

export function resolveIconComponent(iconName?: string | null): ComponentType<LucideProps> {
  if (!iconName) return Palmtree;
  return ABSENCE_ICON_MAP[iconName] || Palmtree;
}

export function buildStatusVisualClasses(colorKey: ColorKey) {
  switch (colorKey) {
    case 'emerald':
      return {
        dotClass: 'bg-emerald-500',
        badgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
        chipActiveClass: 'bg-emerald-600 text-white shadow-sm',
        chipInactiveClass: 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-500/20',
        statIconBgClass: 'bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
        iconColorClass: 'text-emerald-500 dark:text-emerald-400',
        buttonActiveClass: 'bg-emerald-500/20 text-emerald-900 dark:text-emerald-300 font-bold ring-2 ring-emerald-500/30 shadow-sm'
      };
    case 'sky':
      return {
        dotClass: 'bg-sky-500',
        badgeClass: 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300',
        chipActiveClass: 'bg-sky-600 text-white shadow-sm',
        chipInactiveClass: 'bg-sky-500/10 text-sky-800 dark:text-sky-300 hover:bg-sky-500/20',
        statIconBgClass: 'bg-sky-500/10 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400',
        iconColorClass: 'text-sky-500 dark:text-sky-400',
        buttonActiveClass: 'bg-sky-500/20 text-sky-900 dark:text-sky-300 font-bold ring-2 ring-sky-500/30 shadow-sm'
      };
    case 'rose':
      return {
        dotClass: 'bg-rose-500',
        badgeClass: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300',
        chipActiveClass: 'bg-rose-600 text-white shadow-sm',
        chipInactiveClass: 'bg-rose-500/10 text-rose-800 dark:text-rose-300 hover:bg-rose-500/20',
        statIconBgClass: 'bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400',
        iconColorClass: 'text-rose-500 dark:text-rose-400',
        buttonActiveClass: 'bg-rose-500/20 text-rose-900 dark:text-rose-300 font-bold ring-2 ring-rose-500/30 shadow-sm'
      };
    case 'red':
      return {
        dotClass: 'bg-red-500',
        badgeClass: 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300',
        chipActiveClass: 'bg-red-600 text-white shadow-sm',
        chipInactiveClass: 'bg-red-500/10 text-red-800 dark:text-red-300 hover:bg-red-500/20',
        statIconBgClass: 'bg-red-500/10 dark:bg-red-500/20 text-red-600 dark:text-red-400',
        iconColorClass: 'text-red-500 dark:text-red-400',
        buttonActiveClass: 'bg-red-500/20 text-red-900 dark:text-red-300 font-bold ring-2 ring-red-500/30 shadow-sm'
      };
    case 'indigo':
      return {
        dotClass: 'bg-indigo-500',
        badgeClass: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300',
        chipActiveClass: 'bg-indigo-600 text-white shadow-sm',
        chipInactiveClass: 'bg-indigo-500/10 text-indigo-800 dark:text-indigo-300 hover:bg-indigo-500/20',
        statIconBgClass: 'bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400',
        iconColorClass: 'text-indigo-500 dark:text-indigo-400',
        buttonActiveClass: 'bg-indigo-500/20 text-indigo-900 dark:text-indigo-300 font-bold ring-2 ring-indigo-500/30 shadow-sm'
      };
    case 'purple':
      return {
        dotClass: 'bg-purple-500',
        badgeClass: 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300',
        chipActiveClass: 'bg-purple-600 text-white shadow-sm',
        chipInactiveClass: 'bg-purple-500/10 text-purple-800 dark:text-purple-300 hover:bg-purple-500/20',
        statIconBgClass: 'bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400',
        iconColorClass: 'text-purple-500 dark:text-purple-400',
        buttonActiveClass: 'bg-purple-500/20 text-purple-900 dark:text-purple-300 font-bold ring-2 ring-purple-500/30 shadow-sm'
      };
    case 'slate':
      return {
        dotClass: 'bg-slate-400',
        badgeClass: 'bg-slate-200/70 text-slate-700 dark:bg-zinc-700 dark:text-zinc-300',
        chipActiveClass: 'bg-slate-600 text-white shadow-sm',
        chipInactiveClass: 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200/70 dark:hover:bg-zinc-700 dark:hover:text-zinc-200',
        statIconBgClass: 'bg-slate-500/10 dark:bg-slate-500/20 text-slate-600 dark:text-slate-400',
        iconColorClass: 'text-slate-400 dark:text-slate-500',
        buttonActiveClass: 'bg-slate-500/20 text-slate-900 dark:text-slate-300 font-bold ring-2 ring-slate-500/30 shadow-sm'
      };
    case 'zinc':
      return {
        dotClass: 'bg-zinc-600',
        badgeClass: 'bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200',
        chipActiveClass: 'bg-zinc-700 text-white shadow-sm',
        chipInactiveClass: 'bg-zinc-500/10 text-zinc-800 dark:text-zinc-300 hover:bg-zinc-500/20',
        statIconBgClass: 'bg-zinc-500/10 dark:bg-zinc-500/20 text-zinc-600 dark:text-zinc-400',
        iconColorClass: 'text-zinc-500 dark:text-zinc-400',
        buttonActiveClass: 'bg-zinc-500/20 text-zinc-900 dark:text-zinc-300 font-bold ring-2 ring-zinc-500/30 shadow-sm'
      };
    case 'orange':
      return {
        dotClass: 'bg-orange-500',
        badgeClass: 'bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300',
        chipActiveClass: 'bg-orange-600 text-white shadow-sm',
        chipInactiveClass: 'bg-orange-500/10 text-orange-800 dark:text-orange-300 hover:bg-orange-500/20',
        statIconBgClass: 'bg-orange-500/10 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400',
        iconColorClass: 'text-orange-500 dark:text-orange-400',
        buttonActiveClass: 'bg-orange-500/20 text-orange-900 dark:text-orange-300 font-bold ring-2 ring-orange-500/30 shadow-sm'
      };
    case 'pink':
      return {
        dotClass: 'bg-pink-500',
        badgeClass: 'bg-pink-100 text-pink-800 dark:bg-pink-950/60 dark:text-pink-300',
        chipActiveClass: 'bg-pink-600 text-white shadow-sm',
        chipInactiveClass: 'bg-pink-500/10 text-pink-800 dark:text-pink-300 hover:bg-pink-500/20',
        statIconBgClass: 'bg-pink-500/10 dark:bg-pink-500/20 text-pink-600 dark:text-pink-400',
        iconColorClass: 'text-pink-500 dark:text-pink-400',
        buttonActiveClass: 'bg-pink-500/20 text-pink-900 dark:text-pink-300 font-bold ring-2 ring-pink-500/30 shadow-sm'
      };
    case 'fuchsia':
      return {
        dotClass: 'bg-fuchsia-500',
        badgeClass: 'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-950/60 dark:text-fuchsia-300',
        chipActiveClass: 'bg-fuchsia-600 text-white shadow-sm',
        chipInactiveClass: 'bg-fuchsia-500/10 text-fuchsia-800 dark:text-fuchsia-300 hover:bg-fuchsia-500/20',
        statIconBgClass: 'bg-fuchsia-500/10 dark:bg-fuchsia-500/20 text-fuchsia-600 dark:text-fuchsia-400',
        iconColorClass: 'text-fuchsia-500 dark:text-fuchsia-400',
        buttonActiveClass: 'bg-fuchsia-500/20 text-fuchsia-900 dark:text-fuchsia-300 font-bold ring-2 ring-fuchsia-500/30 shadow-sm'
      };
    case 'violet':
      return {
        dotClass: 'bg-violet-500',
        badgeClass: 'bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-300',
        chipActiveClass: 'bg-violet-600 text-white shadow-sm',
        chipInactiveClass: 'bg-violet-500/10 text-violet-800 dark:text-violet-300 hover:bg-violet-500/20',
        statIconBgClass: 'bg-violet-500/10 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400',
        iconColorClass: 'text-violet-500 dark:text-violet-400',
        buttonActiveClass: 'bg-violet-500/20 text-violet-900 dark:text-violet-300 font-bold ring-2 ring-violet-500/30 shadow-sm'
      };
    case 'blue':
      return {
        dotClass: 'bg-blue-600',
        badgeClass: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300',
        chipActiveClass: 'bg-blue-600 text-white shadow-sm',
        chipInactiveClass: 'bg-blue-500/10 text-blue-800 dark:text-blue-300 hover:bg-blue-500/20',
        statIconBgClass: 'bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400',
        iconColorClass: 'text-blue-600 dark:text-blue-400',
        buttonActiveClass: 'bg-blue-500/20 text-blue-900 dark:text-blue-300 font-bold ring-2 ring-blue-500/30 shadow-sm'
      };
    case 'cyan':
      return {
        dotClass: 'bg-cyan-500',
        badgeClass: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300',
        chipActiveClass: 'bg-cyan-600 text-white shadow-sm',
        chipInactiveClass: 'bg-cyan-500/10 text-cyan-800 dark:text-cyan-300 hover:bg-cyan-500/20',
        statIconBgClass: 'bg-cyan-500/10 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400',
        iconColorClass: 'text-cyan-500 dark:text-cyan-400',
        buttonActiveClass: 'bg-cyan-500/20 text-cyan-900 dark:text-cyan-300 font-bold ring-2 ring-cyan-500/30 shadow-sm'
      };
    case 'teal':
      return {
        dotClass: 'bg-teal-500',
        badgeClass: 'bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300',
        chipActiveClass: 'bg-teal-600 text-white shadow-sm',
        chipInactiveClass: 'bg-teal-500/10 text-teal-800 dark:text-teal-300 hover:bg-teal-500/20',
        statIconBgClass: 'bg-teal-500/10 dark:bg-teal-500/20 text-teal-600 dark:text-teal-400',
        iconColorClass: 'text-teal-500 dark:text-teal-400',
        buttonActiveClass: 'bg-teal-500/20 text-teal-900 dark:text-teal-300 font-bold ring-2 ring-teal-500/30 shadow-sm'
      };
    case 'green':
      return {
        dotClass: 'bg-green-600',
        badgeClass: 'bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300',
        chipActiveClass: 'bg-green-600 text-white shadow-sm',
        chipInactiveClass: 'bg-green-500/10 text-green-800 dark:text-green-300 hover:bg-green-500/20',
        statIconBgClass: 'bg-green-500/10 dark:bg-green-500/20 text-green-600 dark:text-green-400',
        iconColorClass: 'text-green-600 dark:text-green-400',
        buttonActiveClass: 'bg-green-500/20 text-green-900 dark:text-green-300 font-bold ring-2 ring-green-500/30 shadow-sm'
      };
    case 'lime':
      return {
        dotClass: 'bg-lime-500',
        badgeClass: 'bg-lime-100 text-lime-800 dark:bg-lime-950/60 dark:text-lime-300',
        chipActiveClass: 'bg-lime-600 text-white shadow-sm',
        chipInactiveClass: 'bg-lime-500/10 text-lime-800 dark:text-lime-300 hover:bg-lime-500/20',
        statIconBgClass: 'bg-lime-500/10 dark:bg-lime-500/20 text-lime-600 dark:text-lime-400',
        iconColorClass: 'text-lime-500 dark:text-lime-400',
        buttonActiveClass: 'bg-lime-500/20 text-lime-900 dark:text-lime-300 font-bold ring-2 ring-lime-500/30 shadow-sm'
      };
    case 'amber':
    default:
      return {
        dotClass: 'bg-amber-500',
        badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
        chipActiveClass: 'bg-amber-600 text-white shadow-sm',
        chipInactiveClass: 'bg-amber-500/10 text-amber-800 dark:text-amber-300 hover:bg-amber-500/20',
        statIconBgClass: 'bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400',
        iconColorClass: 'text-amber-500 dark:text-amber-400',
        buttonActiveClass: 'bg-amber-500/20 text-amber-900 dark:text-amber-300 font-bold ring-2 ring-amber-500/30 shadow-sm'
      };
  }
}

export interface StatusConfig {
  type: StatusType;
  label: string;
  shortLabel: string;
  icon: ComponentType<LucideProps>;
  colorKey: ColorKey;
  category: ActivityCategory;
  /** Whether hours spent in this status count toward the monthly/daily working fund */
  countsTowardFund: boolean;
  dotClass: string;
  badgeClass: string;
  chipActiveClass: string;
  chipInactiveClass: string;
  statIconBgClass: string;
  iconColorClass: string;
  buttonActiveClass: string;
}

export const STATUS_CONFIG_MAP: Record<string, StatusConfig> = {
  // 1. V kanceláři (Office) - Emerald
  office: {
    type: 'office',
    label: 'V kanceláři',
    shortLabel: 'Kancelář',
    icon: MapPin,
    colorKey: 'emerald',
    category: 'work',
    countsTowardFund: true,
    dotClass: 'bg-emerald-500',
    badgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
    chipActiveClass: 'bg-emerald-600 text-white shadow-sm',
    chipInactiveClass: 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-500/20',
    statIconBgClass: 'bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
    iconColorClass: 'text-emerald-500 dark:text-emerald-400',
    buttonActiveClass: 'bg-emerald-500/20 text-emerald-900 dark:text-emerald-300 font-bold ring-2 ring-emerald-500/30 shadow-sm'
  },

  // 2. Home Office - Sky
  home_office: {
    type: 'home_office',
    label: 'Home Office',
    shortLabel: 'Home Office',
    icon: Home,
    colorKey: 'sky',
    category: 'work',
    countsTowardFund: true,
    dotClass: 'bg-sky-500',
    badgeClass: 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300',
    chipActiveClass: 'bg-sky-600 text-white shadow-sm',
    chipInactiveClass: 'bg-sky-500/10 text-sky-800 dark:text-sky-300 hover:bg-sky-500/20',
    statIconBgClass: 'bg-sky-500/10 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400',
    iconColorClass: 'text-sky-500 dark:text-sky-400',
    buttonActiveClass: 'bg-sky-500/20 text-sky-900 dark:text-sky-300 font-bold ring-2 ring-sky-500/30 shadow-sm'
  },

  // 3. Dovolená - Amber
  vacation: {
    type: 'vacation',
    label: 'Dovolená',
    shortLabel: 'Dovolená',
    icon: Palmtree,
    colorKey: 'amber',
    category: 'absence',
    countsTowardFund: true, // 1 den = 8h započteno do fondu
    dotClass: 'bg-amber-500',
    badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
    chipActiveClass: 'bg-amber-600 text-white shadow-sm',
    chipInactiveClass: 'bg-amber-500/10 text-amber-800 dark:text-amber-300 hover:bg-amber-500/20',
    statIconBgClass: 'bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400',
    iconColorClass: 'text-amber-500 dark:text-amber-400',
    buttonActiveClass: 'bg-amber-500/20 text-amber-900 dark:text-amber-300 font-bold ring-2 ring-amber-500/30 shadow-sm'
  },

  // 4. Sick day - Rose
  sick_day: {
    type: 'sick_day',
    label: 'Sick day',
    shortLabel: 'Sick day',
    icon: Thermometer,
    colorKey: 'rose',
    category: 'absence',
    countsTowardFund: true, // placená indispozice
    dotClass: 'bg-rose-500',
    badgeClass: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300',
    chipActiveClass: 'bg-rose-600 text-white shadow-sm',
    chipInactiveClass: 'bg-rose-500/10 text-rose-800 dark:text-rose-300 hover:bg-rose-500/20',
    statIconBgClass: 'bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400',
    iconColorClass: 'text-rose-500 dark:text-rose-400',
    buttonActiveClass: 'bg-rose-500/20 text-rose-900 dark:text-rose-300 font-bold ring-2 ring-rose-500/30 shadow-sm'
  },

  // 5. Nemoc (Pracovní neschopnost / DPN) - Red
  illness: {
    type: 'illness',
    label: 'Nemoc',
    shortLabel: 'Nemoc',
    icon: Pill,
    colorKey: 'red',
    category: 'absence',
    countsTowardFund: false, // omluvená nepřítomnost (nemocenská)
    dotClass: 'bg-red-500',
    badgeClass: 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300',
    chipActiveClass: 'bg-red-600 text-white shadow-sm',
    chipInactiveClass: 'bg-red-500/10 text-red-800 dark:text-red-300 hover:bg-red-500/20',
    statIconBgClass: 'bg-red-500/10 dark:bg-red-500/20 text-red-600 dark:text-red-400',
    iconColorClass: 'text-red-500 dark:text-red-400',
    buttonActiveClass: 'bg-red-500/20 text-red-900 dark:text-red-300 font-bold ring-2 ring-red-500/30 shadow-sm'
  },

  // 6. U lékaře / Lékař - Indigo
  doctor: {
    type: 'doctor',
    label: 'Lékař',
    shortLabel: 'Lékař',
    icon: Stethoscope,
    colorKey: 'indigo',
    category: 'absence',
    countsTowardFund: true, // zákonem uznaná překážka (až 4h/den)
    dotClass: 'bg-indigo-500',
    badgeClass: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300',
    chipActiveClass: 'bg-indigo-600 text-white shadow-sm',
    chipInactiveClass: 'bg-indigo-500/10 text-indigo-800 dark:text-indigo-300 hover:bg-indigo-500/20',
    statIconBgClass: 'bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400',
    iconColorClass: 'text-indigo-500 dark:text-indigo-400',
    buttonActiveClass: 'bg-indigo-500/20 text-indigo-900 dark:text-indigo-300 font-bold ring-2 ring-indigo-500/30 shadow-sm'
  },

  // 7. Neplacené volno - Purple
  unpaid_leave: {
    type: 'unpaid_leave',
    label: 'Neplacené volno',
    shortLabel: 'Neplacené volno',
    icon: CalendarX,
    colorKey: 'purple',
    category: 'absence',
    countsTowardFund: false,
    dotClass: 'bg-purple-500',
    badgeClass: 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300',
    chipActiveClass: 'bg-purple-600 text-white shadow-sm',
    chipInactiveClass: 'bg-purple-500/10 text-purple-800 dark:text-purple-300 hover:bg-purple-500/20',
    statIconBgClass: 'bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400',
    iconColorClass: 'text-purple-500 dark:text-purple-400',
    buttonActiveClass: 'bg-purple-500/20 text-purple-900 dark:text-purple-300 font-bold ring-2 ring-purple-500/30 shadow-sm'
  },

  // 8. Pauza na oběd / Přestávka - Slate/Amber
  break: {
    type: 'break',
    label: 'Pauza na oběd',
    shortLabel: 'Pauza',
    icon: Coffee,
    colorKey: 'amber',
    category: 'break',
    countsTowardFund: false,
    dotClass: 'bg-amber-400',
    badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
    chipActiveClass: 'bg-amber-600 text-white shadow-sm',
    chipInactiveClass: 'bg-amber-500/10 text-amber-800 dark:text-amber-300 hover:bg-amber-500/20',
    statIconBgClass: 'bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400',
    iconColorClass: 'text-amber-500 dark:text-amber-400',
    buttonActiveClass: 'bg-amber-500/20 text-amber-900 dark:text-amber-300 font-bold ring-2 ring-amber-500/30 shadow-sm'
  },

  // 9. Mimo práci (Offline) - Slate
  offline: {
    type: 'offline',
    label: 'Mimo práci',
    shortLabel: 'Mimo práci',
    icon: UserX,
    colorKey: 'slate',
    category: 'offline',
    countsTowardFund: false,
    dotClass: 'bg-slate-400',
    badgeClass: 'bg-slate-200/70 text-slate-700 dark:bg-zinc-700 dark:text-zinc-300',
    chipActiveClass: 'bg-slate-600 text-white shadow-sm',
    chipInactiveClass: 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200/70 dark:hover:bg-zinc-700 dark:hover:text-zinc-200',
    statIconBgClass: 'bg-slate-500/10 dark:bg-slate-500/20 text-slate-600 dark:text-slate-400',
    iconColorClass: 'text-slate-400 dark:text-slate-500',
    buttonActiveClass: 'bg-slate-500/20 text-slate-900 dark:text-slate-300 font-bold ring-2 ring-slate-500/30 shadow-sm'
  },

  // 10. Státní svátek / Svátky - Amber
  holiday: {
    type: 'holiday',
    label: 'Státní svátek',
    shortLabel: 'Svátky',
    icon: Sparkles,
    colorKey: 'amber',
    category: 'absence',
    countsTowardFund: false,
    dotClass: 'bg-amber-500',
    badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
    chipActiveClass: 'bg-amber-600 text-white shadow-sm',
    chipInactiveClass: 'bg-amber-500/10 text-amber-800 dark:text-amber-300 hover:bg-amber-500/20',
    statIconBgClass: 'bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400',
    iconColorClass: 'text-amber-500 dark:text-amber-400',
    buttonActiveClass: 'bg-amber-500/20 text-amber-900 dark:text-amber-300 font-bold ring-2 ring-amber-500/30 shadow-sm'
  },

  // 11. Nedostupný (Důvěrná absence u ostatních osob) - Red
  unavailable: {
    type: 'unavailable',
    label: 'Nedostupný',
    shortLabel: 'Nedostupný',
    icon: UserX,
    colorKey: 'red',
    category: 'absence',
    countsTowardFund: false,
    dotClass: 'bg-red-500',
    badgeClass: 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300',
    chipActiveClass: 'bg-red-600 text-white shadow-sm',
    chipInactiveClass: 'bg-red-500/10 text-red-800 dark:text-red-300 hover:bg-red-500/20',
    statIconBgClass: 'bg-red-500/10 dark:bg-red-500/20 text-red-600 dark:text-red-400',
    iconColorClass: 'text-red-500 dark:text-red-400',
    buttonActiveClass: 'bg-red-500/20 text-red-900 dark:text-red-300 font-bold ring-2 ring-red-500/30 shadow-sm'
  }
};

/**
 * Synchronizes labels, icons, and colors in STATUS_CONFIG_MAP with absence_types loaded from DB.
 */
export function syncAbsenceTypeLabels(
  types:
    | Array<{ code: string; nameEmployee: string; icon?: string | null; color?: string | null }>
    | Record<string, { code: string; nameEmployee: string; icon?: string | null; color?: string | null }>
) {
  const list = Array.isArray(types) ? types : Object.values(types);
  for (const t of list) {
    const code = (t.code || '').trim().toLowerCase();
    if (!code) continue;
    const label = t.nameEmployee?.trim() || code;
    const colorKey = (t.color as ColorKey) || STATUS_CONFIG_MAP[code]?.colorKey || 'amber';
    const iconComp = t.icon ? resolveIconComponent(t.icon) : STATUS_CONFIG_MAP[code]?.icon || Palmtree;
    const visual = buildStatusVisualClasses(colorKey);

    if (code in STATUS_CONFIG_MAP) {
      STATUS_CONFIG_MAP[code] = {
        ...STATUS_CONFIG_MAP[code],
        label,
        shortLabel: label,
        icon: iconComp,
        colorKey,
        ...visual
      };
    } else {
      STATUS_CONFIG_MAP[code] = {
        type: code,
        label,
        shortLabel: label,
        icon: iconComp,
        colorKey,
        category: 'absence',
        countsTowardFund: true,
        ...visual
      };
    }
  }
}

/**
 * Punch actions dictionary (clock_in, clock_out, break)
 */
export type PunchType = 'clock_in' | 'clock_out' | 'break_start' | 'break_end';

export interface PunchConfig {
  type: PunchType;
  label: string;
  icon: ComponentType<LucideProps>;
  colorKey: 'emerald' | 'rose' | 'amber';
  buttonClass: string;
}

export const PUNCH_CONFIG_MAP: Record<PunchType, PunchConfig> = {
  clock_in: {
    type: 'clock_in',
    label: 'Příchod',
    icon: Footprints,
    colorKey: 'emerald',
    buttonClass: 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white'
  },
  clock_out: {
    type: 'clock_out',
    label: 'Odchod',
    icon: DoorOpen,
    colorKey: 'rose',
    buttonClass: 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white'
  },
  break_start: {
    type: 'break_start',
    label: 'Začátek pauzy',
    icon: Coffee,
    colorKey: 'amber',
    buttonClass: 'bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 font-bold'
  },
  break_end: {
    type: 'break_end',
    label: 'Konec pauzy',
    icon: Coffee,
    colorKey: 'amber',
    buttonClass: 'bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 font-bold'
  }
};

/**
 * Normalizes any raw type/code string and returns the unified StatusConfig.
 * Handles synonyms and case insensitivity safely with fallback to 'offline'.
 */
export function getStatusConfig(rawType: string | undefined | null): StatusConfig {
  if (!rawType) return STATUS_CONFIG_MAP.offline;
  const key = rawType.toLowerCase().trim();

  // Direct map hit
  if (key in STATUS_CONFIG_MAP) {
    return STATUS_CONFIG_MAP[key as StatusType];
  }

  // Match custom DB labels synced into STATUS_CONFIG_MAP
  for (const cfg of Object.values(STATUS_CONFIG_MAP)) {
    const lbl = cfg.label.toLowerCase().trim();
    const shortLbl = cfg.shortLabel.toLowerCase().trim();
    if (key === lbl || key === shortLbl || (lbl.length >= 3 && key.startsWith(lbl))) {
      return cfg;
    }
  }

  // Exact known aliases
  if (key === 'kancelar' || key === 'kancelář' || key === 'prace' || key === 'v práci' || key === 'v_praci') {
    return STATUS_CONFIG_MAP.office;
  }
  if (key === 'homeoffice' || key === 'ho' || key === 'domov' || key === 'práce z domova') {
    return STATUS_CONFIG_MAP.home_office;
  }
  if (key === 'dovolena' || key === 'dovolená' || key === 'annual_leave') {
    return STATUS_CONFIG_MAP.vacation;
  }
  if (key === 'sickday' || key === 'sick' || key === 'zdravotni' || key === 'zdravotní volno') {
    return STATUS_CONFIG_MAP.sick_day;
  }
  if (key === 'nemoc' || key === 'neschopenka' || key === 'dpn' || key === 'pracovni_neschopnost' || key === 'pracovní neschopnost') {
    return STATUS_CONFIG_MAP.illness;
  }
  if (key === 'lekar' || key === 'lékař' || key === 'doctor_visit' || key === 'propustka' || key === 'u lekare' || key === 'u lékaře') {
    return STATUS_CONFIG_MAP.doctor;
  }
  if (key === 'neplacene' || key === 'neplacené' || key === 'neplacené volno' || key === 'neplacene_volno') {
    return STATUS_CONFIG_MAP.unpaid_leave;
  }
  if (key === 'pauza' || key === 'obed' || key === 'oběd') {
    return STATUS_CONFIG_MAP.break;
  }
  if (key === 'mimo' || key === 'mimo práci' || key === 'mimo_praci' || key === 'neaktivní') {
    return STATUS_CONFIG_MAP.offline;
  }
  if (key === 'nedostupny' || key === 'nedostupný' || key === 'nedostupná' || key === 'nedostupna' || key === 'unavailable') {
    return STATUS_CONFIG_MAP.unavailable;
  }

  // Substring fuzzy matching
  if (key.includes('nemoc') || key.includes('neschopen') || key.includes('dpn')) return STATUS_CONFIG_MAP.illness;
  if (key.includes('dovol')) return STATUS_CONFIG_MAP.vacation;
  if (key.includes('sick')) return STATUS_CONFIG_MAP.sick_day;
  if (key.includes('lekar') || key.includes('lékař') || key.includes('doctor') || key.includes('propustk')) return STATUS_CONFIG_MAP.doctor;
  if (key.includes('neplacen')) return STATUS_CONFIG_MAP.unpaid_leave;
  if (key.includes('pauz') || key.includes('obed') || key.includes('oběd')) return STATUS_CONFIG_MAP.break;
  if (key.includes('home') || key.includes('domov')) return STATUS_CONFIG_MAP.home_office;
  if (key.includes('kancel') || key.includes('kancl') || key.includes('office') || key.includes('prác')) return STATUS_CONFIG_MAP.office;
  if (key.includes('mimo') || key.includes('offline')) return STATUS_CONFIG_MAP.offline;

  return STATUS_CONFIG_MAP.offline;
}

/**
 * Returns consistent tone color classes by ColorKey
 */
export function getColorClasses(colorKey: ColorKey = 'amber') {
  switch (colorKey) {
    case 'emerald':
      return {
        bg: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
        text: 'text-emerald-700 dark:text-emerald-400',
        badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
      };
    case 'sky':
      return {
        bg: 'bg-sky-500/15 text-sky-700 dark:text-sky-400',
        text: 'text-sky-700 dark:text-sky-400',
        badge: 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300'
      };
    case 'rose':
      return {
        bg: 'bg-rose-500/15 text-rose-700 dark:text-rose-400',
        text: 'text-rose-700 dark:text-rose-400',
        badge: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
      };
    case 'red':
      return {
        bg: 'bg-red-500/15 text-red-700 dark:text-red-400',
        text: 'text-red-700 dark:text-red-400',
        badge: 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300'
      };
    case 'indigo':
      return {
        bg: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-400',
        text: 'text-indigo-700 dark:text-indigo-400',
        badge: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300'
      };
    case 'purple':
      return {
        bg: 'bg-purple-500/15 text-purple-700 dark:text-purple-400',
        text: 'text-purple-700 dark:text-purple-400',
        badge: 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300'
      };
    case 'slate':
      return {
        bg: 'bg-slate-500/15 text-slate-700 dark:text-slate-400',
        text: 'text-slate-700 dark:text-slate-400',
        badge: 'bg-slate-100 text-slate-800 dark:bg-zinc-800 dark:text-zinc-300'
      };
    case 'amber':
    default:
      return {
        bg: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
        text: 'text-amber-700 dark:text-amber-400',
        badge: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
      };
  }
}

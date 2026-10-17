import type { ComponentType } from 'react';
import {
  MapPin,
  Home,
  Palmtree,
  Thermometer,
  Bandage,
  Stethoscope,
  CalendarX,
  UserX,
  Coffee,
  Footprints,
  DoorOpen,
  Sparkles,
  type LucideProps
} from 'lucide-react';

export type PresenceType = 'office' | 'home_office' | 'offline';
export type AbsenceType = 'vacation' | 'sick_day' | 'illness' | 'doctor' | 'unpaid_leave';
export type StatusType = PresenceType | AbsenceType | 'break' | 'holiday';

export type ActivityCategory = 'work' | 'absence' | 'break' | 'offline';

export type ColorKey =
  | 'emerald'
  | 'sky'
  | 'amber'
  | 'rose'
  | 'red'
  | 'indigo'
  | 'purple'
  | 'slate';

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

export const STATUS_CONFIG_MAP: Record<StatusType, StatusConfig> = {
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
    icon: Bandage,
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

  // 9. Nepřítomen / Mimo práci - Slate
  offline: {
    type: 'offline',
    label: 'Nepřítomen',
    shortLabel: 'Nepřítomen',
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
  }
};

/**
 * Synchronizes labels in STATUS_CONFIG_MAP with custom absence type names loaded from DB.
 */
export function syncAbsenceTypeLabels(
  types: Array<{ code: string; nameEmployee: string }> | Record<string, { code: string; nameEmployee: string }>
) {
  const list = Array.isArray(types) ? types : Object.values(types);
  for (const t of list) {
    const code = t.code as StatusType;
    if (code in STATUS_CONFIG_MAP && t.nameEmployee && t.nameEmployee.trim().length > 0) {
      STATUS_CONFIG_MAP[code].label = t.nameEmployee.trim();
      STATUS_CONFIG_MAP[code].shortLabel = t.nameEmployee.trim();
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

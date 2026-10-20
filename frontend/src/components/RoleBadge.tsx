import type { ComponentType } from 'react';
import {
  ShieldCheck,
  Briefcase,
  Award,
  Building2,
  User,
  type LucideProps
} from 'lucide-react';

export type RoleKey = 'admin' | 'manager' | 'team_lead' | 'office_manager' | 'colleague';

export interface RoleConfig {
  key: RoleKey | 'default';
  label: string;
  icon: ComponentType<LucideProps>;
  colorKey: 'purple' | 'blue' | 'amber' | 'teal' | 'slate';
  badgeClass: string;
}

export const ROLE_CONFIGS: Record<RoleKey, RoleConfig> = {
  admin: {
    key: 'admin',
    label: 'Administrátor',
    icon: ShieldCheck,
    colorKey: 'purple',
    badgeClass: 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300'
  },
  manager: {
    key: 'manager',
    label: 'Manažer',
    icon: Briefcase,
    colorKey: 'blue',
    badgeClass: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
  },
  team_lead: {
    key: 'team_lead',
    label: 'Vedoucí',
    icon: Award,
    colorKey: 'amber',
    badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
  },
  office_manager: {
    key: 'office_manager',
    label: 'Office Manager',
    icon: Building2,
    colorKey: 'teal',
    badgeClass: 'bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300'
  },
  colleague: {
    key: 'colleague',
    label: 'Uživatel',
    icon: User,
    colorKey: 'slate',
    badgeClass: 'bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300'
  }
};

/**
 * Normalizes role or roleLabel and returns unified RoleConfig.
 */
export function getRoleConfig(role?: string, roleLabel?: string): RoleConfig {
  const raw = (role || roleLabel || '').toLowerCase().trim();

  if (raw.includes('admin')) return ROLE_CONFIGS.admin;
  if (raw.includes('office')) return ROLE_CONFIGS.office_manager;
  if (raw.includes('lead') || raw.includes('vedouc')) return ROLE_CONFIGS.team_lead;
  if (raw.includes('manag') || raw.includes('manaž')) return ROLE_CONFIGS.manager;
  if (raw.includes('koleg') || raw.includes('uživatel') || raw.includes('uzivatel') || raw.includes('colleague') || raw.includes('employee') || raw.includes('user')) return ROLE_CONFIGS.colleague;

  if (role && role in ROLE_CONFIGS) {
    return ROLE_CONFIGS[role as RoleKey];
  }

  return {
    key: 'default',
    label: roleLabel || role || 'Uživatel',
    icon: User,
    colorKey: 'slate',
    badgeClass: 'bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300'
  };
}

export interface RoleBadgeProps {
  role?: string;
  roleLabel?: string;
  /** Set to true to display the role's icon in detailed views. In minipills it defaults to false. */
  showIcon?: boolean;
  className?: string;
}

/**
 * Unified Role Pill component with icons and tonal color schema.
 * By default, icons in minipills are hidden (showIcon=false).
 */
export function RoleBadge({
  role,
  roleLabel,
  showIcon = false,
  className = ''
}: RoleBadgeProps) {
  const config = getRoleConfig(role, roleLabel);
  const Icon = config.icon;
  const normalizedLabel =
    roleLabel === 'Kolega'
      ? 'Uživatel'
      : roleLabel === 'Vedoucí týmu'
      ? 'Vedoucí'
      : roleLabel;
  const text = normalizedLabel || config.label;

  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full transition-colors truncate max-w-fit ${config.badgeClass} ${className}`}
    >
      {showIcon && <Icon className="w-3 h-3 flex-shrink-0" />}
      <span className="truncate">{text}</span>
    </span>
  );
}

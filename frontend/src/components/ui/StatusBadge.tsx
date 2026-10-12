import type { ComponentType } from 'react';
import {
  Clock,
  CheckCircle2,
  XCircle,
  FileEdit,
  Lock,
  Check,
  X,
  type LucideProps
} from 'lucide-react';

export type WorkflowStatusKey =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'draft'
  | 'closed'
  | 'active'
  | 'inactive';

export interface WorkflowStatusConfig {
  key: WorkflowStatusKey;
  label: string;
  icon: ComponentType<LucideProps>;
  badgeClass: string;
}

export const WORKFLOW_STATUS_MAP: Record<WorkflowStatusKey, WorkflowStatusConfig> = {
  pending: {
    key: 'pending',
    label: 'Čeká na schválení',
    icon: Clock,
    badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
  },
  approved: {
    key: 'approved',
    label: 'Schváleno',
    icon: CheckCircle2,
    badgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
  },
  rejected: {
    key: 'rejected',
    label: 'Zamítnuto',
    icon: XCircle,
    badgeClass: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
  },
  draft: {
    key: 'draft',
    label: 'Rozpracováno',
    icon: FileEdit,
    badgeClass: 'bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300'
  },
  closed: {
    key: 'closed',
    label: 'Uzavřeno',
    icon: Lock,
    badgeClass: 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300'
  },
  active: {
    key: 'active',
    label: 'Aktivní',
    icon: Check,
    badgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
  },
  inactive: {
    key: 'inactive',
    label: 'Neaktivní',
    icon: X,
    badgeClass: 'bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400'
  }
};

export function getWorkflowStatusConfig(status?: string | null): WorkflowStatusConfig {
  if (!status) return WORKFLOW_STATUS_MAP.draft;
  const key = status.toLowerCase().trim();

  if (key in WORKFLOW_STATUS_MAP) {
    return WORKFLOW_STATUS_MAP[key as WorkflowStatusKey];
  }

  // Synonym mapping
  if (key.includes('schvál') || key.includes('approved') || key.includes('hotovo')) return WORKFLOW_STATUS_MAP.approved;
  if (key.includes('ček') || key.includes('ceka') || key.includes('pending') || key.includes('posouzen')) return WORKFLOW_STATUS_MAP.pending;
  if (key.includes('zamít') || key.includes('zamit') || key.includes('rejected')) return WORKFLOW_STATUS_MAP.rejected;
  if (key.includes('uzav') || key.includes('closed')) return WORKFLOW_STATUS_MAP.closed;
  if (key.includes('aktiv') || key.includes('active')) return WORKFLOW_STATUS_MAP.active;

  return WORKFLOW_STATUS_MAP.draft;
}

export interface StatusBadgeProps {
  status?: string | null;
  customLabel?: string;
  showIcon?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

export function StatusBadge({
  status,
  customLabel,
  showIcon = true,
  size = 'md',
  className = ''
}: StatusBadgeProps) {
  const cfg = getWorkflowStatusConfig(status);
  const Icon = cfg.icon;
  const label = customLabel || cfg.label;

  const sizeClass = size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-[11px] px-2.5 py-1';
  const iconSizeClass = size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold select-none flex-shrink-0 ${sizeClass} ${cfg.badgeClass} ${className}`}
    >
      {showIcon && <Icon className={`${iconSizeClass} flex-shrink-0`} />}
      <span>{label}</span>
    </span>
  );
}

/**
 * Small contract badge for HPP / OSVČ / DPP / DPČ
 */
export function ContractBadge({
  contract,
  className = ''
}: {
  contract?: string | null;
  className?: string;
}) {
  if (!contract) return null;
  return (
    <span
      className={`text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 select-none ${className}`}
    >
      {contract}
    </span>
  );
}

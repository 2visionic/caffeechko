import type { ReactNode } from 'react';
import { UserAvatar } from './ui';
import { RoleBadge } from './RoleBadge';
import { formatContractLabel } from '../types/attendance';

export interface ApplicantCardProps {
  name: string;
  role?: string;
  contract?: 'HPP' | 'OSVČ' | string;
  contractType?: string;
  contractTypeName?: string;
  isPermanentHomeOffice?: boolean;
  rightContent?: ReactNode;
  onClick?: () => void;
}

/**
 * Sdílená karta žadatele pro všechny modaly žádostí (Nová žádost, Detail žádosti o volno, Detail lékaře).
 */
export function ApplicantCard({
  name,
  role,
  contract,
  contractType,
  contractTypeName,
  isPermanentHomeOffice,
  rightContent,
  onClick
}: ApplicantCardProps) {
  const contractLabel = formatContractLabel(contract, contractType, contractTypeName);

  return (
    <div
      onClick={onClick}
      title={onClick ? `Přejít na detail osoby: ${name}` : undefined}
      className={`bg-slate-100/70 dark:bg-zinc-800/60 p-4 rounded-2xl flex items-center justify-between gap-4 transition-colors ${
        onClick
          ? 'cursor-pointer hover:bg-slate-200/80 dark:hover:bg-zinc-700/70 group'
          : ''
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <UserAvatar name={name} size="md" isPermanentHomeOffice={isPermanentHomeOffice} />
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`font-bold text-sm text-slate-900 dark:text-white truncate ${onClick ? 'group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors' : ''}`}>
              {name}
            </span>
            {role && <RoleBadge role={role} roleLabel={role} />}
          </div>
          <div className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 truncate">
            {contractLabel}
          </div>
        </div>
      </div>

      {rightContent && <div className="flex-shrink-0">{rightContent}</div>}
    </div>
  );
}

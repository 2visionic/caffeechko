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
  rightContent?: ReactNode;
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
  rightContent
}: ApplicantCardProps) {
  const contractLabel =
    contract || contractType || contractTypeName
      ? formatContractLabel(contract, contractType, contractTypeName)
      : undefined;

  return (
    <div className="bg-slate-100/70 dark:bg-zinc-800/60 p-4 rounded-2xl flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <UserAvatar name={name} size="md" />
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-sm text-slate-900 dark:text-white truncate">
              {name}
            </span>
            {role && <RoleBadge role={role} roleLabel={role} />}
          </div>
          {contractLabel ? (
            <div className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 truncate">
              {contractLabel}
            </div>
          ) : role ? (
            <div className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 truncate">
              {role}
            </div>
          ) : null}
        </div>
      </div>

      {rightContent && <div className="flex-shrink-0">{rightContent}</div>}
    </div>
  );
}

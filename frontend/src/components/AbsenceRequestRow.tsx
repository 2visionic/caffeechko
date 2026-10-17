import { Check, Clock, X } from 'lucide-react';
import { getStatusConfig } from '../config/presenceConfig';
import { formatDateCzech } from '../types/attendance';
import type { LeaveRequestItem } from './LeaveRequestModal';
import type { DoctorVisitItem } from './DoctorVisitModal';
import { PresenceBadge, RoleBadge, getWorkflowStatusConfig, Button } from './ui';

export type UnifiedAbsenceRequestItem = LeaveRequestItem | DoctorVisitItem;

export interface AbsenceRequestRowProps {
  request: UnifiedAbsenceRequestItem;
  /** Zda zobrazit 2. sloupec se jménem, chipem role a pracovním poměrem (pouze v agendě žádostí kolegů) */
  showApplicant?: boolean;
  onOpenDetail: () => void;
}

export function isDoctorRequest(item: UnifiedAbsenceRequestItem): item is DoctorVisitItem {
  return item.type === 'doctor';
}

function getAbsenceStartComparable(item: UnifiedAbsenceRequestItem): string {
  if (isDoctorRequest(item)) {
    const d = item.date || (item as any).startDate || '';
    const t = item.startTime || '08:00';
    return `${d}T${t}`;
  }
  return `${item.startDate || ''}T00:00`;
}

function getAbsenceCreatedComparable(item: UnifiedAbsenceRequestItem): string {
  const created = item.createdAt;
  if (created && created.length > 0) {
    return created;
  }
  return getAbsenceStartComparable(item);
}

function getAbsenceStatusPriority(status?: string | null): number {
  const wf = getWorkflowStatusConfig(status);
  // 1. Neschválené (rejected), 2. Čekající (pending), 3. Schválené (approved)
  if (wf.key === 'rejected') return 0;
  if (wf.key === 'pending') return 1;
  return 2;
}

/**
 * Sjednocené řazení všech žádostí:
 * 1. úroveň: Neschválené (rejected) -> Čekající (pending) -> Schválené (approved)
 * 2. úroveň:
 *    - Neschválené a Čekající: od nejnižšího data založení (createdAt vzestupně)
 *    - Schválené: od nejnižšího data začátku absence (startDate / date vzestupně)
 */
export function sortAbsenceRequests<T extends UnifiedAbsenceRequestItem>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const prioA = getAbsenceStatusPriority(a.status);
    const prioB = getAbsenceStatusPriority(b.status);
    if (prioA !== prioB) {
      return prioA - prioB;
    }

    if (prioA === 0 || prioA === 1) {
      const createdCmp = getAbsenceCreatedComparable(a).localeCompare(getAbsenceCreatedComparable(b));
      if (createdCmp !== 0) return createdCmp;
    }

    return getAbsenceStartComparable(a).localeCompare(getAbsenceStartComparable(b));
  });
}

function formatContractLabel(contract?: 'HPP' | 'OSVČ' | string, contractType?: string): string {
  if (contract === 'OSVČ') {
    return 'OSVČ (IČO)';
  }
  if (contractType === 'half_time') {
    return 'HPP • Poloviční úvazek';
  }
  if (contractType === 'part_time') {
    return 'HPP • Čtvrtinový úvazek';
  }
  return 'HPP • Plný úvazek';
}

function renderStatusIndicator(status?: string | null) {
  const wf = getWorkflowStatusConfig(status);

  if (wf.key === 'approved') {
    return (
      <span
        className=" -bottom-1 -right-1 absolute w-4.5 h-4.5 rounded-full bg-emerald-500 text-white flex items-center justify-center ring-2 ring-slate-100 dark:ring-zinc-800 shadow-xs"
        title={wf.label}
      >
        <Check className="w-2.5 h-2.5 stroke-[3]" />
      </span>
    );
  }

  if (wf.key === 'rejected') {
    return (
      <span
        className="-bottom-1 -right-1 absolute w-4.5 h-4.5 rounded-full bg-rose-500 text-white flex items-center justify-center ring-2 ring-slate-100 dark:ring-zinc-800 shadow-xs"
        title={wf.label}
      >
        <X className="w-2.5 h-2.5 stroke-[3]" />
      </span>
    );
  }

  return (
    <span
      className="-bottom-1 -right-1 absolute w-4.5 h-4.5 rounded-full bg-amber-500 text-white flex items-center justify-center ring-2 ring-slate-100 dark:ring-zinc-800 shadow-xs"
      title={wf.label}
    >
      <Clock className="w-2.5 h-2.5 stroke-[2.5]" />
    </span>
  );
}

export function AbsenceRequestRow({
  request,
  showApplicant = false,
  onOpenDetail
}: AbsenceRequestRowProps) {
  const cfg = getStatusConfig(request.type);
  const isTimeAbsence = isDoctorRequest(request);
  const absenceLabel = cfg.label || request.typeName;

  return (
    <div className="py-3 px-3.5 rounded-2xl bg-slate-100/70 dark:bg-zinc-800/60 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
      {/* Levá a střední část (Sloupce 1, 2 a 3) */}
      <div className="flex items-center gap-3.5 min-w-0 flex-1">
        {/* 1. sloupec: Ikona absence s indikátorem stavu (Schváleno / Zamítnuto / Čekající) */}
        <div className="relative flex-shrink-0">
          <PresenceBadge
            type={request.type}
            variant="icon-box"
            size="md"
          />
          {renderStatusIndicator(request.status)}
        </div>

        {/* 2. sloupec: Vidí pouze člověk v agendě žádostí kolegů (Jméno + chip role, 2. řádek textově pracovní poměr) */}
        {showApplicant && (
          <div className="min-w-0 sm:w-56 md:w-64 flex-shrink-0 sm:pr-4 sm:border-r sm:border-slate-200/70 dark:sm:border-zinc-700/60">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                {request.userName}
              </span>
              <RoleBadge role={request.userRole} roleLabel={request.userRole} />
            </div>
            <div className="text-xs font-normal text-slate-500 dark:text-zinc-400 mt-0.5 truncate">
              {formatContractLabel(request.contract, request.contractType)}
            </div>
          </div>
        )}

        {/* 3. sloupec (nebo 2. u vlastních žádostí): Název absence (regular) + 2. řádek datum (bold) s chipem počtu dnů */}
        <div className={`min-w-0 flex-1 ${showApplicant ? 'sm:pl-0.5' : ''}`}>
          <div className="text-xs font-normal text-slate-500 dark:text-zinc-400 truncate">
            {absenceLabel}
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {isTimeAbsence ? (
              <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                {formatDateCzech(request.date || (request as any).startDate)} ({request.startTime} – {request.endTime})
              </span>
            ) : (
              <>
                <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                  {formatDateCzech(request.startDate)}
                  {request.startDate !== request.endDate ? ` – ${formatDateCzech(request.endDate)}` : ''}
                </span>
                <span className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded-lg bg-white dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 flex-shrink-0">
                  {request.daysCount} {request.daysCount === 1 ? 'den' : request.daysCount < 5 ? 'dny' : 'dní'}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Pravá část: Tlačítko Detail */}
      <div className="flex items-center justify-end gap-2.5 self-end sm:self-auto flex-shrink-0">
        <Button
          variant="surface"
          size="xs"
          onClick={onOpenDetail}
        >
          Detail
        </Button>
      </div>
    </div>
  );
}

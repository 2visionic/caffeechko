import { Check, Clock, Trash2, X, History, RotateCcw } from 'lucide-react';
import { getStatusConfig } from '../config/presenceConfig';
import { formatDateCzech, formatContractLabel } from '../types/attendance';
import type { LeaveRequestItem } from './LeaveRequestModal';
import type { DoctorVisitItem } from './DoctorVisitModal';
import { PresenceBadge, getWorkflowStatusConfig, Button } from './ui';

export type UnifiedAbsenceRequestItem = LeaveRequestItem | DoctorVisitItem;

export interface AbsenceRequestRowProps {
  request: UnifiedAbsenceRequestItem;
  /** Zda zobrazit 2. sloupec se jménem a pracovním poměrem (pouze v agendě žádostí kolegů) */
  showApplicant?: boolean;
  onOpenDetail: () => void;
  /** Zda přihlášený uživatel může smazat tento záznam */
  canDelete?: boolean;
  /** Callback pro smazání záznamu (s potvrzovacím dialogem) */
  onDelete?: () => void;
  /** Zda přihlášený uživatel může obnovit tento smazaný záznam */
  canRestore?: boolean;
  /** Callback pro obnovení smazaného záznamu */
  onRestore?: () => void;
}

export function isDoctorRequest(item: UnifiedAbsenceRequestItem): item is DoctorVisitItem {
  return item.type === 'doctor' || ('startTime' in item && Boolean(item.startTime) && !('daysCount' in item));
}

function getAbsenceStartDateOnly(item: UnifiedAbsenceRequestItem): string {
  if (isDoctorRequest(item)) {
    return item.date || (item as any).startDate || '';
  }
  return item.startDate || '';
}

function getAbsenceEndDateComparable(item: UnifiedAbsenceRequestItem): string {
  if (isDoctorRequest(item)) {
    return '';
  }
  const end = item.endDate;
  if (!end) return '';
  return end;
}

function getAbsenceStartTimeComparable(item: UnifiedAbsenceRequestItem): string {
  if (isDoctorRequest(item)) {
    return item.startTime || '08:00';
  }
  return (item as any).startTime || '00:00';
}

/**
 * Řazení žádostí podle datumu začátku (1. stupeň) a datumu konce (2. stupeň, null je nejnižší):
 * - 'asc' (výchozí, pro Můj přehled a Žádosti): od nejnižšího datumu začátku, sekundárně od nejnižšího data-do
 * - 'desc': opačné pořadí
 */
export function sortAbsenceRequests<T extends UnifiedAbsenceRequestItem>(
  items: T[],
  direction: 'asc' | 'desc' = 'asc'
): T[] {
  return [...items].sort((a, b) => {
    const startCmp = getAbsenceStartDateOnly(a).localeCompare(getAbsenceStartDateOnly(b));
    if (startCmp !== 0) {
      return direction === 'desc' ? -startCmp : startCmp;
    }
    const endCmp = getAbsenceEndDateComparable(a).localeCompare(getAbsenceEndDateComparable(b));
    if (endCmp !== 0) {
      return direction === 'desc' ? -endCmp : endCmp;
    }
    const timeCmp = getAbsenceStartTimeComparable(a).localeCompare(getAbsenceStartTimeComparable(b));
    if (timeCmp !== 0) {
      return direction === 'desc' ? -timeCmp : timeCmp;
    }
    const ca = a.createdAt || '';
    const cb = b.createdAt || '';
    return direction === 'desc' ? cb.localeCompare(ca) : ca.localeCompare(cb);
  });
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
  onOpenDetail,
  canDelete = false,
  onDelete,
  canRestore = false,
  onRestore
}: AbsenceRequestRowProps) {
  const cfg = getStatusConfig(request.type);
  const isTimeAbsence = isDoctorRequest(request);
  const absenceLabel = request.typeName || cfg.label;

  return (
    <div
      onClick={onOpenDetail}
      className="py-3 px-3.5 rounded-2xl bg-slate-100/70 dark:bg-zinc-800/60 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs cursor-pointer"
    >
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

        {/* 2. sloupec: Vidí pouze člověk v agendě žádostí kolegů (Jméno a 2. řádek textově pracovní poměr, bez chipu role a bez divideru) */}
        {showApplicant && (
          <div className="min-w-0 sm:w-48 md:w-56 flex-shrink-0">
            <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
              {request.userName}
            </div>
            <div className="text-xs font-normal text-slate-500 dark:text-zinc-400 mt-0.5 truncate">
              {formatContractLabel(request.contract, request.contractType, request.contractTypeName)}
            </div>
          </div>
        )}

        {/* 3. sloupec (nebo 2. u vlastních žádostí): Název absence (regular) + 2. řádek datum (bold) s chipem počtu dnů */}
        <div className="min-w-0 flex-1">
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
            {request.editLogs && request.editLogs.length > 0 && (
              <span
                title="Záznam má historii úprav"
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-200/80 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 text-[10px] font-mono font-medium flex-shrink-0"
              >
                <History className="w-3 h-3" />
                <span>{request.editLogs.length}</span>
              </span>
            )}
            {request.isDeleted && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 flex-shrink-0">
                Smazáno
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Pravá část: Tlačítko Detail + Obnovit (pro smazané) + Smazat */}
      <div className="flex items-center justify-end gap-1.5 self-end sm:self-auto flex-shrink-0">
        <Button
          variant="surface"
          size="xs"
          onClick={(e) => {
            e.stopPropagation();
            onOpenDetail();
          }}
        >
          Detail
        </Button>
        {canRestore && request.isDeleted && !request.isLockedByClosure && !request.editableMinEndDate && onRestore && (
          <Button
            variant="surface"
            colorKey="emerald"
            size="icon-sm"
            icon={RotateCcw}
            onClick={(e) => {
              e.stopPropagation();
              onRestore();
            }}
            title="Obnovit smazanou absenci z koše"
          />
        )}
        {canDelete && !request.isDeleted && !request.isLockedByClosure && !request.editableMinEndDate && onDelete && (
          <Button
            variant="surface"
            colorKey="rose"
            size="icon-sm"
            icon={Trash2}
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            title="Smazat záznam absence"
          />
        )}
      </div>
    </div>
  );
}

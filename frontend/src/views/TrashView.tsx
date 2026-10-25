import { RotateCcw, Trash2, CheckCircle2, Lock } from 'lucide-react';
import type { Persona } from '../types/attendance';
import { formatDateCzech } from '../types/attendance';
import {
  resolveAbsenceTypeConfig,
  resolveAbsenceTypeLabel,
  type AbsenceTypeConfigDto,
  type DeletedTimeEntryDto,
  type RecordEditLogDto
} from '../api';
import type { StatusType } from '../config/presenceConfig';
import { PresenceBadge } from '../components/PresenceBadge';
import { SECTIONS } from '../config/sectionsConfig';
import { Box, Button, UserAvatar } from '../components/ui';
import { formatAbsenceDurationLabel } from './AbsencesView';

export interface DeletedAbsenceItem {
  id: string;
  applicantId: string;
  userName: string;
  userRole?: string;
  contract?: 'HPP' | 'OSVČ';
  contractType?: string;
  contractTypeName?: string;
  isPermanentHomeOffice?: boolean;
  type: string;
  typeName: string;
  startDate: string;
  endDate: string;
  startTime?: string | null;
  endTime?: string | null;
  daysCount: number;
  status: 'pending' | 'approved' | 'rejected';
  reason?: string;
  createdAt: string;
  resolvedByName?: string | null;
  resolvedByIsFemale?: boolean | null;
  resolvedAt?: string | null;
  isLockedByClosure?: boolean;
  editLogs?: RecordEditLogDto[];
}

interface TrashViewProps {
  personasList: Persona[];
  absenceTypesMap?: Record<string, AbsenceTypeConfigDto>;
  deletedAbsences: DeletedAbsenceItem[];
  deletedTimeEntries: DeletedTimeEntryDto[];
  onRestoreAbsence: (id: string) => void;
  onRestoreTimeEntry: (id: string) => void;
  onOpenAbsenceDetail?: (item: DeletedAbsenceItem) => void;
}

export function TrashView({
  personasList,
  absenceTypesMap,
  deletedAbsences,
  deletedTimeEntries,
  onRestoreAbsence,
  onRestoreTimeEntry,
  onOpenAbsenceDetail
}: TrashViewProps) {
  const totalCount = deletedAbsences.length + deletedTimeEntries.length;

  const countLabel =
    totalCount === 1
      ? '1 záznam'
      : totalCount >= 2 && totalCount <= 4
      ? `${totalCount} záznamy`
      : `${totalCount} záznamů`;

  return (
    <Box
      header={{
        icon: SECTIONS.trash?.icon || Trash2,
        colorKey: SECTIONS.trash?.color || 'rose',
        title: 'Obsah koše',
        subtitle: 'Přehled smazaných záznamů docházky a absencí s možností jejich obnovení',
        badge: (
          <span className="text-[11px] font-semibold px-2 py-0.2 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300">
            {countLabel}
          </span>
        )
      }}
      className="space-y-6"
    >
      {totalCount === 0 ? (
        <div className="p-8 rounded-2xl bg-slate-100/70 dark:bg-zinc-800/40 text-center space-y-1.5">
          <CheckCircle2 className="w-7 h-7 text-emerald-500 mx-auto mb-1" />
          <p className="text-sm font-semibold text-slate-800 dark:text-zinc-200">
            Koš je prázdný
          </p>
          <p className="text-xs text-slate-400 dark:text-zinc-500 max-w-md mx-auto">
            Aktuálně neevidujeme žádné smazané záznamy absencí ani docházkových logů.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* 1. KATEGORIE: ABSENCE A ŽÁDOSTI */}
          {deletedAbsences.length > 0 && (
            <div className="space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-1">
                Absence ({deletedAbsences.length})
              </div>
              <div className="space-y-1.5">
                {deletedAbsences.map((item) => {
                  const matchedPersona = personasList.find(
                    (p) =>
                      p.id.toLowerCase() === (item.applicantId || '').toLowerCase() ||
                      p.name === item.userName
                  );
                  const isPermHo =
                    matchedPersona?.isPermanentHomeOffice ?? Boolean(item.isPermanentHomeOffice);
                  const isApplicantOsvc =
                    matchedPersona?.contract === 'OSVČ' || item.contract === 'OSVČ';
                  const typeLabel =
                    resolveAbsenceTypeLabel(
                      resolveAbsenceTypeConfig(item.type, absenceTypesMap),
                      isApplicantOsvc
                    ) || item.typeName;

                  return (
                    <div
                      key={`del-abs-${item.id}`}
                      onClick={() => onOpenAbsenceDetail?.({ ...item, isDeleted: true } as any)}
                      className={`py-2.5 px-3 rounded-2xl grid grid-cols-[minmax(0,1.2fr)_minmax(0,0.85fr)_minmax(0,1.25fr)_auto] items-center gap-3 transition-colors bg-slate-100/70 dark:bg-zinc-800/50 hover:bg-slate-100 dark:hover:bg-zinc-800/80 ${
                        onOpenAbsenceDetail ? 'cursor-pointer' : ''
                      }`}
                    >
                      {/* 1. sloupec: Osoba */}
                      <div className="flex items-center gap-2.5 min-w-0 text-left">
                        <UserAvatar
                          name={item.userName}
                          size="sm"
                          isPermanentHomeOffice={isPermHo}
                        />
                        <span className="text-sm font-semibold text-slate-900 dark:text-zinc-100 truncate">
                          {item.userName}
                        </span>
                      </div>

                      {/* 2. sloupec: Typ absence */}
                      <div className="flex items-center justify-start min-w-0">
                        <PresenceBadge
                          type={(item.type as StatusType) || 'vacation'}
                          customLabel={typeLabel}
                        />
                      </div>

                      {/* 3. sloupec: Délka trvání */}
                      <div className="text-right text-xs font-mono font-medium text-slate-600 dark:text-zinc-300 truncate">
                        {formatAbsenceDurationLabel(item as any, absenceTypesMap)}
                      </div>

                      {/* 4. sloupec: Tlačítko Detail + Obnovit */}
                      <div className="flex items-center justify-end gap-1.5 flex-shrink-0">
                        {onOpenAbsenceDetail && (
                          <Button
                            variant="surface"
                            size="xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenAbsenceDetail({ ...item, isDeleted: true } as any);
                            }}
                          >
                            Detail
                          </Button>
                        )}
                        {item.isLockedByClosure ? (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-xl bg-slate-200/80 dark:bg-zinc-700/80 text-slate-600 dark:text-zinc-300 text-[10px] font-semibold"
                            title="Záznam spadá do již uzavřeného měsíce a nelze jej obnovit"
                          >
                            <Lock className="w-3 h-3" />
                            <span>Uzavřeno</span>
                          </span>
                        ) : (
                          <Button
                            variant="surface"
                            colorKey="emerald"
                            size="icon-sm"
                            icon={RotateCcw}
                            onClick={(e) => {
                              e.stopPropagation();
                              onRestoreAbsence(item.id);
                            }}
                            title="Obnovit smazanou absenci"
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 2. KATEGORIE: ZÁZNAMY DOCHÁZKY (LOGY Z VÝKAZŮ) */}
          {deletedTimeEntries.length > 0 && (
            <div className="space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-1">
                Záznamy docházky ({deletedTimeEntries.length})
              </div>
              <div className="space-y-1.5">
                {deletedTimeEntries.map((entry) => {
                  const matchedPersona = personasList.find(
                    (p) =>
                      p.id.toLowerCase() === (entry.userId || '').toLowerCase() ||
                      p.name === entry.userName
                  );
                  const isPermHo =
                    matchedPersona?.isPermanentHomeOffice ?? Boolean(entry.isPermanentHomeOffice);
                  const isHo = entry.locationType === 'home_office';
                  const badgeType: StatusType = isHo ? 'home_office' : 'office';
                  const isUnverifiedOffice =
                    entry.locationType === 'office' && !entry.workplaceId && !entry.workplaceName;
                  const badgeLabel = isHo
                    ? 'Home Office'
                    : isUnverifiedOffice
                    ? 'Kancelář (bez ověření)'
                    : 'Kancelář';

                  const dateStr = entry.date ? formatDateCzech(entry.date) : '';
                  const startStr = entry.startTime || '--:--';
                  const endStr = entry.endTime || 'probíhá';
                  const durationStr = `${dateStr} • ${startStr}–${endStr}`;

                  return (
                    <div
                      key={`del-entry-${entry.id}`}
                      className="py-2.5 px-3 rounded-2xl grid grid-cols-[minmax(0,1.2fr)_minmax(0,0.85fr)_minmax(0,1.25fr)_auto] items-center gap-3 transition-colors bg-slate-100/70 dark:bg-zinc-800/50 hover:bg-slate-100 dark:hover:bg-zinc-800/80"
                    >
                      {/* 1. sloupec: Osoba */}
                      <div className="flex items-center gap-2.5 min-w-0 text-left">
                        <UserAvatar
                          name={entry.userName}
                          size="sm"
                          isPermanentHomeOffice={isPermHo}
                        />
                        <span className="text-sm font-semibold text-slate-900 dark:text-zinc-100 truncate">
                          {entry.userName}
                        </span>
                      </div>

                      {/* 2. sloupec: Typ záznamu */}
                      <div className="flex items-center justify-start min-w-0">
                        <PresenceBadge
                          type={badgeType}
                          customLabel={badgeLabel}
                        />
                      </div>

                      {/* 3. sloupec: Časové rozpětí logu */}
                      <div className="text-right text-xs font-mono font-medium text-slate-600 dark:text-zinc-300 truncate">
                        {durationStr}
                      </div>

                      {/* 4. sloupec: Ikona pro obnovení záznamu na konci řádku */}
                      <div className="flex items-center justify-end gap-1.5 flex-shrink-0">
                        {entry.isLockedByClosure ? (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-xl bg-slate-200/80 dark:bg-zinc-700/80 text-slate-600 dark:text-zinc-300 text-[10px] font-semibold"
                            title="Záznam spadá do již uzavřeného měsíce a nelze jej obnovit"
                          >
                            <Lock className="w-3 h-3" />
                            <span>Uzavřeno</span>
                          </span>
                        ) : (
                          <Button
                            variant="surface"
                            colorKey="emerald"
                            size="icon-sm"
                            icon={RotateCcw}
                            onClick={() => onRestoreTimeEntry(entry.id)}
                            title="Obnovit smazaný záznam docházky"
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </Box>
  );
}

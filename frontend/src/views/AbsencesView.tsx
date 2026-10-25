import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import type { Persona } from '../types/attendance';
import { formatDateCzech } from '../types/attendance';
import { api, getLocalTodayIso, resolveAbsenceTypeConfig, type AbsenceTypeConfigDto } from '../api';
import type { StatusType } from '../config/presenceConfig';
import { PresenceBadge } from '../components/PresenceBadge';
import { canViewerSeePrivateAbsence } from '../components/WhoIsWhereBox';
import { SECTIONS } from '../config/sectionsConfig';
import { Box, Button, UserAvatar } from '../components/ui';
import type { UpcomingAbsenceItem } from './DashboardView';

const MONTH_NAMES = [
  'Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen',
  'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'
];

export function formatAbsenceDurationLabel(
  item: UpcomingAbsenceItem,
  absenceTypesMap?: Record<string, AbsenceTypeConfigDto>
): string {
  const sFormatted = formatDateCzech(item.startDate);
  const eFormatted = formatDateCzech(item.endDate || item.startDate);
  const isMultiDay = Boolean(item.endDate && item.endDate > item.startDate);
  const datePart = isMultiDay ? `${sFormatted} – ${eFormatted}` : sFormatted;

  const rule = resolveAbsenceTypeConfig(item.type, absenceTypesMap);
  const hasRealTimeRange =
    Boolean(item.startTime && item.endTime) &&
    !(item.startTime === '00:00' && item.endTime === '00:00') &&
    (rule.durationMode === 'hours' || item.type === 'unavailable');

  if (hasRealTimeRange && item.startTime && item.endTime) {
    return `${datePart} • ${item.startTime}–${item.endTime}`;
  }

  return datePart;
}

export function AbsenceOverviewList({
  items,
  personasList,
  viewerPersona,
  absenceTypesMap,
  keyPrefix = 'abs',
  highlightPastAbsences = false,
  onOpenDetail,
  canDelete = false,
  onDelete
}: {
  items: UpcomingAbsenceItem[];
  personasList: Persona[];
  viewerPersona?: Persona;
  absenceTypesMap?: Record<string, AbsenceTypeConfigDto>;
  keyPrefix?: string;
  highlightPastAbsences?: boolean;
  onOpenDetail?: (item: UpcomingAbsenceItem) => void;
  canDelete?: boolean;
  onDelete?: (item: UpcomingAbsenceItem) => void;
}) {
  const todayIso = getLocalTodayIso();
  // Zobrazujeme výhradně schválené absence seřazené od nejnižšího data-od a sekundárně od nejnižšího data-do (null je nejnižší)
  const approvedItems = [...items]
    .filter((item) => !item.status || item.status === 'approved')
    .sort((a, b) => {
      const startCmp = (a.startDate || '').localeCompare(b.startDate || '');
      if (startCmp !== 0) return startCmp;
      const aEnd = a.endDate ?? '';
      const bEnd = b.endDate ?? '';
      const endCmp = aEnd.localeCompare(bEnd);
      if (endCmp !== 0) return endCmp;
      const aTime = a.startTime ?? '';
      const bTime = b.startTime ?? '';
      if (aTime !== bTime) return aTime.localeCompare(bTime);
      return (a.userName || '').localeCompare(b.userName || '', 'cs');
    });

  const rowsData = approvedItems.map((item) => {
    const matchedPersona = personasList.find(
      (p) =>
        p.id.toLowerCase() === (item.applicantId || '').toLowerCase() ||
        p.name === item.userName
    );
    const isPermHo =
      matchedPersona?.isPermanentHomeOffice ?? Boolean(item.isPermanentHomeOffice);
    const ruleCfg = resolveAbsenceTypeConfig(item.type, absenceTypesMap);
    const isMaskedPrivate =
      item.type === 'unavailable' ||
      (Boolean(ruleCfg.isPrivate) &&
        Boolean(viewerPersona) &&
        !canViewerSeePrivateAbsence(viewerPersona, {
          id: item.applicantId || matchedPersona?.id,
          parentPersonId: item.parentPersonId ?? matchedPersona?.parentPersonId,
          managerId: item.managerId ?? matchedPersona?.managerId,
          gdprStatus: matchedPersona?.gdprStatus
        }));
    const effectiveType = isMaskedPrivate ? 'unavailable' : item.type;
    const typeLabel = isMaskedPrivate
      ? 'Nedostupný'
      : item.typeName || ruleCfg.nameEmployee;
    const detailItem: UpcomingAbsenceItem = isMaskedPrivate
      ? {
          ...item,
          type: 'unavailable',
          typeName: 'Nedostupný',
          note: undefined
        }
      : item;

    const endIso = item.endDate || item.startDate;
    const isPastAbsence = highlightPastAbsences && Boolean(endIso && endIso < todayIso);

    const isOwnAbsence = Boolean(
      viewerPersona &&
        ((item.applicantId &&
          viewerPersona.id.toLowerCase() === item.applicantId.toLowerCase()) ||
          viewerPersona.name === item.userName)
    );
    const isColleagueOtherAbsence =
      (!viewerPersona ||
        viewerPersona.role === 'colleague' ||
        viewerPersona.id === 'anonymous') &&
      !isOwnAbsence;
    const canShowDetail = Boolean(onOpenDetail) && !isColleagueOtherAbsence && !isMaskedPrivate;

    return {
      item,
      isPermHo,
      effectiveType,
      typeLabel,
      detailItem,
      isPastAbsence,
      canShowDetail
    };
  });

  return (
    <div className="space-y-1.5">
      {rowsData.map(({ item, isPermHo, effectiveType, typeLabel, detailItem, isPastAbsence, canShowDetail }) => {
        return (
          <div
            key={`${keyPrefix}-${item.id}`}
            onClick={() => {
              if (canShowDetail) onOpenDetail?.(detailItem);
            }}
            className={`py-2.5 px-3 rounded-2xl grid grid-cols-[minmax(0,1.2fr)_minmax(0,0.85fr)_minmax(0,1.25fr)_auto] items-center gap-3 transition-colors ${
              canShowDetail ? 'cursor-pointer' : ''
            } ${
              isPastAbsence
                ? 'bg-emerald-500/10 dark:bg-emerald-500/15 hover:bg-emerald-500/15 dark:hover:bg-emerald-500/20'
                : 'bg-slate-100/70 dark:bg-zinc-800/50 hover:bg-slate-100 dark:hover:bg-zinc-800/80'
            }`}
          >
            {/* 1. sloupec: Osoba (pouze avatar + jméno, bez role a úvazku) */}
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
                type={(effectiveType as StatusType) || 'vacation'}
                customLabel={typeLabel}
              />
            </div>

            {/* 3. sloupec: Délka trvání */}
            <div className="text-right text-xs font-mono font-medium text-slate-600 dark:text-zinc-300 truncate">
              {formatAbsenceDurationLabel(detailItem, absenceTypesMap)}
            </div>

            {/* 4. sloupec: Tlačítko Detail (aktivní nebo opacitní placeholder) + Smazat */}
            <div className="flex items-center justify-end gap-1.5 flex-shrink-0">
              {onOpenDetail && (
                <Button
                  variant="surface"
                  size="xs"
                  disabled={!canShowDetail}
                  tabIndex={canShowDetail ? 0 : -1}
                  aria-disabled={!canShowDetail}
                  className={!canShowDetail ? '!opacity-25' : ''}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (canShowDetail) {
                      onOpenDetail(detailItem);
                    }
                  }}
                >
                  Detail
                </Button>
              )}
              {canDelete && onDelete && (
                <Button
                  variant="surface"
                  colorKey="rose"
                  size="icon-sm"
                  icon={Trash2}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(item);
                  }}
                  title="Smazat záznam absence"
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface AbsencesViewProps {
  personasList: Persona[];
  viewerPersona?: Persona;
  absenceTypesMap?: Record<string, AbsenceTypeConfigDto>;
  /** Vložený režim (např. jako tab v Detailu osoby bez vlastního obalového Boxu) */
  embedded?: boolean;
  /** Volitelný filtr na konkrétní osobu (v Detailu osoby) */
  userId?: string;
  /** Trigger pro obnovení dat po úpravě/smazání absence */
  refreshTrigger?: number;
  /** Callback pro otevření detailu absence */
  onOpenAbsenceDetail?: (item: UpcomingAbsenceItem) => void;
  /** Zda přihlášený uživatel může mazat záznamy absencí */
  canDelete?: boolean;
  /** Callback pro smazání absence (s potvrzovacím dialogem) */
  onDeleteAbsence?: (item: UpcomingAbsenceItem) => void;
}

export function AbsencesView({
  personasList,
  viewerPersona,
  absenceTypesMap,
  embedded = false,
  userId,
  refreshTrigger = 0,
  onOpenAbsenceDetail,
  canDelete = false,
  onDeleteAbsence
}: AbsencesViewProps) {
  const now = new Date();
  const todayYear = now.getFullYear();
  const todayMonth = now.getMonth() + 1; // 1–12

  const [selectedYear, setSelectedYear] = useState<number>(todayYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(todayMonth);
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState<boolean>(false);
  const [pickerYear, setPickerYear] = useState<number>(todayYear);
  const [monthAbsences, setMonthAbsences] = useState<UpcomingAbsenceItem[]>([]);
  const pickerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isMonthPickerOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setIsMonthPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMonthPickerOpen]);

  useEffect(() => {
    let isMounted = true;
    api.getUpcomingAbsences(selectedYear, selectedMonth, userId).then((res) => {
      if (!isMounted) return;
      if (res?.data && Array.isArray(res.data)) {
        setMonthAbsences(
          res.data.filter((item: UpcomingAbsenceItem) => !item.status || item.status === 'approved')
        );
      } else {
        setMonthAbsences([]);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [selectedYear, selectedMonth, userId, refreshTrigger, viewerPersona?.id]);

  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear((y) => y - 1);
    } else {
      setSelectedMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear((y) => y + 1);
    } else {
      setSelectedMonth((m) => m + 1);
    }
  };

  const handleOpenMonthPicker = () => {
    setPickerYear(selectedYear);
    setIsMonthPickerOpen((prev) => !prev);
  };

  const handleSelectMonthFromPopup = (monthNum: number) => {
    setSelectedYear(pickerYear);
    setSelectedMonth(monthNum);
    setIsMonthPickerOpen(false);
  };

  const monthPickerActions = (
    <div className="relative self-start lg:self-auto" ref={pickerRef}>
      {/* Přepínač měsíců s klikacím názvem měsíce pro otevření popupu (shodné s Výkazy) */}
      <div className="flex items-center gap-1 bg-slate-100 dark:bg-zinc-800/80 p-1 rounded-2xl">
        <Button
          variant="surface"
          size="icon-sm"
          icon={ChevronLeft}
          onClick={handlePrevMonth}
          title="Předchozí měsíc"
        />
        <button
          type="button"
          onClick={handleOpenMonthPicker}
          className="px-3 py-1 rounded-xl text-xs font-bold text-slate-900 dark:text-white min-w-[104px] text-center hover:bg-white/80 dark:hover:bg-zinc-700/80 transition-colors cursor-pointer select-none"
          title="Kliknutím vyberte rok a měsíc"
        >
          {selectedYear === todayYear
            ? MONTH_NAMES[selectedMonth - 1]
            : `${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`}
        </button>
        <Button
          variant="surface"
          size="icon-sm"
          icon={ChevronRight}
          onClick={handleNextMonth}
          title="Následující měsíc"
        />
      </div>

      {/* Popup s výběrem roku a 4x3 gridem měsíců */}
      {isMonthPickerOpen && (
        <div
          className={`absolute ${
            embedded ? 'left-1/2 -translate-x-1/2' : 'right-0'
          } top-full mt-2 z-50 w-72 p-3 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-xl space-y-3`}
        >
          <div className="flex items-center justify-between gap-1 bg-slate-100 dark:bg-zinc-800/80 p-1 rounded-2xl">
            <Button
              variant="surface"
              size="icon-sm"
              icon={ChevronLeft}
              onClick={() => setPickerYear((y) => y - 1)}
              title="Předchozí rok"
            />
            <span className="px-3 text-xs font-bold font-mono text-slate-900 dark:text-white min-w-[80px] text-center">
              {pickerYear}
            </span>
            <Button
              variant="surface"
              size="icon-sm"
              icon={ChevronRight}
              onClick={() => setPickerYear((y) => y + 1)}
              title="Následující rok"
            />
          </div>

          <div className="grid grid-cols-4 gap-1.5">
            {MONTH_NAMES.map((mName, idx) => {
              const mNum = idx + 1;
              const isSelected = selectedYear === pickerYear && selectedMonth === mNum;

              return (
                <Button
                  key={mNum}
                  variant={isSelected ? 'filled' : 'surface'}
                  colorKey={isSelected ? 'primary' : undefined}
                  size="xs"
                  onClick={() => handleSelectMonthFromPopup(mNum)}
                  className="justify-center px-1.5 font-semibold"
                >
                  {mName.slice(0, 3)}
                </Button>
              );
            })}
          </div>

          <div className="pt-1 border-t border-slate-100 dark:border-zinc-800">
            <Button
              variant="surface"
              colorKey="primary"
              size="xs"
              fullWidth
              onClick={() => {
                setPickerYear(todayYear);
                setSelectedYear(todayYear);
                setSelectedMonth(todayMonth);
                setIsMonthPickerOpen(false);
              }}
            >
              Aktuální
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  const countLabel =
    monthAbsences.length === 1
      ? '1 záznam'
      : monthAbsences.length >= 2 && monthAbsences.length <= 4
      ? `${monthAbsences.length} záznamy`
      : `${monthAbsences.length} záznamů`;

  const listContent =
    monthAbsences.length === 0 ? (
      <div className="py-8 px-4 rounded-2xl bg-slate-100/60 dark:bg-zinc-800/40 text-center text-xs text-slate-400 dark:text-zinc-500">
        V měsíci {MONTH_NAMES[selectedMonth - 1].toLowerCase()} {selectedYear} nejsou evidovány žádné schválené absence.
      </div>
    ) : (
      <AbsenceOverviewList
        items={monthAbsences}
        personasList={personasList}
        viewerPersona={viewerPersona}
        absenceTypesMap={absenceTypesMap}
        keyPrefix={`month-${selectedYear}-${selectedMonth}`}
        highlightPastAbsences
        onOpenDetail={onOpenAbsenceDetail}
        canDelete={canDelete}
        onDelete={onDeleteAbsence}
      />
    );

  if (embedded) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-center">
          {monthPickerActions}
        </div>
        {listContent}
      </div>
    );
  }

  return (
    <Box
      header={{
        icon: SECTIONS.absences.icon,
        title: 'Absence',
        subtitle: 'Měsíční přehled schválených absencí a práce na dálku napříč firmou',
        badge: (
          <span className="text-[11px] font-semibold px-2 py-0.2 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300">
            {countLabel}
          </span>
        ),
        actions: monthPickerActions
      }}
      className="space-y-6"
    >
      {listContent}
    </Box>
  );
}

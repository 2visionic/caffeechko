import { useState, useEffect } from 'react';
import { MapPin, Home, Clock, Sparkles, Stethoscope } from 'lucide-react';

export interface ShiftBlock {
  id: string;
  start: string; // "HH:mm" e.g. "08:15"
  end: string | null; // "HH:mm" or null if ongoing
  location: 'office' | 'home_office' | 'doctor';
  locationName: string;
  method: 'nfc' | 'web' | 'request';
  note?: string;
  startedAtMs?: number;
}

interface DayTimelineProps {
  shifts: ShiftBlock[];
  isClockedIn: boolean;
  activeLocation: 'office' | 'home_office';
  workplaceName: string;
}

const TOTAL_MINUTES = 24 * 60;   // 1440 minut (celých 24 hodin)

// 24h indikace po 3h bez zobrazení časů na začátku (00:00) a na konci (24:00)
const VISIBLE_HOUR_TICKS = [3, 6, 9, 12, 15, 18, 21];

function parseTimeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function formatMinutesToHhMm(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

export function DayTimeline({
  shifts,
  isClockedIn,
  activeLocation,
  workplaceName
}: DayTimelineProps) {
  const [currentTimeStr, setCurrentTimeStr] = useState<string>('12:45');
  const [hoveredShift, setHoveredShift] = useState<ShiftBlock | null>(null);

  // Update current time every 30 seconds
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      setCurrentTimeStr(`${hh}:${mm}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, []);

  const currentMinutes = parseTimeToMinutes(currentTimeStr);

  // Calculate percentage along the 24h timeline (clamped between 0 and 100)
  const getPercent = (timeStr: string) => {
    const min = parseTimeToMinutes(timeStr);
    const clamped = Math.min(Math.max(min, 0), TOTAL_MINUTES);
    return (clamped / TOTAL_MINUTES) * 100;
  };

  const currentPercent = Math.min(
    Math.max((currentMinutes / TOTAL_MINUTES) * 100, 0),
    100
  );

  // Calculate tooltip horizontal center position clamped within card
  const getTooltipCenterPercent = (shift: ShiftBlock) => {
    const startPct = getPercent(shift.start);
    const endPct = shift.end ? getPercent(shift.end) : currentPercent;
    const center = startPct + (endPct - startPct) / 2;
    return Math.min(Math.max(center, 15), 85);
  };

  return (
    <div className="w-full space-y-2 select-none pt-7">
      {/* TIMELINE CONTAINER (Contains the Top Badge + Tooltip + Slim Track) */}
      <div className="relative w-full">

        {/* MATERIAL DESIGN 3 TOOLTIP (Appears above the track when hovering a shift) */}
        {hoveredShift && (
          <div
            className="absolute bottom-[calc(100%+14px)] z-50 pointer-events-none -translate-x-1/2 transition-all duration-150 animate-in fade-in zoom-in-95"
            style={{ left: `${getTooltipCenterPercent(hoveredShift)}%` }}
          >
            <div className="relative bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 rounded-2xl p-3.5 shadow-2xl min-w-[250px] max-w-xs text-xs space-y-2">
              {/* Header: Location badge & status */}
              <div className="flex items-center justify-between gap-2 border-b border-slate-200/40 dark:border-zinc-700/60 pb-2">
                <div className="flex items-center gap-1.5 font-bold">
                  {hoveredShift.location === 'doctor' ? (
                    <>
                      <Stethoscope className="w-3.5 h-3.5 text-indigo-500" />
                      <span className="text-indigo-700 dark:text-indigo-400 font-semibold">
                        U lékaře
                      </span>
                    </>
                  ) : hoveredShift.location === 'office' ? (
                    <>
                      <MapPin className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                        Kancelář
                      </span>
                    </>
                  ) : (
                    <>
                      <Home className="w-3.5 h-3.5 text-sky-500" />
                      <span className="text-sky-700 dark:text-sky-400 font-semibold">
                        Home Office
                      </span>
                    </>
                  )}
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-100 dark:bg-zinc-700 text-slate-700 dark:text-zinc-300 font-semibold">
                  {hoveredShift.location === 'doctor'
                    ? (() => {
                        const s = parseTimeToMinutes(hoveredShift.start);
                        const e = hoveredShift.end ? parseTimeToMinutes(hoveredShift.end) : s;
                        if (currentMinutes >= s && currentMinutes <= e) return '🟣 Právě probíhá';
                        if (currentMinutes < s) return 'Plánovaná návštěva';
                        return 'Ukončená návštěva';
                      })()
                    : hoveredShift.end
                    ? 'Dokončená směna'
                    : '🟢 Právě probíhá'}
                </span>
              </div>

              {/* Time & Duration */}
              <div>
                <div className="flex items-center justify-between text-slate-600 dark:text-zinc-300 font-mono">
                  <span className="font-bold text-slate-900 dark:text-white text-sm">
                    {hoveredShift.start} — {hoveredShift.end || `Nyní (${currentTimeStr})`}
                  </span>
                  <span
                    className={`${
                      hoveredShift.location === 'doctor'
                        ? 'text-indigo-600 dark:text-indigo-400'
                        : 'text-emerald-600 dark:text-emerald-400'
                    } font-bold text-sm`}
                  >
                    {(() => {
                      const s = parseTimeToMinutes(hoveredShift.start);
                      const e = hoveredShift.end ? parseTimeToMinutes(hoveredShift.end) : currentMinutes;
                      return formatMinutesToHhMm(Math.max(0, e - s));
                    })()}
                  </span>
                </div>
              </div>

              {/* Location Name & Verification Detail */}
              <div className="pt-1 border-t border-slate-200/40 dark:border-zinc-700/60 space-y-1 text-[11px] text-slate-500 dark:text-zinc-400">
                <div className="flex items-center gap-1.5">
                  {hoveredShift.location === 'doctor' ? (
                    <Stethoscope className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  ) : (
                    <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  )}
                  <span className="font-medium text-slate-700 dark:text-zinc-200 truncate">
                    {hoveredShift.locationName}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                  <span>
                    {hoveredShift.location === 'doctor'
                      ? 'Schválená propustka k lékaři'
                      : hoveredShift.method === 'nfc'
                      ? 'Ověřeno fyzickým NFC terminálem (Praha 1)'
                      : 'Zaevidováno přes webové rozhraní'}
                  </span>
                </div>
              </div>

              {/* Downward pointing triangle arrow */}
              <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white dark:bg-zinc-800 rotate-45" />
            </div>
          </div>
        )}

        {/* HUBENÝ PROGRESS BAR (Slim track h-3.5 with rounded-full, borderless) */}
        <div className="relative h-3.5 w-full bg-slate-200/80 dark:bg-zinc-800 rounded-full transition-colors overflow-hidden">
          {/* Subtle hour grid lines across the track (každé 3h v rámci 24h) */}
          {VISIBLE_HOUR_TICKS.map((hour) => {
            const leftPercent = (hour / 24) * 100;
            return (
              <div
                key={hour}
                className="absolute top-0 bottom-0 border-l border-slate-300 dark:border-zinc-700/80 pointer-events-none"
                style={{ left: `${leftPercent}%` }}
              />
            );
          })}

          {/* SHIFTS / WORK BLOCKS / DOCTOR VISITS (Clean, sleek color capsules with ZERO text clutter) */}
          {shifts.map((shift) => {
            const startPct = getPercent(shift.start);
            const endPct = shift.end ? getPercent(shift.end) : currentPercent;
            const widthPct = Math.max(1.0, endPct - startPct);
            const isDoctor = shift.location === 'doctor';
            const isOffice = shift.location === 'office';
            const isOngoing = shift.end === null;
            const isHovered = hoveredShift?.id === shift.id;

            return (
              <div
                key={shift.id}
                onMouseEnter={() => setHoveredShift(shift)}
                onMouseLeave={() => setHoveredShift(null)}
                className={`absolute top-0 bottom-0 rounded-full cursor-pointer transition-all duration-150 ${
                  isDoctor
                    ? 'bg-indigo-500 hover:bg-indigo-400 dark:bg-indigo-500 dark:hover:bg-indigo-400 shadow-sm'
                    : isOffice
                    ? 'bg-emerald-500 hover:bg-emerald-400 dark:bg-emerald-500 dark:hover:bg-emerald-400 shadow-sm'
                    : 'bg-sky-500 hover:bg-sky-400 dark:bg-sky-500 dark:hover:bg-sky-400 shadow-sm'
                } ${
                  isHovered ? 'ring-2 ring-amber-400 dark:ring-amber-300 brightness-110 z-20 scale-y-125' : ''
                } ${isOngoing ? 'ring-1 ring-emerald-300 dark:ring-emerald-400 animate-pulse' : ''}`}
                style={{
                  left: `${startPct}%`,
                  width: `${widthPct}%`
                }}
              />
            );
          })}
        </div>

        {/* AKTUÁLNÍ ČAS: Sjednocený indikátor (Odznak, šipka i dashed linka z jednoho bodu) */}
        <div
          className="absolute top-0 bottom-0 pointer-events-none z-30 transition-all duration-300"
          style={{ left: `${currentPercent}%` }}
        >
          {/* Časový odznak se šipkou nad časovou osou (bez slova 'Nyní') */}
          <div className="absolute bottom-[calc(100%+5px)] left-0 -translate-x-1/2 flex flex-col items-center">
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-600/90 dark:bg-blue-500/90 text-white font-semibold text-[10px] shadow-sm font-mono whitespace-nowrap">
              <Clock className="w-2.5 h-2.5 opacity-80" />
              <span>{currentTimeStr}</span>
            </div>
            {/* Šipka ukazující přímo dolů do středu čárkované linky */}
            <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-blue-600/90 dark:border-t-blue-500/90" />
          </div>

          {/* Příjemná klidná modrá čárkovaná čára (bez neonové záře) */}
          <div className="absolute -top-1 -bottom-2.5 left-0 -translate-x-1/2 w-0 border-l-2 border-dashed border-blue-500/70 dark:border-blue-400/70" />
        </div>
      </div>

      {/* TIMELINE LABELS (Hour ticks below the track: 24h po 3h, bez 00:00 a 24:00) */}
      <div className="relative h-5 text-[11px] font-mono text-slate-400 dark:text-zinc-500 pt-1">
        {VISIBLE_HOUR_TICKS.map((hour) => {
          const leftPercent = (hour / 24) * 100;
          return (
            <span
              key={hour}
              className="absolute -translate-x-1/2 whitespace-nowrap"
              style={{ left: `${leftPercent}%` }}
            >
              {String(hour).padStart(2, '0')}:00
            </span>
          );
        })}
      </div>

      {/* LEGENDA (Zachována dle zadání) */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-5 text-[11px] text-slate-500 dark:text-zinc-400">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span>Kancelář</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
            <span>Home Office</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
            <span>U lékaře</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 border-t-2 border-dashed border-blue-500/70 dark:border-blue-400/70" />
            <span>Aktuální čas</span>
          </div>

          {isClockedIn && (
            <div className="hidden sm:flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium pl-2 border-l border-slate-200 dark:border-zinc-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Aktivní: {activeLocation === 'office' ? workplaceName : 'Home Office'}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

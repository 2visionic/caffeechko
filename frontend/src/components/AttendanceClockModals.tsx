import { Home, Building2, Coffee, Smartphone, DoorOpen } from 'lucide-react';
import { Button, Modal } from './ui';
import type { WorkplaceDto } from '../api';

interface AttendanceClockModalsProps {
  isWorkplaceSelectModalOpen: boolean;
  onCloseWorkplaceSelectModal: () => void;
  viewPersonaName: string;
  workplaces: WorkplaceDto[];
  onClockInAction: (locationType: 'office' | 'home_office', locationLabel?: string, nfcId?: string) => void;
  isNfcModalOpen: boolean;
  nfcModalMode?: 'in' | 'out';
  onCloseNfcModal: () => void;
  isHoLeaveModalOpen: boolean;
  onCloseHoLeaveModal: () => void;
  pauseReturnTime: string;
  onChangePauseReturnTime: (time: string) => void;
  onFinishClockOut: (isPause: boolean, returnTime?: string, nfcId?: string) => void;
  isPermanentHomeOffice?: boolean;
  hasApprovedHomeOfficeToday?: boolean;
  canLogHomeOffice?: boolean;
}

export function AttendanceClockModals({
  isWorkplaceSelectModalOpen,
  onCloseWorkplaceSelectModal,
  workplaces,
  onClockInAction,
  isNfcModalOpen,
  nfcModalMode = 'in',
  onCloseNfcModal,
  isHoLeaveModalOpen,
  onCloseHoLeaveModal,
  pauseReturnTime,
  onChangePauseReturnTime,
  onFinishClockOut,
  isPermanentHomeOffice = false,
  hasApprovedHomeOfficeToday = false,
  canLogHomeOffice = false
}: AttendanceClockModalsProps) {
  const isClockOutMode = nfcModalMode === 'out';
  const isHomeOfficePrimaryClockIn = !isClockOutMode && (isPermanentHomeOffice || hasApprovedHomeOfficeToday);
  const showHomeOfficeButton = isPermanentHomeOffice || hasApprovedHomeOfficeToday || canLogHomeOffice;
  const defaultWorkplace = workplaces[0] || {
    name: 'Pobočka Praha 1 - Palmovka',
    nfcIdentifier: 'praha1'
  };

  return (
    <>
      {/* MODAL: Výběr pracoviště při zápisu příchodu v Detailu osoby */}
      <Modal
        isOpen={isWorkplaceSelectModalOpen}
        onClose={onCloseWorkplaceSelectModal}
        title="Příchod"
        subtitle="Výběr pracoviště"
        icon={Building2}
        iconBgClass="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
        size="sm"
        footer={
          <Button
            variant="transparent"
            color="rose"
            size="normal"
            onClick={onCloseWorkplaceSelectModal}
            width="full"
          >
            Zrušit
          </Button>
        }
      >
        <div className="space-y-2.5">
          {workplaces.map((wp) => (
            <button
              key={wp.id || wp.nfcIdentifier}
              type="button"
              onClick={() => onClockInAction('office', wp.name, wp.nfcIdentifier)}
              className="w-full p-3.5 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-left transition-all flex items-center gap-3 cursor-pointer group"
            >
              <div className="w-9 h-9 rounded-xl bg-slate-200/80 dark:bg-zinc-700/80 flex items-center justify-center shrink-0">
                <Building2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                  {wp.name}
                </div>
                {wp.address && (
                  <div className="text-xs text-slate-500 dark:text-zinc-400 truncate mt-0.5">
                    {wp.address}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      </Modal>

      {/* MODAL 4: Pípnutí karty (NFC) při příchodu nebo odchodu */}
      <Modal
        isOpen={isNfcModalOpen}
        onClose={onCloseNfcModal}
        title={isClockOutMode ? 'Odchod' : 'Příchod'}
        subtitle="Přiložte k NFC kartě"
        icon={Smartphone}
        iconBgClass={
          isClockOutMode
            ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400'
            : isHomeOfficePrimaryClockIn
            ? 'bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400'
            : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
        }
        size="sm"
        footer={
          <Button
            variant="transparent"
            color="rose"
            size="normal"
            onClick={onCloseNfcModal}
            width="full"
          >
            Zrušit
          </Button>
        }
      >
        <div className="space-y-4">
          {/* Submarine sonar pulsing background (clickable for NFC simulation in browser) */}
          <button
            type="button"
            onClick={() => {
              if (import.meta.env.DEV) {
                if (isClockOutMode) {
                  onFinishClockOut(false, undefined, defaultWorkplace.nfcIdentifier);
                } else {
                  onClockInAction('office', defaultWorkplace.name, defaultWorkplace.nfcIdentifier);
                }
              }
            }}
            disabled={!import.meta.env.DEV}
            title={import.meta.env.DEV ? `Simulovat přiložení NFC karty (${defaultWorkplace.name}) [DEV]` : undefined}
            className={`relative w-32 h-32 mx-auto flex items-center justify-center mt-2 mb-8 focus:outline-none ${
              import.meta.env.DEV ? 'cursor-pointer group' : 'cursor-default'
            }`}
          >
            <span
              className={`absolute w-16 h-16 rounded-full animate-sonar-1 pointer-events-none ${
                isClockOutMode
                  ? 'bg-rose-500/25 dark:bg-rose-400/20 border border-rose-500/40 dark:border-rose-400/35'
                  : isHomeOfficePrimaryClockIn
                  ? 'bg-sky-500/25 dark:bg-sky-400/20 border border-sky-500/40 dark:border-sky-400/35'
                  : 'bg-emerald-500/25 dark:bg-emerald-400/20 border border-emerald-500/40 dark:border-emerald-400/35'
              }`}
            />
            <span
              className={`absolute w-16 h-16 rounded-full animate-sonar-2 pointer-events-none ${
                isClockOutMode
                  ? 'bg-rose-500/20 dark:bg-rose-400/15 border border-rose-500/35 dark:border-rose-400/30'
                  : isHomeOfficePrimaryClockIn
                  ? 'bg-sky-500/20 dark:bg-sky-400/15 border border-sky-500/35 dark:border-sky-400/30'
                  : 'bg-emerald-500/20 dark:bg-emerald-400/15 border border-emerald-500/35 dark:border-emerald-400/30'
              }`}
            />
            <span
              className={`absolute w-16 h-16 rounded-full animate-sonar-3 pointer-events-none ${
                isClockOutMode
                  ? 'bg-rose-500/15 dark:bg-rose-400/10 border border-rose-500/25 dark:border-rose-400/20'
                  : isHomeOfficePrimaryClockIn
                  ? 'bg-sky-500/15 dark:bg-sky-400/10 border border-sky-500/25 dark:border-sky-400/20'
                  : 'bg-emerald-500/15 dark:bg-emerald-400/10 border border-emerald-500/25 dark:border-emerald-400/20'
              }`}
            />
            <div
              className={`relative z-10 w-20 h-20 rounded-full flex items-center justify-center group-hover:scale-105 transition-transform shadow-lg ${
                isClockOutMode
                  ? 'bg-rose-50 dark:bg-rose-950/80 border border-rose-500/30 dark:border-rose-400/30 shadow-rose-500/15 text-rose-600 dark:text-rose-400'
                  : isHomeOfficePrimaryClockIn
                  ? 'bg-sky-50 dark:bg-sky-950/80 border border-sky-500/30 dark:border-sky-400/30 shadow-sky-500/15 text-sky-600 dark:text-sky-400'
                  : 'bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-500/30 dark:border-emerald-400/30 shadow-emerald-500/15 text-emerald-600 dark:text-emerald-400'
              }`}
            >
              <Smartphone className="w-10 h-10" />
            </div>
          </button>

          <div className="text-center text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-zinc-500 select-none">
            nebo
          </div>

          <div className="space-y-2 pt-1">
            {isClockOutMode ? (
              <Button
                variant="default"
                color="rose"
                size="big"
                width="full"
                icon={Building2}
                onClick={() => onFinishClockOut(false, undefined, undefined)}
              >
                Odchod z kanceláře (bez ověření)
              </Button>
            ) : isHomeOfficePrimaryClockIn ? (
              <>
                <Button
                  variant="default"
                  color="sky"
                  size="big"
                  width="full"
                  icon={Home}
                  onClick={() => onClockInAction('home_office')}
                >
                  Jsem doma (Home Office)
                </Button>

                <Button
                  variant="default"
                  color="emerald"
                  size="big"
                  width="full"
                  icon={Building2}
                  onClick={() => onClockInAction('office', 'Kancelář (bez ověření)')}
                >
                  Jsem v kanceláři (bez ověření)
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="default"
                  color="emerald"
                  size="big"
                  width="full"
                  icon={Building2}
                  onClick={() => onClockInAction('office', 'Kancelář (bez ověření)')}
                >
                  Jsem v kanceláři (bez ověření)
                </Button>

                {showHomeOfficeButton && (
                  <Button
                    variant="default"
                    color="sky"
                    size="big"
                    width="full"
                    icon={Home}
                    onClick={() => onClockInAction('home_office')}
                  >
                    Jsem doma (Home Office)
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </Modal>

      {/* MODAL 5: Odchod z Home Office (Konec vs. Pauza) */}
      <Modal
        isOpen={isHoLeaveModalOpen}
        onClose={onCloseHoLeaveModal}
        title="Odchod"
        subtitle="Ukončení práce na Home Office"
        icon={DoorOpen}
        iconBgClass="bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400"
        size="sm"
        footer={
          <Button
            variant="transparent"
            color="rose"
            size="normal"
            onClick={onCloseHoLeaveModal}
            width="full"
          >
            Zpět
          </Button>
        }
      >
        <div className="space-y-4">
          {/* Sonarová ikonka odchodu z Home Office pro sjednocení modálu příchod/odchod */}
          <button
            type="button"
            onClick={() => onFinishClockOut(false)}
            title="Ukončit práci na Home Office"
            className="relative w-32 h-32 mx-auto flex items-center justify-center mt-2 mb-6 focus:outline-none cursor-pointer group"
          >
            <span className="absolute w-16 h-16 rounded-full animate-sonar-1 pointer-events-none bg-sky-500/25 dark:bg-sky-400/20 border border-sky-500/40 dark:border-sky-400/35" />
            <span className="absolute w-16 h-16 rounded-full animate-sonar-2 pointer-events-none bg-sky-500/20 dark:bg-sky-400/15 border border-sky-500/35 dark:border-sky-400/30" />
            <span className="absolute w-16 h-16 rounded-full animate-sonar-3 pointer-events-none bg-sky-500/15 dark:bg-sky-400/10 border border-sky-500/25 dark:border-sky-400/20" />
            <div className="relative z-10 w-20 h-20 rounded-full flex items-center justify-center group-hover:scale-105 transition-transform shadow-lg bg-sky-50 dark:bg-sky-950/80 border border-sky-500/30 dark:border-sky-400/30 shadow-sky-500/15 text-sky-600 dark:text-sky-400">
              <DoorOpen className="w-10 h-10" />
            </div>
          </button>

          <button
            type="button"
            onClick={() => onFinishClockOut(false)}
            className="w-full p-4 rounded-2xl bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/30 dark:hover:bg-sky-950/50 text-left transition-all group cursor-pointer"
          >
            <div className="font-semibold text-sky-700 dark:text-sky-400 text-sm flex items-center gap-1.5">
              <DoorOpen className="w-4 h-4 shrink-0" />
              <span>Konec práce pro dnešek</span>
            </div>
            <div className="text-xs text-sky-600/70 dark:text-sky-300/70 mt-0.5">
              Definitivní uzavření směny v databázi
            </div>
          </button>

          <div className="p-4 rounded-2xl bg-amber-500/10 dark:bg-amber-500/15 space-y-3">
            <div>
              <div className="font-semibold text-amber-950 dark:text-amber-300 text-sm flex items-center gap-1.5">
                <Coffee className="w-4 h-4" />
                <span>Ještě se vrátím (Pauza)</span>
              </div>
              <div className="text-xs text-amber-800/80 dark:text-amber-300/80 mt-0.5">
                Směna se pozastaví a kolegům se zobrazí orientační čas návratu.
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-600 dark:text-zinc-300">Návrat cca:</span>
              <input
                type="time"
                value={pauseReturnTime}
                onChange={(e) => onChangePauseReturnTime(e.target.value)}
                className="px-3 py-1.5 text-xs font-mono font-semibold rounded-xl bg-white dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <Button
                variant="filled"
                colorKey="amber"
                size="sm"
                className="ml-auto"
                onClick={() => onFinishClockOut(true, pauseReturnTime)}
              >
                Potvrdit
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}

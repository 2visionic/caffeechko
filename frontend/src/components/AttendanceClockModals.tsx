import { Home, Building2, Coffee, Smartphone } from 'lucide-react';
import { Button, Modal } from './ui';
import type { WorkplaceDto } from '../api';

interface AttendanceClockModalsProps {
  isWorkplaceSelectModalOpen: boolean;
  onCloseWorkplaceSelectModal: () => void;
  viewPersonaName: string;
  workplaces: WorkplaceDto[];
  onClockInAction: (locationType: 'office' | 'home_office', locationLabel?: string, nfcId?: string) => void;
  isNfcModalOpen: boolean;
  onCloseNfcModal: () => void;
  isHoLeaveModalOpen: boolean;
  onCloseHoLeaveModal: () => void;
  pauseReturnTime: string;
  onChangePauseReturnTime: (time: string) => void;
  onFinishClockOut: (isPause: boolean, returnTime?: string) => void;
}

export function AttendanceClockModals({
  isWorkplaceSelectModalOpen,
  onCloseWorkplaceSelectModal,
  viewPersonaName,
  workplaces,
  onClockInAction,
  isNfcModalOpen,
  onCloseNfcModal,
  isHoLeaveModalOpen,
  onCloseHoLeaveModal,
  pauseReturnTime,
  onChangePauseReturnTime,
  onFinishClockOut
}: AttendanceClockModalsProps) {
  return (
    <>
      {/* MODAL: Výběr pracoviště při zápisu příchodu v Detailu osoby */}
      <Modal
        isOpen={isWorkplaceSelectModalOpen}
        onClose={onCloseWorkplaceSelectModal}
        title="Výběr pracoviště"
        subtitle={`Zvolte pracoviště pro zápis příchodu (${viewPersonaName})`}
        icon={Building2}
        iconBgClass="bg-amber-400 text-slate-950"
        size="sm"
        footer={
          <div className="w-full">
            <Button
              variant="ghost"
              size="md"
              onClick={onCloseWorkplaceSelectModal}
              fullWidth
            >
              Zrušit
            </Button>
          </div>
        }
      >
        <div className="space-y-2.5 py-1">
          {workplaces.map((wp) => (
            <button
              key={wp.id || wp.nfcIdentifier}
              type="button"
              onClick={() => onClockInAction('office', wp.name, wp.nfcIdentifier)}
              className="w-full p-3.5 rounded-2xl bg-slate-100 hover:bg-amber-400/20 dark:bg-zinc-800 dark:hover:bg-amber-400/20 text-left transition-all flex items-center gap-3 cursor-pointer group"
            >
              <div className="w-9 h-9 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center shrink-0">
                <Building2 className="w-4 h-4 text-slate-950" />
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

      {/* MODAL 4: Pípnutí karty (NFC) s volbami "Jsem v kanceláři (bez ověření)" a "Jsem doma" */}
      <Modal
        isOpen={isNfcModalOpen}
        onClose={onCloseNfcModal}
        title="Přiložte telefon k NFC čipu"
        subtitle="Přiložte zadní stranu telefonu k recepční kartě na pobočce, nebo zvolte příchod bez čipu."
        icon={Smartphone}
        iconBgClass="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400"
        size="sm"
        footer={
          <div className="w-full">
            <Button
              variant="ghost"
              size="md"
              onClick={onCloseNfcModal}
              fullWidth
            >
              Zrušit
            </Button>
          </div>
        }
      >
        <div className="space-y-4 py-2">
          {/* Submarine sonar pulsing background around smartphone icon */}
          <div className="relative w-32 h-32 mx-auto flex items-center justify-center my-2">
            <span className="absolute w-16 h-16 rounded-full bg-emerald-500/25 dark:bg-emerald-400/20 border border-emerald-500/40 dark:border-emerald-400/35 animate-sonar-1 pointer-events-none" />
            <span className="absolute w-16 h-16 rounded-full bg-emerald-500/20 dark:bg-emerald-400/15 border border-emerald-500/35 dark:border-emerald-400/30 animate-sonar-2 pointer-events-none" />
            <span className="absolute w-16 h-16 rounded-full bg-emerald-500/15 dark:bg-emerald-400/10 border border-emerald-500/25 dark:border-emerald-400/20 animate-sonar-3 pointer-events-none" />
            <div className="relative z-10 w-20 h-20 rounded-full bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-500/30 dark:border-emerald-400/30 shadow-lg shadow-emerald-500/15 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Smartphone className="w-10 h-10" />
            </div>
          </div>

          <div className="text-center text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-zinc-500 select-none">
            nebo
          </div>

          <div className="space-y-2 pt-1">
            <Button
              variant="surface"
              size="lg"
              className="w-full justify-center"
              icon={Building2}
              onClick={() => onClockInAction('office', 'Kancelář (bez ověření)')}
            >
              Jsem v kanceláři (bez ověření)
            </Button>

            <Button
              variant="surface"
              size="lg"
              className="w-full justify-center"
              icon={Home}
              onClick={() => onClockInAction('home_office')}
            >
              Jsem doma (Home Office)
            </Button>
          </div>
        </div>
      </Modal>

      {/* MODAL 5: Odchod z Home Office (Konec vs. Pauza) */}
      <Modal
        isOpen={isHoLeaveModalOpen}
        onClose={onCloseHoLeaveModal}
        title="Ukončení práce na Home Office"
        subtitle="Zvolte, zda končíte pro dnešek definitivně, nebo jdete pouze na dočasnou pauzu."
        icon={Home}
        iconBgClass="bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400"
        size="sm"
        footer={
          <div className="w-full">
            <Button
              variant="ghost"
              size="md"
              onClick={onCloseHoLeaveModal}
              fullWidth
            >
              Zpět
            </Button>
          </div>
        }
      >
        <div className="space-y-3 pt-2">
          <button
            type="button"
            onClick={() => onFinishClockOut(false)}
            className="w-full p-4 rounded-2xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-950/50 text-left transition-all group"
          >
            <div className="font-semibold text-rose-700 dark:text-rose-400 text-sm">Konec práce pro dnešek</div>
            <div className="text-xs text-rose-600/70 dark:text-rose-300/70 mt-0.5">
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

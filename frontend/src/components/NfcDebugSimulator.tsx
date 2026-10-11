import React, { useState } from 'react';
import { Smartphone, CheckCircle2, AlertOctagon, X, ShieldAlert } from 'lucide-react';

interface NfcDebugSimulatorProps {
  onSimulateClockIn: (identifier: string, locationType: 'office' | 'home_office' | 'invalid') => void;
}

export const NfcDebugSimulator: React.FC<NfcDebugSimulatorProps> = ({ onSimulateClockIn }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [lastAction, setLastAction] = useState<string | null>(null);

  // Zobrazit pouze v vývojovém režimu dle specifikace
  if (!import.meta.env.DEV) {
    return null;
  }

  const trigger = (name: string, id: string, type: 'office' | 'home_office' | 'invalid') => {
    setLastAction(name);
    onSimulateClockIn(id, type);
    setTimeout(() => setLastAction(null), 3000);
  };

  return (
    <div className="fixed bottom-4 left-4 z-50 font-sans">
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 bg-zinc-900/90 hover:bg-zinc-900 text-white px-4 py-2.5 rounded-full shadow-lg text-xs font-medium backdrop-blur-md transition-all hover:scale-105"
        >
          <Smartphone className="w-4 h-4 text-emerald-400" />
          <span>NFC Debug Simulator</span>
          {lastAction && (
            <span className="ml-1 px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded-full text-[10px]">
              {lastAction}
            </span>
          )}
        </button>
      ) : (
        <div className="bg-zinc-900/95 text-white p-5 rounded-3xl shadow-2xl w-80 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
            <div className="flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-emerald-400" />
              <span className="font-semibold text-sm">NFC Hardware Simulátor</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-xs text-zinc-400 mt-2.5 mb-3 leading-relaxed">
            Simulace přiložení fyzického telefonu k hardwarovým tagům na recepci bez nutnosti reálného čipu.
          </p>

          <div className="space-y-2">
            <button
              onClick={() => trigger('Praha 1', 'praha1', 'office')}
              className="w-full text-left flex items-center justify-between p-2.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-800 text-xs font-medium transition-all group"
            >
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
                <span>Pobočka Praha (NTAG 424 SUN)</span>
              </div>
              <span className="text-[10px] text-zinc-500 font-mono">200 OK</span>
            </button>

            <button
              onClick={() => trigger('Brno 1', 'brno1', 'office')}
              className="w-full text-left flex items-center justify-between p-2.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-800 text-xs font-medium transition-all group"
            >
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-sky-400 group-hover:scale-110 transition-transform" />
                <span>Pobočka Brno (NTAG 213 UID)</span>
              </div>
              <span className="text-[10px] text-zinc-500 font-mono">UID</span>
            </button>

            <button
              onClick={() => trigger('Neznámý čip', 'unknown_tag_99', 'invalid')}
              className="w-full text-left flex items-center justify-between p-2.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-800 text-xs font-medium transition-all group"
            >
              <div className="flex items-center gap-2.5">
                <AlertOctagon className="w-4 h-4 text-rose-400 group-hover:scale-110 transition-transform" />
                <span>Neautorizovaný NFC čip</span>
              </div>
              <span className="text-[10px] text-rose-400/80 font-mono">403 ERR</span>
            </button>

            <button
              onClick={() => trigger('Replay útok', 'replay_attack', 'invalid')}
              className="w-full text-left flex items-center justify-between p-2.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-800 text-xs font-medium transition-all group"
            >
              <div className="flex items-center gap-2.5">
                <ShieldAlert className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
                <span>Simulovat Replay útok</span>
              </div>
              <span className="text-[10px] text-amber-400/80 font-mono">400 REPLAY</span>
            </button>
          </div>

          <div className="mt-4 pt-3 border-t border-zinc-800/80 text-[10px] text-zinc-500 flex items-center justify-between">
            <span>Dev environment: Active</span>
            <span className="text-emerald-400 font-mono">Port 5200</span>
          </div>
        </div>
      )}
    </div>
  );
};

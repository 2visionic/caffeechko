import { useState } from 'react';
import {
  Settings,
  Sun,
  Moon,
  Bell,
  Volume2,
  ShieldCheck,
  Check,
  ExternalLink
} from 'lucide-react';
import { Modal, Button, UserAvatar, ContractBadge } from './ui';
import { RoleBadge } from './RoleBadge';
import type { Persona } from '../App';

export interface UserSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  activePersona: Persona;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onOpenSystemSettings?: () => void;
  addToast: (type: 'success' | 'warning' | 'error', title: string, message: string) => void;
}

export function UserSettingsModal({
  isOpen,
  onClose,
  activePersona,
  darkMode,
  onToggleDarkMode,
  onOpenSystemSettings,
  addToast
}: UserSettingsModalProps) {
  // Uživatelské předvolby (lokální stav)
  const [notifyForgottenClockout, setNotifyForgottenClockout] = useState(true);
  const [notifyRequestApproval, setNotifyRequestApproval] = useState(true);
  const [soundFeedback, setSoundFeedback] = useState(true);

  const isAdminOrOfficer = activePersona.role === 'admin' || activePersona.role === 'office_manager';

  const handleSave = () => {
    addToast('success', 'Předvolby uloženy', 'Vaše uživatelské nastavení bylo úspěšně uloženo.');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Uživatelské nastavení"
      subtitle="Osobní předvolby, vzhled aplikace a systémová oznámení"
      icon={Settings}
      iconBgClass="bg-amber-500/15 text-amber-700 dark:text-amber-400"
      size="lg"
      footer={
        <div className="flex items-center justify-end gap-3 w-full">
          <Button variant="ghost" onClick={onClose}>
            Zavřít
          </Button>
          <Button variant="filled" colorKey="amber" onClick={handleSave}>
            Uložit předvolby
          </Button>
        </div>
      }
    >
      <div className="space-y-6 py-2">
        {/* 1. Profilová karta uživatele */}
        <div className="p-4 rounded-3xl bg-slate-50 dark:bg-zinc-800/50 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3.5 min-w-0">
            <UserAvatar name={activePersona.name} size="lg" isCurrent />
            <div className="min-w-0">
              <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                {activePersona.name}
              </div>
              <div className="text-xs text-slate-500 dark:text-zinc-400 truncate">
                {activePersona.email || 'uživatel bez e-mailu'}
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <RoleBadge role={activePersona.role} roleLabel={activePersona.roleLabel} />
                <ContractBadge contract={activePersona.contract} />
              </div>
            </div>
          </div>
        </div>

        {/* 2. Vzhled a motiv aplikace */}
        <div className="space-y-2.5">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 font-mono">
            Vzhled a motiv aplikace
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                if (darkMode) onToggleDarkMode();
              }}
              className={`p-3.5 rounded-2xl flex items-center gap-3 transition-all cursor-pointer ${
                !darkMode
                  ? 'bg-amber-500/15 text-amber-950 dark:text-amber-200 font-bold ring-2 ring-amber-500/40 shadow-xs'
                  : 'bg-slate-100 dark:bg-zinc-800/60 text-slate-600 dark:text-zinc-400 hover:bg-slate-200/70 dark:hover:bg-zinc-800'
              }`}
            >
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-600 flex items-center justify-center flex-shrink-0">
                <Sun className="w-4 h-4" />
              </div>
              <div className="text-left min-w-0">
                <div className="text-xs font-semibold">Světlý režim</div>
                <div className="text-[11px] text-slate-400 dark:text-zinc-500 font-normal">Denní zobrazení</div>
              </div>
              {!darkMode && <Check className="w-4 h-4 ml-auto text-amber-600 flex-shrink-0" />}
            </button>

            <button
              type="button"
              onClick={() => {
                if (!darkMode) onToggleDarkMode();
              }}
              className={`p-3.5 rounded-2xl flex items-center gap-3 transition-all cursor-pointer ${
                darkMode
                  ? 'bg-amber-500/15 text-amber-950 dark:text-amber-200 font-bold ring-2 ring-amber-500/40 shadow-xs'
                  : 'bg-slate-100 dark:bg-zinc-800/60 text-slate-600 dark:text-zinc-400 hover:bg-slate-200/70 dark:hover:bg-zinc-800'
              }`}
            >
              <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center flex-shrink-0">
                <Moon className="w-4 h-4" />
              </div>
              <div className="text-left min-w-0">
                <div className="text-xs font-semibold">Tmavý režim</div>
                <div className="text-[11px] text-slate-400 dark:text-zinc-500 font-normal">Noční / šetrný</div>
              </div>
              {darkMode && <Check className="w-4 h-4 ml-auto text-amber-400 flex-shrink-0" />}
            </button>
          </div>
        </div>

        {/* 3. Osobní oznámení a připomenutí */}
        <div className="space-y-2.5">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 font-mono">
            Oznámení a chování docházky
          </label>
          <div className="space-y-2">
            <label className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-800/40 hover:bg-slate-100/80 dark:hover:bg-zinc-800/70 transition-colors cursor-pointer">
              <div className="flex items-center gap-3 min-w-0">
                <Bell className="w-4.5 h-4.5 text-slate-500 dark:text-zinc-400 flex-shrink-0" />
                <div>
                  <div className="text-xs font-semibold text-slate-800 dark:text-zinc-200">
                    Upozornění na zapomenutý odchod
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-zinc-400">
                    Zaslat e-mailové upozornění, pokud nedojde k odpípnutí do 19:00
                  </div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={notifyForgottenClockout}
                onChange={(e) => setNotifyForgottenClockout(e.target.checked)}
                className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-800/40 hover:bg-slate-100/80 dark:hover:bg-zinc-800/70 transition-colors cursor-pointer">
              <div className="flex items-center gap-3 min-w-0">
                <ShieldCheck className="w-4.5 h-4.5 text-slate-500 dark:text-zinc-400 flex-shrink-0" />
                <div>
                  <div className="text-xs font-semibold text-slate-800 dark:text-zinc-200">
                    Notifikace o schválení žádostí
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-zinc-400">
                    Oznámení při schválení nebo zamítnutí vaší dovolené a propustky
                  </div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={notifyRequestApproval}
                onChange={(e) => setNotifyRequestApproval(e.target.checked)}
                className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-800/40 hover:bg-slate-100/80 dark:hover:bg-zinc-800/70 transition-colors cursor-pointer">
              <div className="flex items-center gap-3 min-w-0">
                <Volume2 className="w-4.5 h-4.5 text-slate-500 dark:text-zinc-400 flex-shrink-0" />
                <div>
                  <div className="text-xs font-semibold text-slate-800 dark:text-zinc-200">
                    Zvuková odezva terminálu
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-zinc-400">
                    Krátké pípnutí při úspěšném zaznamenání příchodu a odchodu
                  </div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={soundFeedback}
                onChange={(e) => setSoundFeedback(e.target.checked)}
                className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
              />
            </label>
          </div>
        </div>

        {/* 4. Odkaz na správu systému pro Adminy a Officery */}
        {isAdminOrOfficer && onOpenSystemSettings && (
          <div className="pt-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenSystemSettings();
              }}
              className="w-full p-3 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-900 dark:text-amber-300 text-xs font-semibold transition-all flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>Přejít do globální administrace (Nastavení systému)</span>
              </div>
              <ExternalLink className="w-3.5 h-3.5 opacity-70" />
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}

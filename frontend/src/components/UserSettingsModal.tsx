import {
  Settings,
  Sun,
  Moon,
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
  onOpenSystemSettings
}: UserSettingsModalProps) {
  const isAdminOrOfficer = activePersona.role === 'admin' || activePersona.role === 'office_manager';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Uživatelské nastavení"
      subtitle="Přehled účtu a nastavení vzhledu aplikace"
      icon={Settings}
      iconBgClass="bg-amber-500/15 text-amber-700 dark:text-amber-400"
      size="lg"
      footer={
        <div className="flex items-center justify-end gap-3 w-full">
          <Button
            variant="ghost"
            colorKey="rose"
            onClick={onClose}
            className="text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300"
          >
            Zavřít
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
                <ContractBadge
                  contract={activePersona.contract}
                  contractType={activePersona.contractType}
                  contractTypeName={activePersona.contractTypeName}
                />
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

        {/* 3. Odkaz na správu systému pro Adminy a Officery */}
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


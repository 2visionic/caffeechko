import { useState, useEffect, useRef } from 'react';
import {
  ChevronDown,
  ShieldCheck,
  Check,
  Trash2,
  RotateCcw,
  UserX,
  Settings,
  X
} from 'lucide-react';
import type { DevConfig, DatabaseMode, DevDatabaseStatus } from '../api';
import { formatContractLabel, type Persona } from '../types/attendance';
import { getRoleConfig } from './RoleBadge';
import { ANONYMOUS_PERSONA } from '../config/personas';

interface DevToolbarProps {
  isDevVisible: boolean;
  onCloseDevMode: () => void;
  isDbConnected: boolean;
  dbMode: DatabaseMode;
  onSwitchDatabaseMode: (mode: DatabaseMode) => void;
  onWipeCleanDb: () => void;
  isWipingCleanDb: boolean;
  onResetDevDb: () => void;
  isResettingDevDb: boolean;
  onClearLogs: () => void;
  isClearingLogs: boolean;
  devConfig: DevConfig;
  onOpenDevConfigModal: () => void;
  cleanInstalled: boolean;
  cleanAdminUser: Persona | null;
  dbStatus: DevDatabaseStatus | null;
  activePersona: Persona;
  effectivePersonas: Persona[];
  onSwitchPersona: (persona: Persona) => void;
}

export function DevToolbar({
  isDevVisible,
  onCloseDevMode,
  isDbConnected,
  dbMode,
  onSwitchDatabaseMode,
  onWipeCleanDb,
  isWipingCleanDb,
  onResetDevDb,
  isResettingDevDb,
  onClearLogs,
  isClearingLogs,
  devConfig,
  onOpenDevConfigModal,
  cleanInstalled,
  cleanAdminUser,
  dbStatus,
  activePersona,
  effectivePersonas,
  onSwitchPersona
}: DevToolbarProps) {
  const [isPersonaDropdownOpen, setIsPersonaDropdownOpen] = useState(false);
  const personaDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (personaDropdownRef.current && !personaDropdownRef.current.contains(event.target as Node)) {
        setIsPersonaDropdownOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsPersonaDropdownOpen(false);
      }
    }
    if (isPersonaDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isPersonaDropdownOpen]);

  if (!isDevVisible) return null;

  return (
    <div className="w-full bg-yellow-400 text-slate-950 px-4 sm:px-6 lg:px-8 py-2 text-xs border-b border-yellow-500/80 shadow-sm">
      <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 font-extrabold text-slate-950">
            <ShieldCheck className="w-4 h-4 text-slate-950 flex-shrink-0" />
            <span className="tracking-wide">DEV REŽIM:</span>
            <span
              className={`w-2 h-2 rounded-full ${isDbConnected ? 'bg-emerald-600' : 'bg-amber-600'}`}
              title={isDbConnected ? 'SQLite DB připojena' : 'Lokální offline stav'}
            />
          </div>

          {/* Database Switcher */}
          <div className="flex items-center p-0.5 bg-yellow-500/50 rounded-xl text-[11px] font-semibold border border-yellow-600/30">
            <button
              type="button"
              onClick={() => onSwitchDatabaseMode('dev')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all ${
                dbMode === 'dev'
                  ? 'bg-slate-950 text-white shadow-sm font-bold'
                  : 'text-slate-950/80 hover:text-slate-950 font-semibold hover:bg-yellow-500/40'
              }`}
              title="Přepnout na testovací databázi se seedovanými uživateli a strukturou (dochazka_dev.db)"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>Test (dochazka_dev.db)</span>
            </button>

            <button
              type="button"
              onClick={() => onSwitchDatabaseMode('clean')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all ${
                dbMode === 'clean'
                  ? 'bg-slate-950 text-white shadow-sm font-bold'
                  : 'text-slate-950/80 hover:text-slate-950 font-semibold hover:bg-yellow-500/40'
              }`}
              title="Přepnout na čistou databázi pro simulaci instalace (dochazka_clean.db)"
            >
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span>Instal (dochazka_clean.db)</span>
            </button>
          </div>

          {/* Wipe Clean DB Button - shown when clean mode is active */}
          {dbMode === 'clean' && (
            <button
              type="button"
              onClick={onWipeCleanDb}
              disabled={isWipingCleanDb}
              className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-semibold text-[11px] transition-colors shadow-sm"
              title="Smaže všechny tabulky a struktury z dochazka_clean.db a umožní znovu vyzkoušet instalaci od nuly"
            >
              <Trash2 className="w-3.5 h-3.5 text-white" />
              <span>{isWipingCleanDb ? 'Mažu...' : 'Reset DB'}</span>
            </button>
          )}

          {/* Reset Dev DB Button - shown when dev mode is active */}
          {dbMode === 'dev' && (
            <button
              type="button"
              onClick={onResetDevDb}
              disabled={isResettingDevDb}
              className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-yellow-500/50 hover:bg-yellow-500/80 active:bg-yellow-600/50 text-slate-950 font-semibold text-[11px] transition-colors border border-yellow-600/30"
              title="Smaže lokální testovací data a obnoví vývojářskou databázi ze šablony dochazka_dev.template.db"
            >
              <RotateCcw className={`w-3.5 h-3.5 text-slate-950 ${isResettingDevDb ? 'animate-spin' : ''}`} />
              <span>{isResettingDevDb ? 'Obnovuji...' : 'Resetovat DB do šablony'}</span>
            </button>
          )}

          {/* Clear Logs Button */}
          <button
            type="button"
            onClick={onClearLogs}
            disabled={isClearingLogs}
            className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-yellow-500/50 hover:bg-yellow-500/80 active:bg-yellow-600/50 text-slate-950 font-semibold text-[11px] transition-colors border border-yellow-600/30"
            title="Vyprázdní všechny záznamy z tabulky logs v databázi"
          >
            <Trash2 className="w-3.5 h-3.5 text-slate-950" />
            <span>{isClearingLogs ? 'Mažu...' : 'Vyprázdnit log'}</span>
          </button>

          {/* Dev Environment Config Wizard Button */}
          <button
            type="button"
            onClick={onOpenDevConfigModal}
            className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-yellow-500/50 hover:bg-yellow-500/80 active:bg-yellow-600/50 text-slate-950 font-semibold text-[11px] transition-colors border border-yellow-600/30"
            title="Nastavení firmy, oAuth domény a parametrů databáze (zapisuje do lokálního appsettings.Development.json)"
          >
            <Settings className="w-3.5 h-3.5 text-slate-950" />
            <span>Nastavení ({devConfig.companyName} / @{devConfig.googleWorkspaceDomain})</span>
          </button>
        </div>

        {/* Right section: Persona selector & Close DEV bar button */}
        <div className="flex items-center gap-2 self-end sm:self-auto flex-shrink-0">
          {/* Persona selector only shown in Test DB mode */}
          {dbMode === 'clean' ? (
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono px-3 py-1.5 rounded-xl bg-yellow-500/50 text-slate-950 font-semibold border border-yellow-600/30">
                {cleanInstalled && cleanAdminUser
                  ? `Správce: ${cleanAdminUser.name}`
                  : `Čistý stav: Neinstalováno (${dbStatus?.userCount ?? 0} osob)`}
              </span>
            </div>
          ) : (
            <div className="relative" ref={personaDropdownRef}>
              <button
                onClick={() => setIsPersonaDropdownOpen(!isPersonaDropdownOpen)}
                className={`flex items-center justify-between gap-2.5 px-3 py-1.5 rounded-2xl transition-all shadow-sm group ${
                  activePersona.id === 'anonymous'
                    ? 'bg-slate-900/10 hover:bg-slate-900/20 text-slate-950 border border-yellow-600/30'
                    : 'bg-white hover:bg-white/95 text-slate-950 font-medium border border-yellow-500/40 shadow-sm'
                }`}
                title="Klikněte pro změnu přihlášeného testovacího uživatele"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className={`w-6 h-6 rounded-full font-bold text-[10px] flex items-center justify-center flex-shrink-0 ${
                      activePersona.id === 'anonymous'
                        ? 'bg-slate-700 text-white'
                        : 'bg-yellow-400 text-slate-950 border border-yellow-500'
                    }`}
                  >
                    {activePersona.id === 'anonymous' ? (
                      <UserX className="w-3.5 h-3.5" />
                    ) : (
                      (activePersona.name || '?')
                        .split(' ')
                        .filter(Boolean)
                        .map((n) => n[0])
                        .join('')
                    )}
                  </div>
                  <span className="font-bold text-xs truncate max-w-[130px] sm:max-w-[160px]">
                    {activePersona.name}
                  </span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ${
                      activePersona.id === 'anonymous'
                        ? 'bg-slate-300 text-slate-800'
                        : 'bg-yellow-100 text-yellow-900'
                    }`}
                  >
                    {activePersona.roleLabel.split('/')[0].trim()}
                  </span>
                </div>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform flex-shrink-0 text-slate-950 ${isPersonaDropdownOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {isPersonaDropdownOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-3xl bg-white dark:bg-zinc-900 shadow-2xl p-2.5 z-50 animate-in fade-in zoom-in-95 duration-150 space-y-1">
                  <div className="px-3 py-2 text-[11px] font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider font-mono flex items-center justify-between">
                    <span>Vyberte testovací osobu</span>
                    <span className="text-yellow-700 dark:text-yellow-400 font-bold font-mono text-[10px]">5 rolí + odhlášeno</span>
                  </div>
                  <div className="max-h-96 overflow-y-auto space-y-1 pr-1">
                    {/* Volba: Nepřihlášená osoba */}
                    <button
                      type="button"
                      onClick={() => {
                        onSwitchPersona(ANONYMOUS_PERSONA);
                        setIsPersonaDropdownOpen(false);
                      }}
                      className={`w-full p-2.5 rounded-2xl text-left transition-all flex items-center justify-between gap-3 ${
                        activePersona.id === 'anonymous'
                          ? 'bg-slate-200/80 dark:bg-zinc-800 text-slate-900 dark:text-white font-bold'
                          : 'hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 ${
                            activePersona.id === 'anonymous'
                              ? 'bg-slate-700 dark:bg-zinc-300 text-white dark:text-zinc-900'
                              : 'bg-slate-200 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300'
                          }`}
                        >
                          <UserX className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold truncate flex items-center gap-1.5">
                            <span>Nepřihlášená osoba</span>
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-zinc-400 truncate mt-0.5">
                            Odhlášený stav • bez aktivní session
                          </div>
                        </div>
                      </div>
                      {activePersona.id === 'anonymous' && (
                        <Check className="w-4 h-4 text-slate-700 dark:text-slate-300 flex-shrink-0" />
                      )}
                    </button>

                    <div className="my-1 border-t border-slate-100 dark:border-zinc-800/80" />

                    {effectivePersonas.map((p) => {
                      const isSelected = p.id === activePersona.id;
                      const roleBadgeColor = getRoleConfig(p.role, p.roleLabel).badgeClass;

                      return (
                        <button
                          key={p.id}
                          onClick={() => {
                            onSwitchPersona(p);
                            setIsPersonaDropdownOpen(false);
                          }}
                          className={`w-full p-2.5 rounded-2xl text-left transition-all flex items-center justify-between gap-3 ${
                            isSelected
                              ? 'bg-yellow-400/25 text-yellow-950 dark:text-yellow-100 font-bold'
                              : 'hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-800 dark:text-zinc-200'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 ${
                                isSelected
                                  ? 'bg-yellow-500 text-slate-950'
                                  : 'bg-slate-200 dark:bg-zinc-700 text-slate-700 dark:text-zinc-300'
                              }`}
                            >
                              {(p.name || '?')
                                .split(' ')
                                .filter(Boolean)
                                .map((n) => n[0])
                                .join('')}
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-bold truncate flex items-center gap-1.5">
                                <span>{p.name}</span>
                                <span className="text-[10px] font-normal opacity-70">
                                  ({formatContractLabel(p.contract, p.contractType, p.contractTypeName)})
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-zinc-400 truncate flex items-center gap-1.5 mt-0.5">
                                <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-semibold ${roleBadgeColor}`}>
                                  {p.roleLabel}
                                </span>
                              </div>
                            </div>
                          </div>
                          {isSelected && (
                            <Check className="w-4 h-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Close Dev Mode button - completely on the far right */}
          <button
            type="button"
            onClick={onCloseDevMode}
            className="p-1.5 rounded-xl bg-yellow-500/40 hover:bg-yellow-500/80 active:bg-yellow-600/60 text-slate-950 transition-colors flex items-center justify-center flex-shrink-0 border border-yellow-600/30"
            title="Skrýt vývojářský režim (při obnovení stránky se znovu objeví)"
            aria-label="Skrýt DEV režim"
          >
            <X className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>
      </div>
    </div>
  );
}

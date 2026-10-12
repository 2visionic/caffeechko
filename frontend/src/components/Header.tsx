import React, { useState, useRef, useEffect } from 'react';
import {
  Coffee,
  Sun,
  Moon,
  X,
  Settings,
  User,
  LogOut,
  Menu
} from 'lucide-react';
import type { DevConfig, DatabaseMode } from '../api';
import { UserAvatar, ContractBadge } from './ui';


export interface HeaderPersona {
  id: string;
  name: string;
  email?: string;
  roleLabel?: string;
  contract?: string;
  isApproved?: boolean;
}

export interface HeaderProps {
  devConfig: DevConfig;
  activePersona: HeaderPersona;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  isClockedIn: boolean;
  dbMode: DatabaseMode;
  cleanInstalled: boolean;
  isDevVisible: boolean;
  onToggleDevVisible: () => void;
  onOpenSettings: () => void;
  onLogout: () => void;
  addToast: (type: 'success' | 'warning' | 'error', title: string, message: string) => void;
  onToggleMobileMenu?: () => void;
  isMobileMenuOpen?: boolean;
}

/**
 * Main application header with M3 tonal elevation and Google-style profile menu.
 */
export const Header: React.FC<HeaderProps> = ({
  devConfig,
  activePersona,
  darkMode,
  onToggleDarkMode,
  isClockedIn,
  dbMode,
  cleanInstalled,
  isDevVisible,
  onToggleDevVisible,
  onOpenSettings,
  onLogout,
  addToast,
  onToggleMobileMenu,
  isMobileMenuOpen
}) => {
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);

  const isCompactLayout =
    activePersona.id === 'anonymous' ||
    activePersona.isApproved === false ||
    (!cleanInstalled && dbMode === 'clean');

  // Close profile dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };
    if (isProfileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isProfileMenuOpen]);

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md shadow-sm">
      <div
        className={`${
          isCompactLayout ? 'max-w-4xl' : 'max-w-[1256px]'
        } mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3`}
      >
        {/* Logo & Company Instance */}
        <div className="flex items-center gap-3">
          {/* Hamburger Menu Toggle (appears on smaller screens in front of caffeechko logo) */}
          {onToggleMobileMenu && (
            <button
              type="button"
              onClick={onToggleMobileMenu}
              className="lg:hidden p-2 rounded-xl text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors -ml-1 cursor-pointer"
              title={isMobileMenuOpen ? 'Zavřít navigaci' : 'Otevřít navigaci'}
              aria-label="Přepnout navigaci"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}

          <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-700 dark:text-amber-400 flex items-center justify-center shadow-sm flex-shrink-0">
            <Coffee className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-base leading-tight tracking-tight text-slate-900 dark:text-white">
                {devConfig.appName || 'caffeechko'}
              </h1>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-800 dark:text-amber-300 font-semibold">
                {devConfig.instanceName || 'firma'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400">
              {devConfig.companyName
                ? `${devConfig.companyName} • docházkový systém`
                : 'firemní docházkový systém'}
            </p>
          </div>
        </div>

        {/* Header Action Tools */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Dark Mode Toggle */}
          <button
            type="button"
            onClick={onToggleDarkMode}
            className="p-2.5 rounded-full bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 transition-colors"
            title={darkMode ? 'Přepnout na světlý režim' : 'Přepnout na tmavý režim'}
          >
            {darkMode ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-slate-700" />
            )}
          </button>

          {/* Dev Mode Restore Toggle (shown only when dev bar is hidden) */}
          {!isDevVisible && (
            <button
              type="button"
              onClick={onToggleDevVisible}
              className="px-2.5 py-1 rounded-xl bg-yellow-400 hover:bg-yellow-500 active:bg-yellow-600 text-slate-950 font-mono text-[11px] font-bold shadow-xs transition-colors"
              title="Znovu zobrazit vývojářský režim"
            >
              DEV
            </button>
          )}

          {/* User Profile Badge (No borders) */}
          {dbMode === 'clean' && !cleanInstalled ? (
            <div className="flex items-center gap-2 pl-2">
              <span className="text-xs font-mono px-3 py-1.5 rounded-xl bg-amber-500/15 text-amber-900 dark:text-amber-300 font-semibold">
                Před instalací (0 osob)
              </span>
            </div>
          ) : activePersona.id === 'anonymous' ? (
            <div className="flex items-center gap-2 pl-2">
              <span className="text-xs font-mono px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 font-semibold">
                Nepřihlášen
              </span>
            </div>
          ) : (
            <div className="relative pl-2" ref={profileMenuRef}>
              {/* Profile Trigger Button (Avatar only) */}
              <button
                type="button"
                onClick={() => setIsProfileMenuOpen((prev) => !prev)}
                className="rounded-full p-0.5 transition-transform active:scale-95 focus:outline-none cursor-pointer"
                title={`Profil: ${activePersona.name}`}
              >
                <UserAvatar
                  name={activePersona.name}
                  size="md"
                  isCurrent
                  isOnline={isClockedIn}
                />
              </button>

              {/* Google-style Profile Context Card */}
              {isProfileMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-88 sm:w-[360px] rounded-[28px] bg-[#f0f4f9] dark:bg-[#1f2022] p-3.5 shadow-2xl shadow-slate-900/20 dark:shadow-black/70 z-50 animate-in fade-in zoom-in-95 duration-150">
                  {/* Top row: Close button */}
                  <div className="flex justify-end pb-1 pr-0.5">
                    <button
                      type="button"
                      onClick={() => setIsProfileMenuOpen(false)}
                      className="w-8 h-8 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-slate-200/60 dark:hover:bg-white/10 transition-colors cursor-pointer"
                      title="Zavřít"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Karta přihlášené osoby (Google Capsule Card) */}
                  <div className="p-4 rounded-3xl bg-white dark:bg-[#131314] flex items-center gap-3.5 shadow-xs">
                    <UserAvatar
                      name={activePersona.name}
                      size="xl"
                      isCurrent
                      isOnline={isClockedIn}
                    />

                    <div className="min-w-0 flex-1">
                      <div className="text-[15px] font-semibold text-slate-900 dark:text-white truncate leading-tight">
                        {activePersona.name}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-zinc-400 truncate mt-0.5 font-normal">
                        {activePersona.email || 'uživatel bez e-mailu'}
                      </div>
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300">
                          {activePersona.roleLabel}
                        </span>
                        <ContractBadge contract={activePersona.contract} />
                      </div>
                    </div>
                  </div>

                  {/* Skupinové menu */}
                  <div className="mt-2.5 space-y-0.5">
                    {/* Nastavení */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        onOpenSettings();
                      }}
                      className="w-full h-[52px] px-4 rounded-t-[20px] rounded-b-[4px] bg-white dark:bg-[#131314] hover:bg-slate-50 dark:hover:bg-zinc-800/80 transition-all flex items-center gap-3.5 text-left active:scale-[0.99] shadow-xs"
                    >
                      <div className="w-5 flex items-center justify-center flex-shrink-0">
                        <Settings className="w-4.5 h-4.5 text-slate-600 dark:text-zinc-300" />
                      </div>
                      <span className="text-sm font-medium text-slate-800 dark:text-zinc-100">
                        Nastavení
                      </span>
                    </button>

                    {/* Můj profil */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        addToast('warning', 'Můj profil', 'Profilová karta uživatele se připravuje.');
                      }}
                      className="w-full h-[52px] px-4 rounded-[4px] bg-white dark:bg-[#131314] hover:bg-slate-50 dark:hover:bg-zinc-800/80 transition-all flex items-center gap-3.5 text-left active:scale-[0.99] shadow-xs"
                    >
                      <div className="w-5 flex items-center justify-center flex-shrink-0">
                        <User className="w-4.5 h-4.5 text-slate-600 dark:text-zinc-300" />
                      </div>
                      <span className="text-sm font-medium text-slate-800 dark:text-zinc-100">
                        Můj profil
                      </span>
                    </button>

                    {/* Odhlásit se */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        onLogout();
                      }}
                      className="w-full h-[52px] px-4 rounded-b-[20px] rounded-t-[4px] bg-white dark:bg-[#131314] hover:bg-rose-50 dark:hover:bg-rose-950/25 transition-all flex items-center gap-3.5 text-left text-rose-600 dark:text-rose-400 active:scale-[0.99] shadow-xs"
                    >
                      <div className="w-5 flex items-center justify-center flex-shrink-0">
                        <LogOut className="w-4.5 h-4.5 text-rose-600 dark:text-rose-400" />
                      </div>
                      <span className="text-sm font-medium text-rose-600 dark:text-rose-400">
                        Odhlásit se
                      </span>
                    </button>
                  </div>

                  <div className="mt-3.5 pb-1 text-center text-[11px] font-mono text-slate-400 dark:text-zinc-500">
                    caffeechko v0.3 • Bezpečné odhlášení
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

import React, { useState, useRef, useEffect } from 'react';
import {
  Coffee,
  Sun,
  Moon,
  X,
  User,
  Settings,
  LogOut,
  Menu,
  Search
} from 'lucide-react';
import type { DevConfig, DatabaseMode } from '../api';
import type { Persona } from '../types/attendance';
import type { StatusType } from '../config/presenceConfig';
import { UserAvatar, ContractBadge } from './ui';
import { RoleBadge } from './RoleBadge';
import { canAccessPersonaDetail } from './WhoIsWhereBox';

export interface HeaderPersona {
  id: string;
  name: string;
  email?: string;
  role?: string;
  roleLabel?: string;
  contract?: string;
  contractType?: string;
  contractTypeName?: string;
  isApproved?: boolean;
  isPermanentHomeOffice?: boolean;
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
  personasList?: Persona[];
  getPersonaStatus?: (p: Persona) => { statusText: string; statusColor: string; locationType: StatusType };
  onSelectPersona?: (p: Persona) => void;
}

/**
 * Main application header with M3 tonal elevation, person search, and Google-style profile menu.
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
  isMobileMenuOpen,
  personasList = [],
  getPersonaStatus,
  onSelectPersona
}) => {
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const desktopSearchRef = useRef<HTMLDivElement | null>(null);
  const mobileSearchRef = useRef<HTMLDivElement | null>(null);
  const desktopInputRef = useRef<HTMLInputElement | null>(null);
  const mobileInputRef = useRef<HTMLInputElement | null>(null);
  const searchListRef = useRef<HTMLDivElement | null>(null);

  const isCompactLayout =
    activePersona.id === 'anonymous' ||
    activePersona.isApproved === false ||
    (!cleanInstalled && dbMode === 'clean');

  // Pouze osoby, do kterých se může přihlášený uživatel prokliknout (pokud žádné nejsou, vyhledávač se schová)
  const clickablePersonas = Boolean(onSelectPersona)
    ? personasList.filter((p) => canAccessPersonaDetail(activePersona as unknown as Persona, p))
    : [];
  const hasClickablePersonas = !isCompactLayout && clickablePersonas.length > 0;

  // Close profile dropdown & search dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
      if (
        (!desktopSearchRef.current || !desktopSearchRef.current.contains(event.target as Node)) &&
        (!mobileSearchRef.current || !mobileSearchRef.current.contains(event.target as Node))
      ) {
        setIsSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (isMobileSearchOpen) {
      setTimeout(() => mobileInputRef.current?.focus(), 50);
    }
  }, [isMobileSearchOpen]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [searchQuery, activePersona.id]);

  const normalizedQuery = searchQuery.toLowerCase().trim();
  const searchResults = normalizedQuery
    ? clickablePersonas.filter((p) => p.name.toLowerCase().includes(normalizedQuery))
    : clickablePersonas;

  const effectiveHighlightedIndex =
    searchResults.length > 0
      ? Math.min(Math.max(0, highlightedIndex), searchResults.length - 1)
      : 0;

  useEffect(() => {
    if (!searchListRef.current) return;
    const itemEl = searchListRef.current.querySelector<HTMLElement>(
      `[data-search-index="${effectiveHighlightedIndex}"]`
    );
    if (itemEl) {
      itemEl.scrollIntoView({ block: 'nearest' });
    }
  }, [effectiveHighlightedIndex]);

  const handleSelectPersonFromSearch = (person: Persona) => {
    if (onSelectPersona) {
      onSelectPersona(person);
      setIsSearchFocused(false);
      setIsMobileSearchOpen(false);
      setSearchQuery('');
      desktopInputRef.current?.blur();
      mobileInputRef.current?.blur();
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isSearchFocused) {
        setIsSearchFocused(true);
      }
      if (searchResults.length > 0) {
        setHighlightedIndex((prev) => (prev + 1) % searchResults.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isSearchFocused) {
        setIsSearchFocused(true);
      }
      if (searchResults.length > 0) {
        setHighlightedIndex((prev) => (prev - 1 + searchResults.length) % searchResults.length);
      }
    } else if (e.key === 'Enter') {
      if (searchResults.length > 0) {
        e.preventDefault();
        handleSelectPersonFromSearch(searchResults[effectiveHighlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsSearchFocused(false);
      setIsMobileSearchOpen(false);
      desktopInputRef.current?.blur();
      mobileInputRef.current?.blur();
    }
  };

  const renderSearchResultsDropdown = () => {
    if (!isSearchFocused && !normalizedQuery) return null;

    return (
      <div
        ref={searchListRef}
        className="absolute left-0 right-0 top-full mt-2 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-xl shadow-slate-900/15 dark:shadow-black/60 z-50 max-h-80 overflow-y-auto p-1.5 space-y-0.5"
      >
        {searchResults.length === 0 ? (
          <div className="py-4 px-3 text-center text-xs text-slate-400 dark:text-zinc-500">
            Žádná osoba neodpovídá hledání „{searchQuery}“.
          </div>
        ) : (
          searchResults.map((p, idx) => {
            const statusInfo = getPersonaStatus
              ? getPersonaStatus(p)
              : { statusText: 'Mimo práci', statusColor: 'slate', locationType: 'offline' as StatusType };
            const isHighlighted = idx === effectiveHighlightedIndex;

            return (
              <div
                key={p.id}
                data-search-index={idx}
                onMouseEnter={() => setHighlightedIndex(idx)}
                onClick={() => handleSelectPersonFromSearch(p)}
                className={`p-2.5 rounded-xl flex items-center gap-3 transition-colors cursor-pointer ${
                  isHighlighted
                    ? 'bg-amber-500/15 dark:bg-amber-500/20'
                    : 'hover:bg-amber-500/10 dark:hover:bg-amber-500/15'
                }`}
              >
                <UserAvatar
                  name={p.name}
                  size="sm"
                  statusType={statusInfo.locationType}
                  isPermanentHomeOffice={p.isPermanentHomeOffice}
                />
                <span className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white truncate">
                  {p.name}
                </span>
              </div>
            );
          })
        )}
      </div>
    );
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md shadow-sm">
      <div
        className={`${
          isCompactLayout ? 'max-w-4xl' : 'max-w-[1256px]'
        } mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3`}
      >
        {/* Logo & Company Instance */}
        <div className="flex items-center gap-3 shrink-0">
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

        {/* Desktop Person Search Bar in Floating Header */}
        {hasClickablePersonas && (
          <div ref={desktopSearchRef} className="hidden md:block relative flex-1 max-w-md mx-4">
            <div className="relative flex items-center h-10">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={desktopInputRef}
                type="text"
                value={searchQuery}
                onFocus={() => setIsSearchFocused(true)}
                onKeyDown={handleSearchKeyDown}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setIsSearchFocused(true);
                }}
                placeholder="Vyhledat osobu..."
                className="w-full h-10 pl-10 pr-9 text-sm rounded-2xl bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40 transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 cursor-pointer flex items-center justify-center"
                  title="Vymazat hledání"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            {isSearchFocused && renderSearchResultsDropdown()}
          </div>
        )}

        {/* Header Action Tools */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          {/* Mobile Search Lupa Button */}
          {hasClickablePersonas && (
            <button
              type="button"
              onClick={() => {
                setIsMobileSearchOpen((prev) => !prev);
                setIsSearchFocused(true);
              }}
              className={`md:hidden w-10 h-10 flex items-center justify-center rounded-full transition-colors cursor-pointer ${
                isMobileSearchOpen
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300'
              }`}
              title="Vyhledat osobu"
              aria-label="Vyhledat osobu"
            >
              <Search className="w-4 h-4" />
            </button>
          )}

          {/* Dark Mode Toggle */}
          <button
            type="button"
            onClick={onToggleDarkMode}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 transition-colors"
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
            <div className="relative pl-2 flex items-center" ref={profileMenuRef}>
              {/* Profile Trigger Button (Avatar only) */}
              <button
                type="button"
                onClick={() => setIsProfileMenuOpen((prev) => !prev)}
                className="rounded-full flex items-center justify-center transition-transform active:scale-95 focus:outline-none cursor-pointer"
                title={`Profil: ${activePersona.name}`}
              >
                <UserAvatar
                  name={activePersona.name}
                  size="md"
                  isCurrent
                  isOnline={isClockedIn}
                  isPermanentHomeOffice={activePersona.isPermanentHomeOffice}
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
                      isPermanentHomeOffice={activePersona.isPermanentHomeOffice}
                    />

                    <div className="min-w-0 flex-1">
                      <div className="text-[15px] font-semibold text-slate-900 dark:text-white truncate leading-tight">
                        {activePersona.name}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-zinc-400 truncate mt-0.5 font-normal">
                        {activePersona.email || 'uživatel bez e-mailu'}
                      </div>
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        <RoleBadge role={activePersona.role} roleLabel={activePersona.roleLabel} />
                        <ContractBadge
                          contract={activePersona.contract}
                          contractType={activePersona.contractType}
                          contractTypeName={activePersona.contractTypeName}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Skupinové menu */}
                  <div className="mt-2.5 space-y-0.5">
                    {/* Můj profil */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        addToast('warning', 'Můj profil', 'Profilová karta uživatele se připravuje.');
                      }}
                      className="w-full h-[52px] px-4 rounded-t-[20px] rounded-b-[4px] bg-white dark:bg-[#131314] hover:bg-slate-50 dark:hover:bg-zinc-800/80 transition-all flex items-center gap-3.5 text-left active:scale-[0.99] shadow-xs cursor-pointer"
                    >
                      <div className="w-5 flex items-center justify-center flex-shrink-0">
                        <User className="w-4.5 h-4.5 text-slate-600 dark:text-zinc-300" />
                      </div>
                      <span className="text-sm font-medium text-slate-800 dark:text-zinc-100">
                        Můj profil
                      </span>
                    </button>

                    {/* Nastavení (Uživatelské nastavení - přístupné všem) */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        onOpenSettings();
                      }}
                      className="w-full h-[52px] px-4 rounded-[4px] bg-white dark:bg-[#131314] hover:bg-slate-50 dark:hover:bg-zinc-800/80 transition-all flex items-center gap-3.5 text-left active:scale-[0.99] shadow-xs cursor-pointer"
                    >
                      <div className="w-5 flex items-center justify-center flex-shrink-0">
                        <Settings className="w-4.5 h-4.5 text-slate-600 dark:text-zinc-300" />
                      </div>
                      <span className="text-sm font-medium text-slate-800 dark:text-zinc-100">
                        Nastavení
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

      {/* Mobile Search Bar inside Floating Header */}
      {hasClickablePersonas && isMobileSearchOpen && (
        <div
          ref={mobileSearchRef}
          className="md:hidden px-4 pb-3 pt-0.5 relative animate-in fade-in slide-in-from-top-1 duration-150"
        >
          <div className="relative">
            <div className="relative flex items-center h-10">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={mobileInputRef}
                type="text"
                value={searchQuery}
                onFocus={() => setIsSearchFocused(true)}
                onKeyDown={handleSearchKeyDown}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setIsSearchFocused(true);
                }}
                placeholder="Vyhledat osobu..."
                className="w-full h-10 pl-10 pr-9 text-sm rounded-2xl bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
              />
              <button
                type="button"
                onClick={() => {
                  if (searchQuery) {
                    setSearchQuery('');
                  } else {
                    setIsMobileSearchOpen(false);
                  }
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 cursor-pointer flex items-center justify-center"
                title="Zavřít hledání"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {renderSearchResultsDropdown()}
          </div>
        </div>
      )}
    </header>
  );
};

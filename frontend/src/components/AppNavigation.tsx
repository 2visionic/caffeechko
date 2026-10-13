import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { SECTIONS } from '../config/sectionsConfig';

export type NavTabId = 'dochazka' | 'vykazy' | 'zadosti' | 'osoby' | 'uzaverky' | 'nastaveni';

interface NavItem {
  id: NavTabId;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  badge?: number | string;
}

export interface AppNavigationProps {
  activeTab: NavTabId;
  onTabChange: (tab: NavTabId) => void;
  userRole?: string;
  pendingRequestsCount?: number;
  pendingClosuresCount?: number;
  isMobileMenuOpen?: boolean;
  onCloseMobileMenu?: () => void;
}

export const AppNavigation: React.FC<AppNavigationProps> = ({
  activeTab,
  onTabChange,
  userRole = 'colleague',
  pendingRequestsCount = 0,
  pendingClosuresCount = 0,
  isMobileMenuOpen = false,
  onCloseMobileMenu
}) => {
  const isColleague = userRole === 'colleague';
  const isAdminOrOfficer = userRole === 'admin' || userRole === 'office_manager';
  const canSeePersons = !isColleague;
  const canSeeClosures = isAdminOrOfficer;
  const canSeeSettings = isAdminOrOfficer;

  const navItems: NavItem[] = [
    {
      id: 'dochazka',
      label: 'Přehled',
      shortLabel: 'Přehled',
      icon: SECTIONS.attendance.icon
    },
    {
      id: 'vykazy',
      label: 'Moje výkazy',
      shortLabel: 'Výkazy',
      icon: SECTIONS.timesheets.icon
    },
    {
      id: 'zadosti',
      label: isColleague ? 'Moje žádosti' : 'Žádosti',
      shortLabel: isColleague ? 'Moje žádosti' : 'Žádosti',
      icon: SECTIONS.requests.icon,
      badge: pendingRequestsCount > 0 ? pendingRequestsCount : undefined
    },
    ...(canSeePersons
      ? [
          {
            id: 'osoby' as const,
            label: 'Osoby',
            shortLabel: 'Osoby',
            icon: SECTIONS.persons.icon
          }
        ]
      : []),
    ...(canSeeClosures
      ? [
          {
            id: 'uzaverky' as const,
            label: 'Uzávěrky',
            shortLabel: 'Uzávěrky',
            icon: SECTIONS.closures.icon,
            badge: pendingClosuresCount > 0 ? pendingClosuresCount : undefined
          }
        ]
      : []),
    ...(canSeeSettings
      ? [
          {
            id: 'nastaveni' as const,
            label: 'Nastavení systému',
            shortLabel: 'Nastavení',
            icon: SECTIONS.settings.icon
          }
        ]
      : [])
  ];

  const handleSelect = (tab: NavTabId) => {
    onTabChange(tab);
    if (onCloseMobileMenu) {
      onCloseMobileMenu();
    }
  };

  return (
    <>
      {/* 1. DESKTOP FLOATING STICKY SIDEBAR (280px) */}
      <aside className="hidden lg:flex flex-col w-[280px] shrink-0 sticky top-22 z-20 space-y-2 select-none">
        <div
          className="p-3.5 rounded-3xl bg-white dark:bg-zinc-900 shadow-sm space-y-1.5"
          style={{ border: 'none' }}
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item.id)}
                className={`w-full h-11 px-3.5 rounded-2xl flex items-center justify-between text-xs font-semibold transition-all select-none cursor-pointer active:scale-[0.98] ${
                  isActive
                    ? 'bg-amber-500/15 text-amber-950 dark:text-amber-300 font-bold shadow-xs'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon
                    className={`w-4.5 h-4.5 flex-shrink-0 ${
                      isActive
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-slate-400 dark:text-zinc-500'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-300 font-bold font-mono">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </aside>

      {/* 2. MOBILNÍ & TABLET BACKDROP OVERLAY */}
      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 top-[68px] bg-black/40 backdrop-blur-xs z-30 animate-in fade-in duration-200"
          onClick={onCloseMobileMenu}
        />
      )}

      {/* 3. MOBILNÍ & TABLET VYJÍŽDĚJÍCÍ MENU ZLEVA (280px, pod plovoucím headerem) */}
      <aside
        className={`lg:hidden fixed left-0 top-[68px] z-40 w-[280px] h-[calc(100vh-68px)] max-h-[calc(100vh-68px)] bg-white dark:bg-zinc-900 shadow-2xl p-4 flex flex-col justify-between overflow-y-auto transition-transform duration-300 ease-in-out ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ border: 'none' }}
      >
        <div className="space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item.id)}
                className={`w-full h-12 px-4 rounded-2xl flex items-center justify-between text-xs font-semibold transition-all select-none cursor-pointer active:scale-[0.98] ${
                  isActive
                    ? 'bg-amber-500/15 text-amber-950 dark:text-amber-300 font-bold shadow-xs'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon
                    className={`w-5 h-5 flex-shrink-0 ${
                      isActive
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-slate-400 dark:text-zinc-500'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-300 font-bold font-mono">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </aside>
    </>
  );
};

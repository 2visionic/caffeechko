import { useState } from 'react';
import {
  Clock,
  CalendarDays,
  Users,
  ClipboardCheck,
  Settings,
  Menu,
  X
} from 'lucide-react';

export type NavTabId = 'dochazka' | 'vykazy' | 'osoby' | 'uzaverky' | 'nastaveni';

interface NavItem {
  id: NavTabId;
  label: string;
  shortLabel: string;
  icon: typeof Clock;
  badge?: number | string;
}

interface AppNavigationProps {
  activeTab: NavTabId;
  onTabChange: (tab: NavTabId) => void;
  pendingClosuresCount?: number;
}

export function AppNavigation({
  activeTab,
  onTabChange,
  pendingClosuresCount = 0
}: AppNavigationProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navItems: NavItem[] = [
    {
      id: 'dochazka',
      label: 'Přehled docházky',
      shortLabel: 'Docházka',
      icon: Clock
    },
    {
      id: 'vykazy',
      label: 'Moje výkazy',
      shortLabel: 'Výkazy',
      icon: CalendarDays
    },
    {
      id: 'osoby',
      label: 'Osoby',
      shortLabel: 'Osoby',
      icon: Users
    },
    {
      id: 'uzaverky',
      label: 'Měsíční uzávěrky',
      shortLabel: 'Uzávěrky',
      icon: ClipboardCheck,
      badge: pendingClosuresCount > 0 ? pendingClosuresCount : undefined
    },
    {
      id: 'nastaveni',
      label: 'Nastavení systému',
      shortLabel: 'Nastavení',
      icon: Settings
    }
  ];

  const handleSelect = (tab: NavTabId) => {
    onTabChange(tab);
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="w-full">
      {/* DESKTOP & TABLET HORIZONTÁLNÍ NAVIGACE (Pills bar, bez rámečků) */}
      <nav aria-label="Hlavní navigace" className="hidden md:flex items-center gap-1.5 p-1.5 bg-slate-100/90 dark:bg-zinc-800/80 rounded-2xl w-fit max-w-full overflow-x-auto shadow-xs">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelect(item.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap active:scale-98 ${
                isActive
                  ? 'bg-white dark:bg-zinc-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-zinc-700/50'
              }`}
            >
              <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-zinc-400'}`} />
              <span>{item.label}</span>
              {item.badge !== undefined && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold ml-0.5">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* MOBILNÍ LIŠTA: Tlačítko hamburgeru a indikátor aktuální záložky */}
      <div className="md:hidden flex items-center justify-between gap-3 p-2 bg-slate-100/90 dark:bg-zinc-800/80 rounded-2xl">
        <div className="flex items-center gap-2 pl-2">
          {(() => {
            const currentItem = navItems.find((i) => i.id === activeTab) || navItems[0];
            const CurrentIcon = currentItem.icon;
            return (
              <>
                <CurrentIcon className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  {currentItem.label}
                </span>
              </>
            );
          })()}
        </div>

        <button
          type="button"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 rounded-xl bg-white dark:bg-zinc-700 text-slate-700 dark:text-zinc-200 shadow-xs flex items-center gap-1.5 text-xs font-semibold active:scale-95 transition-all"
          aria-expanded={isMobileMenuOpen}
          aria-label="Otevřít navigaci"
        >
          {isMobileMenuOpen ? (
            <>
              <X className="w-4 h-4" />
              <span>Zavřít</span>
            </>
          ) : (
            <>
              <Menu className="w-4 h-4" />
              <span>Menu</span>
            </>
          )}
        </button>
      </div>

      {/* MOBILNÍ VYSOUVACÍ MENU (Drawer / Modal overlay) */}
      {isMobileMenuOpen && (
        <div
          className="md:hidden mt-2 p-3 bg-white dark:bg-zinc-900 rounded-3xl shadow-xl space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-150"
          style={{ border: 'none' }}
        >
          <div className="px-2 py-1 text-[11px] font-mono uppercase text-slate-400 dark:text-zinc-500 font-semibold">
            Navigace
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item.id)}
                className={`w-full flex items-center justify-between p-3 rounded-2xl text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300 font-bold'
                    : 'text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                      isActive
                        ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                        : 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

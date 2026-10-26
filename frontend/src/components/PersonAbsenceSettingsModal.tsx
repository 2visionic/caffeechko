import { useState, useEffect } from 'react';
import { Sliders, Lock, Check } from 'lucide-react';
import { Modal, Button, Switch } from './ui';
import { api } from '../api';
import type { Persona } from '../App';

export interface PersonAbsenceSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: Persona | null;
  onSettingsSaved?: () => Promise<void> | void;
  addToast: (type: 'success' | 'warning' | 'error', title: string, message: string) => void;
}

export function PersonAbsenceSettingsModal({
  isOpen,
  onClose,
  user,
  onSettingsSaved,
  addToast
}: PersonAbsenceSettingsModalProps) {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [availableYears, setAvailableYears] = useState<number[]>([currentYear]);
  const [isClosed, setIsClosed] = useState<boolean>(false);

  const [vacationBase, setVacationBase] = useState<number>(20);
  const [vacationCarriedOver, setVacationCarriedOver] = useState<number>(0);
  const [sickDaysTotal, setSickDaysTotal] = useState<number>(3);
  const [hoPeriod, setHoPeriod] = useState<'unlimited' | 'weekly' | 'monthly' | 'yearly' | 'disabled'>('unlimited');
  const [hoDaysLimit, setHoDaysLimit] = useState<number>(2);
  const [compensatoryLeaveEnabled, setCompensatoryLeaveEnabled] = useState<boolean>(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Reset to current year when opened
  useEffect(() => {
    if (isOpen) {
      setSelectedYear(currentYear);
    }
  }, [isOpen, currentYear, user?.id]);

  // Load balances and year configuration
  useEffect(() => {
    if (!user?.id || !isOpen) return;

    let active = true;
    setIsLoading(true);

    api.getAbsenceBalances(user.id, selectedYear).then((res) => {
      if (!active) return;
      setIsLoading(false);
      if (res?.data) {
        const d = res.data;
        setIsClosed(Boolean(d.isClosed));
        if (Array.isArray(d.availableYears) && d.availableYears.length > 0) {
          setAvailableYears(d.availableYears);
        } else {
          setAvailableYears([selectedYear]);
        }

        setVacationBase(d.vacationBase ?? 20);
        setVacationCarriedOver(d.vacationCarriedOver ?? 0);
        setSickDaysTotal(d.sickDaysTotal ?? 3);

        if (d.homeOfficePeriod) {
          setHoPeriod(d.homeOfficePeriod as any);
        } else if (d.homeOfficeWeeklyDays !== undefined && d.homeOfficeWeeklyDays !== null) {
          setHoPeriod(d.homeOfficeWeeklyDays === 0 ? 'disabled' : 'weekly');
        } else {
          setHoPeriod('unlimited');
        }

        if (d.homeOfficeDaysLimit !== undefined && d.homeOfficeDaysLimit !== null) {
          setHoDaysLimit(Number(d.homeOfficeDaysLimit));
        } else if (d.homeOfficeWeeklyDays) {
          setHoDaysLimit(Number(d.homeOfficeWeeklyDays));
        }
        setCompensatoryLeaveEnabled(Boolean(d.compensatoryLeaveEnabled));
      }
    });

    return () => {
      active = false;
    };
  }, [user?.id, selectedYear, isOpen]);

  const handleSave = async () => {
    if (!user?.id || isSaving || isClosed) return;

    setIsSaving(true);
    try {
      const res = await api.saveUserAbsenceSettings({
        userId: user.id,
        year: selectedYear,
        vacationBase: Number(vacationBase) || 0,
        vacationCarriedOver: Number(vacationCarriedOver) || 0,
        sickDaysTotal: Number(sickDaysTotal) || 0,
        homeOfficePeriod: hoPeriod,
        homeOfficeDaysLimit: hoPeriod === 'weekly' || hoPeriod === 'monthly' || hoPeriod === 'yearly' ? hoDaysLimit : hoPeriod === 'disabled' ? 0 : undefined,
        homeOfficeWeeklyDays: hoPeriod === 'weekly' ? hoDaysLimit : hoPeriod === 'disabled' ? 0 : undefined,
        compensatoryLeaveEnabled: user.contract === 'OSVČ' ? false : compensatoryLeaveEnabled
      });

      if (res && !res.error) {
        addToast('success', 'Fondy uloženy', `Nastavení fondu pro rok ${selectedYear} bylo úspěšně uloženo.`);
        if (onSettingsSaved) {
          await onSettingsSaved();
        }
        onClose();
      } else {
        addToast('error', 'Chyba uložení', res?.error?.message || 'Nepodařilo se uložit nastavení fondu.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={user?.name || 'Osoba'}
      subtitle="Nastavení fondu"
      icon={Sliders}
      iconBgClass="bg-amber-500/15 text-amber-700 dark:text-amber-400"
      size="md"
      footer={
        <>
          {!isClosed && (
            <Button
              variant="filled"
              color="primary"
              size="normal"
              icon={Check}
              onClick={handleSave}
              disabled={isSaving || isLoading}
              width="full"
            >
              {isSaving ? 'Ukládám...' : `Uložit fondy pro rok ${selectedYear}`}
            </Button>
          )}
          <Button
            variant="transparent"
            color="rose"
            size="normal"
            onClick={onClose}
            width="full"
          >
            {isClosed ? 'Zavřít' : 'Zrušit'}
          </Button>
        </>
      }
    >
      <div className="space-y-5 py-1">
        {/* Přepínač roku – rok zobrazujeme VŽDY, přepínače pouze pokud existují i jiné roky */}
        <div className="flex items-center justify-between gap-3 p-2.5 rounded-2xl bg-slate-100 dark:bg-zinc-800">
          <span className="text-xs font-bold text-slate-600 dark:text-zinc-300 font-mono pl-1">
            Kalendářní rok fondu:
          </span>
          {availableYears.length > 1 ? (
            <div className="flex items-center gap-1.5">
              {availableYears.map((yr) => (
                <button
                  key={yr}
                  type="button"
                  onClick={() => setSelectedYear(yr)}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    selectedYear === yr
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'bg-white dark:bg-zinc-700 text-slate-700 dark:text-zinc-300 hover:bg-slate-200/60'
                  }`}
                >
                  {yr}
                </button>
              ))}
            </div>
          ) : (
            <span className="px-3 py-1 rounded-xl text-xs font-bold bg-white dark:bg-zinc-700 text-slate-800 dark:text-zinc-200 font-mono shadow-2xs">
              {selectedYear}
            </span>
          )}
        </div>

        {/* Indikace uzavřeného roku */}
        {isClosed && (
          <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-800 dark:text-rose-300 flex items-start gap-2.5 text-xs">
            <Lock className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
            <div className="space-y-0.5">
              <strong className="block font-bold">Rok {selectedYear} je uzavřen (zafixován)</strong>
              <p className="text-[11px] opacity-90 leading-relaxed">
                Po proběhlé roční uzávěrce jsou fondy tohoto roku uzamčeny proti změnám z důvodu zachování integrity archivních výkazů.
              </p>
            </div>
          </div>
        )}

        {/* Formulář fondů */}
        <div className="space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 font-mono mb-1.5">
                Základní dovolená (dní)
              </label>
              <input
                type="number"
                min="0"
                max="60"
                disabled={isClosed || isLoading}
                value={vacationBase}
                onChange={(e) => setVacationBase(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-zinc-800 text-sm font-bold text-slate-900 dark:text-white disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-amber-500/40"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 font-mono mb-1.5">
                Převedeno z loňska (dní)
              </label>
              <input
                type="number"
                min="0"
                max="60"
                disabled={isClosed || isLoading}
                value={vacationCarriedOver}
                onChange={(e) => setVacationCarriedOver(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-zinc-800 text-sm font-bold text-slate-900 dark:text-white disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-amber-500/40"
              />
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-amber-500/10 text-xs text-amber-800 dark:text-amber-300 font-semibold flex items-center justify-between">
            <span>Celkový fond dovolené na rok {selectedYear}:</span>
            <span className="font-mono text-sm font-bold">{vacationBase + vacationCarriedOver} dní</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 font-mono mb-1.5">
                Sick Days (dní/rok)
              </label>
              <input
                type="number"
                min="0"
                max="30"
                disabled={isClosed || isLoading}
                value={sickDaysTotal}
                onChange={(e) => setSickDaysTotal(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-zinc-800 text-sm font-bold text-slate-900 dark:text-white disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-amber-500/40"
              />
            </div>

          </div>

          <div className="pt-2 border-t border-slate-200/60 dark:border-zinc-700/60">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 font-mono mb-1.5">
              Režim Home Office
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {[
                { id: 'unlimited', label: 'Neomezeno' },
                { id: 'weekly', label: 'Týdenní limit' },
                { id: 'monthly', label: 'Měsíční limit' },
                { id: 'yearly', label: 'Roční limit' },
                { id: 'disabled', label: 'Zakázáno (0 d)' }
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  disabled={isClosed || isLoading}
                  onClick={() => setHoPeriod(m.id as any)}
                  className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer text-center ${
                    hoPeriod === m.id
                      ? 'bg-amber-500/20 text-amber-900 dark:text-amber-200 ring-2 ring-amber-500/40'
                      : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200/60 dark:hover:bg-zinc-700/60'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            {(hoPeriod === 'weekly' || hoPeriod === 'monthly' || hoPeriod === 'yearly') && (
              <div className="pt-2.5">
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-400 mb-1">
                  {hoPeriod === 'weekly'
                    ? 'Limit dní za týden'
                    : hoPeriod === 'monthly'
                    ? 'Limit dní za měsíc'
                    : 'Limit dní za rok'}
                </label>
                <input
                  type="number"
                  min="1"
                  max={hoPeriod === 'weekly' ? 7 : hoPeriod === 'monthly' ? 31 : 365}
                  disabled={isClosed || isLoading}
                  value={hoDaysLimit}
                  onChange={(e) => setHoDaysLimit(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-zinc-800 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                />
              </div>
            )}
          </div>

          {user?.contract !== 'OSVČ' && (
            <div className="pt-2 border-t border-slate-200/60 dark:border-zinc-700/60">
              <div
                onClick={() => {
                  if (!isClosed && !isLoading) {
                    setCompensatoryLeaveEnabled((prev) => !prev);
                  }
                }}
                className={`flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-100 dark:bg-zinc-800 ${
                  !isClosed && !isLoading ? 'cursor-pointer' : 'opacity-60 cursor-not-allowed'
                }`}
              >
                <div className="space-y-0.5">
                  <span className="block text-xs font-bold text-slate-900 dark:text-white">
                    Povolit Náhradní volno (čerpání z FlexiTime)
                  </span>
                  <span className="block text-[11px] text-slate-500 dark:text-zinc-400">
                    Umožní osobě žádat o placené náhradní volno ve dnech, které se odečítá z FlexiTime přesčasů
                  </span>
                </div>
                <Switch
                  checked={compensatoryLeaveEnabled}
                  disabled={isClosed || isLoading}
                  onChange={(val) => setCompensatoryLeaveEnabled(val)}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

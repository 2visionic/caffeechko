import React, { useState, useEffect } from 'react';
import { Settings, X, Save, Database, Building2 } from 'lucide-react';
import { api, type DevConfig } from '../api';

interface DevConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  addToast: (type: 'success' | 'warning' | 'error', title: string, message: string) => void;
  onConfigUpdated?: (config: DevConfig) => void;
}

export const DevConfigModal: React.FC<DevConfigModalProps> = ({
  isOpen,
  onClose,
  addToast,
  onConfigUpdated
}) => {
  const [config, setConfig] = useState<DevConfig>({
    appName: 'caffeechko',
    companyName: 'Firma s.r.o.',
    instanceName: 'firma',
    googleWorkspaceDomain: 'firma.cz',
    googleClientId: '',
    googleClientSecret: '',
    usePostgres: false,
    connectionString: 'Host=localhost;Port=5432;Database=dochazka_dev;Username=dev;Password=devpassword'
  });
  const [showSecret, setShowSecret] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadConfig();
    }
  }, [isOpen]);

  const loadConfig = async () => {
    setIsLoading(true);
    try {
      const res = await api.getDevConfig();
      if (res?.data) {
        setConfig(res.data);
      }
    } catch {
      // Keep defaults
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await api.updateDevConfig(config);
      if (res?.data) {
        addToast(
          'success',
          'Konfigurace uložena',
          `Uloženo do lokálního appsettings.Development.json (doména: @${config.googleWorkspaceDomain}). Soubor je ignorován v Gitu.`
        );
        if (onConfigUpdated) onConfigUpdated(res.data);
        onClose();
      } else {
        addToast('error', 'Chyba při ukládání', res?.error?.message || 'Nastavení se nepodařilo uložit.');
      }
    } catch (err: any) {
      addToast('error', 'Chyba', err?.message || 'Nepodařilo se komunikovat s backendem.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-zinc-800 bg-yellow-400/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-yellow-400/25 text-yellow-800 dark:text-yellow-300 flex items-center justify-center">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Nastavení vývojářského prostředí
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-400 text-slate-950 font-bold shadow-sm">
                  DEV NÁSTROJ
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Ukládá se do lokálního <code>appsettings.Development.json</code> (v .gitignore)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content / Form */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
          {/* Section 1: Firemní identita & Doména */}
          <div className="space-y-3">
            <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white font-mono uppercase text-[11px] tracking-wider">
              <Building2 className="w-3.5 h-3.5 text-yellow-600 dark:text-yellow-400" />
              <span>Firemní identita a oAuth doména</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-mono text-slate-500 dark:text-zinc-400 block mb-1">
                  Název firmy (display):
                </label>
                <input
                  type="text"
                  value={config.companyName}
                  onChange={(e) => setConfig({ ...config, companyName: e.target.value })}
                  placeholder="Firma s.r.o."
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white font-medium"
                />
              </div>

              <div>
                <label className="text-[11px] font-mono text-slate-500 dark:text-zinc-400 block mb-1">
                  Identifikátor instance:
                </label>
                <input
                  type="text"
                  value={config.instanceName}
                  onChange={(e) => setConfig({ ...config, instanceName: e.target.value })}
                  placeholder="firma"
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white font-mono font-medium"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-mono text-slate-500 dark:text-zinc-400 block mb-1">
                Google Workspace Doména (@domena):
              </label>
              <input
                type="text"
                value={config.googleWorkspaceDomain}
                onChange={(e) => setConfig({ ...config, googleWorkspaceDomain: e.target.value })}
                placeholder="firma.cz"
                required
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white font-mono font-medium"
              />
              <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1">
                Tuto doménu Google ověřuje v claimu <code>hd</code> podepsaného ID Tokenu.
              </p>
            </div>

            <div>
              <label className="text-[11px] font-mono text-slate-500 dark:text-zinc-400 block mb-1">
                Google Client ID (volitelné pro reálný OAuth):
              </label>
              <input
                type="text"
                value={config.googleClientId || ''}
                onChange={(e) => setConfig({ ...config, googleClientId: e.target.value })}
                placeholder="např. 123456789-xyz.apps.googleusercontent.com"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white font-mono text-xs"
              />
              <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1">
                Veřejné Client ID pro frontend přihlašovací dialog Google.
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-mono text-slate-500 dark:text-zinc-400">
                  Google Client Secret (privátní klíč pro backend):
                </label>
                <button
                  type="button"
                  onClick={() => setShowSecret(!showSecret)}
                  className="text-[10px] text-yellow-700 dark:text-yellow-400 hover:underline font-mono"
                >
                  {showSecret ? 'Skrýt' : 'Zobrazit'}
                </button>
              </div>
              <input
                type={showSecret ? 'text' : 'password'}
                value={config.googleClientSecret || ''}
                onChange={(e) => setConfig({ ...config, googleClientSecret: e.target.value })}
                placeholder="např. GOCSPX-xxxxxxxxxxxxxxxxxxxx"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white font-mono text-xs"
              />
              <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1">
                Privátní klíč používaný výhradně backendem pro ověření tokenů a výměnu autorizačních kódů. Ukládá se pouze lokálně a je ignorován v Gitu.
              </p>
            </div>
          </div>

          {/* Section 2: Databázový backend */}
          <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-zinc-800">
            <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white font-mono uppercase text-[11px] tracking-wider">
              <Database className="w-3.5 h-3.5 text-yellow-600 dark:text-yellow-400" />
              <span>Databázový backend (Dev vs Produkce)</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-800/60 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-semibold text-slate-900 dark:text-white block">
                    Typ databáze pro tento běh
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-zinc-400">
                    SQLite pro lokální běh bez serveru, PostgreSQL pro produkční nasazení.
                  </span>
                </div>
                <select
                  value={config.usePostgres ? 'postgres' : 'sqlite'}
                  onChange={(e) => setConfig({ ...config, usePostgres: e.target.value === 'postgres' })}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-semibold text-slate-800 dark:text-zinc-200 font-mono"
                >
                  <option value="sqlite">SQLite (soubor .db)</option>
                  <option value="postgres">PostgreSQL (Server)</option>
                </select>
              </div>

              {config.usePostgres && (
                <div>
                  <label className="text-[10px] font-mono text-slate-500 dark:text-zinc-400 block mb-1">
                    PostgreSQL Connection String:
                  </label>
                  <input
                    type="text"
                    value={config.connectionString || ''}
                    onChange={(e) => setConfig({ ...config, connectionString: e.target.value })}
                    placeholder="Host=localhost;Port=5432;Database=dochazka;Username=user;Password=pass"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white font-mono text-xs"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Footer Save Button */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 font-medium hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors"
            >
              Zrušit
            </button>
            <button
              type="submit"
              disabled={isSaving || isLoading}
              className="px-5 py-2 rounded-xl bg-yellow-400 hover:bg-yellow-500 active:scale-98 text-slate-950 font-bold flex items-center gap-2 shadow-sm transition-all"
            >
              <Save className="w-4 h-4 text-slate-950" />
              <span>{isSaving ? 'Ukládám...' : isLoading ? 'Načítám...' : 'Uložit lokální konfiguraci'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

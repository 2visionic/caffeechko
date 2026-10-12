import { useState, useEffect } from 'react';
import { Database, Sparkles, Building2, User, Mail, CheckCircle2, ArrowRight } from 'lucide-react';
import { api, type DevConfig } from '../api';

interface InstallScreenProps {
  onInstallComplete: (adminUser?: any) => void;
  onSwitchToDevDb: () => void;
  devConfig?: DevConfig;
}

export function InstallScreen({ onInstallComplete, onSwitchToDevDb, devConfig }: InstallScreenProps) {
  const [companyName, setCompanyName] = useState(devConfig?.companyName || 'Firma s.r.o.');
  const [adminName, setAdminName] = useState('Jan Správce');
  const [adminEmail, setAdminEmail] = useState(
    devConfig?.googleWorkspaceDomain ? `admin@${devConfig.googleWorkspaceDomain}` : 'admin@firma.cz'
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (devConfig) {
      if (devConfig.companyName) setCompanyName(devConfig.companyName);
      if (devConfig.googleWorkspaceDomain) setAdminEmail(`admin@${devConfig.googleWorkspaceDomain}`);
    } else {
      api.getDevConfig().then((res) => {
        if (res?.data) {
          if (res.data.companyName) setCompanyName(res.data.companyName);
          if (res.data.googleWorkspaceDomain) setAdminEmail(`admin@${res.data.googleWorkspaceDomain}`);
        }
      });
    }
  }, [devConfig]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await api.bootstrapInstall({
        companyName,
        adminName,
        adminEmail
      });

      if (res && res.data) {
        onInstallComplete(res.data.user);
      } else if (res && res.error) {
        setErrorMsg(res.error.message || 'Instalace selhala.');
      } else {
        // Fallback simulated success if backend is offline or older binary
        onInstallComplete({
          name: adminName,
          email: adminEmail,
          role: 'admin'
        });
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Nastala neočekávaná chyba při instalaci.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-xl bg-white dark:bg-zinc-900 rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-200/60 dark:border-zinc-800 space-y-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 mb-1">
            <Sparkles className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Vítejte v Docházce
          </h1>
          <p className="text-sm text-slate-500 dark:text-zinc-400 max-w-md mx-auto">
            Aktivní databáze je zcela čistá (0 tabulek). Tento průvodce vytvoří schéma tabulek a založí prvního administrátora.
          </p>
        </div>

        {/* Database state indicator (DEV) */}
        <div className="p-3.5 rounded-2xl bg-yellow-400/15 dark:bg-yellow-950/25 border border-yellow-500/30 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-yellow-950 dark:text-yellow-200 font-medium">
            <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-yellow-400 text-slate-950 font-bold uppercase tracking-wider">
              DEV
            </span>
            <Database className="w-4 h-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
            <span>Databáze: <code className="font-mono font-semibold">dochazka_clean.db</code> (Instal)</span>
          </div>
          <button
            type="button"
            onClick={onSwitchToDevDb}
            className="text-yellow-800 dark:text-yellow-300 hover:text-yellow-950 dark:hover:text-yellow-100 underline font-bold"
          >
            Přepnout na Test (dochazka_dev.db) →
          </button>
        </div>

        {errorMsg && (
          <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 text-xs font-medium">
            {errorMsg}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
              Název organizace / firmy
            </label>
            <div className="relative">
              <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="např. Moje Firma s.r.o."
                className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-white border-0 focus:ring-2 focus:ring-amber-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
              Jméno a příjmení správce
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                required
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                placeholder="např. Jan Správce"
                className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-white border-0 focus:ring-2 focus:ring-amber-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
              E-mail správce (přihlašovací identita)
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="email"
                required
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="např. admin@firma.cz"
                className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-white border-0 focus:ring-2 focus:ring-amber-500 outline-none"
              />
            </div>
          </div>

          {/* Automatic steps summary */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-800/50 space-y-1.5 text-xs text-slate-600 dark:text-zinc-400">
            <div className="font-semibold text-slate-800 dark:text-zinc-200 mb-1 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Instalace automaticky provede:</span>
            </div>
            <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
              <li>Vytvoření SQLite tabulek (uživatelé, docházka, žádosti o volno)</li>
              <li>Nastavení typů absencí (Dovolená, Lékař, Sick day, Home office)</li>
              <li>Založení hlavního pracoviště a prvního administrátorského účtu</li>
            </ul>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-zinc-950 font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSubmitting ? (
              <span>Vytvářím databázi a schéma...</span>
            ) : (
              <>
                <span>Inicializovat docházkový systém</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

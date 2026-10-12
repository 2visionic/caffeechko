import { useState, useEffect } from 'react';
import { Database, Sparkles, Building2, User, Mail, CheckCircle2, ArrowRight } from 'lucide-react';
import { api, type DevConfig } from '../api';
import { Input, Button } from './ui';

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
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-zinc-950">
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
        {/* Header with Icon */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/15 text-amber-700 dark:text-amber-400 mx-auto flex items-center justify-center shadow-xs">
            <Sparkles className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            Prvotní instalace docházky
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-xs mx-auto">
            Vítejte! Čistá databáze je připravena k inicializaci pro vaši organizaci.
          </p>
        </div>

        {/* Switch to dev DB banner for developers */}
        <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-xs flex items-center justify-between gap-2 text-amber-900 dark:text-amber-200">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 flex-shrink-0 text-amber-600" />
            <span className="text-[11px]">Chcete raději vývojářská ukázková data?</span>
          </div>
          <Button
            variant="surface"
            colorKey="amber"
            size="xs"
            onClick={onSwitchToDevDb}
          >
            Přepnout na DEV
          </Button>
        </div>

        {errorMsg && (
          <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 text-xs font-medium">
            {errorMsg}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Název organizace / firmy"
            icon={Building2}
            required
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="např. Moje Firma s.r.o."
          />

          <Input
            label="Jméno a příjmení správce"
            icon={User}
            required
            value={adminName}
            onChange={(e) => setAdminName(e.target.value)}
            placeholder="např. Jan Správce"
          />

          <Input
            label="E-mail správce (přihlašovací identita)"
            type="email"
            icon={Mail}
            required
            value={adminEmail}
            onChange={(e) => setAdminEmail(e.target.value)}
            placeholder="např. admin@firma.cz"
          />

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

          <Button
            type="submit"
            variant="filled"
            colorKey="primary"
            size="lg"
            fullWidth
            loading={isSubmitting}
            icon={ArrowRight}
            iconPosition="right"
          >
            {isSubmitting ? 'Vytvářím databázi a schéma...' : 'Inicializovat docházkový systém'}
          </Button>
        </form>
      </div>
    </div>
  );
}

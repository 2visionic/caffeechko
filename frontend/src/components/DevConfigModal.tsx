import React, { useState, useEffect } from 'react';
import { Settings, Save, Database, Building2, Eye, EyeOff } from 'lucide-react';
import { api, type DevConfig } from '../api';
import { Modal, Button, Input, Select } from './ui';

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
      const res = await api.updateDevConfig({ ...config, appName: 'caffeechko' });
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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <span>Nastavení vývojářského prostředí</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-400 text-slate-950 font-bold shadow-xs">
            DEV
          </span>
        </div>
      }
      subtitle="Ukládá se do lokálního appsettings.Development.json (v .gitignore)"
      icon={Settings}
      iconBgClass="bg-yellow-400/20 text-yellow-800 dark:text-yellow-300"
      size="xl"
      footer={
        <>
          <Button
            variant="filled"
            color="primary"
            size="normal"
            width="full"
            icon={Save}
            loading={isSaving || isLoading}
            onClick={handleSave}
          >
            Uložit konfiguraci
          </Button>
          <Button
            variant="transparent"
            color="rose"
            size="normal"
            width="full"
            onClick={onClose}
          >
            Zrušit
          </Button>
        </>
      }
    >
      <form onSubmit={handleSave} className="space-y-4">
        {/* Section 1: Základní identita tenantu */}
        <div className="space-y-3">
          <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white font-mono uppercase text-[11px] tracking-wider">
            <Building2 className="w-3.5 h-3.5 text-yellow-600 dark:text-yellow-400" />
            <span>Identita organizace a Google Workspace</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Název firmy"
              value={config.companyName || ''}
              onChange={(e) => setConfig({ ...config, companyName: e.target.value })}
              placeholder="Moje Firma s.r.o."
            />
            <Input
              label="Google Workspace Doména"
              value={config.googleWorkspaceDomain || ''}
              onChange={(e) => setConfig({ ...config, googleWorkspaceDomain: e.target.value })}
              placeholder="firma.cz"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Kód instance (tenant slug)"
              value={config.instanceName || ''}
              onChange={(e) => setConfig({ ...config, instanceName: e.target.value })}
              placeholder="firma"
            />
            <Input
              label="Název aplikace (fixní)"
              value="caffeechko"
              disabled
              placeholder="caffeechko"
            />
          </div>
        </div>

        {/* Section 2: Google OAuth2 Credentials */}
        <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-zinc-800">
          <Input
            label="Google Client ID"
            value={config.googleClientId || ''}
            onChange={(e) => setConfig({ ...config, googleClientId: e.target.value })}
            placeholder="např. 123456789-abc.apps.googleusercontent.com"
          />

          <Input
            label="Google Client Secret"
            type={showSecret ? 'text' : 'password'}
            value={config.googleClientSecret || ''}
            onChange={(e) => setConfig({ ...config, googleClientSecret: e.target.value })}
            placeholder="GOCSPX-..."
            rightElement={
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200"
              >
                {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            }
          />
        </div>

        {/* Section 3: Databázový backend */}
        <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-zinc-800">
          <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white font-mono uppercase text-[11px] tracking-wider">
            <Database className="w-3.5 h-3.5 text-yellow-600 dark:text-yellow-400" />
            <span>Databázový backend</span>
          </div>

          <Select
            label="Typ databáze pro tento běh"
            value={config.usePostgres ? 'postgres' : 'sqlite'}
            onChange={(e) => setConfig({ ...config, usePostgres: e.target.value === 'postgres' })}
            options={[
              { value: 'sqlite', label: 'SQLite (soubor .db)' },
              { value: 'postgres', label: 'PostgreSQL (Server)' }
            ]}
          />

          {config.usePostgres && (
            <Input
              label="PostgreSQL Connection String"
              value={config.connectionString || ''}
              onChange={(e) => setConfig({ ...config, connectionString: e.target.value })}
              placeholder="Host=localhost;Port=5432;Database=dochazka;Username=user;Password=pass"
            />
          )}
        </div>
      </form>
    </Modal>
  );
};

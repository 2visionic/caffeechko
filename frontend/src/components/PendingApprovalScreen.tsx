import React, { useEffect, useState } from 'react';
import { Clock, Phone, Mail, RefreshCw, LogOut, CheckCircle2 } from 'lucide-react';
import { api } from '../api';
import { Button, StatusBadge } from './ui';

interface ContactPerson {
  name: string;
  role: string;
  email: string;
  phoneNumber?: string;
}

interface PendingApprovalScreenProps {
  userId: string;
  userName: string;
  userEmail: string;
  onRefreshStatus: () => void;
  onLogout: () => void;
  addToast: (type: 'success' | 'warning' | 'error', title: string, message: string) => void;
}

export const PendingApprovalScreen: React.FC<PendingApprovalScreenProps> = ({
  userId,
  userName,
  userEmail,
  onRefreshStatus,
  onLogout,
  addToast
}) => {
  const [contact, setContact] = useState<ContactPerson>({
    name: 'Maru Veselá',
    role: 'Office Manažer',
    email: 'maru.vesela@firma.cz',
    phoneNumber: '+420 777 234 567'
  });
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    async function loadStatus() {
      const cfgRes = await api.getDevConfig();
      const domain = cfgRes?.data?.googleWorkspaceDomain || (userEmail.includes('@') ? userEmail.split('@')[1] : 'firma.cz');
      setContact(prev => ({
        ...prev,
        email: `maru.vesela@${domain}`
      }));
      const res = await api.getPendingStatus(userId);
      if (res?.data?.contactPerson) {
        setContact(res.data.contactPerson);
      }
    }
    loadStatus();
  }, [userId, userEmail]);

  const handleCheckNow = async () => {
    setIsChecking(true);
    try {
      const res = await api.getPendingStatus(userId);
      if (res?.data?.isApproved) {
        addToast('success', 'Účet byl schválen!', 'Váš úvazek byl nastaven. Vítejte v docházkovém systému.');
        onRefreshStatus();
      } else {
        addToast('warning', 'Stav žádosti', 'Účet zatím čeká na schválení Office Managerem.');
      }
    } finally {
      setIsChecking(false);
    }
  };

  const detectedDomain = userEmail.includes('@') ? `@${userEmail.split('@')[1]}` : '@firma.cz';

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div
        className="max-w-md w-full bg-white dark:bg-zinc-900 rounded-3xl p-8 sm:p-10 shadow-sm transition-colors text-center space-y-7"
        style={{ border: 'none' }}
      >
        {/* Animated Pending Clock Icon */}
        <div className="flex flex-col items-center space-y-3">
          <div className="w-16 h-16 rounded-3xl bg-amber-500/15 text-amber-700 dark:text-amber-400 flex items-center justify-center shadow-sm">
            <Clock className="w-8 h-8 animate-pulse" />
          </div>

          <div className="space-y-2 flex flex-col items-center">
            <StatusBadge status="pending" customLabel="Čeká na schválení úvazku" size="md" />
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white pt-1">
              Účet zatím není aktivován
            </h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Přihlášen: <strong className="text-slate-800 dark:text-zinc-200">{userName}</strong> ({userEmail})
            </p>
          </div>
        </div>

        {/* Info card */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/60 text-xs text-slate-600 dark:text-zinc-300 text-left space-y-2 leading-relaxed">
          <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Google Workspace přihlášení ověřeno</span>
          </div>
          <p>
            Váš firemní účet byl úspěšně rozpoznán v doméně <code className="bg-amber-500/15 px-1 py-0.5 rounded font-mono text-amber-800 dark:text-amber-300">{detectedDomain}</code>.
          </p>
          <p>
            Před prvním zápisem docházky musí váš <strong>Office Manager</strong> nebo <strong>Administrátor</strong> nastavit typ smlouvy (HPP / IČO), týdenní pracovní fond a schválit přístup.
          </p>
        </div>

        {/* Contact Person Box */}
        <div className="p-4 rounded-2xl bg-amber-500/10 dark:bg-amber-500/15 text-left space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
              Kontaktní osoba pro aktivaci:
            </span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-900 dark:text-amber-200">
              {contact.role}
            </span>
          </div>

          <div>
            <div className="text-sm font-bold text-slate-900 dark:text-white">
              {contact.name}
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1 border-t border-amber-500/20 text-xs">
            {contact.phoneNumber && (
              <a
                href={`tel:${contact.phoneNumber}`}
                className="flex-1 py-2 px-3 rounded-xl bg-white dark:bg-zinc-800 hover:bg-amber-50 text-slate-800 dark:text-zinc-200 font-semibold flex items-center justify-center gap-2 shadow-sm transition-colors text-center"
              >
                <Phone className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>{contact.phoneNumber}</span>
              </a>
            )}

            <a
              href={`mailto:${contact.email}`}
              className="flex-1 py-2 px-3 rounded-xl bg-white dark:bg-zinc-800 hover:bg-amber-50 text-slate-800 dark:text-zinc-200 font-semibold flex items-center justify-center gap-2 shadow-sm transition-colors text-center truncate"
            >
              <Mail className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
              <span className="truncate">{contact.email}</span>
            </a>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col gap-2 pt-1">
          <Button
            variant="filled"
            colorKey="amber"
            size="lg"
            loading={isChecking}
            icon={RefreshCw}
            onClick={handleCheckNow}
            className="w-full justify-center"
          >
            {isChecking ? 'Ověřuji stav schválení...' : 'Zkontrolovat stav schválení'}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            icon={LogOut}
            onClick={onLogout}
            className="w-full justify-center text-slate-400 hover:text-rose-600 dark:hover:text-rose-400"
          >
            Odhlásit se
          </Button>
        </div>
      </div>
    </div>
  );
};

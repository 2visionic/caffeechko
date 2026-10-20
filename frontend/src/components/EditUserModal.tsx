import { useState, useEffect } from 'react';
import { User, Check, Mars, Venus } from 'lucide-react';
import { Modal, Button, Switch } from './ui';
import { api } from '../api';
import type { Persona } from '../App';

export interface EditUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: Persona | null;
  allUsers: Persona[];
  contractTypesMap?: Record<string, string>;
  onUserSaved?: () => Promise<void> | void;
  addToast: (type: 'success' | 'warning' | 'error', title: string, message: string) => void;
}

export function EditUserModal({
  isOpen,
  onClose,
  user,
  allUsers,
  contractTypesMap = {},
  onUserSaved,
  addToast
}: EditUserModalProps) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isDisplayNameCustom, setIsDisplayNameCustom] = useState(false);
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [role, setRole] = useState('colleague');
  const [contractKind, setContractKind] = useState('employee');
  const [contractTypeCode, setContractTypeCode] = useState('full_time');
  const [managerId, setManagerId] = useState<string>('');
  const [parentPersonId, setParentPersonId] = useState<string>('');
  const [isFemale, setIsFemale] = useState(false);
  const [isPermanentHomeOffice, setIsPermanentHomeOffice] = useState(false);
  const [employmentStartDate, setEmploymentStartDate] = useState('');

  const [isSaving, setIsSaving] = useState(false);

  // Init form from user
  useEffect(() => {
    if (user && isOpen) {
      // Split name if firstName/lastName not explicit
      let f = user.firstName || '';
      let l = user.lastName || '';
      if (!f && !l && user.name) {
        const parts = user.name.trim().split(/\s+/);
        f = parts[0] || '';
        l = parts.slice(1).join(' ') || '';
      }
      setFirstName(f);
      setLastName(l);

      const fallbackName = `${f} ${l}`.trim();
      const currentDisplay = user.name || '';
      setDisplayName(currentDisplay);
      setIsDisplayNameCustom(Boolean(currentDisplay && fallbackName && currentDisplay !== fallbackName));

      setEmail(user.email || '');
      setPhoneNumber(user.phoneNumber || '');
      setRole(user.role || 'colleague');
      setContractKind(user.contract === 'OSVČ' ? 'osvc' : 'employee');
      setContractTypeCode(user.contractType || 'full_time');
      setManagerId(user.managerId || '');
      setParentPersonId(user.parentPersonId || '');
      setIsFemale(Boolean(user.isFemale ?? (l.endsWith('á') || currentDisplay.endsWith('á'))));
      setIsPermanentHomeOffice(Boolean(user.isPermanentHomeOffice));
      setEmploymentStartDate(user.employmentStartDate ? user.employmentStartDate.slice(0, 10) : '');
    }
  }, [user, isOpen]);

  // Handle first / last name changes with fallback synchronization
  const handleFirstNameChange = (val: string) => {
    setFirstName(val);
    if (!isDisplayNameCustom) {
      setDisplayName(`${val} ${lastName}`.trim());
    }
    // Auto-detect female by typical czech female endings
    if (val.toLowerCase().endsWith('a') || val.toLowerCase().endsWith('e')) {
      // optional hint, but keep female if lastName ends with 'á'
    }
  };

  const handleLastNameChange = (val: string) => {
    setLastName(val);
    if (!isDisplayNameCustom) {
      setDisplayName(`${firstName} ${val}`.trim());
    }
    if (val.trim().endsWith('á')) {
      setIsFemale(true);
    }
  };

  const currentFallback = `${firstName} ${lastName}`.trim();

  const handleDisplayNameFocus = () => {
    if (!isDisplayNameCustom || displayName.trim() === currentFallback) {
      setDisplayName('');
    }
  };

  const handleDisplayNameBlur = () => {
    if (!displayName.trim()) {
      setDisplayName(currentFallback);
      setIsDisplayNameCustom(false);
    } else if (displayName.trim() !== currentFallback) {
      setIsDisplayNameCustom(true);
    }
  };

  const handleSave = async () => {
    if (!user?.id || isSaving) return;
    if (!firstName.trim()) {
      addToast('error', 'Vyplňte jméno', 'Křestní jméno nesmí být prázdné.');
      return;
    }
    if (!lastName.trim()) {
      addToast('error', 'Vyplňte příjmení', 'Příjmení nesmí být prázdné.');
      return;
    }

    setIsSaving(true);
    try {
      const finalDisplay = displayName.trim() || currentFallback;
      const res = await api.updateUserProfile(user.id, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        displayName: finalDisplay,
        email: email.trim() || undefined,
        phoneNumber: phoneNumber.trim() || undefined,
        role,
        contractKind,
        contractTypeCode,
        managerId: managerId || null,
        parentPersonId: parentPersonId || null,
        isFemale,
        isPermanentHomeOffice,
        employmentStartDate: employmentStartDate || null
      });

      if (res && !res.error) {
        addToast('success', 'Osoba upravena', `Údaje osoby „${finalDisplay}“ byly úspěšně uloženy.`);
        onClose();
        if (onUserSaved) {
          await onUserSaved();
        }
      } else {
        addToast('error', 'Chyba uložení', res?.error?.message || 'Nepodařilo se uložit změny osoby.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const otherUsers = allUsers.filter((u) => u.id !== user?.id && u.id !== 'anonymous');

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={user?.name || 'Osoba'}
      subtitle="Upravit profil"
      icon={User}
      iconBgClass="bg-amber-500/15 text-amber-700 dark:text-amber-400"
      size="lg"
      footer={
        <>
          <Button
            variant="filled"
            color="primary"
            size="normal"
            icon={Check}
            onClick={handleSave}
            disabled={isSaving}
            width="full"
          >
            {isSaving ? 'Ukládám...' : 'Uložit změny'}
          </Button>
          <Button
            variant="transparent"
            color="rose"
            size="normal"
            onClick={onClose}
            width="full"
          >
            Zrušit
          </Button>
        </>
      }
    >
      <div className="space-y-4 py-1">
        {/* 1. Jméno a Příjmení */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 font-mono mb-1.5">
              Křestní jméno *
            </label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => handleFirstNameChange(e.target.value)}
              placeholder="např. Jan"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-zinc-800 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 font-mono mb-1.5">
              Příjmení *
            </label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => handleLastNameChange(e.target.value)}
              placeholder="např. Novák"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-zinc-800 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40"
            />
          </div>
        </div>

        {/* 2. Zobrazované jméno */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 font-mono">
              Zobrazované jméno v systému (DisplayName)
            </label>
            {isDisplayNameCustom && (
              <span className="text-[10px] font-mono text-amber-600 dark:text-amber-400">
                (vlastní formát)
              </span>
            )}
          </div>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            onFocus={handleDisplayNameFocus}
            onBlur={handleDisplayNameBlur}
            placeholder={currentFallback || 'Jméno Příjmení'}
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-zinc-800 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40"
          />
        </div>

        {/* 3. Oslovení / Pohlaví & Role */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 font-mono mb-1.5">
              Role v systému
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-zinc-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none"
            >
              <option value="colleague">Uživatel</option>
              <option value="team_lead">Vedoucí</option>
              <option value="manager">Manažer</option>
              <option value="office_manager">Office Manager</option>
              <option value="admin">Administrátor</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 font-mono mb-1.5">
              Pohlaví
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIsFemale(false)}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  !isFemale
                    ? 'bg-sky-500/15 text-sky-900 dark:text-sky-200 ring-2 ring-sky-500/40'
                    : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200/60 dark:hover:bg-zinc-700/60'
                }`}
              >
                <Mars className="w-4 h-4 text-sky-500 shrink-0" />
                <span>Muž</span>
              </button>
              <button
                type="button"
                onClick={() => setIsFemale(true)}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  isFemale
                    ? 'bg-pink-500/15 text-pink-900 dark:text-pink-200 ring-2 ring-pink-500/40'
                    : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200/60 dark:hover:bg-zinc-700/60'
                }`}
              >
                <Venus className="w-4 h-4 text-pink-500 shrink-0" />
                <span>Žena</span>
              </button>
            </div>
          </div>
        </div>

        {/* 4. Úvazek: ContractKind + ContractType */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 font-mono mb-1.5">
              Druh vztahu
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setContractKind('employee')}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  contractKind === 'employee'
                    ? 'bg-amber-500/20 text-amber-900 dark:text-amber-200 ring-2 ring-amber-500/40'
                    : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400'
                }`}
              >
                HPP
              </button>
              <button
                type="button"
                onClick={() => setContractKind('osvc')}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  contractKind === 'osvc'
                    ? 'bg-amber-500/20 text-amber-900 dark:text-amber-200 ring-2 ring-amber-500/40'
                    : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400'
                }`}
              >
                OSVČ
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 font-mono mb-1.5">
              Typ úvazku (fond)
            </label>
            <select
              value={contractTypeCode}
              onChange={(e) => setContractTypeCode(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-zinc-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none"
            >
              {Object.keys(contractTypesMap).length > 0 ? (
                Object.entries(contractTypesMap).map(([code, name]) => (
                  <option key={code} value={code}>
                    {name}
                  </option>
                ))
              ) : (
                <>
                  <option value="full_time">Plný úvazek (1.0)</option>
                  <option value="half_time">Poloviční úvazek (0.5)</option>
                  <option value="part_time">Částečný úvazek (0.25)</option>
                </>
              )}
            </select>
          </div>
        </div>

        {/* 5. Nadřízený a Vedoucí */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 font-mono mb-1.5">
              Přímý nadřízený (Manažer)
            </label>
            <select
              value={managerId}
              onChange={(e) => setManagerId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-zinc-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none"
            >
              <option value="">Vedení společnosti (výchozí)</option>
              {otherUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.roleLabel || u.role})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 font-mono mb-1.5">
              Vedoucí týmu (Parent Person)
            </label>
            <select
              value={parentPersonId}
              onChange={(e) => setParentPersonId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-zinc-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none"
            >
              <option value="">Bez přiřazeného vedoucího</option>
              {otherUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.roleLabel || u.role})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 6. E-mail (100% šířka) */}
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 font-mono mb-1.5">
            E-mail
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jmeno@firma.cz"
            className="w-full px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none"
          />
        </div>

        {/* 7. Telefon & Datum nástupu */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 font-mono mb-1.5">
              Telefon
            </label>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+420 777 000 000"
              className="w-full px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 font-mono mb-1.5">
              Datum nástupu do zaměstnání
            </label>
            <input
              type="date"
              value={employmentStartDate}
              onChange={(e) => setEmploymentStartDate(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none"
            />
          </div>
        </div>

        <div className="pt-2">
          <Switch
            checked={isPermanentHomeOffice}
            onChange={setIsPermanentHomeOffice}
            color="amber"
            label="Trvalý Home Office"
          />
        </div>
      </div>
    </Modal>
  );
}

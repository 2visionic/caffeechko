import React, { useState } from 'react';
import { X, Check, EyeOff } from 'lucide-react';

interface DeclensionModalProps {
  name: string;
  isOpen: boolean;
  onClose: () => void;
  onSave: (declensions: Record<string, string>) => void;
  onIgnore: () => void;
}

export const DeclensionModal: React.FC<DeclensionModalProps> = ({
  name,
  isOpen,
  onClose,
  onSave,
  onIgnore,
}) => {
  if (!isOpen) return null;

  const [forms, setForms] = useState({
    nominative: name,
    genitive: '',
    dative: '',
    accusative: '',
    vocative: '',
    locative: '',
    instrumental: ''
  });

  const handleChange = (field: string, val: string) => {
    setForms(prev => ({ ...prev, [field]: val }));
  };

  const cases = [
    { key: 'nominative', label: '1. pád (Kdo, co?)', placeholder: 'Předvyplněno jménem' },
    { key: 'genitive', label: '2. pád (Bez koho, čeho?)', placeholder: 'např. Petra' },
    { key: 'dative', label: '3. pád (Ke komu, čemu?)', placeholder: 'např. Petrovi' },
    { key: 'accusative', label: '4. pád (Vidím koho, co?)', placeholder: 'např. Petra' },
    { key: 'vocative', label: '5. pád (Oslovujeme, voláme!)', placeholder: 'např. Petře' },
    { key: 'locative', label: '6. pád (O kom, o čem?)', placeholder: 'např. Petrovi' },
    { key: 'instrumental', label: '7. pád (S kým, čím?)', placeholder: 'např. Petrem' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-zinc-900 w-full max-w-lg rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200/40 dark:border-zinc-700/60">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Skloňování jména: <span className="text-sky-600 dark:text-sky-400">{name}</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              Doplňte 7 pádů pro přirozené české notifikace a oslovení v systému.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3 my-5 max-h-[60vh] overflow-y-auto pr-1">
          {cases.map((c) => (
            <div key={c.key} className="space-y-1">
              <label className="text-xs font-medium text-slate-700 dark:text-zinc-300">
                {c.label}
              </label>
              <input
                type="text"
                value={(forms as any)[c.key]}
                onChange={(e) => handleChange(c.key, e.target.value)}
                placeholder={c.placeholder}
                className="w-full px-3.5 py-2 text-sm bg-slate-100 dark:bg-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/50 dark:text-white"
              />
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-slate-200/40 dark:border-zinc-700/60">
          <button
            onClick={onIgnore}
            className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200 px-3 py-2 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <EyeOff className="w-4 h-4" />
            <span>Ignorovat toto jméno</span>
          </button>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="text-xs font-medium text-slate-600 dark:text-zinc-300 px-4 py-2 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
            >
              Zrušit
            </button>
            <button
              onClick={() => onSave(forms)}
              className="flex items-center gap-1.5 text-xs font-medium text-white bg-sky-600 hover:bg-sky-700 px-5 py-2 rounded-full shadow transition-all hover:scale-102"
            >
              <Check className="w-4 h-4" />
              <span>Uložit skloňování</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

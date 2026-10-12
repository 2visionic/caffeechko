import React, { useState } from 'react';
import { Check, EyeOff, UserCheck } from 'lucide-react';
import { Modal, Button, Input } from './ui';

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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <span>
          Skloňování jména: <span className="text-sky-600 dark:text-sky-400">{name}</span>
        </span>
      }
      subtitle="Doplňte 7 pádů pro přirozené české notifikace a oslovení v systému."
      icon={UserCheck}
      iconBgClass="bg-sky-500/15 text-sky-700 dark:text-sky-400"
      size="lg"
      footer={
        <div className="flex items-center justify-between w-full">
          <Button
            variant="ghost"
            size="sm"
            icon={EyeOff}
            onClick={onIgnore}
          >
            Ignorovat
          </Button>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Zrušit
            </Button>
            <Button
              variant="filled"
              colorKey="sky"
              size="sm"
              icon={Check}
              onClick={() => onSave(forms)}
            >
              Uložit tvary
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-3 pr-1">
        {cases.map((c) => (
          <Input
            key={c.key}
            label={c.label}
            value={(forms as any)[c.key]}
            onChange={(e) => handleChange(c.key, e.target.value)}
            placeholder={c.placeholder}
          />
        ))}
      </div>
    </Modal>
  );
};

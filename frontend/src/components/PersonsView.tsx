import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import type { Persona } from '../App';
import type { StatusType } from '../config/presenceConfig';
import { CONTRACT_TYPE_LABELS } from '../types/attendance';
import { WhoIsWhereBox } from './WhoIsWhereBox';
import { EditUserModal } from './EditUserModal';
import { CreateUserModal } from './CreateUserModal';
import { PersonAbsenceSettingsModal } from './PersonAbsenceSettingsModal';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { Button } from './ui';
import { api } from '../api';

interface PersonsViewProps {
  personasList: Persona[];
  activePersona: Persona;
  getPersonaStatus: (p: Persona) => { statusText: string; statusColor: string; locationType: StatusType };
  onSelectPersona?: (p: Persona) => void;
  contractTypesMap?: Record<string, string>;
  contractTypes?: Array<{ code: string; name: string; coefficient?: number }>;
  addToast: (type: 'success' | 'warning' | 'error', title: string, message: string) => void;
  onReloadUsers?: () => Promise<void> | void;
}

export function PersonsView({
  personasList,
  activePersona,
  getPersonaStatus,
  onSelectPersona,
  contractTypesMap: initialContractTypesMap,
  contractTypes,
  addToast,
  onReloadUsers
}: PersonsViewProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingPersona, setEditingPersona] = useState<Persona | null>(null);
  const [settingsPersona, setSettingsPersona] = useState<Persona | null>(null);
  const [deletingPersona, setDeletingPersona] = useState<Persona | null>(null);

  const managedPersonas = useMemo(() => {
    const activeId = activePersona.id.toLowerCase();
    const others = personasList.filter((p) => p.id.toLowerCase() !== activeId);

    if (activePersona.role === 'team_lead') {
      return others.filter((p) => p.parentPersonId?.toLowerCase() === activeId);
    }

    if (activePersona.role === 'manager') {
      return others.filter((p) => p.managerId?.toLowerCase() === activeId);
    }

    if (activePersona.role === 'office_manager' || activePersona.role === 'admin') {
      return others;
    }

    return [];
  }, [personasList, activePersona]);

  const subtitle = useMemo(() => {
    if (activePersona.role === 'team_lead') {
      return 'Přehled osob ve vaší správě (kolegové, kteří vás mají přiřazeného jako vedoucího)';
    }
    if (activePersona.role === 'manager') {
      return 'Přehled osob ve vaší správě (kolegové, kteří vás mají přiřazeného jako manažera)';
    }
    return 'Kompletní přehled všech osob ve správě organizace';
  }, [activePersona.role]);

  const resolvedContractTypesMap = useMemo(() => {
    const map: Record<string, string> = { ...CONTRACT_TYPE_LABELS, ...(initialContractTypesMap || {}) };
    if (contractTypes) {
      for (const ct of contractTypes) {
        if (ct?.code && ct?.name) {
          map[ct.code] = ct.name;
        }
      }
    }
    return map;
  }, [initialContractTypesMap, contractTypes]);

  const handleConfirmToggleActive = async () => {
    if (!deletingPersona) return;
    try {
      const res = await api.toggleUserActive(deletingPersona.id);
      if (res?.data) {
        const nextState = res.data.isActive;
        addToast(
          'success',
          nextState ? 'Osoba aktivována' : 'Osoba deaktivována',
          res.data.message || `Stav uživatele ${deletingPersona.name} byl upraven.`
        );
        await onReloadUsers?.();
      }
    } catch (e: any) {
      addToast('error', 'Chyba změny stavu', e.message || 'Nepodařilo se změnit stav osoby.');
    } finally {
      setDeletingPersona(null);
    }
  };

  return (
    <>
      <WhoIsWhereBox
        personasList={managedPersonas}
        activePersona={activePersona}
        getPersonaStatus={getPersonaStatus}
        onSelectPersona={onSelectPersona}
        title="Osoby ve správě"
        subtitle={subtitle}
        showContacts={false}
        showEmploymentAndGdpr={true}
        hideSearch={true}
        extraFilterAction={
          activePersona.role === 'admin' || activePersona.role === 'office_manager' ? (
            <Button
              variant="filled"
              color="primary"
              size="sm"
              icon={Plus}
              onClick={() => setIsCreateOpen(true)}
            >
              Osoba
            </Button>
          ) : undefined
        }
        onEditPersona={(p) => setEditingPersona(p)}
        onOpenPersonaSettings={(p) => setSettingsPersona(p)}
        onDeletePersona={(p) => setDeletingPersona(p)}
      />

      {/* Vytvoření nové osoby (officer, admin) */}
      <CreateUserModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        allUsers={personasList}
        contractTypesMap={resolvedContractTypesMap}
        contractTypes={contractTypes}
        onUserCreated={async () => {
          await onReloadUsers?.();
        }}
        addToast={addToast}
      />

      {/* Editace osoby (officer, admin) */}
      <EditUserModal
        isOpen={Boolean(editingPersona)}
        onClose={() => setEditingPersona(null)}
        user={editingPersona}
        allUsers={personasList}
        contractTypesMap={resolvedContractTypesMap}
        onUserSaved={async () => {
          await onReloadUsers?.();
        }}
        addToast={addToast}
      />

      {/* Nastavení absencí a fondu osoby (officer, admin) */}
      <PersonAbsenceSettingsModal
        isOpen={Boolean(settingsPersona)}
        onClose={() => setSettingsPersona(null)}
        user={settingsPersona}
        onSettingsSaved={async () => {
          await onReloadUsers?.();
        }}
        addToast={addToast}
      />

      {/* Potvrzení smazání / deaktivace / aktivace osoby */}
      <ConfirmDeleteModal
        isOpen={Boolean(deletingPersona)}
        onClose={() => setDeletingPersona(null)}
        title={deletingPersona?.name || 'Osoba'}
        description={
          deletingPersona?.isActive === false
            ? 'Aktivace osoby'
            : 'Deaktivace osoby'
        }
        confirmText={deletingPersona?.isActive === false ? 'Aktivovat' : 'Deaktivovat'}
        confirmColor={deletingPersona?.isActive === false ? 'emerald' : 'rose'}
        onConfirm={handleConfirmToggleActive}
      />
    </>
  );
}

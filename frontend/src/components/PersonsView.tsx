import { useMemo } from 'react';
import type { Persona } from '../App';
import type { StatusType } from '../config/presenceConfig';
import { WhoIsWhereBox } from './WhoIsWhereBox';

interface PersonsViewProps {
  personasList: Persona[];
  activePersona: Persona;
  getPersonaStatus: (p: Persona) => { statusText: string; statusColor: string; locationType: StatusType };
  onSelectPersona?: (p: Persona) => void;
}

export function PersonsView({
  personasList,
  activePersona,
  getPersonaStatus,
  onSelectPersona
}: PersonsViewProps) {
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

  return (
    <WhoIsWhereBox
      personasList={managedPersonas}
      activePersona={activePersona}
      getPersonaStatus={getPersonaStatus}
      onSelectPersona={onSelectPersona}
      title="Osoby ve správě"
      subtitle={subtitle}
    />
  );
}

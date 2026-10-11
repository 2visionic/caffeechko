import { Users, X, Crown, Code, TrendingUp, UserCheck } from 'lucide-react';

export interface OrgPerson {
  id: string;
  name: string;
  roleLabel: string;
  department: string;
  managerId?: string;
  managerName?: string;
  isClockedIn: boolean;
  locationName: string;
  contract: 'HPP' | 'OSVČ';
}

interface OrgHierarchyModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPersonaId: string;
  people: OrgPerson[];
  onSelectPersona: (personId: string) => void;
}

export function OrgHierarchyModal({
  isOpen,
  onClose,
  currentPersonaId,
  people,
  onSelectPersona
}: OrgHierarchyModalProps) {
  if (!isOpen) return null;

  const currentPerson = people.find((p) => p.id === currentPersonaId);

  // Group by departments
  const executive = people.filter((p) => p.department === 'Vedení společnosti');
  const hr = people.filter((p) => p.department === 'Provoz a lidské zdroje');
  const devLead = people.find((p) => p.name.includes('Jana Nováková'));
  const devTeam = people.filter((p) => p.department === 'Vývoj a technologie' && p.id !== devLead?.id);
  const marketingLead = people.find((p) => p.name.includes('David Sýkora'));
  const marketingTeam = people.filter((p) => p.department === 'Marketing a obchod' && p.id !== marketingLead?.id);

  const renderPersonCard = (p: OrgPerson, _isLead = false) => {
    const isCurrent = p.id === currentPersonaId;
    const isDirectManager = currentPerson?.managerId === p.id;
    const isSubordinate = p.managerId === currentPersonaId;

    return (
      <div
        key={p.id}
        onClick={() => onSelectPersona(p.id)}
        className={`p-3.5 rounded-2xl transition-all cursor-pointer flex items-center justify-between gap-3 ${
          isCurrent
            ? 'bg-amber-500/20 ring-2 ring-amber-500/40 shadow-sm'
            : isDirectManager
            ? 'bg-sky-500/10 dark:bg-sky-500/20 hover:bg-sky-500/15'
            : isSubordinate
            ? 'bg-emerald-500/10 dark:bg-emerald-500/20 hover:bg-emerald-500/15'
            : 'bg-slate-100/70 dark:bg-zinc-800/80 hover:bg-slate-200/60 dark:hover:bg-zinc-700/60'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative flex-shrink-0">
            <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-zinc-700 flex items-center justify-center font-bold text-xs text-slate-700 dark:text-zinc-200">
              {p.name.split(' ').map((n) => n[0]).join('')}
            </div>
            <span
              className={`absolute bottom-0 right-0 w-3 h-3 rounded-full ring-2 ring-white dark:ring-zinc-900 ${
                p.isClockedIn ? 'bg-emerald-500' : 'bg-slate-400'
              }`}
            />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                {p.name}
              </span>
              {isCurrent && (
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-500 text-white flex-shrink-0">
                  Vy
                </span>
              )}
              {isDirectManager && (
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-sky-500 text-white flex-shrink-0">
                  Váš nadřízený
                </span>
              )}
              {isSubordinate && (
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-600 text-white flex-shrink-0">
                  Váš podřízený
                </span>
              )}
            </div>

            <div className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
              {p.roleLabel} • {p.contract}
            </div>
          </div>
        </div>

        <div className="text-right flex-shrink-0">
          <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-white/70 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300">
            {p.isClockedIn ? 'Přítomen' : 'Mimo práci'}
          </span>
          <div className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1">
            Kliknutím přepnout
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-zinc-900 w-full max-w-2xl max-h-[85vh] rounded-3xl p-6 sm:p-7 shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200/40 dark:border-zinc-700/60 pb-3 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Organizační struktura & Hierarchie schvalování
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Instance: <span className="font-semibold text-amber-600 dark:text-amber-400">magicware</span> • Přehled nadřízených a týmů
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current User Context Banner */}
        {currentPerson && (
          <div className="p-3 rounded-2xl bg-amber-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs flex-shrink-0">
            <div className="flex items-center gap-2 text-amber-900 dark:text-amber-300">
              <UserCheck className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
              <span>
                Jste přihlášeni jako: <strong>{currentPerson.name}</strong> ({currentPerson.roleLabel})
              </span>
            </div>
            <div className="text-[11px] text-amber-800/80 dark:text-amber-400">
              {currentPerson.managerName ? (
                <span>Váš nadřízený: <strong>{currentPerson.managerName}</strong></span>
              ) : (
                <span className="font-semibold">Nejvyšší vedení (bez nadřízeného)</span>
              )}
            </div>
          </div>
        )}

        {/* Scrollable Tree Container */}
        <div className="overflow-y-auto space-y-5 pr-1 text-xs">
          {/* 1. TOP MANAGEMENT */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-zinc-200 uppercase tracking-wider text-[11px] font-mono">
              <Crown className="w-3.5 h-3.5 text-amber-500" />
              <span>1. Vedení společnosti (Executive & HR)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {executive.map((p) => renderPersonCard(p, true))}
              {hr.map((p) => renderPersonCard(p, true))}
            </div>
          </div>

          {/* 2. VÝVOJOVÝ TÝM */}
          <div className="space-y-2.5 p-3.5 rounded-2xl bg-slate-100/60 dark:bg-zinc-800/40">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-zinc-200 uppercase tracking-wider text-[11px] font-mono">
                <Code className="w-3.5 h-3.5 text-sky-500" />
                <span>2. Vývoj a technologie (Dev Team)</span>
              </div>
              <span className="text-[10px] text-slate-500 dark:text-zinc-400">
                Vedoucí schvaluje dovolené vývojářům
              </span>
            </div>

            {/* Team Lead */}
            {devLead && (
              <div className="pl-1">
                <div className="text-[10px] uppercase font-bold text-sky-600 dark:text-sky-400 mb-1 font-mono">
                  Team Lead (Schvalovatel):
                </div>
                {renderPersonCard(devLead, true)}
              </div>
            )}

            {/* Subordinates */}
            <div className="pl-4 sm:pl-6 space-y-2 border-l-2 border-dashed border-slate-200/70 dark:border-zinc-700/60">
              <div className="text-[10px] uppercase font-bold text-slate-400 dark:text-zinc-500 font-mono">
                Podřízení členové týmu:
              </div>
              <div className="space-y-2">
                {devTeam.map((p) => renderPersonCard(p))}
              </div>
            </div>
          </div>

          {/* 3. MARKETINGOVÝ TÝM */}
          <div className="space-y-2.5 p-3.5 rounded-2xl bg-slate-100/60 dark:bg-zinc-800/40">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-zinc-200 uppercase tracking-wider text-[11px] font-mono">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                <span>3. Marketing & Obchod</span>
              </div>
              <span className="text-[10px] text-slate-500 dark:text-zinc-400">
                Vedoucí schvaluje marketingové žádosti
              </span>
            </div>

            {/* Team Lead */}
            {marketingLead && (
              <div className="pl-1">
                <div className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 mb-1 font-mono">
                  Team Lead (Schvalovatel):
                </div>
                {renderPersonCard(marketingLead, true)}
              </div>
            )}

            {/* Subordinates */}
            <div className="pl-4 sm:pl-6 space-y-2 border-l-2 border-dashed border-slate-200/70 dark:border-zinc-700/60">
              <div className="text-[10px] uppercase font-bold text-slate-400 dark:text-zinc-500 font-mono">
                Podřízení členové týmu:
              </div>
              <div className="space-y-2">
                {marketingTeam.map((p) => renderPersonCard(p))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-slate-200/40 dark:border-zinc-700/60 flex items-center justify-between flex-shrink-0">
          <div className="text-[11px] text-slate-500 dark:text-zinc-400">
            Kliknutím na kteroukoli osobu se do ní okamžitě přepnete v Dev módu.
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-xs font-semibold text-slate-700 dark:text-zinc-300"
          >
            Zavřít
          </button>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import {
  Settings,
  Sun,
  Moon,
  Check,
  ExternalLink,
  Shield,
  GripVertical,
  RotateCcw
} from 'lucide-react';
import { Modal, Button, UserAvatar, ContractBadge } from './ui';
import { RoleBadge } from './RoleBadge';
import { GdprStatusBadge } from './GdprConsentModal';
import { getStatusConfig } from '../config/presenceConfig';
import {
  resolveAbsenceTypeConfig,
  resolveAbsenceTypeLabel,
  type AbsenceTypeConfigDto
} from '../api';
import {
  getDefaultQuickAbsenceTypes,
  sortQuickAbsenceTypes
} from './QuickRequestActions';
import type { Persona } from '../App';

export interface UserSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  activePersona: Persona;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onOpenSystemSettings?: () => void;
  onOpenGdprModal?: () => void;
  gdprStatus?: 'granted' | 'revoked' | 'unfilled' | string | null;
  hasActiveGdpr?: boolean;
  absenceTypesMap?: Record<string, AbsenceTypeConfigDto>;
  absenceSortOrder?: string[];
  onSaveAbsenceSortOrder?: (newOrder: string[]) => Promise<void> | void;
  addToast: (type: 'success' | 'warning' | 'error', title: string, message: string) => void;
}

export function UserSettingsModal({
  isOpen,
  onClose,
  activePersona,
  darkMode,
  onToggleDarkMode,
  onOpenSystemSettings,
  onOpenGdprModal,
  gdprStatus,
  hasActiveGdpr = true,
  absenceTypesMap,
  absenceSortOrder = [],
  onSaveAbsenceSortOrder
}: UserSettingsModalProps) {
  const isAdminOrOfficer = activePersona.role === 'admin' || activePersona.role === 'office_manager';
  const effectiveGdprStatus = gdprStatus ?? activePersona.gdprStatus ?? 'unfilled';
  const isOsvc = activePersona.contract === 'OSVČ';

  const defaultAbsenceTypes = getDefaultQuickAbsenceTypes(absenceTypesMap, {
    isOsvc,
    isPermanentHomeOffice: activePersona.isPermanentHomeOffice,
    compensatoryLeaveEnabled: Boolean(activePersona.compensatoryLeaveEnabled)
  }).map((t) => String(t));

  const [localOrder, setLocalOrder] = useState<string[]>(() =>
    sortQuickAbsenceTypes(defaultAbsenceTypes, absenceSortOrder).map((t) => String(t))
  );
  const [draggedCode, setDraggedCode] = useState<string | null>(null);
  const [dragOverCode, setDragOverCode] = useState<string | null>(null);
  const [isSavingSort, setIsSavingSort] = useState(false);

  useEffect(() => {
    const nextSorted = sortQuickAbsenceTypes(defaultAbsenceTypes, absenceSortOrder).map((t) =>
      String(t)
    );
    setLocalOrder(nextSorted);
  }, [
    isOpen,
    activePersona.id,
    activePersona.contract,
    activePersona.isPermanentHomeOffice,
    activePersona.compensatoryLeaveEnabled,
    absenceTypesMap,
    absenceSortOrder
  ]);

  const isDefaultOrder = (order: string[]) =>
    order.length === defaultAbsenceTypes.length &&
    order.every((code, idx) => code === defaultAbsenceTypes[idx]);

  const hasCustomOrder = !isDefaultOrder(localOrder);

  const persistOrderChange = async (nextOrder: string[]) => {
    setLocalOrder(nextOrder);
    if (!onSaveAbsenceSortOrder) return;
    setIsSavingSort(true);
    try {
      const payload = isDefaultOrder(nextOrder) ? [] : nextOrder;
      await onSaveAbsenceSortOrder(payload);
    } finally {
      setIsSavingSort(false);
    }
  };

  const handleDropOnCode = (targetCode: string) => {
    if (!draggedCode || draggedCode === targetCode) {
      setDraggedCode(null);
      setDragOverCode(null);
      return;
    }
    const fromIdx = localOrder.indexOf(draggedCode);
    const toIdx = localOrder.indexOf(targetCode);
    if (fromIdx === -1 || toIdx === -1) {
      setDraggedCode(null);
      setDragOverCode(null);
      return;
    }
    const next = [...localOrder];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    setDraggedCode(null);
    setDragOverCode(null);
    void persistOrderChange(next);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Uživatelské nastavení"
      subtitle="Přehled účtu a nastavení vzhledu aplikace"
      icon={Settings}
      iconBgClass="bg-amber-500/15 text-amber-700 dark:text-amber-400"
      size="lg"
      footer={
        <Button
          variant="transparent"
          color="rose"
          size="normal"
          width="full"
          onClick={onClose}
        >
          Zavřít
        </Button>
      }
    >
      <div className="space-y-6 py-2">
        {/* 1. Profilová karta uživatele */}
        <div className="p-4 rounded-3xl bg-slate-50 dark:bg-zinc-800/50 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3.5 min-w-0">
            <UserAvatar name={activePersona.name} size="lg" isCurrent />
            <div className="min-w-0">
              <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                {activePersona.name}
              </div>
              <div className="text-xs text-slate-500 dark:text-zinc-400 truncate">
                {activePersona.email || 'uživatel bez e-mailu'}
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <RoleBadge role={activePersona.role} roleLabel={activePersona.roleLabel} />
                <ContractBadge
                  contract={activePersona.contract}
                  contractType={activePersona.contractType}
                  contractTypeName={activePersona.contractTypeName}
                />
              </div>
            </div>
          </div>
        </div>

        {/* 2. Vzhled a motiv aplikace */}
        <div className="space-y-2.5">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 font-mono">
            Vzhled a motiv aplikace
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                if (darkMode) onToggleDarkMode();
              }}
              className={`p-3.5 rounded-2xl flex items-center gap-3 transition-all cursor-pointer ${
                !darkMode
                  ? 'bg-amber-500/15 text-amber-950 dark:text-amber-200 font-bold ring-2 ring-amber-500/40 shadow-xs'
                  : 'bg-slate-100 dark:bg-zinc-800/60 text-slate-600 dark:text-zinc-400 hover:bg-slate-200/70 dark:hover:bg-zinc-800'
              }`}
            >
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-600 flex items-center justify-center flex-shrink-0">
                <Sun className="w-4 h-4" />
              </div>
              <div className="text-left min-w-0">
                <div className="text-xs font-semibold">Světlý režim</div>
                <div className="text-[11px] text-slate-400 dark:text-zinc-500 font-normal">Denní zobrazení</div>
              </div>
              {!darkMode && <Check className="w-4 h-4 ml-auto text-amber-600 flex-shrink-0" />}
            </button>

            <button
              type="button"
              onClick={() => {
                if (!darkMode) onToggleDarkMode();
              }}
              className={`p-3.5 rounded-2xl flex items-center gap-3 transition-all cursor-pointer ${
                darkMode
                  ? 'bg-amber-500/15 text-amber-950 dark:text-amber-200 font-bold ring-2 ring-amber-500/40 shadow-xs'
                  : 'bg-slate-100 dark:bg-zinc-800/60 text-slate-600 dark:text-zinc-400 hover:bg-slate-200/70 dark:hover:bg-zinc-800'
              }`}
            >
              <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center flex-shrink-0">
                <Moon className="w-4 h-4" />
              </div>
              <div className="text-left min-w-0">
                <div className="text-xs font-semibold">Tmavý režim</div>
                <div className="text-[11px] text-slate-400 dark:text-zinc-500 font-normal">Noční / šetrný</div>
              </div>
              {darkMode && <Check className="w-4 h-4 ml-auto text-amber-400 flex-shrink-0" />}
            </button>
          </div>
        </div>

        {/* 2.5 Řazení tlačítek pro zadání absence (Drag & Drop) */}
        {activePersona.id !== 'anonymous' &&
          activePersona.id !== 'clean-uninstalled' &&
          localOrder.length > 1 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 font-mono block">
                    Řazení tlačítek pro zadání absence
                  </label>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                    Přetažením upravte pořadí tlačítek absencí na Přehledu a v Moje žádosti.
                  </p>
                </div>
                {hasCustomOrder && (
                  <Button
                    variant="surface"
                    size="xs"
                    icon={RotateCcw}
                    disabled={isSavingSort}
                    onClick={() => {
                      void persistOrderChange([...defaultAbsenceTypes]);
                    }}
                  >
                    Výchozí
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {localOrder.map((code, index) => {
                  const cfg = getStatusConfig(code);
                  const typeRule = resolveAbsenceTypeConfig(code, absenceTypesMap);
                  const label = resolveAbsenceTypeLabel(typeRule, isOsvc) || cfg.label;
                  const Icon = cfg.icon;
                  const isDragging = draggedCode === code;
                  const isDragOver = dragOverCode === code && draggedCode !== code;

                  return (
                    <div
                      key={code}
                      draggable={!isSavingSort}
                      onDragStart={(e) => {
                        setDraggedCode(code);
                        e.dataTransfer.effectAllowed = 'move';
                        try {
                          e.dataTransfer.setData('text/plain', code);
                        } catch {
                          // ignore
                        }
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                        if (dragOverCode !== code) {
                          setDragOverCode(code);
                        }
                      }}
                      onDragLeave={() => {
                        if (dragOverCode === code) {
                          setDragOverCode(null);
                        }
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        handleDropOnCode(code);
                      }}
                      onDragEnd={() => {
                        setDraggedCode(null);
                        setDragOverCode(null);
                      }}
                      className={`p-2.5 rounded-2xl flex items-center gap-2.5 select-none transition-all cursor-grab active:cursor-grabbing ${
                        isDragging
                          ? 'opacity-40 scale-98 bg-slate-200 dark:bg-zinc-700'
                          : isDragOver
                          ? 'bg-amber-500/15 ring-2 ring-amber-500/50'
                          : 'bg-slate-100/80 dark:bg-zinc-800/60 hover:bg-slate-200/70 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <GripVertical className="w-4 h-4 text-slate-400 dark:text-zinc-500 shrink-0" />
                      <span className="text-[11px] font-mono font-bold text-slate-400 dark:text-zinc-500 w-4 shrink-0">
                        {index + 1}.
                      </span>
                      <Icon className={`w-4 h-4 shrink-0 ${cfg.iconColorClass}`} />
                      <span className="text-xs font-semibold text-slate-800 dark:text-zinc-100 truncate">
                        {label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        {/* 3. Ochrana osobních údajů (GDPR) */}
        {activePersona.id !== 'anonymous' && activePersona.id !== 'clean-uninstalled' && (
          <div className="space-y-2.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 font-mono">
              Ochrana osobních údajů (GDPR)
            </label>
            <div className="p-4 rounded-2xl bg-slate-100/70 dark:bg-zinc-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-slate-900 dark:text-white">
                    Aktuální stav souhlasu:
                  </span>
                  <GdprStatusBadge status={effectiveGdprStatus} variant="full" />
                </div>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                  Souhlas se zpracováním údajů o důvěrných absencích můžete kdykoliv udělit nebo odvolat.
                </p>
              </div>
              {onOpenGdprModal && hasActiveGdpr && (
                <Button
                  variant="surface"
                  size="sm"
                  icon={Shield}
                  onClick={() => {
                    onOpenGdprModal();
                  }}
                >
                  Zobrazit
                </Button>
              )}
            </div>
          </div>
        )}

        {/* 4. Odkaz na správu systému pro Adminy a Officery */}
        {isAdminOrOfficer && onOpenSystemSettings && (
          <div className="pt-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenSystemSettings();
              }}
              className="w-full p-3 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-900 dark:text-amber-300 text-xs font-semibold transition-all flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>Přejít do globální administrace (Nastavení systému)</span>
              </div>
              <ExternalLink className="w-3.5 h-3.5 opacity-70" />
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}


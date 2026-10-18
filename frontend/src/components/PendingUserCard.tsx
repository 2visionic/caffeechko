import { useState } from 'react';
import { Check } from 'lucide-react';
import { formatContractLabel } from '../types/attendance';
import {
  DEFAULT_ABSENCE_TYPES,
  type AbsenceTypeConfigDto,
  type ContractTypeSettingDto
} from '../api';
import { Button, UserAvatar, StatusBadge, Select } from './ui';

export interface PendingUserCardProps {
  user: any;
  defaultVacationDays?: number;
  defaultSickDays?: number;
  defaultHomeOfficeWeeklyDays?: number;
  baseDailyHours?: number;
  weeklyWorkDays?: number;
  contractTypes?: ContractTypeSettingDto[];
  absenceTypesMap?: Record<string, AbsenceTypeConfigDto>;
  onApprove: (
    role: string,
    contractKind: string,
    weeklyHours: number,
    vacationDays?: number,
    sickDays?: number,
    homeOfficeWeeklyDays?: number,
    contractType?: string,
    allowances?: Record<string, number>
  ) => void;
}

export function PendingUserCard({
  user,
  defaultVacationDays = 20,
  defaultSickDays = 3,
  defaultHomeOfficeWeeklyDays = 2,
  baseDailyHours = 8,
  weeklyWorkDays = 5,
  contractTypes,
  absenceTypesMap,
  onApprove
}: PendingUserCardProps) {
  const effectiveAbsenceMap = absenceTypesMap && Object.keys(absenceTypesMap).length > 0
    ? absenceTypesMap
    : DEFAULT_ABSENCE_TYPES;

  const limitedTypes = Object.values(effectiveAbsenceMap).filter(
    (t) => t.isActive !== false && t.defaultBudgetPeriod && t.defaultBudgetPeriod !== 'unlimited'
  );

  const getBaseDefaultForType = (t: AbsenceTypeConfigDto): number => {
    if (t.defaultAllowance != null) return t.defaultAllowance;
    if (t.code === 'vacation') return defaultVacationDays;
    if (t.code === 'sick_day') return defaultSickDays;
    if (t.code === 'home_office') return defaultHomeOfficeWeeklyDays;
    return 0;
  };

  const [role, setRole] = useState<string>('colleague');
  const [contractKind, setContractKind] = useState<string>('employee');
  const [contractType, setContractType] = useState<string>('full_time');
  const [weeklyHours, setWeeklyHours] = useState<number>(baseDailyHours * weeklyWorkDays);
  const [allowances, setAllowances] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    for (const t of limitedTypes) {
      init[t.code] = getBaseDefaultForType(t);
    }
    return init;
  });

  const getFteCoeff = (cType: string) => {
    const found = contractTypes?.find((c) => c.code === cType);
    if (found) return found.coefficient;
    if (cType === 'half_time') return 0.5;
    if (cType === 'part_time') return 0.25;
    return 1.0;
  };

  const recalculateAllowances = (kind: string, coeff: number) => {
    const next: Record<string, number> = {};
    for (const t of limitedTypes) {
      if (kind === 'osvc') {
        next[t.code] = 0;
      } else {
        const base = getBaseDefaultForType(t);
        next[t.code] = Math.round(base * coeff * 10) / 10;
      }
    }
    setAllowances(next);
  };

  const handleContractTypeChange = (cType: string) => {
    setContractType(cType);
    const coeff = getFteCoeff(cType);
    setWeeklyHours(Math.round(baseDailyHours * weeklyWorkDays * coeff));
    if (contractKind === 'employee') {
      recalculateAllowances('employee', coeff);
    }
  };

  const handleContractChange = (val: string) => {
    setContractKind(val);
    const coeff = getFteCoeff(contractType);
    recalculateAllowances(val, coeff);
  };

  const contractTypeOptions = contractTypes && contractTypes.length > 0
    ? contractTypes.map((ct) => ({
        value: ct.code,
        label: formatContractLabel('HPP', ct.code, ct.name)
      }))
    : [
        { value: 'full_time', label: formatContractLabel('HPP', 'full_time') },
        { value: 'half_time', label: formatContractLabel('HPP', 'half_time') },
        { value: 'part_time', label: formatContractLabel('HPP', 'part_time') }
      ];

  return (
    <div
      className="p-6 sm:p-7 rounded-3xl bg-amber-500/5 dark:bg-amber-500/10 shadow-sm flex flex-col gap-5 transition-all"
      style={{ border: 'none' }}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3.5">
          <UserAvatar name={user.name} size="md" />
          <div>
            <div className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
              <span>{user.name}</span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">
                Google Workspace registrace
              </span>
            </div>
            <div className="text-xs text-slate-500 dark:text-zinc-400">
              {user.email}
            </div>
          </div>
        </div>

        <StatusBadge status="pending" customLabel="Čeká na nastavení úvazku" size="md" />
      </div>

      {/* Settings Row: Smlouva, Role, Úvazek */}
      <div className="p-4 rounded-2xl bg-white/60 dark:bg-zinc-800/60 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Select
          label="Typ smlouvy:"
          value={contractKind}
          onChange={(e) => handleContractChange(e.target.value)}
          options={[
            { value: 'employee', label: 'HPP' },
            { value: 'osvc', label: 'OSVČ' }
          ]}
        />

        <Select
          label="Pracovní role:"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          options={[
            { value: 'colleague', label: 'Kolega' },
            { value: 'team_lead', label: 'Vedoucí' },
            { value: 'manager', label: 'Manažer' },
            { value: 'office_manager', label: 'Office Manager' },
            { value: 'admin', label: 'Administrátor' }
          ]}
        />

        <Select
          label="Typ úvazku:"
          value={contractType}
          onChange={(e) => handleContractTypeChange(e.target.value)}
          options={contractTypeOptions}
        />
      </div>

      {/* Settings Row 2: Fondy absencí (dynamicky z číselníku absence_types) */}
      <div className="p-4 rounded-2xl bg-white/60 dark:bg-zinc-800/60 grid grid-cols-1 sm:grid-cols-3 gap-3">
        {limitedTypes.map((absType) => {
          const periodLabel = absType.defaultBudgetPeriod === 'weekly'
            ? 'dní / týden'
            : absType.defaultBudgetPeriod === 'monthly'
            ? 'dní / měsíc'
            : 'dní / rok';
          const val = allowances[absType.code] ?? getBaseDefaultForType(absType);
          return (
            <div key={absType.code} className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                {absType.nameEmployee} ({periodLabel}):
              </label>
              <input
                type="number"
                min={0}
                max={absType.defaultBudgetPeriod === 'weekly' ? 7 : 100}
                value={val}
                onChange={(e) =>
                  setAllowances((prev) => ({
                    ...prev,
                    [absType.code]: Number(e.target.value)
                  }))
                }
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              />
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button
          variant="filled"
          colorKey="amber"
          icon={Check}
          onClick={() =>
            onApprove(
              role,
              contractKind,
              weeklyHours,
              allowances.vacation ?? defaultVacationDays,
              allowances.sick_day ?? defaultSickDays,
              allowances.home_office ?? defaultHomeOfficeWeeklyDays,
              contractType,
              allowances
            )
          }
        >
          Schválit a nastavit úvazek
        </Button>
      </div>
    </div>
  );
}

import type { ShiftBlock } from '../components/DayTimeline';
export type { ShiftBlock };

export interface Persona {
  id: string;
  name: string;
  email: string;
  phoneNumber: string;
  role: 'admin' | 'manager' | 'team_lead' | 'office_manager' | 'colleague';
  roleLabel: string;
  managerId?: string;
  managerName?: string;
  parentPersonId?: string;
  parentPersonName?: string;
  vacationRemaining?: number;
  vacationTotal?: number;
  sickDaysRemaining?: number;
  sickDaysTotal?: number;
  unpaidLeaveDays?: number;
  illnessDays?: number;
  doctorHours?: number;
  homeOfficeDays?: number;
  overtimeHours?: number;
  contract: 'HPP' | 'OSVČ';
  contractType?: 'full_time' | 'half_time' | 'part_time';
  contractTypeName?: string;
  dailyHours?: number;
  fteCoefficient?: number;
  isApproved?: boolean;
  isPermanentHomeOffice?: boolean;
  isFemale?: boolean;
  firstName?: string;
  lastName?: string;
  isActive?: boolean;
  employmentStartDate?: string;
  homeOfficePeriod?: string;
  homeOfficeDaysLimit?: number;
  homeOfficeRemaining?: number;
  homeOfficeTotal?: number;
  homeOfficeUsed?: number;
  compensatoryLeaveEnabled?: boolean;
  compensatoryLeaveDays?: number;
  compensatoryLeavePendingDays?: number;
  compensatoryLeaveAvailableSaldoHours?: number;
  compensatoryLeaveMaxDays?: number;
  gdprStatus?: 'granted' | 'revoked' | 'unfilled';
  activeGdprDocumentId?: string | null;
}

export const CONTRACT_TYPE_LABELS: Record<string, string> = {
  full_time: 'Plný úvazek',
  half_time: 'Poloviční úvazek',
  part_time: 'Zkrácený úvazek',
  osvc: 'OSVČ'
};

export function syncContractTypeLabels(
  types: Array<{ code: string; name: string }> | Record<string, { code: string; name: string }>
) {
  const list = Array.isArray(types) ? types : Object.values(types);
  for (const item of list) {
    if (item?.code && item?.name) {
      CONTRACT_TYPE_LABELS[item.code] = item.name;
    }
  }
}

/**
 * Jednotné vypsání názvu pracovního úvazku dle číselníku contract_types v DB (bez 'HPP • ' a bez '(1.0)').
 */
export function formatContractLabel(
  contract?: 'HPP' | 'OSVČ' | string,
  contractType?: string,
  contractTypeName?: string
): string {
  if (contract === 'OSVČ' || contract === 'osvc' || contract === 'IČO' || contractType === 'osvc') {
    return CONTRACT_TYPE_LABELS.osvc || 'OSVČ';
  }
  if (contractTypeName && contractTypeName.trim().length > 0) {
    return contractTypeName;
  }
  if (contractType && CONTRACT_TYPE_LABELS[contractType]) {
    return CONTRACT_TYPE_LABELS[contractType];
  }
  return CONTRACT_TYPE_LABELS.full_time || 'Plný úvazek';
}

export interface ToastMessage {
  id: number;
  type: 'success' | 'warning' | 'error';
  title: string;
  message: string;
}

export function formatHoursMinutes(hoursDecimal: number, showZeroMinutes = false): string {
  const totalMinutes = Math.max(0, Math.round(hoursDecimal * 60));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (m === 0 && !showZeroMinutes) {
    return `${h}h`;
  }
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

export function formatOvertime(hoursDecimal: number): string {
  const totalMinutes = Math.round(hoursDecimal * 60);
  if (totalMinutes === 0) return '0h';
  const sign = totalMinutes > 0 ? '+' : '-';
  const absMin = Math.abs(totalMinutes);
  const h = Math.floor(absMin / 60);
  const m = absMin % 60;
  if (m === 0) {
    return `${sign}${h}h`;
  }
  return `${sign}${h}h ${String(m).padStart(2, '0')}m`;
}

export function formatDateCzech(dStr?: string | null): string {
  if (!dStr || typeof dStr !== 'string') return '';
  const parts = dStr.split('-');
  if (parts.length === 3) {
    return `${parseInt(parts[2], 10)}. ${parseInt(parts[1], 10)}. ${parts[0]}`;
  }
  return dStr;
}

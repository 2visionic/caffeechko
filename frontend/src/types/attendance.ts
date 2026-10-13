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
  dailyHours?: number;
  fteCoefficient?: number;
  isApproved?: boolean;
}

export interface ToastMessage {
  id: number;
  type: 'success' | 'warning' | 'error';
  title: string;
  message: string;
}

export function formatHoursMinutes(hoursDecimal: number): string {
  const totalMinutes = Math.max(0, Math.round(hoursDecimal * 60));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

export function formatOvertime(hoursDecimal: number): string {
  const sign = hoursDecimal >= 0 ? '+' : '-';
  const totalMinutes = Math.round(Math.abs(hoursDecimal) * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
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

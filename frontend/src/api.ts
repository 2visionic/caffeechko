const API_BASE = 'http://localhost:5000/api';

export type DatabaseMode = 'dev' | 'clean';

export function getStoredDbMode(): DatabaseMode {
  if (typeof window !== 'undefined') {
    return (localStorage.getItem('caffeechko_db_mode') as DatabaseMode) || 'dev';
  }
  return 'dev';
}

export function setStoredDbMode(mode: DatabaseMode) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('caffeechko_db_mode', mode);
  }
}

export function getSessionUserId(): string | null {
  if (typeof window !== 'undefined') {
    return sessionStorage.getItem('caffeechko_session_user_id');
  }
  return null;
}

export function setSessionUserId(userId: string) {
  if (typeof window !== 'undefined') {
    sessionStorage.setItem('caffeechko_session_user_id', userId);
  }
}

export function getAuthToken(): string | null {
  if (typeof window !== 'undefined') {
    return sessionStorage.getItem('caffeechko_auth_token');
  }
  return null;
}

export function setAuthToken(token: string) {
  if (typeof window !== 'undefined') {
    sessionStorage.setItem('caffeechko_auth_token', token);
  }
}

export function clearSessionUserId() {
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem('caffeechko_session_user_id');
    sessionStorage.removeItem('caffeechko_session_user');
    sessionStorage.removeItem('caffeechko_auth_token');
  }
}

function getHeaders(customHeaders?: Record<string, string>) {
  const sessionUserId = getSessionUserId();
  const token = getAuthToken();
  return {
    'Content-Type': 'application/json',
    'X-Database-Mode': getStoredDbMode(),
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(sessionUserId && sessionUserId !== 'anonymous'
      ? { 'X-User-Id': sessionUserId, 'X-Dev-User-Id': sessionUserId }
      : {}),
    ...(customHeaders || {})
  };
}

async function requestJson<T = any>(
  path: string,
  options?: RequestInit,
  requireOk = true
): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: getHeaders(options?.headers as Record<string, string> | undefined)
    });
    if (requireOk && !res.ok) return null;
    const text = await res.text();
    let parsed: any = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = null;
    }
    if (!res.ok) {
      if (parsed && parsed.error) return parsed as T;
      return {
        error: {
          code: `ERR_HTTP_${res.status}`,
          message: parsed?.title || 'Chyba serveru při zpracování požadavku.'
        }
      } as unknown as T;
    }
    return parsed as T;
  } catch {
    return null;
  }
}

export interface ApiClockInRequest {
  userId?: string;
  nfcIdentifier?: string;
  isHomeOffice?: boolean;
  editedByUserId?: string;
  editedByUserName?: string;
}

export interface ApiClockOutRequest {
  userId?: string;
  nfcIdentifier?: string;
  isPause?: boolean;
  expectedReturnAt?: string;
  editedByUserId?: string;
  editedByUserName?: string;
}

export interface RadarUserDto {
  userId: string;
  displayName: string;
  email?: string;
  role: string;
  roleLabel?: string;
  phoneNumber?: string;
  contractKind?: string;
  contractType?: string;
  contractTypeName?: string;
  managerId?: string | null;
  managerName?: string | null;
  parentPersonId?: string | null;
  parentPersonName?: string | null;
  locationType?: string;
  statusText: string;
  statusColor: string;
  isPermanentHomeOffice?: boolean;
  isFemale?: boolean;
  firstName?: string;
  lastName?: string;
  isActive?: boolean;
  employmentStartDate?: string;
  gdprStatus?: 'granted' | 'revoked' | 'unfilled';
  activeGdprDocumentId?: string;
}

export interface GdprSendDto {
  id: string;
  gdprDocumentId: string;
  userId: string;
  userEmail: string;
  userName?: string;
  isGranted: boolean;
  sentAt: string;
}

export interface GdprDocumentDto {
  id: string;
  validFrom: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  sendsCount: number;
  grantedCount?: number;
  revokedCount?: number;
  isCurrentlyActive: boolean;
  userSends?: GdprSendDto[];
}

export interface UserGdprOverviewDto {
  activeGdprId?: string | null;
  activeValidFrom?: string | null;
  activeContent?: string | null;
  currentStatus: 'granted' | 'revoked' | 'unfilled';
  latestSentAt?: string | null;
  unchanged?: boolean;
  validDocuments: GdprDocumentDto[];
}

export const DEFAULT_GDPR_HTML_CONTENT =
  '<b>Souhlas se zpřístupněním informací o důvěrných absencích (GDPR)</b><br><br>' +
  'V souladu s Nařízením Evropského parlamentu a Rady (EU) 2016/679 (<i>obecné nařízení o ochraně osobních údajů – GDPR</i>) ' +
  'uděluji společnosti souhlas s tím, aby informace o mých <u>důvěrných absencích</u> (zejména <i>Nemoc</i>, <i>Lékař</i> a <i>Neplacené volno</i>) ' +
  'byly v interním docházkovém systému zobrazeny v plném znění mému přímému <b>Vedoucímu</b>, <b>Manažerovi</b> a <b>Administrátorovi</b> systému.<br><br>' +
  '<b>Poučení o dobrovolnosti a odvolání souhlasu:</b><br>' +
  'Udělení tohoto souhlasu je zcela <u>dobrovolné</u>. Pokud souhlas neudělíte nebo jej v budoucnu odvoláte, ' +
  'vašemu Vedoucímu, Manažerovi i Administrátorovi se u důvěrných absencí zobrazí pouze obecný stav <b>„Nedostupný“</b> bez uvedení konkrétního důvodu. ' +
  'Svou volbu můžete kdykoliv změnit v <i>Uživatelském nastavení</i>.';

export interface CreateUserDto {
  firstName: string;
  lastName: string;
  displayName?: string;
  email?: string;
  phoneNumber?: string;
  role: string;
  contractKind: string;
  contractTypeCode?: string;
  managerId?: string | null;
  parentPersonId?: string | null;
  isFemale?: boolean;
  isPermanentHomeOffice?: boolean;
  employmentStartDate?: string;

  vacationBase?: number;
  vacationCarriedOver?: number;
  sickDaysTotal?: number;
  homeOfficePeriod?: string;
  homeOfficeDaysLimit?: number;
}

export interface RecordEditLogDto {
  id: string;
  editedByUserId: string;
  editedByName: string;
  editedAt: string;
  summary?: string | null;
}

export function formatShortDayMonth(isoDate: string): string {
  if (!isoDate) return '';
  const parts = isoDate.slice(0, 10).split('-').map(Number);
  if (parts.length < 3 || !parts[1] || !parts[2]) return isoDate;
  return `${parts[2]}. ${parts[1]}.`;
}

export function formatRecordEditLog(log: {
  editedAt: string;
  editedByName: string;
  summary?: string | null;
}): string {
  const dt = new Date(log.editedAt);
  const dtStr = !Number.isNaN(dt.getTime())
    ? `${dt.getDate()}. ${dt.getMonth() + 1}. ${dt.getFullYear()} ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`
    : log.editedAt;

  const name = (log.editedByName || 'Správce').trim();
  const isFem = name.endsWith('á');
  const rawSummary = (log.summary || '').trim();

  if (!rawSummary) {
    return `${dtStr} • ${name} ${isFem ? 'upravila záznam' : 'upravil záznam'}`;
  }

  const lower = rawSummary.toLowerCase();
  if (
    lower.startsWith('změnil') ||
    lower.startsWith('změnila') ||
    lower.startsWith('smazal') ||
    lower.startsWith('smazala') ||
    lower.startsWith('obnovil') ||
    lower.startsWith('obnovila')
  ) {
    return `${dtStr} • ${name} ${rawSummary}`;
  }

  return `${dtStr} • ${name} ${isFem ? 'změnila z' : 'změnil z'} ${rawSummary}`;
}

export interface ApiAbsenceRequestData {
  userId: string;
  typeCode: string;
  startDate: string;
  endDate: string;
  startTime?: string;
  endTime?: string;
  facilityName?: string;
  hasConfirmationDocument?: boolean;
  note?: string;
  autoApprove?: boolean;
  approvedByUserId?: string;
}

export interface DevDatabaseStatus {
  currentMode: 'dev' | 'clean';
  databaseFile: string;
  tableCount: number;
  userCount: number;
  isInstalled: boolean;
}

export interface DevConfig {
  appName: string;
  companyName: string;
  instanceName: string;
  googleWorkspaceDomain: string;
  googleClientId?: string;
  googleClientSecret?: string;
  usePostgres: boolean;
  connectionString?: string;
}

export interface MonthSummaryDto {
  year: number;
  month: number;
  hoursWorked: number;
  fundHours: number;
  dailyTargetHours?: number;
  fteCoefficient?: number;
  overtimeHours: number;
  homeOfficeDays: number;
}

export interface TimeEntryDetailDto {
  id: string;
  date: string;
  startTime: string;
  endTime?: string | null;
  hours: number;
  locationType: 'office' | 'home_office' | 'doctor';
  workplaceId?: string | null;
  workplaceName?: string | null;
  isManual?: boolean;
  editedBy?: string | null;
  editedAt?: string | null;
  editReason?: string | null;
  editLogs?: RecordEditLogDto[];
}

export interface DeletedTimeEntryDto extends TimeEntryDetailDto {
  userId: string;
  userName: string;
  isPermanentHomeOffice?: boolean;
  deletedAt?: string | null;
  deletedByName?: string | null;
}

export interface CompanySettingDto {
  dailyHours: number;
  weeklyWorkDays: number;
}

export interface ContractTypeSettingDto {
  id?: string;
  code: string;
  name: string;
  coefficient: number;
  usersCount?: number;
}

export interface HolidayConfigDto {
  id?: string;
  name: string;
  month?: number | null;
  day?: number | null;
  rule?: string | null;
  packageCode?: string;
  isCustomHoliday?: boolean;
  isActive: boolean;
  resolvedDateCurrentYear?: string | null;
}

export interface AbsenceTypeConfigDto {
  id?: string;
  code: string;
  nameEmployee: string;
  allowOsvc: boolean;
  durationMode: 'days' | 'hours' | 'single_day' | 'both' | string;
  submissionOffsetDays: number;
  submissionDeadlineTime?: string | null;
  maxPerMonthLimit?: number | null;
  defaultBudgetPeriod: string;
  defaultAllowance?: number | null;
  isActive: boolean;
  icon?: string;
  color?: string;
  approverRole?: string | null;
  isSystem?: boolean;
  isPrivate?: boolean;
  isPaid?: boolean;
  isWorkMode?: boolean;
  allowCarryOver?: boolean;
  prorateByContract?: boolean;
  switchToUnpaidOnExhausted?: boolean;
  infoText?: string | null;
}

export const DEFAULT_ABSENCE_TYPES: Record<string, AbsenceTypeConfigDto> = {
  vacation: {
    code: 'vacation',
    nameEmployee: 'Dovolená',
    allowOsvc: true,
    durationMode: 'days',
    submissionOffsetDays: 3,
    submissionDeadlineTime: null,
    defaultBudgetPeriod: 'yearly',
    defaultAllowance: 20,
    isActive: true,
    icon: 'Palmtree',
    color: 'amber',
    approverRole: 'manager',
    isSystem: true,
    isPaid: true,
    isWorkMode: false,
    allowCarryOver: true,
    prorateByContract: true,
    switchToUnpaidOnExhausted: true,
    infoText: null
  },
  doctor: {
    code: 'doctor',
    nameEmployee: 'Lékař',
    allowOsvc: false,
    durationMode: 'hours',
    submissionOffsetDays: 0,
    submissionDeadlineTime: null,
    defaultBudgetPeriod: 'unlimited',
    defaultAllowance: null,
    isActive: true,
    icon: 'Stethoscope',
    color: 'indigo',
    approverRole: 'manager',
    isSystem: true,
    isPaid: true,
    isWorkMode: false,
    allowCarryOver: false,
    prorateByContract: false,
    switchToUnpaidOnExhausted: false,
    infoText:
      'Zákonná překážka v práci s náhradou mzdy (§ 199 ZP)\nLékařská návštěva nekrátí fond dovolené. Po návratu doložíte razítko propustky.'
  },
  sick_day: {
    code: 'sick_day',
    nameEmployee: 'Sick day',
    allowOsvc: true,
    durationMode: 'single_day',
    submissionOffsetDays: 0,
    submissionDeadlineTime: '09:00:00',
    maxPerMonthLimit: 2,
    defaultBudgetPeriod: 'yearly',
    defaultAllowance: 3,
    isActive: true,
    icon: 'Thermometer',
    color: 'rose',
    approverRole: 'manager',
    isSystem: true,
    isPaid: true,
    isWorkMode: false,
    allowCarryOver: false,
    prorateByContract: false,
    switchToUnpaidOnExhausted: false,
    infoText: null
  },
  home_office: {
    code: 'home_office',
    nameEmployee: 'Home office',
    allowOsvc: true,
    durationMode: 'days',
    submissionOffsetDays: 1,
    submissionDeadlineTime: null,
    defaultBudgetPeriod: 'weekly',
    defaultAllowance: 2,
    isActive: true,
    icon: 'Home',
    color: 'sky',
    approverRole: 'manager',
    isSystem: true,
    isPaid: true,
    isWorkMode: true,
    allowCarryOver: false,
    prorateByContract: false,
    switchToUnpaidOnExhausted: false,
    infoText: null
  },
  unpaid_leave: {
    code: 'unpaid_leave',
    nameEmployee: 'Neplacené volno',
    allowOsvc: true,
    durationMode: 'days',
    submissionOffsetDays: 1,
    submissionDeadlineTime: null,
    defaultBudgetPeriod: 'unlimited',
    defaultAllowance: null,
    isActive: true,
    icon: 'CalendarX',
    color: 'purple',
    approverRole: 'manager',
    isSystem: true,
    isPaid: false,
    isWorkMode: false,
    allowCarryOver: false,
    prorateByContract: false,
    switchToUnpaidOnExhausted: false,
    infoText: null
  },
  illness: {
    code: 'illness',
    nameEmployee: 'Nemoc',
    allowOsvc: false,
    durationMode: 'days',
    submissionOffsetDays: 0,
    submissionDeadlineTime: null,
    defaultBudgetPeriod: 'unlimited',
    defaultAllowance: null,
    isActive: true,
    icon: 'Pill',
    color: 'red',
    approverRole: 'office_manager',
    isSystem: true,
    isPrivate: true,
    isPaid: true,
    isWorkMode: false,
    allowCarryOver: false,
    prorateByContract: false,
    switchToUnpaidOnExhausted: false,
    infoText:
      'Dočasná pracovní neschopnost (nemocenská / eNeschopenka)\nAbsence z důvodu nemoci nečerpá zůstatek dovolené ani sick days. Číslo rozhodnutí o DPN můžete uvést do poznámky níže.'
  },
  ocr: {
    code: 'ocr',
    nameEmployee: 'OČR',
    allowOsvc: false,
    durationMode: 'days',
    submissionOffsetDays: 0,
    submissionDeadlineTime: null,
    defaultBudgetPeriod: 'unlimited',
    defaultAllowance: null,
    isActive: true,
    icon: 'Baby',
    color: 'orange',
    approverRole: 'office_manager',
    isSystem: true,
    isPrivate: true,
    isPaid: true,
    isWorkMode: false,
    allowCarryOver: false,
    prorateByContract: false,
    switchToUnpaidOnExhausted: false,
    infoText:
      'Ošetřování člena rodiny (ošetřovné dle zákona č. 187/2006 Sb.)\nAbsence z důvodu OČR nečerpá zůstatek dovolené ani sick days. Číslo rozhodnutí o potřebě ošetřování můžete uvést do poznámky níže.'
  }
};

export function getLocalTodayIso(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDaysToLocalIso(isoDate: string, daysOffset: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  if (!y || !m || !d) return isoDate;
  const dt = new Date(Date.UTC(y, m - 1, d + daysOffset));
  return dt.toISOString().slice(0, 10);
}

const CZECH_FIXED_HOLIDAYS_MMDD = new Set([
  '01-01',
  '05-01',
  '05-08',
  '07-05',
  '07-06',
  '09-28',
  '10-28',
  '11-17',
  '12-24',
  '12-25',
  '12-26'
]);

function getEasterHolidayIsosForYear(year: number): [string, string] {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  const goodFridayUtc = new Date(Date.UTC(year, month - 1, day - 2));
  const easterMondayUtc = new Date(Date.UTC(year, month - 1, day + 1));
  return [
    goodFridayUtc.toISOString().slice(0, 10),
    easterMondayUtc.toISOString().slice(0, 10),
  ];
}

export function isCzechHolidayIso(isoDate: string, customHolidayDates?: Iterable<string>): boolean {
  if (!isoDate || isoDate.length < 10) return false;
  const datePart = isoDate.slice(0, 10);
  if (customHolidayDates) {
    for (const h of customHolidayDates) {
      if (h === datePart) return true;
    }
  }
  const mmdd = datePart.slice(5, 10);
  if (CZECH_FIXED_HOLIDAYS_MMDD.has(mmdd)) return true;
  const year = Number(datePart.slice(0, 4));
  if (!year) return false;
  const [goodFriday, easterMonday] = getEasterHolidayIsosForYear(year);
  return datePart === goodFriday || datePart === easterMonday;
}

export function isWorkingDayIso(isoDate: string, customHolidayDates?: Iterable<string>): boolean {
  if (!isoDate || isoDate.length < 10) return false;
  const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dow = dt.getUTCDay();
  if (dow === 0 || dow === 6) return false; // Sunday or Saturday
  return !isCzechHolidayIso(isoDate, customHolidayDates);
}

/**
 * Spočítá počet pracovních dnů (pondělí–pátek mimo státní svátky ČR) v intervalu [startIso, endIso] včetně.
 */
export function countWorkingDays(
  startIso: string,
  endIso: string,
  customHolidayDates?: Iterable<string>
): number {
  if (!startIso) return 0;
  const effectiveEnd = endIso || startIso;
  const sPart = startIso.slice(0, 10);
  const ePart = effectiveEnd.slice(0, 10);
  if (ePart < sPart) return 0;

  const [sy, sm, sd] = sPart.split('-').map(Number);
  const [ey, em, ed] = ePart.split('-').map(Number);
  if (!sy || !sm || !sd || !ey || !em || !ed) return 0;

  const cur = new Date(Date.UTC(sy, sm - 1, sd));
  const endDt = new Date(Date.UTC(ey, em - 1, ed));
  const customSet = customHolidayDates ? new Set(customHolidayDates) : undefined;

  let count = 0;
  let safety = 0;
  while (cur <= endDt && safety < 800) {
    const iso = cur.toISOString().slice(0, 10);
    if (isWorkingDayIso(iso, customSet)) {
      count++;
    }
    cur.setUTCDate(cur.getUTCDate() + 1);
    safety++;
  }
  return count;
}

/**
 * Najde koncové datum od `startIso` tak, aby interval [startIso, endIso] obsahoval nejvýše `workingDaysLimit` pracovních dnů.
 */
export function addWorkingDaysToLocalIso(
  startIso: string,
  workingDaysLimit: number,
  customHolidayDates?: Iterable<string>
): string {
  if (!startIso || workingDaysLimit <= 0) return startIso;
  const sPart = startIso.slice(0, 10);
  const [sy, sm, sd] = sPart.split('-').map(Number);
  if (!sy || !sm || !sd) return startIso;

  const cur = new Date(Date.UTC(sy, sm - 1, sd));
  const customSet = customHolidayDates ? new Set(customHolidayDates) : undefined;
  let counted = 0;
  let lastValidIso = sPart;
  let safety = 0;

  while (safety < 800) {
    const iso = cur.toISOString().slice(0, 10);
    if (isWorkingDayIso(iso, customSet)) {
      counted++;
      lastValidIso = iso;
      if (counted >= workingDaysLimit) {
        return lastValidIso;
      }
    }
    cur.setUTCDate(cur.getUTCDate() + 1);
    safety++;
  }
  return lastValidIso;
}


export function resolveAbsenceTypeConfig(
  typeCode: string,
  absenceTypesMap?: Record<string, AbsenceTypeConfigDto>
): AbsenceTypeConfigDto {
  if (typeCode === 'unavailable') {
    return {
      code: 'unavailable',
      nameEmployee: 'Nedostupný',
      allowOsvc: true,
      durationMode: 'days',
      submissionOffsetDays: 0,
      submissionDeadlineTime: null,
      defaultBudgetPeriod: 'unlimited',
      defaultAllowance: null,
      isActive: true,
      icon: 'UserX',
      color: 'red',
      isSystem: true,
      isPrivate: true
    };
  }
  return (
    absenceTypesMap?.[typeCode] ||
    DEFAULT_ABSENCE_TYPES[typeCode] ||
    DEFAULT_ABSENCE_TYPES.vacation
  );
}

export function getAbsenceTypeLabel(
  typeCode: string,
  absenceTypesMap?: Record<string, AbsenceTypeConfigDto>
): string {
  return resolveAbsenceTypeConfig(typeCode, absenceTypesMap).nameEmployee;
}

export function getMinAllowedDateForAbsenceType(
  typeConfig: AbsenceTypeConfigDto,
  bypassRules = false,
  now = new Date()
): string | undefined {
  if (bypassRules) return undefined;
  const todayIso = getLocalTodayIso(now);
  const offset = typeConfig.submissionOffsetDays ?? 0;
  return addDaysToLocalIso(todayIso, offset);
}

export function isAbsenceTypeDeadlinePassedToday(
  typeConfig: AbsenceTypeConfigDto,
  isManagingOtherPerson = false,
  now = new Date()
): boolean {
  if (
    typeConfig.durationMode === 'single_day' &&
    (typeConfig.submissionOffsetDays ?? 0) === 0 &&
    typeConfig.submissionDeadlineTime
  ) {
    if (isManagingOtherPerson) return false;
    const parts = typeConfig.submissionDeadlineTime.split(':').map(Number);
    const dh = parts[0] ?? 9;
    const dm = parts[1] ?? 0;
    const ds = parts[2] ?? 0;
    const nowSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    const deadlineSeconds = dh * 3600 + dm * 60 + ds;
    return nowSeconds > deadlineSeconds;
  }
  return false;
}

export interface HolidayDto {
  id: string;
  date: string; // "YYYY-MM-DD"
  name: string;
  month?: number | null;
  day?: number | null;
  rule?: string | null;
  packageCode: string;
  isCustomHoliday: boolean;
  isActive: boolean;
}

export interface WorkplaceDto {
  id: string;
  name: string;
  nfcIdentifier: string;
  nfcHardwareUid?: string | null;
  address?: string | null;
  isActive?: boolean;
  hasCardPassword?: boolean;
}

export const api = {
  // Developer configuration (Workspace domain, company, DB mode)
  async getDevConfig(): Promise<{ data?: DevConfig; error?: any } | null> {
    const json = await requestJson<{ data?: DevConfig; error?: any }>('/dev/config');
    if (json?.data) {
      void this.flushPendingLogs();
      localStorage.setItem('caffeechko_dev_config', JSON.stringify(json.data));
      return json;
    }

    const cached = localStorage.getItem('caffeechko_dev_config');
    if (cached) {
      try {
        return { data: JSON.parse(cached) };
      } catch {}
    }
    return {
      data: {
        appName: 'caffeechko',
        companyName: 'Firma s.r.o.',
        instanceName: 'firma',
        googleWorkspaceDomain: 'firma.cz',
        googleClientId: '',
        googleClientSecret: '',
        usePostgres: false,
        connectionString: 'Host=localhost;Port=5432;Database=dochazka_dev;Username=dev;Password=devpassword'
      }
    };
  },

  async updateDevConfig(config: DevConfig): Promise<{ data?: DevConfig; error?: any } | null> {
    localStorage.setItem('caffeechko_dev_config', JSON.stringify(config));
    const json = await requestJson<{ data?: DevConfig; error?: any }>('/dev/config', {
      method: 'POST',
      body: JSON.stringify(config)
    });
    return json || { data: config };
  },

  // Database management
  async getDatabaseStatus(): Promise<{ data?: DevDatabaseStatus; error?: any } | null> {
    return requestJson('/dev/database/status');
  },

  async switchDatabase(mode: DatabaseMode): Promise<{ data?: DevDatabaseStatus; error?: any } | null> {
    setStoredDbMode(mode);
    return requestJson('/dev/database/switch', {
      method: 'POST',
      body: JSON.stringify({ mode })
    });
  },

  async wipeCleanDatabase(): Promise<{ data?: string; error?: any } | null> {
    return requestJson('/dev/database/wipe-clean', { method: 'POST' });
  },

  async resetDevDatabase(): Promise<{ data?: string; error?: any } | null> {
    return requestJson('/dev/database/reset-dev', { method: 'POST' });
  },

  async bootstrapInstall(data: { companyName?: string; adminName?: string; adminEmail?: string }) {
    try {
      const res = await fetch(`${API_BASE}/dev/database/bootstrap-install`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(data)
      });
      return await res.json();
    } catch (e: any) {
      console.warn('Backend not reachable:', e);
      void this.createLog('system', `ERR_NETWORK POST /api/dev/database/bootstrap-install: ${e?.message || 'Failed to fetch'}`);
      return null;
    }
  },

  // Clock in
  async clockIn(req: ApiClockInRequest) {
    try {
      const res = await fetch(`${API_BASE}/attendance/clock-in`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(req)
      });
      return await res.json();
    } catch (e: any) {
      console.warn('Backend not reachable, operating in offline fallback:', e);
      void this.createLog('api', `ERR_NETWORK POST /api/attendance/clock-in: ${e?.message || 'Failed to fetch'}`, req.userId);
      return null;
    }
  },

  // Clock out
  async clockOut(req: ApiClockOutRequest) {
    try {
      const res = await fetch(`${API_BASE}/attendance/clock-out`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(req)
      });
      return await res.json();
    } catch (e: any) {
      console.warn('Backend not reachable, operating in offline fallback:', e);
      void this.createLog('api', `ERR_NETWORK POST /api/attendance/clock-out: ${e?.message || 'Failed to fetch'}`, req.userId);
      return null;
    }
  },

  // Attendance status
  async getStatus(userId: string) {
    return requestJson(`/attendance/status?userId=${userId}`);
  },

  // Who is where / Live Radar
  async getWhoIsWhere() {
    return requestJson('/attendance/who-is-where');
  },

  // Workplaces (branches)
  async getWorkplaces(includeInactive = false): Promise<{ data?: WorkplaceDto[]; error?: any } | null> {
    return requestJson(`/attendance/workplaces${includeInactive ? '?includeInactive=true' : ''}`);
  },

  async createWorkplace(data: Partial<WorkplaceDto>): Promise<{ data?: WorkplaceDto[]; error?: any } | null> {
    return requestJson('/attendance/workplaces', {
      method: 'POST',
      body: JSON.stringify(data)
    }, false);
  },

  async updateWorkplace(id: string, data: Partial<WorkplaceDto>): Promise<{ data?: WorkplaceDto[]; error?: any } | null> {
    return requestJson(`/attendance/workplaces/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }, false);
  },

  async deleteWorkplace(id: string): Promise<{ data?: WorkplaceDto[]; error?: any } | null> {
    return requestJson(`/attendance/workplaces/${id}`, {
      method: 'DELETE'
    }, false);
  },

  async encodeWorkplaceCard(id: string, password: string, nfcHardwareUid?: string): Promise<{ data?: WorkplaceDto; error?: any } | null> {
    return requestJson(`/attendance/workplaces/${id}/encode-card`, {
      method: 'POST',
      body: JSON.stringify({ password, nfcHardwareUid })
    }, false);
  },

  // Week summary
  async getWeekSummary(userId: string) {
    return requestJson(`/attendance/week?userId=${userId}`);
  },

  // Month summary
  async getMonthSummary(userId: string, year?: number, month?: number): Promise<{ data?: MonthSummaryDto; error?: any } | null> {
    const yearQuery = year ? `&year=${year}` : '';
    const monthQuery = month ? `&month=${month}` : '';
    return requestJson(`/attendance/month?userId=${userId}${yearQuery}${monthQuery}`);
  },

  // Monthly detailed time entries from SQLite DB
  async getMonthlyEntries(userId: string, year?: number, month?: number): Promise<{ data?: TimeEntryDetailDto[]; error?: any } | null> {
    const yearQuery = year ? `&year=${year}` : '';
    const monthQuery = month ? `&month=${month}` : '';
    return requestJson(`/attendance/entries?userId=${userId}${yearQuery}${monthQuery}`);
  },

  // Update time entry (Admin / Office Manager)
  async updateTimeEntry(
    id: string,
    data: {
      date?: string;
      startTime?: string;
      endTime?: string;
      locationType?: 'office' | 'home_office';
      workplaceId?: string | null;
      editReason?: string;
      editedByUserId?: string;
      editedByUserName?: string;
    }
  ) {
    return requestJson(`/attendance/entries/${id}/update`, {
      method: 'POST',
      headers: data.editedByUserId
        ? { 'X-User-Id': data.editedByUserId, 'X-Dev-User-Id': data.editedByUserId }
        : undefined,
      body: JSON.stringify(data)
    }, false);
  },

  // Soft-delete time entry (Admin / Office Manager)
  async deleteTimeEntry(id: string, deletedByUserId?: string) {
    return requestJson(`/attendance/entries/${id}/delete`, {
      method: 'POST',
      headers: deletedByUserId
        ? { 'X-User-Id': deletedByUserId, 'X-Dev-User-Id': deletedByUserId }
        : undefined,
      body: JSON.stringify({ deletedByUserId })
    }, false);
  },

  // Get deleted time entries for Trash (Admin / Office Manager)
  async getDeletedTimeEntries(): Promise<{ data?: DeletedTimeEntryDto[]; error?: any } | null> {
    return requestJson('/attendance/entries/deleted');
  },

  // Restore deleted time entry from Trash (Admin / Office Manager)
  async restoreTimeEntry(id: string, deletedByUserId?: string) {
    return requestJson(`/attendance/entries/${id}/restore`, {
      method: 'POST',
      headers: deletedByUserId
        ? { 'X-User-Id': deletedByUserId, 'X-Dev-User-Id': deletedByUserId }
        : undefined,
      body: JSON.stringify({ deletedByUserId })
    }, false);
  },

  // Resolved holidays from DB (including floating rule-based holidays) for given year
  async getHolidays(year?: number): Promise<{ data?: HolidayDto[]; error?: any } | null> {
    const yearQuery = year ? `?year=${year}` : '';
    return requestJson(`/attendance/holidays${yearQuery}`);
  },

  // Holidays CRUD configuration in Settings
  async getHolidaysConfig(): Promise<{ data?: HolidayConfigDto[]; error?: any } | null> {
    return requestJson('/absence/holidays-config');
  },

  async createHoliday(data: Partial<HolidayConfigDto>): Promise<{ data?: HolidayConfigDto[]; error?: any } | null> {
    return requestJson('/absence/holidays', {
      method: 'POST',
      body: JSON.stringify(data)
    }, false);
  },

  async updateHoliday(id: string, data: Partial<HolidayConfigDto>): Promise<{ data?: HolidayConfigDto[]; error?: any } | null> {
    return requestJson(`/absence/holidays/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }, false);
  },

  async deleteHoliday(id: string): Promise<{ data?: HolidayConfigDto[]; error?: any } | null> {
    return requestJson(`/absence/holidays/${id}`, {
      method: 'DELETE'
    }, false);
  },

  // Company settings
  async getCompanySettings() {
    return requestJson('/absence/company-settings');
  },

  async updateCompanySettings(settings: Partial<CompanySettingDto>): Promise<{ data?: CompanySettingDto; error?: any } | null> {
    return requestJson('/absence/company-settings', {
      method: 'POST',
      body: JSON.stringify(settings)
    });
  },

  // Contract types (úvazky a koeficienty z DB)
  async getContractTypes(): Promise<{ data?: ContractTypeSettingDto[]; error?: any } | null> {
    return requestJson('/absence/contract-types');
  },

  async createContractType(data: Partial<ContractTypeSettingDto>): Promise<{ data?: ContractTypeSettingDto[]; error?: any } | null> {
    return requestJson('/absence/contract-types', {
      method: 'POST',
      body: JSON.stringify(data)
    }, false);
  },

  async updateContractType(id: string, data: Partial<ContractTypeSettingDto>): Promise<{ data?: ContractTypeSettingDto[]; error?: any } | null> {
    return requestJson(`/absence/contract-types/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }, false);
  },

  async deleteContractType(id: string, replacementCode?: string): Promise<{ data?: ContractTypeSettingDto[]; error?: any } | null> {
    const qs = replacementCode ? `?replacementCode=${encodeURIComponent(replacementCode)}` : '';
    return requestJson(`/absence/contract-types/${id}${qs}`, {
      method: 'DELETE'
    }, false);
  },

  // Absence types configuration from DB
  async getAbsenceTypes(): Promise<{ data?: AbsenceTypeConfigDto[]; error?: any } | null> {
    return requestJson('/absence/types');
  },

  async updateAbsenceTypes(items: AbsenceTypeConfigDto[]): Promise<{ data?: AbsenceTypeConfigDto[]; error?: any } | null> {
    return requestJson('/absence/types', {
      method: 'POST',
      body: JSON.stringify(items)
    }, false);
  },

  async deleteAbsenceType(id: string): Promise<{ data?: AbsenceTypeConfigDto[]; error?: any } | null> {
    return requestJson(`/absence/types/${id}`, {
      method: 'DELETE'
    }, false);
  },

  // Absence balances (vacation, sick days & dynamic types)
  async getAbsenceBalances(userId: string, year?: number) {
    const yearQuery = year ? `&year=${year}` : '';
    return requestJson(`/absence/balances?userId=${userId}${yearQuery}`);
  },

  // Save user absence settings for a given year (if not closed)
  async saveUserAbsenceSettings(data: {
    userId: string;
    year: number;
    vacationBase: number;
    vacationCarriedOver: number;
    sickDaysTotal: number;
    homeOfficeWeeklyDays?: number;
    homeOfficePeriod?: string;
    homeOfficeDaysLimit?: number;
  }) {
    return requestJson('/absence/save-user-settings', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  // Create new user (officer / admin)
  async createUser(data: CreateUserDto) {
    return requestJson<{ data?: RadarUserDto; error?: { code: string; message: string } }>('/attendance/users/create', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  // Update user profile (officer / admin)
  async updateUserProfile(userId: string, data: {
    firstName: string;
    lastName: string;
    displayName?: string;
    email?: string;
    phoneNumber?: string;
    role?: string;
    contractKind?: string;
    contractTypeCode?: string;
    managerId?: string | null;
    parentPersonId?: string | null;
    isFemale?: boolean;
    isPermanentHomeOffice?: boolean;
    employmentStartDate?: string | null;
  }) {
    return requestJson(`/attendance/users/${userId}/update`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  // Toggle user active / inactive (deactivate person)
  async toggleUserActive(userId: string) {
    return requestJson(`/attendance/users/${userId}/toggle-active`, {
      method: 'POST'
    });
  },

  // Name declensions
  async getNameDeclensions(): Promise<{ data?: string[]; error?: any } | null> {
    return requestJson('/attendance/name-declensions');
  },

  async addNameDeclension(nominative: string) {
    return requestJson('/attendance/name-declensions', {
      method: 'POST',
      body: JSON.stringify({ nominative })
    });
  },

  // Per-user year closure preview (Officer / Admin)
  async getUserYearClosurePreview(userId: string, fromYear = 2026, targetYear = 2027) {
    return requestJson(`/absence/user-closure-preview?userId=${userId}&fromYear=${fromYear}&targetYear=${targetYear}`);
  },

  // Close user year (Officer / Admin)
  async closeUserYear(data: {
    userId: string;
    fromYear?: number;
    targetYear?: number;
    carriedOverVacationDays: number;
    newBaseVacationDays: number;
    newSickDays: number;
    closedByUserId?: string;
    note?: string;
  }) {
    return requestJson('/absence/close-user-year', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  // My absence requests
  async getMyRequests(userId: string, includeDeleted: boolean = false) {
    return requestJson(`/absence/my-requests?userId=${userId}${includeDeleted ? '&includeDeleted=true' : ''}`);
  },

  // Upcoming absences for current & next week (dashboard overview) or for a specific year/month (and optional userId)
  async getUpcomingAbsences(year?: number, month?: number, userId?: string) {
    const params = new URLSearchParams();
    if (year && month) {
      params.set('year', String(year));
      params.set('month', String(month));
    }
    if (userId) {
      params.set('userId', userId);
    }
    const qs = params.toString();
    return requestJson(`/absence/upcoming${qs ? `?${qs}` : ''}`);
  },

  // Pending approvals for manager
  async getPendingApprovals(managerId: string) {
    return requestJson(`/absence/pending-approvals?managerId=${managerId}`);
  },

  // Submit absence request
  async submitAbsence(data: ApiAbsenceRequestData) {
    return requestJson('/absence/request', {
      method: 'POST',
      body: JSON.stringify(data)
    }, false);
  },

  // Approve request
  async approveAbsence(
    id: string,
    managerId: string,
    overrides?: {
      startDate?: string;
      endDate?: string;
      startTime?: string;
      endTime?: string;
      facilityName?: string;
      hasConfirmationDocument?: boolean;
    }
  ) {
    return requestJson(`/absence/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ managerId, ...(overrides || {}) })
    }, false);
  },

  // Update absence dates/times without changing approval status (Admin / Office Manager)
  async updateAbsence(
    id: string,
    data: {
      startDate?: string;
      endDate?: string;
      startTime?: string;
      endTime?: string;
      facilityName?: string;
      hasConfirmationDocument?: boolean;
      note?: string;
      editedByUserId?: string;
      editedByUserName?: string;
    }
  ) {
    return requestJson(`/absence/${id}/update`, {
      method: 'POST',
      headers: data.editedByUserId
        ? { 'X-User-Id': data.editedByUserId, 'X-Dev-User-Id': data.editedByUserId }
        : undefined,
      body: JSON.stringify(data)
    }, false);
  },

  // Soft-delete absence (Admin / Office Manager)
  async deleteAbsence(id: string, deletedByUserId?: string) {
    return requestJson(`/absence/${id}/delete`, {
      method: 'POST',
      headers: deletedByUserId
        ? { 'X-User-Id': deletedByUserId, 'X-Dev-User-Id': deletedByUserId }
        : undefined,
      body: JSON.stringify({ deletedByUserId })
    }, false);
  },

  // Get deleted absences for Trash (Admin / Office Manager)
  async getDeletedAbsences(): Promise<{ data?: any[]; error?: any } | null> {
    return requestJson('/absence/deleted');
  },

  // Restore deleted absence from Trash (Admin / Office Manager)
  async restoreAbsence(id: string, deletedByUserId?: string) {
    return requestJson(`/absence/${id}/restore`, {
      method: 'POST',
      headers: deletedByUserId
        ? { 'X-User-Id': deletedByUserId, 'X-Dev-User-Id': deletedByUserId }
        : undefined,
      body: JSON.stringify({ deletedByUserId })
    }, false);
  },

  // Reject request
  async rejectAbsence(id: string, managerId: string, reason: string) {
    return requestJson(`/absence/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ managerId, reason })
    }, false);
  },

  // Mark request as read by applicant
  async markAbsenceRead(id: string) {
    return requestJson(`/absence/${id}/read`, { method: 'POST' }, false);
  },

  // Resubmit rejected request with optional modifications
  async resubmitAbsence(
    id: string,
    data: {
      typeCode?: string;
      startDate?: string;
      endDate?: string;
      startTime?: string;
      endTime?: string;
      facilityName?: string;
      hasConfirmationDocument?: boolean;
      note?: string;
      autoApprove?: boolean;
      approvedByUserId?: string;
    }
  ) {
    return requestJson(`/absence/${id}/resubmit`, {
      method: 'POST',
      body: JSON.stringify(data)
    }, false);
  },

  // Auth: Google Workspace OAuth 2.0
  async loginWithGoogle(payload: { email: string; name?: string; avatarUrl?: string; idToken?: string }) {
    try {
      const res = await fetch(`${API_BASE}/auth/google`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      void this.flushPendingLogs();
      return json;
    } catch (e: any) {
      console.warn('Google login failed:', e);
      const rawMsg = e?.message || 'Failed to fetch';
      void this.createLog(
        'auth',
        `ERR_NETWORK POST /api/auth/google (${payload.email || 'token'}): ${rawMsg}`,
        '0'
      );
      return {
        error: {
          code: 'ERR_NETWORK',
          message:
            rawMsg === 'Failed to fetch'
              ? 'Nepodařilo se spojit se serverem (Failed to fetch). Zkontrolujte, zda běží backend API na portu 5000.'
              : rawMsg
        }
      };
    }
  },

  // Universal Audit & Error Logging
  async createLog(
    type: 'api' | 'web' | 'auth' | 'nfc' | 'system',
    status: string,
    userIdOverride?: string
  ) {
    const rawUser = userIdOverride ?? getSessionUserId();
    const userId = !rawUser || rawUser === 'anonymous' ? '0' : rawUser;
    const entry = {
      userId,
      type,
      status,
      dateTime: new Date().toISOString()
    };

    try {
      const res = await fetch(`${API_BASE}/logs`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(entry)
      });
      if (res.ok) {
        void this.flushPendingLogs();
        return await res.json();
      }
    } catch {
      if (typeof window !== 'undefined') {
        try {
          const existing = JSON.parse(localStorage.getItem('caffeechko_pending_logs') || '[]');
          existing.push(entry);
          localStorage.setItem('caffeechko_pending_logs', JSON.stringify(existing.slice(-100)));
        } catch {}
      }
    }
    return null;
  },

  async flushPendingLogs() {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem('caffeechko_pending_logs');
      if (!raw) return;
      const items = JSON.parse(raw);
      if (!Array.isArray(items) || items.length === 0) return;

      localStorage.removeItem('caffeechko_pending_logs');
      const res = await fetch(`${API_BASE}/logs`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ items })
      });
      if (!res.ok) {
        localStorage.setItem('caffeechko_pending_logs', JSON.stringify(items));
      }
    } catch {}
  },

  async getLogs(limit = 100, type?: string, userId?: string) {
    const params = new URLSearchParams({ limit: String(limit) });
    if (type) params.set('type', type);
    if (userId) params.set('userId', userId);
    return requestJson(`/logs?${params.toString()}`);
  },

  async clearLogs(): Promise<{ data?: number; error?: any } | null> {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('caffeechko_pending_logs');
    }
    return requestJson('/logs', { method: 'DELETE' });
  },

  // Auth: Get current authenticated user profile
  async getAuthMe() {
    return requestJson('/auth/me');
  },

  // Auth: Logout
  async logout() {
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        headers: getHeaders()
      });
    } catch {
    } finally {
      clearSessionUserId();
    }
  },

  // Auth: Get account pending status & contact person (Office Manager / Admin fallback)
  async getPendingStatus(userId?: string) {
    const url = userId ? `/auth/pending-status?userId=${userId}` : '/auth/pending-status';
    return requestJson(url);
  },

  // Auth: List of users pending approval (for Office Manager / Admin)
  async getPendingUsers() {
    return requestJson('/auth/pending-users');
  },

  // Auth: Approve user and set contract (Office Manager / Admin)
  async approveUser(data: {
    userId: string;
    role?: string;
    contractKind?: string;
    contractType?: string;
    weeklyHoursBudget?: number;
    vacationDays?: number;
    sickDays?: number;
    homeOfficeWeeklyDays?: number;
    allowances?: Record<string, number>;
    isPermanentHomeOffice?: boolean;
  }) {
    return requestJson('/auth/approve-user', {
      method: 'POST',
      body: JSON.stringify(data)
    }, false);
  },

  // Auth: Set permanent Home Office flag on user
  async setPermanentHomeOffice(userId: string, isPermanentHomeOffice: boolean) {
    return requestJson(`/auth/users/${userId}/permanent-home-office`, {
      method: 'POST',
      body: JSON.stringify({ isPermanentHomeOffice })
    }, false);
  },

  // Dev: Impersonate persona in dev mode and retrieve valid JWT token
  async devImpersonate(userId: string) {
    return requestJson('/auth/dev-impersonate', {
      method: 'POST',
      body: JSON.stringify({ userId })
    }, false);
  },

  // GDPR documents & user consent
  async getGdprDocuments(): Promise<{ data?: GdprDocumentDto[]; error?: any } | null> {
    return requestJson('/gdpr/documents');
  },

  async createGdprDocument(data: { validFrom: string; content: string }): Promise<{ data?: GdprDocumentDto[]; error?: any } | null> {
    return requestJson('/gdpr/documents', {
      method: 'POST',
      body: JSON.stringify(data)
    }, false);
  },

  async updateGdprDocument(id: string, data: { validFrom: string; content: string }): Promise<{ data?: GdprDocumentDto[]; error?: any } | null> {
    return requestJson(`/gdpr/documents/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }, false);
  },

  async deleteGdprDocument(id: string): Promise<{ data?: GdprDocumentDto[]; error?: any } | null> {
    return requestJson(`/gdpr/documents/${id}`, {
      method: 'DELETE'
    }, false);
  },

  async getUserGdprOverview(userId: string): Promise<{ data?: UserGdprOverviewDto; error?: any } | null> {
    return requestJson(`/gdpr/user/${userId}`);
  },

  async submitGdprConsent(data: {
    userId: string;
    userEmail?: string;
    gdprDocumentId?: string;
    isGranted: boolean;
  }): Promise<{ data?: UserGdprOverviewDto; error?: any } | null> {
    return requestJson('/gdpr/submit', {
      method: 'POST',
      body: JSON.stringify(data)
    }, false);
  },

  async resetGdprSends(): Promise<{ data?: number; error?: any } | null> {
    return requestJson('/gdpr/sends', {
      method: 'DELETE'
    }, false);
  }
};

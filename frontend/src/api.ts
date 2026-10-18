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
    ...(sessionUserId && sessionUserId !== 'anonymous' ? { 'X-User-Id': sessionUserId } : {}),
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
    return await res.json();
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
}

export interface CompanySettingDto {
  dailyHours: number;
  weeklyWorkDays: number;
}

export interface ContractTypeSettingDto {
  code: string;
  name: string;
  coefficient: number;
}

export interface AbsenceTypeConfigDto {
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
    isActive: true
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
    isActive: true
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
    isActive: true
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
    isActive: true
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
    isActive: true
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
    isActive: true
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

export function resolveAbsenceTypeConfig(
  typeCode: string,
  absenceTypesMap?: Record<string, AbsenceTypeConfigDto>
): AbsenceTypeConfigDto {
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
  address?: string | null;
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

  // Active workplaces (branches)
  async getWorkplaces(): Promise<{ data?: WorkplaceDto[]; error?: any } | null> {
    return requestJson('/attendance/workplaces');
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

  // Resolved holidays from DB (including floating rule-based holidays) for given year
  async getHolidays(year?: number): Promise<{ data?: HolidayDto[]; error?: any } | null> {
    const yearQuery = year ? `?year=${year}` : '';
    return requestJson(`/attendance/holidays${yearQuery}`);
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

  // Absence types configuration from DB
  async getAbsenceTypes(): Promise<{ data?: AbsenceTypeConfigDto[]; error?: any } | null> {
    return requestJson('/absence/types');
  },

  async updateAbsenceTypes(items: AbsenceTypeConfigDto[]): Promise<{ data?: AbsenceTypeConfigDto[]; error?: any } | null> {
    return requestJson('/absence/types', {
      method: 'POST',
      body: JSON.stringify(items)
    });
  },

  // Absence balances (vacation, sick days & dynamic types)
  async getAbsenceBalances(userId: string, year?: number) {
    const yearQuery = year ? `&year=${year}` : '';
    return requestJson(`/absence/balances?userId=${userId}${yearQuery}`);
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
  async getMyRequests(userId: string) {
    return requestJson(`/absence/my-requests?userId=${userId}`);
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
  }) {
    return requestJson('/auth/approve-user', {
      method: 'POST',
      body: JSON.stringify(data)
    }, false);
  },

  // Dev: Impersonate persona in dev mode and retrieve valid JWT token
  async devImpersonate(userId: string) {
    return requestJson('/auth/dev-impersonate', {
      method: 'POST',
      body: JSON.stringify({ userId })
    }, false);
  }
};

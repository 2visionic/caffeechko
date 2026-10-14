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

export interface ApiClockInRequest {
  userId?: string;
  nfcIdentifier?: string;
  isHomeOffice?: boolean;
}

export interface ApiClockOutRequest {
  userId?: string;
  isPause?: boolean;
  expectedReturnAt?: string;
}

export interface RadarUserDto {
  userId: string;
  displayName: string;
  email?: string;
  role: string;
  phoneNumber?: string;
  contractKind?: string;
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
  locationType: 'office' | 'home_office';
  workplaceName?: string | null;
}

export interface CompanySettingDto {
  dailyHours: number;
  weeklyWorkDays: number;
  defaultVacationDays: number;
  defaultSickDays: number;
  defaultHomeOfficeWeeklyDays: number;
}

export interface ContractTypeSettingDto {
  code: string;
  name: string;
  coefficient: number;
}

export const api = {
  // Developer configuration (Workspace domain, company, DB mode)
  async getDevConfig(): Promise<{ data?: DevConfig; error?: any } | null> {
    try {
      const res = await fetch(`${API_BASE}/dev/config`, { headers: getHeaders() });
      if (res.ok) {
        const json = await res.json();
        void this.flushPendingLogs();
        if (json?.data) {
          localStorage.setItem('caffeechko_dev_config', JSON.stringify(json.data));
          return json;
        }
      }
    } catch {
      // Backend might not be running or route not yet active
    }

    // Resilient fallback to local storage
    const cached = localStorage.getItem('caffeechko_dev_config');
    if (cached) {
      try {
        return { data: JSON.parse(cached) };
      } catch {
        // invalid json
      }
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
    // 1. Immediately store in localStorage so frontend always succeeds and keeps changes
    localStorage.setItem('caffeechko_dev_config', JSON.stringify(config));

    try {
      const res = await fetch(`${API_BASE}/dev/config`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(config)
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Backend not yet restarted with new endpoint
    }

    // Return success with saved local config
    return { data: config };
  },

  // Database management
  async getDatabaseStatus(): Promise<{ data?: DevDatabaseStatus; error?: any } | null> {
    try {
      const res = await fetch(`${API_BASE}/dev/database/status`, {
        headers: getHeaders()
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  },

  async switchDatabase(mode: DatabaseMode): Promise<{ data?: DevDatabaseStatus; error?: any } | null> {
    setStoredDbMode(mode);
    try {
      const res = await fetch(`${API_BASE}/dev/database/switch`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ mode })
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  },

  async wipeCleanDatabase(): Promise<{ data?: string; error?: any } | null> {
    try {
      const res = await fetch(`${API_BASE}/dev/database/wipe-clean`, {
        method: 'POST',
        headers: getHeaders()
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  },

  async resetDevDatabase(): Promise<{ data?: string; error?: any } | null> {
    try {
      const res = await fetch(`${API_BASE}/dev/database/reset-dev`, {
        method: 'POST',
        headers: getHeaders()
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
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
    try {
      const res = await fetch(`${API_BASE}/attendance/status?userId=${userId}`, {
        headers: getHeaders()
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  },

  // Who is where / Live Radar
  async getWhoIsWhere() {
    try {
      const res = await fetch(`${API_BASE}/attendance/who-is-where`, {
        headers: getHeaders()
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  },

  // Week summary
  async getWeekSummary(userId: string) {
    try {
      const res = await fetch(`${API_BASE}/attendance/week?userId=${userId}`, {
        headers: getHeaders()
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  },

  // Month summary
  async getMonthSummary(userId: string, year?: number, month?: number): Promise<{ data?: MonthSummaryDto; error?: any } | null> {
    try {
      const yearQuery = year ? `&year=${year}` : '';
      const monthQuery = month ? `&month=${month}` : '';
      const res = await fetch(`${API_BASE}/attendance/month?userId=${userId}${yearQuery}${monthQuery}`, {
        headers: getHeaders()
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  },

  // Monthly detailed time entries from SQLite DB
  async getMonthlyEntries(userId: string, year?: number, month?: number): Promise<{ data?: TimeEntryDetailDto[]; error?: any } | null> {
    try {
      const yearQuery = year ? `&year=${year}` : '';
      const monthQuery = month ? `&month=${month}` : '';
      const res = await fetch(`${API_BASE}/attendance/entries?userId=${userId}${yearQuery}${monthQuery}`, {
        headers: getHeaders()
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  },

  // Company settings (defaults for vacation, sick days, home office)
  async getCompanySettings() {
    try {
      const res = await fetch(`${API_BASE}/absence/company-settings`, {
        headers: getHeaders()
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  },

  async updateCompanySettings(settings: Partial<CompanySettingDto>): Promise<{ data?: CompanySettingDto; error?: any } | null> {
    try {
      const res = await fetch(`${API_BASE}/absence/company-settings`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(settings)
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  },

  // Contract types (úvazky a koeficienty z DB)
  async getContractTypes(): Promise<{ data?: ContractTypeSettingDto[]; error?: any } | null> {
    try {
      const res = await fetch(`${API_BASE}/absence/contract-types`, {
        headers: getHeaders()
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  },

  // Absence balances (vacation & sick days)
  async getAbsenceBalances(userId: string, year?: number) {
    try {
      const yearQuery = year ? `&year=${year}` : '';
      const res = await fetch(`${API_BASE}/absence/balances?userId=${userId}${yearQuery}`, {
        headers: getHeaders()
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  },

  // Per-user year closure preview (Officer / Admin)
  async getUserYearClosurePreview(userId: string, fromYear = 2026, targetYear = 2027) {
    try {
      const res = await fetch(`${API_BASE}/absence/user-closure-preview?userId=${userId}&fromYear=${fromYear}&targetYear=${targetYear}`, {
        headers: getHeaders()
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
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
    try {
      const res = await fetch(`${API_BASE}/absence/close-user-year`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(data)
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  },

  // My absence requests
  async getMyRequests(userId: string) {
    try {
      const res = await fetch(`${API_BASE}/absence/my-requests?userId=${userId}`, {
        headers: getHeaders()
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  },

  // Pending approvals for manager
  async getPendingApprovals(managerId: string) {
    try {
      const res = await fetch(`${API_BASE}/absence/pending-approvals?managerId=${managerId}`, {
        headers: getHeaders()
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  },

  // Submit absence request
  async submitAbsence(data: ApiAbsenceRequestData) {
    try {
      const res = await fetch(`${API_BASE}/absence/request`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(data)
      });
      return await res.json();
    } catch (e) {
      console.warn('Backend not reachable:', e);
      return null;
    }
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
    try {
      const res = await fetch(`${API_BASE}/absence/${id}/approve`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ managerId, ...(overrides || {}) })
      });
      return await res.json();
    } catch {
      return null;
    }
  },

  // Reject request
  async rejectAbsence(id: string, managerId: string, reason: string) {
    try {
      const res = await fetch(`${API_BASE}/absence/${id}/reject`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ managerId, reason })
      });
      return await res.json();
    } catch {
      return null;
    }
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

  // Universal Audit & Error Logging (supports offline queueing when backend is down)
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
      // Backend unreachable -> queue in localStorage so even Failed to fetch is persisted to DB once backend starts
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
    } catch {
      // Still offline
    }
  },

  async getLogs(limit = 100, type?: string, userId?: string) {
    try {
      const params = new URLSearchParams({ limit: String(limit) });
      if (type) params.set('type', type);
      if (userId) params.set('userId', userId);
      const res = await fetch(`${API_BASE}/logs?${params.toString()}`, {
        headers: getHeaders()
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  },

  // Auth: Get current authenticated user profile
  async getAuthMe() {
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: getHeaders()
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  },

  // Auth: Logout
  async logout() {
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        headers: getHeaders()
      });
    } catch {
      // Ignore network errors on logout
    } finally {
      clearSessionUserId();
    }
  },

  // Auth: Get account pending status & contact person (Office Manager / Admin fallback)
  async getPendingStatus(userId?: string) {
    try {
      const url = userId ? `${API_BASE}/auth/pending-status?userId=${userId}` : `${API_BASE}/auth/pending-status`;
      const res = await fetch(url, { headers: getHeaders() });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  },

  // Auth: List of users pending approval (for Office Manager / Admin)
  async getPendingUsers() {
    try {
      const res = await fetch(`${API_BASE}/auth/pending-users`, { headers: getHeaders() });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
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
  }) {
    try {
      const res = await fetch(`${API_BASE}/auth/approve-user`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(data)
      });
      return await res.json();
    } catch {
      return null;
    }
  },

  // Dev: Impersonate persona in dev mode and retrieve valid JWT token
  async devImpersonate(userId: string) {
    try {
      const res = await fetch(`${API_BASE}/auth/dev-impersonate`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ userId })
      });
      return await res.json();
    } catch {
      return null;
    }
  }
};

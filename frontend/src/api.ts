const API_BASE = 'http://localhost:5000/api';

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

export const api = {
  // Clock in
  async clockIn(req: ApiClockInRequest) {
    try {
      const res = await fetch(`${API_BASE}/attendance/clock-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req)
      });
      return await res.json();
    } catch (e) {
      console.warn('Backend not reachable, operating in offline fallback:', e);
      return null;
    }
  },

  // Clock out
  async clockOut(req: ApiClockOutRequest) {
    try {
      const res = await fetch(`${API_BASE}/attendance/clock-out`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req)
      });
      return await res.json();
    } catch (e) {
      console.warn('Backend not reachable, operating in offline fallback:', e);
      return null;
    }
  },

  // Attendance status
  async getStatus(userId: string) {
    try {
      const res = await fetch(`${API_BASE}/attendance/status?userId=${userId}`);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  },

  // Who is where / Live Radar
  async getWhoIsWhere() {
    try {
      const res = await fetch(`${API_BASE}/attendance/who-is-where`);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  },

  // Week summary
  async getWeekSummary(userId: string) {
    try {
      const res = await fetch(`${API_BASE}/attendance/week?userId=${userId}`);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  },

  // My absence requests
  async getMyRequests(userId: string) {
    try {
      const res = await fetch(`${API_BASE}/absence/my-requests?userId=${userId}`);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  },

  // Pending approvals for manager
  async getPendingApprovals(managerId: string) {
    try {
      const res = await fetch(`${API_BASE}/absence/pending-approvals?managerId=${managerId}`);
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return await res.json();
    } catch (e) {
      console.warn('Backend not reachable:', e);
      return null;
    }
  },

  // Approve request
  async approveAbsence(id: string, managerId: string) {
    try {
      const res = await fetch(`${API_BASE}/absence/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ managerId })
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ managerId, reason })
      });
      return await res.json();
    } catch {
      return null;
    }
  }
};

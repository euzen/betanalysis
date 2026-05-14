import axios from 'axios';

// Detect environment - Render uses separate domains for frontend/backend
const isProduction = window.location.hostname.includes('onrender.com');
const API_BASE_URL = isProduction 
  ? 'https://bet-tracker-api.onrender.com/api'  // Change this after first deploy
  : '/api';

export const api = axios.create({ baseURL: API_BASE_URL });

export const setAuthToken = (token: string | null) => {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
};

let _refreshPromise: Promise<string | null> | null = null;

async function tryRefresh(): Promise<string | null> {
  const refreshToken = localStorage.getItem('refresh_token');
  if (!refreshToken) return null;
  try {
    const refreshUrl = isProduction 
      ? 'https://bet-tracker-api.onrender.com/api/auth/refresh'
      : '/api/auth/refresh';
    const res = await axios.post(refreshUrl, { refresh_token: refreshToken });
    const { access_token, refresh_token: newRefresh } = res.data;
    localStorage.setItem('refresh_token', newRefresh);
    setAuthToken(access_token);
    const stored = localStorage.getItem('auth_token');
    if (stored !== null) localStorage.setItem('auth_token', access_token);
    return access_token;
  } catch {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('auth_user');
    setAuthToken(null);
    window.location.href = '/login';
    return null;
  }
}

api.interceptors.response.use(
  r => r,
  async error => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      if (!_refreshPromise) {
        _refreshPromise = tryRefresh().finally(() => { _refreshPromise = null; });
      }
      const newToken = await _refreshPromise;
      if (newToken) {
        original.headers['Authorization'] = `Bearer ${newToken}`;
        return api(original);
      }
    }
    return Promise.reject(error);
  }
);

export interface Bet {
  id: number;
  match_name: string;
  league: string | null;
  match_datetime: string | null;
  tip: string;
  odds: number;
  result: string;
  score: string | null;
}

export interface Source {
  id: number;
  name: string;
}

export interface Ticket {
  id: number;
  status: string;
  ticket_type: string;
  bookmaker: string | null;
  source_id: number | null;
  source: Source | null;
  created_at: string;
  total_odds: number | null;
  stake: number | null;
  possible_win: number | null;
  actual_win: number | null;
  note: string | null;
  bets: Bet[];
}

export interface TicketIn {
  status?: string;
  ticket_type?: string;
  bookmaker?: string | null;
  source_id?: number | null;
  created_at?: string;
  total_odds?: number | null;
  stake?: number | null;
  possible_win?: number | null;
  actual_win?: number | null;
  note?: string | null;
  bets: BetIn[];
}

export interface BetIn {
  match_name: string;
  league?: string | null;
  match_datetime?: string | null;
  tip: string;
  odds: number;
  result?: string;
  score?: string | null;
}

export interface Stats {
  total: number;
  won: number;
  lost: number;
  pending: number;
  total_staked: number;
  total_won: number;
  profit: number;
  roi: number;
}

export interface TicketFilters {
  status?: string;
  bookmaker?: string;
  source_id?: number;
  date_from?: string;
  date_to?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface PaginatedTickets {
  items: Ticket[];
  total: number;
  limit: number;
  offset: number;
}

export const getTickets = (filters: TicketFilters = {}) =>
  api.get<PaginatedTickets>('/tickets/', { params: filters }).then(r => r.data);

export const getTicket = (id: number) =>
  api.get<Ticket>(`/tickets/${id}`).then(r => r.data);

export const createTicket = (data: TicketIn) =>
  api.post<Ticket>('/tickets/', data).then(r => r.data);

export const updateTicket = (id: number, data: TicketIn) =>
  api.put<Ticket>(`/tickets/${id}`, data).then(r => r.data);

export const deleteTicket = (id: number) =>
  api.delete(`/tickets/${id}`);

export const patchTicketStatus = (id: number, status: string) =>
  api.patch<Ticket>(`/tickets/${id}/status`, { status }).then(r => r.data);

export const importFromHtml = (html: string) =>
  api.post<Ticket>('/tickets/import/html', { html }).then(r => r.data);

export const getStats = () =>
  api.get<Stats>('/tickets/stats').then(r => r.data);

export const getSources = () =>
  api.get<Source[]>('/sources/').then(r => r.data);

export const createSource = (name: string) =>
  api.post<Source>('/sources/', { name }).then(r => r.data);

export const updateSource = (id: number, name: string) =>
  api.put<Source>(`/sources/${id}`, { name }).then(r => r.data);

export const deleteSource = (id: number) =>
  api.delete(`/sources/${id}`);

export interface TipStat {
  tip: string;
  category: string;
  total: number;
  won: number;
  lost: number;
  pending: number;
  success_rate: number | null;
}

export interface CategoryStat {
  category: string;
  total: number;
  won: number;
  lost: number;
  pending: number;
  success_rate: number | null;
}

export interface TipStatsResponse {
  tips: TipStat[];
  categories: CategoryStat[];
}

export const getStatsByTip = () =>
  api.get<TipStatsResponse>('/tickets/stats/by-tip').then(r => r.data);

export interface ReportingFilters {
  date_from?: string;
  date_to?: string;
  bookmaker?: string;
  source_id?: number;
  ticket_type?: string;
}

export interface ReportingSummary {
  total: number; won: number; lost: number; pending: number;
  total_staked: number; total_won: number; profit: number; roi: number; avg_odds: number | null;
}

export interface ProfitPoint { date: string; profit: number; }

export interface BookmakerStat {
  bookmaker: string; total: number; won: number; lost: number;
  staked: number; profit: number; roi: number | null; success_rate: number | null;
}

export interface SourceStat {
  source: string; total: number; won: number; lost: number;
  staked: number; profit: number; roi: number | null; success_rate: number | null;
}

export interface CategoryReportStat {
  category: string; total: number; won: number; lost: number;
  success_rate: number | null; avg_odds: number | null;
}

export interface TopTicket {
  id: number; date: string; matches: string; stake: number | null; profit: number; bookmaker: string | null;
}

export interface StreakInfo {
  current: number;
  type: 'win' | 'loss' | null;
  best_win: number;
  best_loss: number;
}

export interface DowStat {
  day: string; total: number; won: number; lost: number;
  staked: number; profit: number; roi: number | null; success_rate: number | null;
}

export interface MonthStat {
  month: string; key: string; total: number; won: number; lost: number; pending: number;
  staked: number; profit: number; roi: number | null; success_rate: number | null;
}

export interface ReportingData {
  summary: ReportingSummary;
  streak: StreakInfo;
  profit_over_time: ProfitPoint[];
  by_month: MonthStat[];
  by_bookmaker: BookmakerStat[];
  by_source: SourceStat[];
  by_category: CategoryReportStat[];
  by_day_of_week: DowStat[];
  top_best: TopTicket[];
  top_worst: TopTicket[];
}

export const getReporting = (filters: ReportingFilters = {}) =>
  api.get<ReportingData>('/tickets/stats/reporting', { params: filters }).then(r => r.data);

export interface TicketTemplate {
  id: number;
  name: string;
  ticket_type: string | null;
  bookmaker: string | null;
  source_id: number | null;
  source_name: string | null;
  stake: number | null;
  bets: BetIn[];
  created_at: string;
}

export interface TicketTemplateIn {
  name: string;
  ticket_type?: string | null;
  bookmaker?: string | null;
  source_id?: number | null;
  stake?: number | null;
  bets: BetIn[];
}

export const exportJson = () =>
  api.get('/tickets/export/json').then(r => r.data);

export const importJson = (tickets: object[], merge = true) =>
  api.post<{ imported: number; skipped: number; errors: string[] }>('/tickets/import/json', { tickets, merge }).then(r => r.data);

export const getTemplates = () =>
  api.get<TicketTemplate[]>('/templates/').then(r => r.data);

export const createTemplate = (data: TicketTemplateIn) =>
  api.post<TicketTemplate>('/templates/', data).then(r => r.data);

export const updateTemplate = (id: number, data: TicketTemplateIn) =>
  api.put<TicketTemplate>(`/templates/${id}`, data).then(r => r.data);

export const deleteTemplate = (id: number) =>
  api.delete(`/templates/${id}`);

export interface OddsRangeStat {
  band: string;
  total: number;
  won: number;
  lost: number;
  success_rate: number | null;
  staked: number;
  profit: number;
  roi: number | null;
  avg_odds: number;
}

export const getOddsRange = () =>
  api.get<OddsRangeStat[]>('/tickets/stats/by-odds-range').then(r => r.data);

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user_id: number;
  username: string;
  email: string;
}

export const authRegister = (email: string, username: string, password: string) =>
  api.post<AuthResponse>('/auth/register', { email, username, password }).then(r => r.data);

export const authLogin = (username: string, password: string) => {
  const form = new URLSearchParams();
  form.append('username', username);
  form.append('password', password);
  return api.post<AuthResponse>('/auth/login', form, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  }).then(r => r.data);
};

export const migrateExistingData = () =>
  api.post('/auth/migrate-existing-data').then(r => r.data);

export const generateShareLink = (ticketId: number) =>
  api.post<{ share_token: string }>(`/tickets/${ticketId}/share`).then(r => r.data);

export const revokeShareLink = (ticketId: number) =>
  api.delete(`/tickets/${ticketId}/share`).then(r => r.data);

export const getSharedTicket = (token: string) =>
  api.get<Ticket>(`/tickets/shared/${token}`).then(r => r.data);

export const changePassword = (current_password: string, new_password: string) =>
  api.post('/auth/change-password', { current_password, new_password }).then(r => r.data);

export const changeUsername = (username: string) =>
  api.post<AuthResponse>('/auth/change-username', { username }).then(r => r.data);

export interface PublicProfile {
  username: string;
  total_tickets: number;
  evaluated: number;
  won: number;
  winrate: number;
  roi: number;
  profit: number;
  shared_tickets: {
    share_token: string;
    status: string;
    ticket_type: string;
    created_at: string;
    total_odds: number | null;
    stake: number | null;
    bets_count: number;
  }[];
}

export const getPublicProfile = (username: string) =>
  api.get<PublicProfile>(`/auth/profile/${username}`).then(r => r.data);

export const setPublicProfile = (is_public: boolean) =>
  api.post<{ is_public: boolean }>('/auth/set-public', { is_public }).then(r => r.data);

export interface AdminUser {
  id: number;
  username: string;
  email: string;
  is_active: boolean;
  is_admin: boolean;
  is_public: boolean;
  created_at: string;
  ticket_count: number;
}

export interface AdminEditUserPayload {
  username?: string;
  email?: string;
  password?: string;
  is_active?: boolean;
  is_admin?: boolean;
  is_public?: boolean;
}

export const adminGetStats = () =>
  api.get<{ total_users: number; active_users: number; admin_count: number; total_tickets: number }>('/admin/stats').then(r => r.data);

export const adminListUsers = () =>
  api.get<AdminUser[]>('/admin/users').then(r => r.data);

export const adminEditUser = (id: number, data: AdminEditUserPayload) =>
  api.put<AdminUser>(`/admin/users/${id}`, data).then(r => r.data);

export const adminDeleteUser = (id: number) =>
  api.delete(`/admin/users/${id}`).then(r => r.data);

export const adminBulkAction = (user_ids: number[], action: string) =>
  api.post<{ affected: number }>('/admin/users/bulk', { user_ids, action }).then(r => r.data);

export const adminImpersonate = (id: number) =>
  api.post<{ access_token: string; user_id: number; username: string; email: string }>(`/admin/users/${id}/impersonate`).then(r => r.data);

export const adminGetLoginLogs = (limit = 100) =>
  api.get<{ id: number; username_attempted: string; ip_address: string | null; success: boolean; created_at: string; user_id: number | null }[]>(`/admin/login-logs?limit=${limit}`).then(r => r.data);

export interface ExtendedStats {
  activity: { today: number; week: number; month: number };
  registrations_30d: { date: string; count: number }[];
  top_by_tickets: { id: number; username: string; ticket_count: number; shared_count: number; winrate: number }[];
  top_by_winrate: { id: number; username: string; ticket_count: number; shared_count: number; winrate: number }[];
  top_by_shared: { id: number; username: string; ticket_count: number; shared_count: number; winrate: number }[];
}

export const adminGetExtendedStats = () =>
  api.get<ExtendedStats>('/admin/extended-stats').then(r => r.data);

export const adminGetSystemSettings = () =>
  api.get<{ maintenance_mode: string; announcement: string }>('/admin/system-settings').then(r => r.data);

export const adminUpdateSystemSettings = (data: { maintenance_mode?: boolean; announcement?: string }) =>
  api.put<{ maintenance_mode: string; announcement: string }>('/admin/system-settings', data).then(r => r.data);

export const getPublicSettings = () =>
  api.get<{ announcement: string }>('/admin/public-settings').then(r => r.data);

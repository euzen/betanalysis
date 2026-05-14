import { useEffect, useState } from 'react';
import {
  adminGetStats, adminListUsers, adminEditUser, adminDeleteUser,
  adminBulkAction, adminImpersonate, adminGetLoginLogs, adminGetExtendedStats,
  adminGetSystemSettings, adminUpdateSystemSettings,
  AdminUser, AdminEditUserPayload, ExtendedStats,
} from '../services/api';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { setAuthToken } from '../services/api';
import { Users, Ticket, ShieldCheck, UserCheck, Pencil, Trash2, X, Check, ExternalLink, LogIn, BarChart2, Settings, AlertTriangle, Megaphone } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

function StatCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
      <div className="p-2.5 bg-blue-50 rounded-lg text-blue-600">{icon}</div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-xs text-gray-400">{label}</p>
      </div>
    </div>
  );
}

type Tab = 'users' | 'stats' | 'logs' | 'system';

interface EditModal {
  user: AdminUser;
  username: string;
  email: string;
  password: string;
  is_active: boolean;
  is_admin: boolean;
  is_public: boolean;
}

export default function Admin() {
  const { toast } = useToast();
  const { login } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('users');
  const [stats, setStats] = useState<{ total_users: number; active_users: number; admin_count: number; total_tickets: number } | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<EditModal | null>(null);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);

  // Stats tab
  const [extStats, setExtStats] = useState<ExtendedStats | null>(null);

  // Logs tab
  const [logs, setLogs] = useState<{ id: number; username_attempted: string; ip_address: string | null; success: boolean; created_at: string; user_id: number | null }[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // System tab
  const [sysSettings, setSysSettings] = useState<{ maintenance_mode: string; announcement: string } | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [maintenance, setMaintenance] = useState(false);
  const [sysLoading, setSysLoading] = useState(false);

  const load = async () => {
    try {
      const [s, u] = await Promise.all([adminGetStats(), adminListUsers()]);
      setStats(s);
      setUsers(u);
    } catch {
      toast('Chyba při načítání admin dat', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (activeTab === 'stats' && !extStats) {
      adminGetExtendedStats().then(setExtStats).catch(() => toast('Chyba při načítání statistik', 'error'));
    }
    if (activeTab === 'logs' && logs.length === 0) {
      setLogsLoading(true);
      adminGetLoginLogs(200).then(setLogs).catch(() => toast('Chyba při načítání logů', 'error')).finally(() => setLogsLoading(false));
    }
    if (activeTab === 'system' && !sysSettings) {
      adminGetSystemSettings().then(s => {
        setSysSettings(s);
        setAnnouncement(s.announcement);
        setMaintenance(s.maintenance_mode === '1');
      }).catch(() => toast('Chyba při načítání nastavení', 'error'));
    }
  }, [activeTab]);

  const openModal = (u: AdminUser) => {
    setModal({ user: u, username: u.username, email: u.email, password: '', is_active: u.is_active, is_admin: u.is_admin, is_public: u.is_public });
  };

  const handleSave = async () => {
    if (!modal) return;
    setSaving(true);
    const payload: AdminEditUserPayload = {
      username: modal.username !== modal.user.username ? modal.username : undefined,
      email: modal.email !== modal.user.email ? modal.email : undefined,
      password: modal.password.length >= 6 ? modal.password : undefined,
      is_active: modal.is_active !== modal.user.is_active ? modal.is_active : undefined,
      is_admin: modal.is_admin !== modal.user.is_admin ? modal.is_admin : undefined,
      is_public: modal.is_public !== modal.user.is_public ? modal.is_public : undefined,
    };
    try {
      const updated = await adminEditUser(modal.user.id, payload);
      setUsers(prev => prev.map(u => u.id === updated.id ? updated : u));
      setModal(null);
      toast('Uživatel uložen', 'success');
    } catch (err: any) {
      toast(err?.response?.data?.detail || 'Chyba při ukládání', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (u: AdminUser) => {
    if (!confirm(`Opravdu smazat uživatele "${u.username}" včetně všech jeho tiketů?`)) return;
    try {
      await adminDeleteUser(u.id);
      setUsers(prev => prev.filter(x => x.id !== u.id));
      if (stats) setStats({ ...stats, total_users: stats.total_users - 1 });
      toast('Uživatel smazán', 'info');
    } catch (err: any) {
      toast(err?.response?.data?.detail || 'Chyba při mazání', 'error');
    }
  };

  const toggleSelect = (id: number) =>
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const toggleSelectAll = () =>
    setSelected(prev => prev.length === users.length ? [] : users.map(u => u.id));

  const handleBulkAction = async (action: string) => {
    if (selected.length === 0) return;
    const label = action === 'delete' ? 'smazat' : action === 'deactivate' ? 'deaktivovat' : 'aktivovat';
    if (action === 'delete' && !confirm(`Opravdu ${label} ${selected.length} uživatel(ů)?`)) return;
    setBulkLoading(true);
    try {
      const { affected } = await adminBulkAction(selected, action);
      toast(`Hotovo – ${affected} uživatel(ů) ${label}no`, 'success');
      setSelected([]);
      load();
    } catch (err: any) {
      toast(err?.response?.data?.detail || 'Chyba', 'error');
    } finally {
      setBulkLoading(false);
    }
  };

  const handleImpersonate = async (u: AdminUser) => {
    if (!confirm(`Přihlásit se jako "${u.username}"? Budete přesměrováni na dashboard.`)) return;
    try {
      const res = await adminImpersonate(u.id);
      setAuthToken(res.access_token);
      login(res.access_token, { id: res.user_id, username: res.username, email: res.email });
      window.location.href = '/';
    } catch (err: any) {
      toast(err?.response?.data?.detail || 'Chyba impersonace', 'error');
    }
  };

  const handleSaveSystem = async () => {
    setSysLoading(true);
    try {
      const updated = await adminUpdateSystemSettings({ maintenance_mode: maintenance, announcement });
      setSysSettings(updated);
      toast('Nastavení uloženo', 'success');
    } catch {
      toast('Chyba při ukládání', 'error');
    } finally {
      setSysLoading(false);
    }
  };

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'users', label: 'Uživatelé', icon: <Users size={15} /> },
    { id: 'stats', label: 'Statistiky', icon: <BarChart2 size={15} /> },
    { id: 'logs', label: 'Přihlášení', icon: <LogIn size={15} /> },
    { id: 'system', label: 'Systém', icon: <Settings size={15} /> },
  ];

  if (loading) return <div className="text-gray-400 py-20 text-center">Načítám...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Administrace</h1>

      {/* Summary stat cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <StatCard label="Uživatelů celkem" value={stats.total_users} icon={<Users size={18} />} />
          <StatCard label="Aktivních" value={stats.active_users} icon={<UserCheck size={18} />} />
          <StatCard label="Adminů" value={stats.admin_count} icon={<ShieldCheck size={18} />} />
          <StatCard label="Tiketů celkem" value={stats.total_tickets} icon={<Ticket size={18} />} />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-xl w-fit">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: Users ─────────────────────────────────────────────── */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Bulk actions bar */}
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
            <span className="font-semibold text-gray-800 text-sm">Uživatelé ({users.length}){selected.length > 0 && <span className="ml-2 text-blue-600">– vybráno {selected.length}</span>}</span>
            {selected.length > 0 && (
              <div className="flex gap-2">
                <button onClick={() => handleBulkAction('activate')} disabled={bulkLoading} className="text-xs px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 disabled:opacity-50">Aktivovat</button>
                <button onClick={() => handleBulkAction('deactivate')} disabled={bulkLoading} className="text-xs px-3 py-1.5 bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-lg hover:bg-yellow-100 disabled:opacity-50">Deaktivovat</button>
                <button onClick={() => handleBulkAction('delete')} disabled={bulkLoading} className="text-xs px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50">Smazat</button>
              </div>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase">
                  <th className="px-4 py-3"><input type="checkbox" checked={selected.length === users.length && users.length > 0} onChange={toggleSelectAll} className="rounded" /></th>
                  <th className="text-left px-4 py-3">Uživatel</th>
                  <th className="text-left px-4 py-3 hidden sm:table-cell">Email</th>
                  <th className="text-center px-3 py-3">Tikety</th>
                  <th className="text-center px-3 py-3">Stav</th>
                  <th className="text-center px-3 py-3 hidden md:table-cell">Admin</th>
                  <th className="text-center px-3 py-3 hidden lg:table-cell">Profil</th>
                  <th className="text-center px-3 py-3 hidden lg:table-cell">Registrace</th>
                  <th className="px-3 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users.map(u => (
                  <tr key={u.id} className={`hover:bg-gray-50 transition-colors ${selected.includes(u.id) ? 'bg-blue-50' : ''}`}>
                    <td className="px-4 py-3"><input type="checkbox" checked={selected.includes(u.id)} onChange={() => toggleSelect(u.id)} className="rounded" /></td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold shrink-0">{u.username[0].toUpperCase()}</div>
                        <span className="truncate max-w-[120px]">{u.username}</span>
                        {u.is_admin && <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full hidden sm:inline">admin</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{u.email}</td>
                    <td className="px-3 py-3 text-center text-gray-700 font-medium">{u.ticket_count}</td>
                    <td className="px-3 py-3 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>{u.is_active ? 'aktivní' : 'blokován'}</span>
                    </td>
                    <td className="px-3 py-3 text-center hidden md:table-cell">
                      {u.is_admin ? <Check size={14} className="text-green-500 mx-auto" /> : <X size={14} className="text-gray-300 mx-auto" />}
                    </td>
                    <td className="px-3 py-3 text-center hidden lg:table-cell">
                      {u.is_public ? <a href={`/u/${u.username}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-500 hover:underline text-xs"><ExternalLink size={12} />veřejný</a> : <span className="text-xs text-gray-400">skrytý</span>}
                    </td>
                    <td className="px-3 py-3 text-center text-xs text-gray-400 hidden lg:table-cell">{new Date(u.created_at).toLocaleDateString('cs-CZ')}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => handleImpersonate(u)} title="Přihlásit se jako tento uživatel" className="text-orange-400 hover:text-orange-600 p-1 rounded hover:bg-orange-50 transition-colors"><LogIn size={13} /></button>
                        <button onClick={() => openModal(u)} className="text-blue-500 hover:text-blue-700 p-1 rounded hover:bg-blue-50 transition-colors"><Pencil size={13} /></button>
                        <button onClick={() => handleDelete(u)} className="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors"><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB: Stats ─────────────────────────────────────────────── */}
      {activeTab === 'stats' && (
        <div className="flex flex-col gap-6">
          {!extStats && <div className="text-gray-400 py-10 text-center">Načítám statistiky...</div>}
          {extStats && (
            <>
              {/* Activity */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
                  <p className="text-2xl font-bold text-gray-900">{extStats.activity.today}</p>
                  <p className="text-xs text-gray-400 mt-1">Tikety dnes</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
                  <p className="text-2xl font-bold text-gray-900">{extStats.activity.week}</p>
                  <p className="text-xs text-gray-400 mt-1">Tento týden</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
                  <p className="text-2xl font-bold text-gray-900">{extStats.activity.month}</p>
                  <p className="text-xs text-gray-400 mt-1">Tento měsíc</p>
                </div>
              </div>

              {/* Registrations chart */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-800 mb-4">Registrace – posledních 30 dní</h3>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={extStats.registrations_30d} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={4} />
                    <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                    <Tooltip />
                    <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Top tables */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { title: 'Top tikety', data: extStats.top_by_tickets, key: 'ticket_count', label: 'tiketů' },
                  { title: 'Top úspěšnost', data: extStats.top_by_winrate, key: 'winrate', label: '%' },
                  { title: 'Top sdílení', data: extStats.top_by_shared, key: 'shared_count', label: 'sdílených' },
                ].map(({ title, data, key, label }) => (
                  <div key={title} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100"><h3 className="text-sm font-semibold text-gray-800">{title}</h3></div>
                    <div className="divide-y divide-gray-50">
                      {data.map((u, i) => (
                        <div key={u.id} className="flex items-center gap-3 px-4 py-2.5">
                          <span className="text-xs font-bold text-gray-400 w-4">{i + 1}.</span>
                          <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold shrink-0">{u.username[0].toUpperCase()}</div>
                          <span className="text-sm text-gray-800 flex-1 truncate">{u.username}</span>
                          <span className="text-sm font-semibold text-blue-600">{(u as any)[key]} {label}</span>
                        </div>
                      ))}
                      {data.length === 0 && <p className="text-xs text-gray-400 px-4 py-3">Žádná data</p>}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── TAB: Logs ──────────────────────────────────────────────── */}
      {activeTab === 'logs' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800">Přihlašovací log (posl. 200)</h3>
          </div>
          {logsLoading ? <div className="py-10 text-center text-gray-400">Načítám...</div> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase">
                    <th className="text-left px-5 py-3">Datum</th>
                    <th className="text-left px-5 py-3">Uživatel</th>
                    <th className="text-left px-4 py-3">IP adresa</th>
                    <th className="text-center px-4 py-3">Výsledek</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {logs.map(l => (
                    <tr key={l.id} className="hover:bg-gray-50">
                      <td className="px-5 py-2.5 text-xs text-gray-500">{new Date(l.created_at).toLocaleString('cs-CZ')}</td>
                      <td className="px-5 py-2.5 font-medium text-gray-800">{l.username_attempted}</td>
                      <td className="px-4 py-2.5 text-gray-500 font-mono text-xs">{l.ip_address || '–'}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${l.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                          {l.success ? <><Check size={10} />OK</> : <><X size={10} />Zamítnuto</>}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {logs.length === 0 && <tr><td colSpan={4} className="text-center py-8 text-gray-400 text-sm">Žádné záznamy</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: System ────────────────────────────────────────────── */}
      {activeTab === 'system' && (
        <div className="flex flex-col gap-4 max-w-xl">
          {/* Maintenance mode */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle size={16} className="text-orange-500" />
              <h3 className="text-sm font-semibold text-gray-800">Maintenance mode</h3>
            </div>
            <p className="text-xs text-gray-400 mb-4">Blokuje přihlášení pro všechny ne-adminské uživatele. Admini mohou přihlásit normálně.</p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMaintenance(!maintenance)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${maintenance ? 'bg-orange-500' : 'bg-gray-300'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${maintenance ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
              <span className={`text-sm font-medium ${maintenance ? 'text-orange-600' : 'text-gray-500'}`}>{maintenance ? 'Zapnuto – přihlášení blokováno' : 'Vypnuto'}</span>
            </div>
          </div>

          {/* Announcement */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-1">
              <Megaphone size={16} className="text-blue-500" />
              <h3 className="text-sm font-semibold text-gray-800">Systémové oznámení</h3>
            </div>
            <p className="text-xs text-gray-400 mb-3">Zobrazí se všem přihlášeným uživatelům jako banner. Ponechte prázdné pro skrytí.</p>
            <textarea
              value={announcement}
              onChange={e => setAnnouncement(e.target.value)}
              rows={3}
              placeholder="Napište oznámení pro uživatele..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <button
            onClick={handleSaveSystem}
            disabled={sysLoading}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors self-start"
          >
            {sysLoading ? 'Ukládám...' : 'Uložit nastavení'}
          </button>
        </div>
      )}

      {/* ── Edit Modal ─────────────────────────────────────────────── */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Upravit uživatele – {modal.user.username}</h3>
              <button onClick={() => setModal(null)} className="text-gray-400 hover:text-gray-600 p-1 rounded"><X size={18} /></button>
            </div>
            <div className="px-6 py-5 flex flex-col gap-4">
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Uživatelské jméno</label>
                <input type="text" value={modal.username} onChange={e => setModal({ ...modal, username: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Email</label>
                <input type="email" value={modal.email} onChange={e => setModal({ ...modal, email: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Nové heslo <span className="text-gray-400 font-normal">(prázdné = beze změny)</span></label>
                <input type="password" value={modal.password} onChange={e => setModal({ ...modal, password: e.target.value })} placeholder="min. 6 znaků" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="flex flex-col gap-2.5">
                {[
                  { key: 'is_active' as const, label: 'Aktivní účet', color: 'bg-blue-600' },
                  { key: 'is_admin' as const, label: 'Admin práva', color: 'bg-purple-600' },
                  { key: 'is_public' as const, label: 'Veřejný profil', color: 'bg-green-600' },
                ].map(({ key, label, color }) => (
                  <label key={key} className="flex items-center gap-3 cursor-pointer">
                    <button type="button" onClick={() => setModal({ ...modal, [key]: !modal[key] })} className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${modal[key] ? color : 'bg-gray-300'}`}>
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${modal[key] ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </button>
                    <span className="text-sm text-gray-700">{label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100">
              <button onClick={() => setModal(null)} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">Zrušit</button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">{saving ? 'Ukládám...' : 'Uložit změny'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

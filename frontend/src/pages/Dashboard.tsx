import React, { useEffect, useState } from 'react';
import { getStats, getReporting, Stats, StreakInfo } from '../services/api';
import { TrendingUp, TrendingDown, Clock, Trophy, Banknote, Target, Flame, Skull } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts';

const Card: React.FC<{ label: string; value: string; sub?: string; color?: string; icon: React.ReactNode }> = ({ label, value, sub, color = 'text-gray-900', icon }) => (
  <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
    <div className="p-3 bg-gray-50 rounded-lg text-blue-600">{icon}</div>
    <div>
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  </div>
);

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [streak, setStreak] = useState<StreakInfo | null>(null);
  const [profitByDay, setProfitByDay] = useState<{ date: string; cumProfit: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getStats(), getReporting()])
      .then(([s, r]) => {
        setStats(s);
        setStreak(r.streak);
        // Build cumulative profit sparkline from last 30 days
        const days = [...(r.profit_over_time || [])].sort((a, b) => a.date.localeCompare(b.date)).slice(-30);
        let cum = 0;
        setProfitByDay(days.map(d => { cum += d.profit; return { date: d.date.slice(5), cumProfit: Math.round(cum * 100) / 100 }; }));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-gray-400 py-20 text-center">Načítám...</div>;
  if (!stats) return <div className="text-red-500 py-20 text-center">Chyba při načítání statistik.</div>;

  const successRate = stats.total > 0 ? Math.round((stats.won / (stats.won + stats.lost || 1)) * 100) : 0;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Přehled</h1>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Donut chart */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Výsledky tiketů</h2>
          <div className="flex items-center gap-6">
            <ResponsiveContainer width={120} height={120}>
              <PieChart>
                <Pie data={[
                  { name: 'Výherní', value: stats?.won || 0 },
                  { name: 'Prohrané', value: stats?.lost || 0 },
                  { name: 'Nevyhodnocené', value: stats?.pending || 0 },
                ]} cx="50%" cy="50%" innerRadius={35} outerRadius={55} paddingAngle={2} dataKey="value">
                  <Cell fill="#22c55e" />
                  <Cell fill="#ef4444" />
                  <Cell fill="#f59e0b" />
                </Pie>
                <Tooltip formatter={(v: number) => [`${v} tiketů`]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-green-500 shrink-0"></span><span className="text-gray-600">Výherní: <strong className="text-gray-900">{stats?.won}</strong></span></div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-red-500 shrink-0"></span><span className="text-gray-600">Prohrané: <strong className="text-gray-900">{stats?.lost}</strong></span></div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-yellow-400 shrink-0"></span><span className="text-gray-600">Nevyhodnocené: <strong className="text-gray-900">{stats?.pending}</strong></span></div>
              <div className="mt-1 text-xs text-gray-400">Úspěšnost: <strong className={successRate >= 50 ? 'text-green-600' : 'text-red-500'}>{successRate} %</strong></div>
            </div>
          </div>
        </div>

        {/* Profit sparkline */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-1">Kumulativní zisk (posledních 30 dní)</h2>
          <p className={`text-xl font-bold mb-3 ${(stats?.profit || 0) >= 0 ? 'text-green-600' : 'text-red-500'}`}>
            {(stats?.profit || 0) >= 0 ? '+' : ''}{stats?.profit.toFixed(2)} Kč
          </p>
          {profitByDay.length > 1 ? (
            <ResponsiveContainer width="100%" height={80}>
              <AreaChart data={profitByDay} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis hide />
                <Tooltip formatter={(v: number) => [`${v} Kč`, 'Zisk']} labelStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="cumProfit" stroke="#3b82f6" strokeWidth={2} fill="url(#profitGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-xs text-gray-400 text-center py-6">Nedóstatek dat pro graf.</p>
          )}
        </div>
      </div>

      {/* Streak banner */}
      {streak && streak.current > 0 && (
        <div className={`rounded-xl border p-4 flex items-center gap-4 mb-2 ${
          streak.type === 'win' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
        }`}>
          <div className={`text-3xl font-black ${
            streak.type === 'win' ? 'text-green-600' : 'text-red-600'
          }`}>
            {streak.type === 'win'
              ? <Flame size={32} className="text-green-500" />
              : <Skull size={32} className="text-red-500" />}
          </div>
          <div>
            <p className={`font-semibold text-sm ${
              streak.type === 'win' ? 'text-green-700' : 'text-red-700'
            }`}>
              Aktuální série {streak.type === 'win' ? 'výher' : 'proher'}: <strong>{streak.current}×</strong>
            </p>
            <p className="text-xs text-gray-500">
              Nejlepší série výher: {streak.best_win}× &nbsp;·&nbsp; Nejhorší série proher: {streak.best_loss}×
            </p>
          </div>
        </div>
      )}

      {/* KPI karty */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <Card label="Celkem tiketů" value={String(stats.total)} icon={<Target size={22} />} />
        <Card label="Výherní" value={String(stats.won)} color="text-green-600" icon={<Trophy size={22} />} />
        <Card label="Prohrané" value={String(stats.lost)} color="text-red-500" icon={<TrendingDown size={22} />} />
        <Card label="Nevyhodnocené" value={String(stats.pending)} color="text-yellow-600" icon={<Clock size={22} />} />
        <Card
          label="Úspěšnost"
          value={`${successRate} %`}
          sub={`${stats.won}V / ${stats.lost}P (jen vyhodnocené)`}
          color={successRate >= 50 ? 'text-green-600' : 'text-red-500'}
          icon={<TrendingUp size={22} />}
        />
        <Card
          label="Zisk / Ztráta"
          value={`${stats.profit >= 0 ? '+' : ''}${stats.profit.toFixed(2)} Kč`}
          sub={`Vsazeno: ${stats.total_staked.toFixed(2)} Kč | ROI: ${stats.roi.toFixed(1)} %`}
          color={stats.profit >= 0 ? 'text-green-600' : 'text-red-500'}
          icon={<Banknote size={22} />}
        />
      </div>

    </div>
  );
};

export default Dashboard;

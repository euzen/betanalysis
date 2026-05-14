import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts';
import {
  getReporting, getSources, ReportingData, ReportingFilters, Source, DowStat, MonthStat,
} from '../services/api';
import { TrendingUp, TrendingDown, Target, Coins, BarChart2, CalendarDays, Printer } from 'lucide-react';
import BookmakerBadge from '../components/BookmakerBadge';

const fmt = (n: number | null | undefined, decimals = 2) =>
  n != null ? n.toFixed(decimals) : '—';

const pct = (n: number | null | undefined) =>
  n != null ? `${n.toFixed(1)} %` : '—';

const profitColor = (v: number) =>
  v > 0 ? 'text-green-600' : v < 0 ? 'text-red-600' : 'text-gray-500';

const SummaryCard = ({ label, value, sub, icon: Icon, color }: {
  label: string; value: string; sub?: string; icon: any; color: string;
}) => (
  <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-start gap-4">
    <div className={`p-2.5 rounded-lg ${color}`}><Icon size={20} /></div>
    <div>
      <p className="text-xs text-gray-500 font-medium">{label}</p>
      <p className="text-xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  </div>
);

const TableSection = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
    <div className="px-5 py-4 border-b border-gray-100">
      <h2 className="font-semibold text-gray-800">{title}</h2>
    </div>
    <div className="overflow-x-auto">{children}</div>
  </div>
);

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

const PERIODS = [
  { label: 'Vše', from: '', to: '' },
  {
    label: 'Tento měsíc',
    get from() { const n = new Date(); return isoDate(new Date(n.getFullYear(), n.getMonth(), 1)); },
    get to() { return isoDate(new Date()); },
  },
  {
    label: 'Minulý měsíc',
    get from() { const n = new Date(); return isoDate(new Date(n.getFullYear(), n.getMonth() - 1, 1)); },
    get to() { const n = new Date(); return isoDate(new Date(n.getFullYear(), n.getMonth(), 0)); },
  },
  {
    label: 'Tento rok',
    get from() { return isoDate(new Date(new Date().getFullYear(), 0, 1)); },
    get to() { return isoDate(new Date()); },
  },
];

export default function Reporting() {
  const [data, setData] = useState<ReportingData | null>(null);
  const [compareData, setCompareData] = useState<ReportingData | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<ReportingFilters>({});
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [bookmaker, setBookmaker] = useState('');
  const [sourceId, setSourceId] = useState('');
  const [ticketType, setTicketType] = useState('');
  const [activePeriod, setActivePeriod] = useState('Vše');
  const [showCompare, setShowCompare] = useState(false);

  useEffect(() => { getSources().then(setSources); }, []);

  const load = (f: ReportingFilters) => {
    setLoading(true);
    getReporting(f).then(d => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  };

  useEffect(() => { load({}); }, []);

  const applyPeriod = (p: typeof PERIODS[0]) => {
    setActivePeriod(p.label);
    setDateFrom(p.from);
    setDateTo(p.to);
    const f: ReportingFilters = {};
    if (p.from) f.date_from = p.from;
    if (p.to) f.date_to = p.to;
    if (bookmaker) f.bookmaker = bookmaker;
    if (sourceId) f.source_id = Number(sourceId);
    if (ticketType) f.ticket_type = ticketType;
    setFilters(f);
    load(f);

    // Auto-load compare: if "Tento měsíc" → compare with "Minulý měsíc"
    if (p.label === 'Tento měsíc') {
      const prev = PERIODS[2];
      getReporting({ date_from: prev.from, date_to: prev.to }).then(setCompareData);
      setShowCompare(true);
    } else if (p.label === 'Minulý měsíc') {
      const n = new Date();
      const twoBack = { from: isoDate(new Date(n.getFullYear(), n.getMonth() - 2, 1)), to: isoDate(new Date(n.getFullYear(), n.getMonth() - 1, 0)) };
      getReporting({ date_from: twoBack.from, date_to: twoBack.to }).then(setCompareData);
      setShowCompare(true);
    } else {
      setShowCompare(false);
      setCompareData(null);
    }
  };

  const handleApply = () => {
    const f: ReportingFilters = {};
    if (dateFrom) f.date_from = dateFrom;
    if (dateTo) f.date_to = dateTo;
    if (bookmaker) f.bookmaker = bookmaker;
    if (sourceId) f.source_id = Number(sourceId);
    if (ticketType) f.ticket_type = ticketType;
    setFilters(f);
    load(f);
  };

  const handleReset = () => {
    setDateFrom(''); setDateTo(''); setBookmaker(''); setSourceId(''); setTicketType('');
    setFilters({});
    load({});
  };

  const s = data?.summary;
  const hasFilters = Object.keys(filters).length > 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900 print:text-xl">Reporting</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => window.print()} className="print:hidden flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 bg-white text-gray-600 hover:border-gray-300 transition-colors">
            <Printer size={14} /> Tisk / PDF
          </button>
          <CalendarDays size={15} className="text-gray-400" />
          {PERIODS.map(p => (
            <button
              key={p.label}
              onClick={() => applyPeriod(p)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                activePeriod === p.label
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}
            >
              {p.label}
            </button>
          ))}
          {hasFilters && (
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">Aktivní filtr</span>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Datum od</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Datum do</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Sázková kancelář</label>
            <select value={bookmaker} onChange={e => setBookmaker(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Všechny</option>
              <option>Tipsport</option><option>Fortuna</option><option>SazkaBet</option>
              <option>Betano</option><option>Ostatní</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Zdroj</label>
            <select value={sourceId} onChange={e => setSourceId(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Všechny</option>
              {sources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Typ tiketu</label>
            <select value={ticketType} onChange={e => setTicketType(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Všechny</option>
              <option>SÓLO</option><option>AKU</option><option>SYSTÉM</option>
            </select>
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          <button onClick={handleApply}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
            Použít filtr
          </button>
          {hasFilters && (
            <button onClick={handleReset}
              className="px-4 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors">
              Zrušit filtr
            </button>
          )}
        </div>
      </div>

      {loading && <div className="text-center py-12 text-gray-400 text-sm">Načítám data...</div>}

      {!loading && data && (
        <>
          {/* Streak cards */}
          {data.streak.current > 0 && (
            <div className={`rounded-xl border p-4 flex items-center gap-4 ${
              data.streak.type === 'win' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
            }`}>
              <div className={`text-3xl font-black ${
                data.streak.type === 'win' ? 'text-green-600' : 'text-red-600'
              }`}>{data.streak.current}×</div>
              <div>
                <p className={`font-semibold text-sm ${
                  data.streak.type === 'win' ? 'text-green-700' : 'text-red-700'
                }`}>
                  Aktuální série {data.streak.type === 'win' ? 'výher' : 'proher'}
                </p>
                <p className="text-xs text-gray-500">
                  Nejlepší série výher: {data.streak.best_win}× &nbsp;·&nbsp; Nejhorší série proher: {data.streak.best_loss}×
                </p>
              </div>
            </div>
          )}

          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCard label="Tikety" icon={Target} color="bg-blue-50 text-blue-600"
              value={`${s!.won}/${s!.total}`} sub={`${s!.pending} nevyhodnocených`} />
            <SummaryCard label="Vsazeno" icon={Coins} color="bg-gray-50 text-gray-600"
              value={`${fmt(s!.total_staked)} Kč`} sub={`Průměrný kurz: ${fmt(s!.avg_odds)}`} />
            <SummaryCard label="Zisk / Ztráta" icon={s!.profit >= 0 ? TrendingUp : TrendingDown}
              color={s!.profit >= 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}
              value={`${s!.profit >= 0 ? '+' : ''}${fmt(s!.profit)} Kč`}
              sub={`ROI: ${fmt(s!.roi)} %`} />
            <SummaryCard label="Úspěšnost" icon={BarChart2} color="bg-purple-50 text-purple-600"
              value={s!.won + s!.lost > 0 ? pct(s!.won / (s!.won + s!.lost) * 100) : '—'}
              sub={`${s!.won} výher / ${s!.lost} proher`} />
          </div>

          {/* Porovnání období */}
          {showCompare && compareData && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-800">Porovnání s předchozím obdobím</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">Metrika</th>
                      <th className="px-4 py-3 text-right font-medium text-blue-600">{activePeriod}</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-400">Předchozí</th>
                      <th className="px-4 py-3 text-right font-medium">Změna</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {[
                      { label: 'Tikety celkem', cur: s!.total, prev: compareData.summary.total, unit: '' },
                      { label: 'Výhry', cur: s!.won, prev: compareData.summary.won, unit: '' },
                      { label: 'Úspěšnost', cur: s!.won + s!.lost > 0 ? +(s!.won / (s!.won + s!.lost) * 100).toFixed(1) : null, prev: compareData.summary.won + compareData.summary.lost > 0 ? +(compareData.summary.won / (compareData.summary.won + compareData.summary.lost) * 100).toFixed(1) : null, unit: '%' },
                      { label: 'Vsazeno', cur: s!.total_staked, prev: compareData.summary.total_staked, unit: ' Kč' },
                      { label: 'Zisk', cur: s!.profit, prev: compareData.summary.profit, unit: ' Kč' },
                      { label: 'ROI', cur: s!.roi, prev: compareData.summary.roi, unit: '%' },
                    ].map(row => {
                      const diff = row.cur != null && row.prev != null ? row.cur - row.prev : null;
                      const diffPct = diff != null && row.prev != null && row.prev !== 0 ? (diff / Math.abs(row.prev) * 100) : null;
                      return (
                        <tr key={row.label} className="hover:bg-gray-50">
                          <td className="px-4 py-2.5 font-medium text-gray-700">{row.label}</td>
                          <td className="px-4 py-2.5 text-right font-semibold text-blue-600">
                            {row.cur != null ? `${row.cur}${row.unit}` : '—'}
                          </td>
                          <td className="px-4 py-2.5 text-right text-gray-400">
                            {row.prev != null ? `${row.prev}${row.unit}` : '—'}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            {diff != null ? (
                              <span className={`font-semibold ${diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                                {diff > 0 ? '+' : ''}{typeof diff === 'number' ? diff.toFixed(row.unit === '' ? 0 : 1) : diff}{row.unit}
                                {diffPct != null && <span className="text-xs ml-1 opacity-70">({diffPct > 0 ? '+' : ''}{diffPct.toFixed(0)} %)</span>}
                              </span>
                            ) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Profit over time chart */}
          {data.profit_over_time.length > 1 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 print-page-break print-hide-chart">
              <h2 className="font-semibold text-gray-800 mb-4">Vývoj zisku v čase</h2>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={data.profit_over_time} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${v} Kč`} />
                  <Tooltip formatter={(v: number) => [`${v.toFixed(2)} Kč`, 'Kumulativní zisk']} />
                  <ReferenceLine y={0} stroke="#d1d5db" strokeDasharray="4 4" />
                  <Line type="monotone" dataKey="profit" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print-page-break">
            {/* By bookmaker */}
            <TableSection title="Podle sázkové kanceláře">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Kancelář</th>
                    <th className="px-4 py-3 text-right font-medium">Tikety</th>
                    <th className="px-4 py-3 text-right font-medium">Úsp.</th>
                    <th className="px-4 py-3 text-right font-medium">Vsazeno</th>
                    <th className="px-4 py-3 text-right font-medium">Zisk</th>
                    <th className="px-4 py-3 text-right font-medium">ROI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.by_bookmaker.map(r => (
                    <tr key={r.bookmaker} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5"><BookmakerBadge bookmaker={r.bookmaker} size="md" /></td>
                      <td className="px-4 py-2.5 text-right text-gray-500">{r.total}</td>
                      <td className="px-4 py-2.5 text-right">{pct(r.success_rate)}</td>
                      <td className="px-4 py-2.5 text-right text-gray-500">{fmt(r.staked)} Kč</td>
                      <td className={`px-4 py-2.5 text-right font-medium ${profitColor(r.profit)}`}>{r.profit >= 0 ? '+' : ''}{fmt(r.profit)} Kč</td>
                      <td className={`px-4 py-2.5 text-right font-medium ${profitColor(r.roi ?? 0)}`}>{fmt(r.roi)} %</td>
                    </tr>
                  ))}
                  {data.by_bookmaker.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">Žádná data</td></tr>}
                </tbody>
              </table>
            </TableSection>

            {/* By source */}
            <TableSection title="Podle zdroje">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Zdroj</th>
                    <th className="px-4 py-3 text-right font-medium">Tikety</th>
                    <th className="px-4 py-3 text-right font-medium">Úsp.</th>
                    <th className="px-4 py-3 text-right font-medium">Vsazeno</th>
                    <th className="px-4 py-3 text-right font-medium">Zisk</th>
                    <th className="px-4 py-3 text-right font-medium">ROI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.by_source.map(r => (
                    <tr key={r.source} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-medium text-gray-800">{r.source}</td>
                      <td className="px-4 py-2.5 text-right text-gray-500">{r.total}</td>
                      <td className="px-4 py-2.5 text-right">{pct(r.success_rate)}</td>
                      <td className="px-4 py-2.5 text-right text-gray-500">{fmt(r.staked)} Kč</td>
                      <td className={`px-4 py-2.5 text-right font-medium ${profitColor(r.profit)}`}>{r.profit >= 0 ? '+' : ''}{fmt(r.profit)} Kč</td>
                      <td className={`px-4 py-2.5 text-right font-medium ${profitColor(r.roi ?? 0)}`}>{fmt(r.roi)} %</td>
                    </tr>
                  ))}
                  {data.by_source.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">Žádná data</td></tr>}
                </tbody>
              </table>
            </TableSection>
          </div>

          {/* By day of week */}
          <div className="print-page-break"><TableSection title="Výkonnost podle dne v týdnu">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Den</th>
                  <th className="px-4 py-3 text-right font-medium">Tikety</th>
                  <th className="px-4 py-3 text-right font-medium">Výh.</th>
                  <th className="px-4 py-3 text-right font-medium">Proh.</th>
                  <th className="px-4 py-3 text-right font-medium">Úsp.</th>
                  <th className="px-4 py-3 text-right font-medium">Vsazeno</th>
                  <th className="px-4 py-3 text-right font-medium">Zisk</th>
                  <th className="px-4 py-3 text-right font-medium">ROI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.by_day_of_week.filter((r: DowStat) => r.total > 0).map((r: DowStat) => (
                  <tr key={r.day} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium text-gray-800">{r.day}</td>
                    <td className="px-4 py-2.5 text-right text-gray-500">{r.total}</td>
                    <td className="px-4 py-2.5 text-right text-green-600">{r.won}</td>
                    <td className="px-4 py-2.5 text-right text-red-500">{r.lost}</td>
                    <td className="px-4 py-2.5 text-right">{pct(r.success_rate)}</td>
                    <td className="px-4 py-2.5 text-right text-gray-500">{fmt(r.staked)} Kč</td>
                    <td className={`px-4 py-2.5 text-right font-medium ${profitColor(r.profit)}`}>{r.profit >= 0 ? '+' : ''}{fmt(r.profit)} Kč</td>
                    <td className={`px-4 py-2.5 text-right font-medium ${profitColor(r.roi ?? 0)}`}>{fmt(r.roi)} %</td>
                  </tr>
                ))}
                {data.by_day_of_week.every((r: DowStat) => r.total === 0) && (
                  <tr><td colSpan={8} className="px-4 py-6 text-center text-gray-400">Žádná data</td></tr>
                )}
              </tbody>
            </table>
          </TableSection>

          </div>

          {/* By month */}
          {data.by_month.length > 0 && (
            <div className="print-page-break"><TableSection title="Přehled po měsících">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Měsíc</th>
                    <th className="px-4 py-3 text-right font-medium">Tikety</th>
                    <th className="px-4 py-3 text-right font-medium">Výh.</th>
                    <th className="px-4 py-3 text-right font-medium">Proh.</th>
                    <th className="px-4 py-3 text-right font-medium">Čeká</th>
                    <th className="px-4 py-3 text-right font-medium">Úsp.</th>
                    <th className="px-4 py-3 text-right font-medium">Vsazeno</th>
                    <th className="px-4 py-3 text-right font-medium">Zisk</th>
                    <th className="px-4 py-3 text-right font-medium">ROI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.by_month.map((r: MonthStat) => (
                    <tr key={r.key} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-semibold text-gray-800">{r.month}</td>
                      <td className="px-4 py-2.5 text-right text-gray-500">{r.total}</td>
                      <td className="px-4 py-2.5 text-right text-green-600">{r.won}</td>
                      <td className="px-4 py-2.5 text-right text-red-500">{r.lost}</td>
                      <td className="px-4 py-2.5 text-right text-yellow-600">{r.pending}</td>
                      <td className="px-4 py-2.5 text-right">{pct(r.success_rate)}</td>
                      <td className="px-4 py-2.5 text-right text-gray-500">{fmt(r.staked)} Kč</td>
                      <td className={`px-4 py-2.5 text-right font-semibold ${profitColor(r.profit)}`}>{r.profit >= 0 ? '+' : ''}{fmt(r.profit)} Kč</td>
                      <td className={`px-4 py-2.5 text-right font-medium ${profitColor(r.roi ?? 0)}`}>{fmt(r.roi)} %</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableSection></div>
          )}

          {/* By category */}
          <div className="print-page-break"><TableSection title="Podle kategorie sázky">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Kategorie</th>
                  <th className="px-4 py-3 text-right font-medium">Sázky</th>
                  <th className="px-4 py-3 text-right font-medium">Výhry</th>
                  <th className="px-4 py-3 text-right font-medium">Prohry</th>
                  <th className="px-4 py-3 text-right font-medium">Úspěšnost</th>
                  <th className="px-4 py-3 text-right font-medium">Průměrný kurz</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.by_category.map(r => (
                  <tr key={r.category} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium text-gray-800">{r.category}</td>
                    <td className="px-4 py-2.5 text-right text-gray-500">{r.total}</td>
                    <td className="px-4 py-2.5 text-right text-green-600">{r.won}</td>
                    <td className="px-4 py-2.5 text-right text-red-500">{r.lost}</td>
                    <td className="px-4 py-2.5 text-right font-medium">{pct(r.success_rate)}</td>
                    <td className="px-4 py-2.5 text-right text-gray-500">{fmt(r.avg_odds)}</td>
                  </tr>
                ))}
                {data.by_category.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">Žádná data</td></tr>}
              </tbody>
            </table>
          </TableSection>

          </div>
          {/* Top best / worst */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print-page-break">
            <TableSection title="🏆 Top 5 nejlepších tiketů">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Datum</th>
                    <th className="px-4 py-3 text-left font-medium">Zápasy</th>
                    <th className="px-4 py-3 text-right font-medium">Vklad</th>
                    <th className="px-4 py-3 text-right font-medium">Zisk</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.top_best.map(r => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 text-gray-400 whitespace-nowrap">
                        <Link to={`/tickets/${r.id}`} className="text-blue-600 hover:underline">{r.date}</Link>
                      </td>
                      <td className="px-4 py-2.5 text-gray-700 max-w-[180px] truncate">{r.matches}</td>
                      <td className="px-4 py-2.5 text-right text-gray-500">{fmt(r.stake)} Kč</td>
                      <td className="px-4 py-2.5 text-right font-medium text-green-600">+{fmt(r.profit)} Kč</td>
                    </tr>
                  ))}
                  {data.top_best.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">Žádná data</td></tr>}
                </tbody>
              </table>
            </TableSection>

            <TableSection title="📉 Top 5 nejhorších tiketů">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Datum</th>
                    <th className="px-4 py-3 text-left font-medium">Zápasy</th>
                    <th className="px-4 py-3 text-right font-medium">Vklad</th>
                    <th className="px-4 py-3 text-right font-medium">Ztráta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.top_worst.map(r => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 text-gray-400 whitespace-nowrap">
                        <Link to={`/tickets/${r.id}`} className="text-blue-600 hover:underline">{r.date}</Link>
                      </td>
                      <td className="px-4 py-2.5 text-gray-700 max-w-[180px] truncate">{r.matches}</td>
                      <td className="px-4 py-2.5 text-right text-gray-500">{fmt(r.stake)} Kč</td>
                      <td className="px-4 py-2.5 text-right font-medium text-red-600">{fmt(r.profit)} Kč</td>
                    </tr>
                  ))}
                  {data.top_worst.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">Žádná data</td></tr>}
                </tbody>
              </table>
            </TableSection>
          </div>
        </>
      )}
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getTickets, deleteTicket, patchTicketStatus, createTicket, getSources, Ticket, Source, TicketFilters, PaginatedTickets } from '../services/api';
import { Trash2, Eye, PlusCircle, Copy, Download, Filter, X, ChevronDown, Search, ChevronLeft, ChevronRight, LayoutList, Table2, AlertTriangle } from 'lucide-react';
import BookmakerBadge from '../components/BookmakerBadge';
import { useToast } from '../context/ToastContext';

const STATUS_COLOR: Record<string, string> = {
  'VÝHERNÍ': 'bg-green-100 text-green-700',
  'PROHRÁVAJÍCÍ': 'bg-red-100 text-red-700',
  'NEVYHODNOCENÝ': 'bg-yellow-100 text-yellow-700',
  'STORNOVANÝ': 'bg-gray-100 text-gray-500',
};

const STATUSES = ['NEVYHODNOCENÝ', 'VÝHERNÍ', 'PROHRÁVAJÍCÍ', 'STORNOVANÝ'];

const PAGE_SIZE = 25;

const exportCsv = (tickets: Ticket[]) => {
  const rows = [
    ['ID', 'Datum', 'Status', 'Typ', 'Kancelář', 'Zdroj', 'Kurz', 'Vklad', 'Možná výhra', 'Výhra', 'Zápasy'],
    ...tickets.map(t => [
      t.id,
      new Date(t.created_at).toLocaleDateString('cs-CZ'),
      t.status,
      t.ticket_type,
      t.bookmaker || '',
      t.source?.name || '',
      t.total_odds?.toFixed(2) || '',
      t.stake?.toFixed(2) || '',
      t.possible_win?.toFixed(2) || '',
      t.actual_win?.toFixed(2) || '',
      t.bets.map(b => b.match_name).join(' | '),
    ]),
  ];
  const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'tikety.csv'; a.click();
  URL.revokeObjectURL(url);
};

const TicketList: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [result, setResult] = useState<PaginatedTickets>({ items: [], total: 0, limit: PAGE_SIZE, offset: 0 });
  const [loading, setLoading] = useState(true);
  const [sources, setSources] = useState<Source[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(0);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>(() => (localStorage.getItem('ticketViewMode') as 'table' | 'cards') || 'table');

  const setView = (mode: 'table' | 'cards') => { setViewMode(mode); localStorage.setItem('ticketViewMode', mode); };

  // Filter state
  const [status, setStatus] = useState('');
  const [bookmaker, setBookmaker] = useState('');
  const [sourceId, setSourceId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const tickets = result.items;
  const totalPages = Math.ceil(result.total / PAGE_SIZE);
  const activeFilterCount = [status, bookmaker, sourceId, dateFrom, dateTo, search].filter(Boolean).length;

  const buildFilters = (p: number): TicketFilters => {
    const f: TicketFilters = { limit: PAGE_SIZE, offset: p * PAGE_SIZE };
    if (status) f.status = status;
    if (bookmaker) f.bookmaker = bookmaker;
    if (sourceId) f.source_id = Number(sourceId);
    if (dateFrom) f.date_from = dateFrom;
    if (dateTo) f.date_to = dateTo;
    if (search) f.search = search;
    return f;
  };

  const load = (f: TicketFilters) => {
    setLoading(true);
    getTickets(f).then(data => { setResult(data); setLoading(false); }).catch(() => setLoading(false));
  };

  useEffect(() => { getSources().then(setSources); }, []);

  useEffect(() => {
    load(buildFilters(page));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, status, bookmaker, sourceId, dateFrom, dateTo, search]);

  const applyFilters = () => { setPage(0); };

  const resetFilters = () => {
    setStatus(''); setBookmaker(''); setSourceId(''); setDateFrom(''); setDateTo('');
    setSearch(''); setSearchInput(''); setPage(0);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Opravdu smazat tiket?')) return;
    await deleteTicket(id);
    toast('Tiket byl smazán.', 'info');
    load(buildFilters(page));
  };

  const handleStatusChange = async (ticket: Ticket, newStatus: string) => {
    await patchTicketStatus(ticket.id, newStatus);
    setResult(prev => ({ ...prev, items: prev.items.map(t => t.id === ticket.id ? { ...t, status: newStatus } : t) }));
    toast(`Status změněn na: ${newStatus}`);
  };

  const handleDuplicate = async (ticket: Ticket) => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const nowStr = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}:00`;
    await createTicket({
      status: 'NEVYHODNOCENÝ',
      ticket_type: ticket.ticket_type,
      bookmaker: ticket.bookmaker,
      source_id: ticket.source_id,
      created_at: nowStr,
      total_odds: ticket.total_odds,
      stake: ticket.stake,
      possible_win: ticket.possible_win,
      note: ticket.note,
      bets: ticket.bets.map(b => ({
        match_name: b.match_name,
        league: b.league || '',
        match_datetime: b.match_datetime || '',
        tip: b.tip,
        odds: b.odds,
        result: 'NEVYHODNOCENO',
        score: '',
      })),
    });
    toast('Tiket byl duplikován.');
    navigate('/tickets');
    load(buildFilters(page));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Tikety</h1>
        <div className="flex gap-2">
          <button onClick={() => exportCsv(tickets)} className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors">
            <Download size={15} /> CSV
          </button>
          <div className="hidden md:flex border border-gray-200 rounded-lg overflow-hidden">
            <button onClick={() => setView('table')} title="Tabulka" className={`px-2.5 py-2 transition-colors ${viewMode === 'table' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}><Table2 size={15} /></button>
            <button onClick={() => setView('cards')} title="Karty" className={`px-2.5 py-2 transition-colors ${viewMode === 'cards' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}><LayoutList size={15} /></button>
          </div>
          <button
            onClick={() => setShowFilters(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 border text-sm font-medium rounded-lg transition-colors ${activeFilterCount > 0 ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            <Filter size={15} />
            Filtry
            {activeFilterCount > 0 && <span className="bg-blue-600 text-white text-xs rounded-full px-1.5">{activeFilterCount}</span>}
          </button>
          <Link to="/import" className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
            <PlusCircle size={15} /> Přidat
          </Link>
        </div>
      </div>

      {/* Filters panel */}
      {showFilters && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
              <select value={status} onChange={e => setStatus(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Vše</option>
                {STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Kancelář</label>
              <select value={bookmaker} onChange={e => setBookmaker(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Vše</option>
                {['Tipsport','Fortuna','SazkaBet','Betano','Ostatní'].map(b => <option key={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Zdroj</label>
              <select value={sourceId} onChange={e => setSourceId(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Vše</option>
                {sources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Datum od</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Datum do</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={applyFilters} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">Použít</button>
            {activeFilterCount > 0 && (
              <button onClick={resetFilters} className="flex items-center gap-1 px-4 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors">
                <X size={14} /> Zrušit
              </button>
            )}
          </div>
        </div>
      )}

      {/* Search bar */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { setSearch(searchInput); setPage(0); } }}
            placeholder="Hledat zápas, tip, kancelář... (Enter)"
            className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {searchInput && (
            <button onClick={() => { setSearchInput(''); setSearch(''); setPage(0); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          )}
        </div>
        <button onClick={() => { setSearch(searchInput); setPage(0); }} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
          Hledat
        </button>
      </div>

      {loading && <div className="text-gray-400 py-20 text-center">Načítám...</div>}
      {!loading && tickets.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="text-5xl mb-4">{activeFilterCount > 0 ? '🔍' : '🎫'}</div>
          <p className="text-lg font-semibold text-gray-700 mb-1">
            {activeFilterCount > 0 ? 'Žádné tikety nevyhovují filtru' : 'Zatím žádné tikety'}
          </p>
          <p className="text-sm text-gray-400 mb-5">
            {activeFilterCount > 0
              ? 'Zkuste změnit nebo resetovat filtry.'
              : 'Začněte přidáním prvního tiketu ručním zadáním.'}
          </p>
          {activeFilterCount > 0 ? (
            <button onClick={resetFilters} className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors">
              Resetovat filtry
            </button>
          ) : (
            <Link to="/import" className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
              Přidat první tiket
            </Link>
          )}
        </div>
      )}

      {/* Desktop table */}
      <div className={`${viewMode === 'table' ? 'hidden md:block' : 'hidden'} bg-white rounded-xl border border-gray-200 overflow-hidden`}>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100">
              <th className="text-left px-4 py-3 font-medium">Datum</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-left px-4 py-3 font-medium">Kancelář / Zdroj</th>
              <th className="text-left px-4 py-3 font-medium">Zápasy</th>
              <th className="text-right px-4 py-3 font-medium">Kurz</th>
              <th className="text-right px-4 py-3 font-medium">Vklad</th>
              <th className="text-right px-4 py-3 font-medium">Výsledek</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {tickets.map(ticket => {
              const effectiveWin = ticket.status === 'VÝHERNÍ'
                ? (ticket.actual_win ?? ticket.possible_win)
                : null;
              const profit = effectiveWin != null
                ? effectiveWin - (ticket.stake || 0)
                : ticket.status === 'PROHRÁVAJÍCÍ' && ticket.stake != null
                  ? -ticket.stake
                  : null;
              return (
                <tr key={ticket.id} className="hover:bg-gray-50/60 transition-colors group">
                  {/* Datum */}
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                    {new Date(ticket.created_at).toLocaleDateString('cs-CZ', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                  </td>

                  {/* Status dropdown */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                    {ticket.status === 'VÝHERNÍ' && ticket.actual_win == null && (
                      <span title="Chybí skutečná výhra – doplňte v detailu tiketu">
                        <AlertTriangle size={13} className="text-amber-400 shrink-0" />
                      </span>
                    )}
                    <div className="relative group/status">
                      <button className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS_COLOR[ticket.status] || 'bg-gray-100 text-gray-500'}`}>
                        {ticket.status} <ChevronDown size={10} />
                      </button>
                      <div className="absolute left-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-lg shadow-lg hidden group-hover/status:block min-w-[160px]">
                        {STATUSES.map(s => (
                          <button key={s} onClick={() => handleStatusChange(ticket, s)}
                            className={`block w-full text-left px-3 py-2 text-xs hover:bg-gray-50 ${ticket.status === s ? 'font-bold' : ''}`}>
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                    </div>
                  </td>

                  {/* Kancelář / Zdroj */}
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      {ticket.bookmaker && <BookmakerBadge bookmaker={ticket.bookmaker} />}
                      {ticket.source && (
                        <span className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full font-medium w-fit">{ticket.source.name}</span>
                      )}
                      {!ticket.bookmaker && !ticket.source && <span className="text-xs text-gray-300">—</span>}
                    </div>
                  </td>

                  {/* Zápasy */}
                  <td className="px-4 py-3 max-w-xs">
                    <div className="flex flex-col gap-0.5">
                      {ticket.bets.slice(0, 2).map(b => (
                        <div key={b.id} className="flex items-center gap-1.5 text-xs">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${b.result === 'VÝHRA' ? 'bg-green-500' : b.result === 'PROHRA' ? 'bg-red-500' : 'bg-yellow-400'}`} />
                          <span className="text-gray-700 truncate max-w-[160px]">{b.match_name}</span>
                          <span className="text-gray-400 shrink-0">{b.tip}</span>
                          <span className="text-gray-500 font-medium shrink-0">{b.odds.toFixed(2)}</span>
                        </div>
                      ))}
                      {ticket.bets.length > 2 && (
                        <span className="text-xs text-gray-400">+{ticket.bets.length - 2} další</span>
                      )}
                    </div>
                  </td>

                  {/* Kurz */}
                  <td className="px-4 py-3 text-right font-semibold text-gray-800 whitespace-nowrap">
                    {ticket.total_odds ? ticket.total_odds.toFixed(2) : <span className="text-gray-300">—</span>}
                  </td>

                  {/* Vklad */}
                  <td className="px-4 py-3 text-right text-gray-600 whitespace-nowrap">
                    {ticket.stake ? `${ticket.stake.toFixed(2)} Kč` : <span className="text-gray-300">—</span>}
                  </td>

                  {/* Výsledek */}
                  <td className="px-4 py-3 text-right whitespace-nowrap font-semibold">
                    {profit !== null
                      ? <span className={profit >= 0 ? 'text-green-600' : 'text-red-500'}>{profit >= 0 ? '+' : ''}{profit.toFixed(2)} Kč</span>
                      : ticket.possible_win != null
                        ? <span className="text-blue-500 font-normal text-xs">možná {ticket.possible_win.toFixed(2)} Kč</span>
                        : <span className="text-gray-300">—</span>
                    }
                  </td>

                  {/* Akce */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Link to={`/tickets/${ticket.id}`} className="p-1 text-gray-400 hover:text-blue-600 transition-colors" title="Detail"><Eye size={15} /></Link>
                      <button onClick={() => handleDuplicate(ticket)} className="p-1 text-gray-400 hover:text-green-600 transition-colors" title="Duplikovat"><Copy size={15} /></button>
                      <button onClick={() => handleDelete(ticket.id)} className="p-1 text-gray-400 hover:text-red-500 transition-colors" title="Smazat"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Cards (mobile always, desktop when cards mode) */}
      <div className={`${viewMode === 'cards' ? 'flex' : 'md:hidden flex'} flex-col gap-3`}>
        {tickets.map(ticket => (
          <div key={ticket.id} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative group">
                  <button className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLOR[ticket.status] || 'bg-gray-100 text-gray-500'}`}>
                    {ticket.status} <ChevronDown size={10} />
                  </button>
                  <div className="absolute left-0 top-full mt-1 z-10 bg-white border border-gray-200 rounded-lg shadow-lg hidden group-hover:block min-w-[160px]">
                    {STATUSES.map(s => (
                      <button key={s} onClick={() => handleStatusChange(ticket, s)}
                        className={`block w-full text-left px-3 py-2 text-xs hover:bg-gray-50 ${ticket.status === s ? 'font-bold' : ''}`}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                {ticket.bookmaker && <BookmakerBadge bookmaker={ticket.bookmaker} />}
                {ticket.source && <span className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full font-medium">{ticket.source.name}</span>}
                <span className="text-xs text-gray-400">{new Date(ticket.created_at).toLocaleDateString('cs-CZ')}</span>
                {ticket.status === 'VÝHERNÍ' && ticket.actual_win == null && (
                  <span title="Chybí skutečná výhra" className="flex items-center gap-1 text-xs text-amber-500 font-medium">
                    <AlertTriangle size={12} /> Chybí výhra
                  </span>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <Link to={`/tickets/${ticket.id}`} className="text-gray-400 hover:text-blue-600"><Eye size={17} /></Link>
                <button onClick={() => handleDuplicate(ticket)} className="text-gray-400 hover:text-green-600" title="Duplikovat"><Copy size={17} /></button>
                <button onClick={() => handleDelete(ticket.id)} className="text-gray-400 hover:text-red-600"><Trash2 size={17} /></button>
              </div>
            </div>
            <div className="mt-2 flex gap-3 text-xs text-gray-500 flex-wrap">
              {ticket.total_odds && <span>Kurz: <strong className="text-gray-800">{ticket.total_odds.toFixed(2)}</strong></span>}
              {ticket.stake && <span>Vklad: <strong className="text-gray-800">{ticket.stake.toFixed(2)} Kč</strong></span>}
              {ticket.status === 'VÝHERNÍ'
                ? <span className="text-green-600 font-semibold">+{((ticket.actual_win ?? ticket.possible_win ?? 0) - (ticket.stake||0)).toFixed(2)} Kč</span>
                : ticket.status === 'PROHRÁVAJÍCÍ' && ticket.stake != null
                  ? <span className="text-red-500 font-semibold">-{ticket.stake.toFixed(2)} Kč</span>
                  : ticket.possible_win != null
                    ? <span>Možná: <strong>{ticket.possible_win.toFixed(2)} Kč</strong></span>
                    : null}
            </div>
            <div className="mt-2 flex flex-col gap-1">
              {ticket.bets.map(b => (
                <div key={b.id} className="flex items-center justify-between text-xs text-gray-500 bg-gray-50 rounded px-2.5 py-1.5">
                  <span className="font-medium text-gray-700 truncate max-w-[55%]">{b.match_name}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span>{b.tip}</span>
                    <span className="font-semibold text-gray-700">{b.odds.toFixed(2)}</span>
                    <span className={`px-1.5 py-0.5 rounded font-semibold ${b.result === 'VÝHRA' ? 'bg-green-100 text-green-700' : b.result === 'PROHRA' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{b.result}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 px-1">
          <p className="text-xs text-gray-500">
            {result.offset + 1}–{Math.min(result.offset + PAGE_SIZE, result.total)} z {result.total}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={16} />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i)
              .filter(i => Math.abs(i - page) <= 2)
              .map(i => (
                <button
                  key={i}
                  onClick={() => setPage(i)}
                  className={`w-8 h-8 rounded-lg text-sm font-medium border transition-colors ${
                    i === page ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {i + 1}
                </button>
              ))
            }
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page === totalPages - 1}
              className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TicketList;

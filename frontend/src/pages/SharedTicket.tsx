import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getSharedTicket, Ticket } from '../services/api';
import { TrendingUp, Calendar, Building2, Tag, CheckCircle, XCircle, Clock } from 'lucide-react';
import BookmakerBadge from '../components/BookmakerBadge';

const STATUS_COLOR: Record<string, string> = {
  'VÝHERNÍ': 'bg-green-100 text-green-700',
  'PROHRÁVAJÍCÍ': 'bg-red-100 text-red-700',
  'NEVYHODNOCENÝ': 'bg-yellow-100 text-yellow-700',
  'STORNOVANÝ': 'bg-gray-100 text-gray-500',
};

const BET_ICON: Record<string, React.ReactNode> = {
  'VÝHRA': <CheckCircle size={14} className="text-green-500" />,
  'PROHRA': <XCircle size={14} className="text-red-500" />,
  'NEVYHODNOCENO': <Clock size={14} className="text-yellow-500" />,
};

const BET_COLOR: Record<string, string> = {
  'VÝHRA': 'text-green-700 bg-green-50',
  'PROHRA': 'text-red-700 bg-red-50',
  'NEVYHODNOCENO': 'text-yellow-700 bg-yellow-50',
};

export default function SharedTicket() {
  const { token } = useParams<{ token: string }>();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!token) return;
    getSharedTicket(token)
      .then(t => { setTicket(t); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, [token]);

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">Načítám...</div>
  );

  if (error || !ticket) return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4 text-center p-4">
      <XCircle size={48} className="text-red-400" />
      <h1 className="text-xl font-bold text-gray-800">Tiket nenalezen</h1>
      <p className="text-gray-500">Tento odkaz neexistuje nebo byl zrušen.</p>
      <Link to="/login" className="text-blue-600 hover:underline text-sm">Přihlásit se</Link>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Topbar */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-blue-600 rounded-lg">
            <TrendingUp size={16} className="text-white" />
          </div>
          <span className="font-bold text-gray-900 text-sm">BetAnalysis</span>
        </div>
        <Link to="/login" className="text-xs text-blue-600 hover:underline">Přihlásit se</Link>
      </header>

      <main className="max-w-2xl mx-auto p-4 py-8">
        {/* Status badge */}
        <div className="flex items-center gap-3 mb-6">
          <span className={`text-sm font-semibold px-3 py-1 rounded-full ${STATUS_COLOR[ticket.status] || 'bg-gray-100 text-gray-500'}`}>
            {ticket.status}
          </span>
          <span className="text-sm text-gray-500">{ticket.ticket_type}</span>
        </div>

        {/* Meta */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
          <div className="flex flex-wrap gap-4 mb-5 text-sm text-gray-500">
            <div className="flex items-center gap-1.5">
              <Calendar size={14} className="text-gray-400" />
              {new Date(ticket.created_at).toLocaleString('cs-CZ')}
            </div>
            {ticket.bookmaker && (
              <div className="flex items-center gap-1.5">
                <Building2 size={14} className="text-gray-400" />
                <BookmakerBadge bookmaker={ticket.bookmaker} size="md" />
              </div>
            )}
            {ticket.source && (
              <div className="flex items-center gap-1.5">
                <Tag size={14} className="text-purple-400" />
                <span className="text-purple-600 font-medium">{ticket.source.name}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {ticket.total_odds != null && (
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Celkový kurz</p>
                <p className="text-lg font-bold text-gray-900">{ticket.total_odds.toFixed(2)}</p>
              </div>
            )}
            {ticket.stake != null && (
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Vklad</p>
                <p className="text-lg font-bold text-gray-900">{ticket.stake.toFixed(2)} Kč</p>
              </div>
            )}
            {ticket.possible_win != null && (
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Možná výhra</p>
                <p className="text-lg font-bold text-gray-900">{ticket.possible_win.toFixed(2)} Kč</p>
              </div>
            )}
            {ticket.actual_win != null && (
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Skutečná výhra</p>
                <p className="text-lg font-bold text-green-600">{ticket.actual_win.toFixed(2)} Kč</p>
              </div>
            )}
          </div>
        </div>

        {/* Bets */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800 text-sm">Sázky ({ticket.bets.length})</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {ticket.bets.map(bet => (
              <div key={bet.id} className="px-5 py-3 flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 text-sm truncate">{bet.match_name}</p>
                  {bet.league && <p className="text-xs text-gray-400">{bet.league}</p>}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-sm font-semibold text-gray-700">{bet.tip}</span>
                  <span className="text-sm text-gray-500">{bet.odds.toFixed(2)}</span>
                  <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${BET_COLOR[bet.result] || 'bg-gray-100 text-gray-500'}`}>
                    {BET_ICON[bet.result]} {bet.result}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Sdíleno přes BetAnalysis · <Link to="/login" className="text-blue-500 hover:underline">Vyzkoušet zdarma</Link>
        </p>
      </main>
    </div>
  );
}

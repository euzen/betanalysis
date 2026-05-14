import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getTicket, deleteTicket, generateShareLink, revokeShareLink, Ticket } from '../services/api';
import { ArrowLeft, Trash2, Pencil, Building2, Tag, StickyNote, Calendar, Printer, Share2, X } from 'lucide-react';
import BookmakerBadge from '../components/BookmakerBadge';
import { useToast } from '../context/ToastContext';

const STATUS_COLOR: Record<string, string> = {
  'VÝHERNÍ': 'bg-green-100 text-green-700',
  'PROHRÁVAJÍCÍ': 'bg-red-100 text-red-700',
  'NEVYHODNOCENÝ': 'bg-yellow-100 text-yellow-700',
  'STORNOVANÝ': 'bg-gray-100 text-gray-500',
};

const BET_COLOR: Record<string, string> = {
  'VÝHRA': 'bg-green-100 text-green-700',
  'PROHRA': 'bg-red-100 text-red-700',
  'NEVYHODNOCENO': 'bg-yellow-100 text-yellow-700',
};

const TicketDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    getTicket(Number(id))
      .then(t => { setTicket(t); setLoading(false); })
      .catch(() => { setLoading(false); });
  }, [id]);

  const handleShare = async () => {
    if (!ticket) return;
    setShareLoading(true);
    try {
      const res = await generateShareLink(ticket.id);
      setShareToken(res.share_token);
      const url = `${window.location.origin}/share/${res.share_token}`;
      await navigator.clipboard.writeText(url);
      toast('Odkaz zkopírován do schránky', 'success');
    } catch {
      toast('Nepodařilo se vygenerovat odkaz', 'error');
    } finally {
      setShareLoading(false);
    }
  };

  const handleRevokeShare = async () => {
    if (!ticket) return;
    await revokeShareLink(ticket.id);
    setShareToken(null);
    toast('Sdílení zrušeno', 'info');
  };

  const handleDelete = async () => {
    if (!ticket || !confirm('Opravdu smazat tiket?')) return;
    await deleteTicket(ticket.id);
    toast('Tiket byl smazán.', 'info');
    navigate('/tickets');
  };

  if (loading) return <div className="text-gray-400 py-20 text-center">Načítám...</div>;
  if (!ticket) return <div className="text-red-500 py-20 text-center">Tiket nenalezen.</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <Link to="/tickets" className="flex items-center gap-2 text-gray-500 hover:text-gray-800 text-sm">
          <ArrowLeft size={16} /> Zpět na tikety
        </Link>
        <div className="flex gap-3 print:hidden">
          <button onClick={() => window.print()} className="flex items-center gap-2 text-gray-500 hover:text-gray-800 text-sm">
            <Printer size={16} /> Tisk / PDF
          </button>
          {shareToken ? (
            <button onClick={handleRevokeShare} className="flex items-center gap-2 text-orange-500 hover:text-orange-700 text-sm">
              <X size={16} /> Zrušit sdílení
            </button>
          ) : (
            <button onClick={handleShare} disabled={shareLoading} className="flex items-center gap-2 text-green-600 hover:text-green-800 text-sm disabled:opacity-50">
              <Share2 size={16} /> {shareLoading ? 'Generuji...' : 'Sdílet'}
            </button>
          )}
          <Link to={`/tickets/${ticket.id}/edit`} className="flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm">
            <Pencil size={16} /> Upravit
          </Link>
          <button onClick={handleDelete} className="flex items-center gap-2 text-red-500 hover:text-red-700 text-sm">
            <Trash2 size={16} /> Smazat
          </button>
        </div>
      </div>

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4">
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <span className={`text-sm font-semibold px-3 py-1 rounded-full ${STATUS_COLOR[ticket.status] || 'bg-gray-100 text-gray-500'}`}>
            {ticket.status}
          </span>
          <span className="text-sm text-gray-500 font-medium">{ticket.ticket_type}</span>
        </div>

        {/* Meta info row */}
        <div className="flex flex-wrap gap-4 mb-5">
          <div className="flex items-center gap-1.5 text-sm text-gray-500">
            <Calendar size={14} className="text-gray-400" />
            {new Date(ticket.created_at).toLocaleString('cs-CZ')}
          </div>
          {ticket.bookmaker && (
            <div className="flex items-center gap-1.5 text-sm text-gray-500">
              <Building2 size={14} className="text-gray-400" />
              <BookmakerBadge bookmaker={ticket.bookmaker} size="md" />
            </div>
          )}
          {ticket.source && (
            <div className="flex items-center gap-1.5 text-sm">
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
          {ticket.possible_win != null && ticket.status === 'NEVYHODNOCENÝ' && (
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Možná výhra</p>
              <p className="text-lg font-bold text-blue-600">{ticket.possible_win.toFixed(2)} Kč</p>
            </div>
          )}
          {ticket.actual_win != null && ticket.status === 'VÝHERNÍ' && (
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Skutečná výhra</p>
              <p className="text-lg font-bold text-green-600">{ticket.actual_win.toFixed(2)} Kč</p>
            </div>
          )}
          {ticket.status === 'PROHRÁVAJÍCÍ' && ticket.stake != null && (
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Ztráta</p>
              <p className="text-lg font-bold text-red-600">-{ticket.stake.toFixed(2)} Kč</p>
            </div>
          )}
        </div>

        {ticket.note && (
          <div className="mt-4 flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-lg px-4 py-3">
            <StickyNote size={15} className="text-amber-500 mt-0.5 shrink-0" />
            <p className="text-sm text-amber-800">{ticket.note}</p>
          </div>
        )}
      </div>

      {/* Bets */}
      <h2 className="text-base font-semibold text-gray-700 mb-3">
        Zápasy ({ticket.bets.length})
      </h2>
      <div className="flex flex-col gap-3">
        {ticket.bets.map(bet => (
          <div key={bet.id} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <p className="font-semibold text-gray-900">{bet.match_name}</p>
                {bet.league && <p className="text-xs text-gray-400 mt-0.5">{bet.league}</p>}
              </div>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${BET_COLOR[bet.result] || 'bg-gray-100 text-gray-500'}`}>
                {bet.result}
              </span>
            </div>

            <div className="flex flex-wrap gap-4 text-sm text-gray-600">
              {bet.match_datetime && (
                <span className="text-gray-400 text-xs">
                  {new Date(bet.match_datetime).toLocaleString('cs-CZ', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
              <span>Tip: <strong>{bet.tip}</strong></span>
              <span>Kurz: <strong>{bet.odds.toFixed(2)}</strong></span>
              {bet.score && <span>Skóre: <strong>{bet.score}</strong></span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TicketDetail;

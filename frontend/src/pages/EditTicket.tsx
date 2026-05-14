import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getTicket, updateTicket, getSources, BetIn, Ticket, Source } from '../services/api';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { useToast } from '../context/ToastContext';

const emptyBet = (): BetIn => ({
  match_name: '',
  league: '',
  match_datetime: '',
  tip: '',
  odds: 0,
  result: 'NEVYHODNOCENO',
  score: '',
});

const toLocalDatetime = (iso: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const EditTicket: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [status, setStatus] = useState('NEVYHODNOCENÝ');
  const [ticketType, setTicketType] = useState('SÓLO');
  const [bookmaker, setBookmaker] = useState<string | null>(null);
  const [sourceId, setSourceId] = useState<number | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [stake, setStake] = useState('');
  const [totalOdds, setTotalOdds] = useState('');
  const [possibleWin, setPossibleWin] = useState('');
  const [actualWin, setActualWin] = useState('');
  const [note, setNote] = useState('');
  const [createdAt, setCreatedAt] = useState('');
  const [bets, setBets] = useState<BetIn[]>([emptyBet()]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!id) return;
    getSources().then(setSources);
    getTicket(Number(id)).then((t: Ticket) => {
      setStatus(t.status);
      setTicketType(t.ticket_type);
      setBookmaker(t.bookmaker);
      setSourceId(t.source_id);
      setStake(t.stake != null ? String(t.stake) : '');
      setTotalOdds(t.total_odds != null ? String(t.total_odds) : '');
      setPossibleWin(t.possible_win != null ? String(t.possible_win) : '');
      setActualWin(t.actual_win != null ? String(t.actual_win) : '');
      setNote(t.note || '');
      setCreatedAt(toLocalDatetime(t.created_at));
      setBets(t.bets.map(b => ({
        match_name: b.match_name,
        league: b.league || '',
        match_datetime: toLocalDatetime(b.match_datetime),
        tip: b.tip,
        odds: b.odds,
        result: b.result,
        score: b.score || '',
      })));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  const updateBet = (i: number, field: keyof BetIn, value: string | number) => {
    setBets(prev => prev.map((b, idx) => idx === i ? { ...b, [field]: value } : b));
  };

  const handleSave = async () => {
    const errs: Record<string, string> = {};
    if (stake && parseFloat(stake) <= 0) errs.stake = 'Vklad musí být větší než 0.';
    if (totalOdds && parseFloat(totalOdds) <= 1) errs.totalOdds = 'Kurz musí být větší než 1.';
    bets.forEach((b, i) => {
      if (!b.match_name.trim()) errs[`bet_name_${i}`] = 'Vyplnte název zápasu.';
      if (!b.tip.trim()) errs[`bet_tip_${i}`] = 'Vyplnte tip.';
      if (b.odds <= 0) errs[`bet_odds_${i}`] = 'Kurz musí být > 0.';
    });
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;
    const validBets = bets.filter(b => b.match_name && b.tip && b.odds > 0);
    if (validBets.length === 0) { setError('Přidejte alespoň jeden zápas.'); return; }
    setSaving(true); setError(null);
    try {
      await updateTicket(Number(id), {
        status,
        ticket_type: ticketType,
        bookmaker: bookmaker || null,
        source_id: sourceId,
        created_at: createdAt ? createdAt + ':00' : undefined,
        stake: stake ? parseFloat(stake) : null,
        total_odds: totalOdds ? parseFloat(totalOdds) : null,
        possible_win: possibleWin ? parseFloat(possibleWin) : null,
        actual_win: actualWin ? parseFloat(actualWin) : null,
        note: note || null,
        bets: validBets,
      });
      toast('Tiket byl úspěšně uložen.');
      navigate(`/tickets/${id}`);
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Chyba při ukládání.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-gray-400 py-20 text-center">Načítám...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <Link to={`/tickets/${id}`} className="flex items-center gap-2 text-gray-500 hover:text-gray-800 text-sm">
          <ArrowLeft size={16} /> Zpět na detail
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">Upravit tiket #{id}</h1>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}

      <div className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col gap-5">
        {/* Ticket info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-500 mb-1">Datum vytvoření / importu</label>
            <input type="datetime-local" value={createdAt} onChange={e => setCreatedAt(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
            <select value={status} onChange={e => setStatus(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option>NEVYHODNOCENÝ</option>
              <option>VÝHERNÍ</option>
              <option>PROHRÁVAJÍCÍ</option>
              <option>STORNOVANÝ</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Typ tiketu</label>
            <select value={ticketType} onChange={e => setTicketType(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option>SÓLO</option>
              <option>AKU</option>
              <option>SYSTÉM</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Sázková kancelář</label>
            <select value={bookmaker || ''} onChange={e => setBookmaker(e.target.value || null)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">— Nepřiřazeno —</option>
              <option>Tipsport</option>
              <option>Fortuna</option>
              <option>SazkaBet</option>
              <option>Betano</option>
              <option>Ostatní</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Zdroj</label>
            <select value={sourceId ?? ''} onChange={e => setSourceId(e.target.value ? Number(e.target.value) : null)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">— Nepřiřazeno —</option>
              {sources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Vklad (Kč)</label>
            <input type="number" value={stake} onChange={e => { setStake(e.target.value); setFieldErrors(p => ({ ...p, stake: '' })); }} placeholder="10" className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${fieldErrors.stake ? 'border-red-400' : 'border-gray-200'}`} />
            {fieldErrors.stake && <p className="text-xs text-red-500 mt-0.5">{fieldErrors.stake}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Celkový kurz</label>
            <input type="number" step="0.01" value={totalOdds} onChange={e => { setTotalOdds(e.target.value); setFieldErrors(p => ({ ...p, totalOdds: '' })); }} placeholder="1.85" className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${fieldErrors.totalOdds ? 'border-red-400' : 'border-gray-200'}`} />
            {fieldErrors.totalOdds && <p className="text-xs text-red-500 mt-0.5">{fieldErrors.totalOdds}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Možná výhra (Kč)</label>
            <input type="number" value={possibleWin} onChange={e => setPossibleWin(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Skutečná výhra (Kč)</label>
            <input type="number" value={actualWin} onChange={e => setActualWin(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-500 mb-1">Poznámka</label>
            <input type="text" value={note} onChange={e => setNote(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        {/* Bets */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700">Zápasy</h2>
            <button onClick={() => setBets(p => [...p, emptyBet()])} className="flex items-center gap-1 text-blue-600 text-sm hover:text-blue-800">
              <Plus size={15} /> Přidat zápas
            </button>
          </div>
          <div className="flex flex-col gap-4">
            {bets.map((b, i) => (
              <div key={i} className="border border-gray-100 rounded-lg p-4 bg-gray-50 relative">
                {bets.length > 1 && (
                  <button onClick={() => setBets(p => p.filter((_, idx) => idx !== i))} className="absolute top-3 right-3 text-red-400 hover:text-red-600">
                    <Trash2 size={15} />
                  </button>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Název zápasu *</label>
                    <input value={b.match_name} onChange={e => { updateBet(i, 'match_name', e.target.value); setFieldErrors(p => ({ ...p, [`bet_name_${i}`]: '' })); }} className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white ${fieldErrors[`bet_name_${i}`] ? 'border-red-400' : 'border-gray-200'}`} />
                    {fieldErrors[`bet_name_${i}`] && <p className="text-xs text-red-500 mt-0.5">{fieldErrors[`bet_name_${i}`]}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Liga / soutěž</label>
                    <input value={b.league || ''} onChange={e => updateBet(i, 'league', e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Datum a čas</label>
                    <input type="datetime-local" value={b.match_datetime || ''} onChange={e => updateBet(i, 'match_datetime', e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Tip *</label>
                    <input value={b.tip} onChange={e => { updateBet(i, 'tip', e.target.value); setFieldErrors(p => ({ ...p, [`bet_tip_${i}`]: '' })); }} className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white ${fieldErrors[`bet_tip_${i}`] ? 'border-red-400' : 'border-gray-200'}`} />
                    {fieldErrors[`bet_tip_${i}`] && <p className="text-xs text-red-500 mt-0.5">{fieldErrors[`bet_tip_${i}`]}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Kurz *</label>
                    <input type="number" step="0.01" value={b.odds || ''} onChange={e => { updateBet(i, 'odds', parseFloat(e.target.value)); setFieldErrors(p => ({ ...p, [`bet_odds_${i}`]: '' })); }} className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white ${fieldErrors[`bet_odds_${i}`] ? 'border-red-400' : 'border-gray-200'}`} />
                    {fieldErrors[`bet_odds_${i}`] && <p className="text-xs text-red-500 mt-0.5">{fieldErrors[`bet_odds_${i}`]}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Výsledek tipu</label>
                    <select value={b.result} onChange={e => updateBet(i, 'result', e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                      <option>NEVYHODNOCENO</option>
                      <option>VÝHRA</option>
                      <option>PROHRA</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Skóre</label>
                    <input value={b.score || ''} onChange={e => updateBet(i, 'score', e.target.value)} placeholder="1:2" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={handleSave} disabled={saving} className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Ukládám...' : 'Uložit změny'}
          </button>
          <Link to={`/tickets/${id}`} className="px-6 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50">
            Zrušit
          </Link>
        </div>
      </div>
    </div>
  );
};

export default EditTicket;

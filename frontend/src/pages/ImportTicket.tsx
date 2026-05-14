import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createTicket, getSources, getTemplates, createTemplate, deleteTemplate, BetIn, Source, TicketTemplate } from '../services/api';
import { Plus, Trash2, BookmarkPlus, BookmarkCheck } from 'lucide-react';
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

const ImportTicket: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sources, setSources] = useState<Source[]>([]);

  useEffect(() => { getSources().then(setSources); }, []);

  // Manual form state
  const [status, setStatus] = useState('NEVYHODNOCENÝ');
  const [ticketType, setTicketType] = useState('SÓLO');
  const [bookmaker, setBookmaker] = useState<string | null>(null);
  const [sourceId, setSourceId] = useState<number | null>(null);
  const [stake, setStake] = useState('');
  const [totalOdds, setTotalOdds] = useState('');
  const [possibleWin, setPossibleWin] = useState('');
  const [actualWin, setActualWin] = useState('');
  const [note, setNote] = useState('');
  const [createdAt, setCreatedAt] = useState(() => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  });
  const [bets, setBets] = useState<BetIn[]>([emptyBet()]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [templates, setTemplates] = useState<TicketTemplate[]>([]);
  const [templateName, setTemplateName] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);
  const [templateSaving, setTemplateSaving] = useState(false);

  useEffect(() => { getTemplates().then(setTemplates); }, []);

  const handleSaveTemplate = async () => {
    const name = templateName.trim() || `Šablona ${templates.length + 1}`;
    setTemplateSaving(true);
    try {
      const saved = await createTemplate({
        name,
        ticket_type: ticketType,
        bookmaker: bookmaker || null,
        source_id: sourceId,
        stake: stake ? parseFloat(stake) : null,
        bets,
      });
      setTemplates(prev => [...prev, saved]);
      setTemplateName('');
      setShowTemplates(false);
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Chyba při ukládání šablony.');
    } finally {
      setTemplateSaving(false);
    }
  };

  const handleLoadTemplate = (tpl: TicketTemplate) => {
    if (tpl.ticket_type) setTicketType(tpl.ticket_type);
    setBookmaker(tpl.bookmaker);
    setSourceId(tpl.source_id);
    setStake(tpl.stake != null ? String(tpl.stake) : '');
    setBets(tpl.bets.length > 0 ? tpl.bets.map(b => ({ ...b })) : [emptyBet()]);
    setShowTemplates(false);
  };

  const handleDeleteTemplate = async (id: number) => {
    await deleteTemplate(id);
    setTemplates(prev => prev.filter(t => t.id !== id));
  };

  useEffect(() => {
    const s = parseFloat(stake);
    const o = parseFloat(totalOdds);
    if (s > 0 && o > 0) {
      const pw = Math.round(s * o * 100) / 100;
      setPossibleWin(String(pw));
      if (status === 'VÝHERNÍ') {
        setActualWin(String(pw));
      } else if (status === 'PROHRÁVAJÍCÍ' || status === 'STORNOVANÝ') {
        setActualWin('0');
      }
    } else {
      setPossibleWin('');
      setActualWin('');
    }
  }, [stake, totalOdds, status]);

  const handleManualSave = async () => {
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
    setLoading(true); setError(null);
    try {
      await createTicket({
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
      navigate('/tickets');
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Chyba při ukládání.');
    } finally {
      setLoading(false);
    }
  };

  const updateBet = (i: number, field: keyof BetIn, value: string | number) => {
    setBets(prev => prev.map((b, idx) => idx === i ? { ...b, [field]: value } : b));
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Přidat tiket</h1>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}

      <div className="flex flex-col gap-4">

        {/* Templates panel */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">Šablony</h3>
            <button onClick={() => setShowTemplates(v => !v)} className="text-xs text-blue-600 hover:underline">
              {showTemplates ? 'Skrýt' : `Zobrazit (${templates.length})`}
            </button>
          </div>

          {showTemplates && (
            <div className="flex flex-col gap-2 mb-3">
              {templates.length === 0 && <p className="text-xs text-gray-400">Zatím žádné šablony. Uložte aktuální formulář jako šablonu.</p>}
              {templates.map(tpl => (
                <div key={tpl.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                  <button onClick={() => handleLoadTemplate(tpl)} className="flex items-center gap-2 text-sm text-blue-700 hover:text-blue-900 font-medium">
                    <BookmarkCheck size={14} /> {tpl.name}
                  </button>
                  <button onClick={() => handleDeleteTemplate(tpl.id)} className="text-gray-400 hover:text-red-500 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <input
              type="text"
              value={templateName}
              onChange={e => setTemplateName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSaveTemplate()}
              placeholder="Název šablony..."
              className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button onClick={handleSaveTemplate} disabled={templateSaving} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50">
              <BookmarkPlus size={14} /> {templateSaving ? 'Ukládám...' : 'Uložit jako šablonu'}
            </button>
          </div>
        </div>

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
              <input type="number" value={possibleWin} onChange={e => setPossibleWin(e.target.value)} placeholder="18.50" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-blue-50" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Skutečná výhra (Kč)</label>
              <input type="number" value={actualWin} onChange={e => setActualWin(e.target.value)} placeholder="0" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-blue-50" />
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
                      <input value={b.match_name} onChange={e => { updateBet(i, 'match_name', e.target.value); setFieldErrors(p => ({ ...p, [`bet_name_${i}`]: '' })); }} placeholder="Stockport - Port Vale" className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white ${fieldErrors[`bet_name_${i}`] ? 'border-red-400' : 'border-gray-200'}`} />
                      {fieldErrors[`bet_name_${i}`] && <p className="text-xs text-red-500 mt-0.5">{fieldErrors[`bet_name_${i}`]}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Liga / soutěž</label>
                      <input value={b.league || ''} onChange={e => updateBet(i, 'league', e.target.value)} placeholder="Premier League" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Datum a čas</label>
                      <input type="datetime-local" value={b.match_datetime || ''} onChange={e => updateBet(i, 'match_datetime', e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Tip (sázka) *</label>
                      <input value={b.tip} onChange={e => { updateBet(i, 'tip', e.target.value); setFieldErrors(p => ({ ...p, [`bet_tip_${i}`]: '' })); }} placeholder="Stockport" className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white ${fieldErrors[`bet_tip_${i}`] ? 'border-red-400' : 'border-gray-200'}`} />
                      {fieldErrors[`bet_tip_${i}`] && <p className="text-xs text-red-500 mt-0.5">{fieldErrors[`bet_tip_${i}`]}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Kurz *</label>
                      <input type="number" step="0.01" value={b.odds || ''} onChange={e => { updateBet(i, 'odds', parseFloat(e.target.value)); setFieldErrors(p => ({ ...p, [`bet_odds_${i}`]: '' })); }} placeholder="1.30" className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white ${fieldErrors[`bet_odds_${i}`] ? 'border-red-400' : 'border-gray-200'}`} />
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

          <button onClick={handleManualSave} disabled={loading} className="self-start bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {loading ? 'Ukládám...' : 'Uložit tiket'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportTicket;

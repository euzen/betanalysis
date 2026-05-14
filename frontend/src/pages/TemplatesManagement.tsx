import React, { useEffect, useState } from 'react';
import { getTemplates, createTemplate, updateTemplate, deleteTemplate, getSources, TicketTemplate, TicketTemplateIn, BetIn, Source } from '../services/api';
import { Plus, Trash2, Pencil, X, BookmarkCheck, ChevronDown, ChevronUp } from 'lucide-react';
import BookmakerBadge from '../components/BookmakerBadge';
import { useToast } from '../context/ToastContext';

const emptyBet = (): BetIn => ({ match_name: '', league: '', match_datetime: '', tip: '', odds: 0, result: 'NEVYHODNOCENO', score: '' });

const BOOKMAKERS = ['Tipsport', 'Fortuna', 'SazkaBet', 'Betano', 'Ostatní'];

interface FormState {
  name: string;
  ticket_type: string;
  bookmaker: string;
  source_id: number | null;
  stake: string;
  bets: BetIn[];
}

const defaultForm = (): FormState => ({
  name: '',
  ticket_type: 'SÓLO',
  bookmaker: '',
  source_id: null,
  stake: '',
  bets: [emptyBet()],
});

const TemplatesManagement: React.FC = () => {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<TicketTemplate[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(defaultForm());
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    Promise.all([getTemplates(), getSources()]).then(([t, s]) => {
      setTemplates(t); setSources(s); setLoading(false);
    });
  }, []);

  const openNew = () => {
    setEditingId(null);
    setForm(defaultForm());
    setErrors({});
    setShowForm(true);
  };

  const openEdit = (tpl: TicketTemplate) => {
    setEditingId(tpl.id);
    setForm({
      name: tpl.name,
      ticket_type: tpl.ticket_type || 'SÓLO',
      bookmaker: tpl.bookmaker || '',
      source_id: tpl.source_id,
      stake: tpl.stake != null ? String(tpl.stake) : '',
      bets: tpl.bets.length > 0 ? tpl.bets.map(b => ({ ...b })) : [emptyBet()],
    });
    setErrors({});
    setShowForm(true);
    setExpandedId(null);
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = 'Název šablony je povinný.';
    form.bets.forEach((b, i) => {
      if (!b.match_name.trim()) errs[`bet_name_${i}`] = 'Vyplňte název zápasu.';
      if (!b.tip.trim()) errs[`bet_tip_${i}`] = 'Vyplňte tip.';
      if (b.odds <= 0) errs[`bet_odds_${i}`] = 'Kurz musí být > 0.';
    });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    const payload: TicketTemplateIn = {
      name: form.name.trim(),
      ticket_type: form.ticket_type || null,
      bookmaker: form.bookmaker || null,
      source_id: form.source_id,
      stake: form.stake ? parseFloat(form.stake) : null,
      bets: form.bets,
    };
    try {
      if (editingId != null) {
        const updated = await updateTemplate(editingId, payload);
        setTemplates(prev => prev.map(t => t.id === editingId ? updated : t));
        toast('Šablona aktualizována.');
      } else {
        const created = await createTemplate(payload);
        setTemplates(prev => [...prev, created]);
        toast('Šablona uložena.');
      }
      setShowForm(false);
      setEditingId(null);
    } catch (e: any) {
      setErrors({ name: e.response?.data?.detail || 'Chyba při ukládání.' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Opravdu smazat šablonu?')) return;
    await deleteTemplate(id);
    setTemplates(prev => prev.filter(t => t.id !== id));
    toast('Šablona smazána.', 'info');
  };

  const updateBet = (i: number, field: keyof BetIn, value: string | number) => {
    setForm(prev => ({ ...prev, bets: prev.bets.map((b, idx) => idx === i ? { ...b, [field]: value } : b) }));
  };

  if (loading) return <div className="text-gray-400 py-20 text-center">Načítám...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Šablony tiketů</h1>
        <button onClick={openNew} className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
          <Plus size={16} /> Nová šablona
        </button>
      </div>

      {/* Form panel */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-800">{editingId != null ? 'Upravit šablonu' : 'Nová šablona'}</h2>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">Název šablony *</label>
              <input
                value={form.name}
                onChange={e => { setForm(p => ({ ...p, name: e.target.value })); setErrors(p => ({ ...p, name: '' })); }}
                placeholder="Např. Víkendový AKU"
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.name ? 'border-red-400' : 'border-gray-200'}`}
              />
              {errors.name && <p className="text-xs text-red-500 mt-0.5">{errors.name}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Typ tiketu</label>
              <select value={form.ticket_type} onChange={e => setForm(p => ({ ...p, ticket_type: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option>SÓLO</option><option>AKU</option><option>SYSTÉM</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Sázková kancelář</label>
              <select value={form.bookmaker} onChange={e => setForm(p => ({ ...p, bookmaker: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">— Nepřiřazeno —</option>
                {BOOKMAKERS.map(b => <option key={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Zdroj</label>
              <select value={form.source_id ?? ''} onChange={e => setForm(p => ({ ...p, source_id: e.target.value ? Number(e.target.value) : null }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">— Nepřiřazeno —</option>
                {sources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Výchozí vklad (Kč)</label>
              <input type="number" value={form.stake} onChange={e => setForm(p => ({ ...p, stake: e.target.value }))} placeholder="100" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          {/* Bets */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-700">Výchozí sázky</h3>
              <button onClick={() => setForm(p => ({ ...p, bets: [...p.bets, emptyBet()] }))} className="flex items-center gap-1 text-blue-600 text-sm hover:text-blue-800">
                <Plus size={14} /> Přidat sázku
              </button>
            </div>
            <div className="flex flex-col gap-3">
              {form.bets.map((b, i) => (
                <div key={i} className="border border-gray-100 rounded-lg p-3 bg-gray-50 relative">
                  {form.bets.length > 1 && (
                    <button onClick={() => setForm(p => ({ ...p, bets: p.bets.filter((_, idx) => idx !== i) }))} className="absolute top-2 right-2 text-red-400 hover:text-red-600">
                      <Trash2 size={14} />
                    </button>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="sm:col-span-3">
                      <label className="block text-xs font-medium text-gray-500 mb-1">Název zápasu *</label>
                      <input value={b.match_name} onChange={e => { updateBet(i, 'match_name', e.target.value); setErrors(p => ({ ...p, [`bet_name_${i}`]: '' })); }} placeholder="Stockport - Port Vale" className={`w-full border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white ${errors[`bet_name_${i}`] ? 'border-red-400' : 'border-gray-200'}`} />
                      {errors[`bet_name_${i}`] && <p className="text-xs text-red-500 mt-0.5">{errors[`bet_name_${i}`]}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Tip *</label>
                      <input value={b.tip} onChange={e => { updateBet(i, 'tip', e.target.value); setErrors(p => ({ ...p, [`bet_tip_${i}`]: '' })); }} placeholder="1X2" className={`w-full border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white ${errors[`bet_tip_${i}`] ? 'border-red-400' : 'border-gray-200'}`} />
                      {errors[`bet_tip_${i}`] && <p className="text-xs text-red-500 mt-0.5">{errors[`bet_tip_${i}`]}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Kurz *</label>
                      <input type="number" step="0.01" value={b.odds || ''} onChange={e => { updateBet(i, 'odds', parseFloat(e.target.value)); setErrors(p => ({ ...p, [`bet_odds_${i}`]: '' })); }} placeholder="1.50" className={`w-full border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white ${errors[`bet_odds_${i}`] ? 'border-red-400' : 'border-gray-200'}`} />
                      {errors[`bet_odds_${i}`] && <p className="text-xs text-red-500 mt-0.5">{errors[`bet_odds_${i}`]}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Liga</label>
                      <input value={b.league || ''} onChange={e => updateBet(i, 'league', e.target.value)} placeholder="Premier League" className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving} className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {saving ? 'Ukládám...' : editingId != null ? 'Uložit změny' : 'Vytvořit šablonu'}
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors">
              Zrušit
            </button>
          </div>
        </div>
      )}

      {/* Templates list */}
      {templates.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <BookmarkCheck size={40} className="mx-auto mb-3 opacity-30" />
          <p>Žádné šablony. Vytvořte první šablonu výše.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {templates.map(tpl => (
            <div key={tpl.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3 min-w-0">
                  <BookmarkCheck size={18} className="text-blue-500 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{tpl.name}</p>
                    <div className="flex items-center gap-2 flex-wrap mt-0.5">
                      <span className="text-xs text-gray-400">{tpl.ticket_type}</span>
                      {tpl.bookmaker && <BookmakerBadge bookmaker={tpl.bookmaker} />}
                      {tpl.source_name && <span className="text-xs bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded-full font-medium">{tpl.source_name}</span>}
                      {tpl.stake != null && <span className="text-xs text-gray-400">Vklad: {tpl.stake} Kč</span>}
                      <span className="text-xs text-gray-300">{tpl.bets.length} {tpl.bets.length === 1 ? 'sázka' : tpl.bets.length < 5 ? 'sázky' : 'sázek'}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => setExpandedId(expandedId === tpl.id ? null : tpl.id)} className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors" title="Detail">
                    {expandedId === tpl.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                  <button onClick={() => openEdit(tpl)} className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors" title="Upravit">
                    <Pencil size={16} />
                  </button>
                  <button onClick={() => handleDelete(tpl.id)} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors" title="Smazat">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* Expandable bets */}
              {expandedId === tpl.id && tpl.bets.length > 0 && (
                <div className="border-t border-gray-100 px-5 py-3 bg-gray-50">
                  <div className="flex flex-col gap-1.5">
                    {tpl.bets.map((b, i) => (
                      <div key={i} className="flex items-center justify-between text-xs text-gray-500 bg-white rounded px-3 py-2 border border-gray-100">
                        <span className="font-medium text-gray-700">{b.match_name}</span>
                        <div className="flex items-center gap-3">
                          {b.league && <span className="text-gray-400">{b.league}</span>}
                          <span>{b.tip}</span>
                          <span className="font-semibold text-gray-800">{Number(b.odds).toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TemplatesManagement;

import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import { getSources, createSource, updateSource, deleteSource, Source } from '../services/api';

export default function SourcesManagement() {
  const [sources, setSources] = useState<Source[]>([]);
  const [newName, setNewName] = useState('');
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = () => getSources().then(setSources).catch(() => setError('Nepodařilo se načíst zdroje'));

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      await createSource(newName.trim());
      setNewName('');
      setError(null);
      load();
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Chyba při vytváření zdroje');
    }
  };

  const handleUpdate = async (id: number) => {
    if (!editName.trim()) return;
    try {
      await updateSource(id, editName.trim());
      setEditId(null);
      setEditName('');
      setError(null);
      load();
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Chyba při ukládání');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Smazat tento zdroj?')) return;
    try {
      await deleteSource(id);
      load();
    } catch {
      setError('Chyba při mazání zdroje');
    }
  };

  return (
    <div className="max-w-lg mx-auto p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Správa zdrojů</h1>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
      )}

      {/* Add new */}
      <div className="flex gap-2 mb-6">
        <input
          type="text"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleCreate()}
          placeholder="Název nového zdroje..."
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleCreate}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} />
          Přidat
        </button>
      </div>

      {/* List */}
      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {sources.length === 0 && (
          <p className="text-sm text-gray-400 px-4 py-6 text-center">Zatím žádné zdroje</p>
        )}
        {sources.map(src => (
          <div key={src.id} className="flex items-center gap-3 px-4 py-3">
            {editId === src.id ? (
              <>
                <input
                  autoFocus
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleUpdate(src.id); if (e.key === 'Escape') setEditId(null); }}
                  className="flex-1 border border-blue-400 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button onClick={() => handleUpdate(src.id)} className="text-green-600 hover:text-green-700 p-1"><Check size={16} /></button>
                <button onClick={() => setEditId(null)} className="text-gray-400 hover:text-gray-600 p-1"><X size={16} /></button>
              </>
            ) : (
              <>
                <span className="flex-1 text-sm text-gray-800">{src.name}</span>
                <button onClick={() => { setEditId(src.id); setEditName(src.name); }} className="text-gray-400 hover:text-blue-600 p-1 transition-colors"><Pencil size={15} /></button>
                <button onClick={() => handleDelete(src.id)} className="text-gray-400 hover:text-red-600 p-1 transition-colors"><Trash2 size={15} /></button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

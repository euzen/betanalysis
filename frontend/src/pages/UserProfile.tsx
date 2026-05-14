import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getPublicProfile, PublicProfile } from '../services/api';
import { TrendingUp, Trophy, Target, BarChart2, ExternalLink, XCircle } from 'lucide-react';

const STATUS_COLOR: Record<string, string> = {
  'VÝHERNÍ': 'bg-green-100 text-green-700',
  'PROHRÁVAJÍCÍ': 'bg-red-100 text-red-700',
  'NEVYHODNOCENÝ': 'bg-yellow-100 text-yellow-700',
  'STORNOVANÝ': 'bg-gray-100 text-gray-500',
};

export default function UserProfile() {
  const { username } = useParams<{ username: string }>();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<'not_found' | 'private' | null>(null);

  useEffect(() => {
    if (!username) return;
    getPublicProfile(username)
      .then(p => { setProfile(p); setLoading(false); })
      .catch((err: any) => {
        setError(err?.response?.status === 403 ? 'private' : 'not_found');
        setLoading(false);
      });
  }, [username]);

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">Načítám...</div>
  );

  if (error || !profile) return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4 text-center p-4">
      <XCircle size={48} className={error === 'private' ? 'text-gray-400' : 'text-red-400'} />
      <h1 className="text-xl font-bold text-gray-800">
        {error === 'private' ? 'Profil je skrytý' : 'Uživatel nenalezen'}
      </h1>
      <p className="text-sm text-gray-500">
        {error === 'private' ? 'Tento uživatel má profil nastaven jako soukromý.' : 'Uživatel s tímto jménem neexistuje.'}
      </p>
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
        {/* Profile header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-14 h-14 rounded-full bg-blue-600 flex items-center justify-center text-white text-2xl font-bold">
            {profile.username[0].toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{profile.username}</h1>
            <p className="text-sm text-gray-500">{profile.total_tickets} tiketů celkem</p>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <div className="flex justify-center mb-1"><Trophy size={18} className="text-yellow-500" /></div>
            <p className="text-2xl font-bold text-gray-900">{profile.winrate}%</p>
            <p className="text-xs text-gray-400 mt-0.5">Úspěšnost</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <div className="flex justify-center mb-1"><Target size={18} className="text-blue-500" /></div>
            <p className="text-2xl font-bold text-gray-900">{profile.won}/{profile.evaluated}</p>
            <p className="text-xs text-gray-400 mt-0.5">Výhry/vyhodnoceno</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <div className="flex justify-center mb-1"><BarChart2 size={18} className="text-purple-500" /></div>
            <p className="text-2xl font-bold text-gray-900">{profile.roi}%</p>
            <p className="text-xs text-gray-400 mt-0.5">ROI</p>
          </div>
          <div className={`bg-white rounded-xl border border-gray-200 p-4 text-center`}>
            <div className="flex justify-center mb-1">
              <TrendingUp size={18} className={profile.profit >= 0 ? 'text-green-500' : 'text-red-500'} />
            </div>
            <p className={`text-2xl font-bold ${profile.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {profile.profit >= 0 ? '+' : ''}{profile.profit.toFixed(0)} Kč
            </p>
            <p className="text-xs text-gray-400 mt-0.5">Zisk/ztráta</p>
          </div>
        </div>

        {/* Shared tickets */}
        {profile.shared_tickets.length > 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <h2 className="font-semibold text-gray-800 text-sm">Sdílené tikety ({profile.shared_tickets.length})</h2>
            </div>
            <div className="divide-y divide-gray-50">
              {profile.shared_tickets.map(t => (
                <a
                  key={t.share_token}
                  href={`/share/${t.share_token}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLOR[t.status] || 'bg-gray-100 text-gray-500'}`}>
                        {t.status}
                      </span>
                      <span className="text-xs text-gray-400">{t.ticket_type}</span>
                    </div>
                    <p className="text-xs text-gray-400">
                      {new Date(t.created_at).toLocaleDateString('cs-CZ')} · {t.bets_count} sázek
                      {t.total_odds ? ` · kurz ${t.total_odds.toFixed(2)}` : ''}
                      {t.stake ? ` · vklad ${t.stake} Kč` : ''}
                    </p>
                  </div>
                  <ExternalLink size={14} className="text-gray-400" />
                </a>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-gray-400 text-sm">
            Tento uživatel zatím nesdílí žádné tikety.
          </div>
        )}

        <p className="text-center text-xs text-gray-400 mt-8">
          BetAnalysis · <Link to="/login" className="text-blue-500 hover:underline">Vyzkoušet zdarma</Link>
        </p>
      </main>
    </div>
  );
}

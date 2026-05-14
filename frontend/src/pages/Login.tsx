import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authLogin, authRegister, migrateExistingData } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { TrendingUp, Eye, EyeOff } from 'lucide-react';

export default function Login() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === 'login') {
        const res = await authLogin(username, password);
        login(res.access_token, { id: res.user_id, username: res.username, email: res.email }, res.refresh_token);
        toast('Přihlášení úspěšné', 'success');
        navigate('/');
      } else {
        const res = await authRegister(email, username, password);
        login(res.access_token, { id: res.user_id, username: res.username, email: res.email }, res.refresh_token);
        await migrateExistingData().catch(() => {});
        toast('Účet vytvořen', 'success');
        navigate('/');
      }
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Chyba přihlášení';
      toast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full max-w-md p-8">
        {/* Logo */}
        <div className="flex items-center gap-2 justify-center mb-8">
          <div className="p-2 bg-blue-600 rounded-xl">
            <TrendingUp size={22} className="text-white" />
          </div>
          <span className="text-xl font-bold text-gray-900">BetAnalysis</span>
        </div>

        {/* Tabs */}
        <div className="flex rounded-lg bg-gray-100 p-1 mb-6">
          <button
            onClick={() => setMode('login')}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${mode === 'login' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Přihlásit se
          </button>
          <button
            onClick={() => setMode('register')}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${mode === 'register' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Registrace
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {mode === 'register' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="vas@email.cz"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {mode === 'login' ? 'Email nebo uživatelské jméno' : 'Uživatelské jméno'}
            </label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              placeholder={mode === 'login' ? 'email nebo jméno' : 'vaše_jmeno'}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Heslo</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="••••••••"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {mode === 'register' && (
              <p className="text-xs text-gray-400 mt-1">Minimálně 6 znaků</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors mt-2"
          >
            {loading ? 'Načítám...' : mode === 'login' ? 'Přihlásit se' : 'Vytvořit účet'}
          </button>
        </form>
      </div>
    </div>
  );
}

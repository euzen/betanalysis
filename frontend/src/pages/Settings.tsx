import React, { useRef, useState } from 'react';
import { exportJson, importJson, changePassword, changeUsername, setPublicProfile } from '../services/api';
import axios from 'axios';
import { Download, Upload, AlertTriangle, CheckCircle, User, Lock, ExternalLink } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';

const Settings: React.FC = () => {
  const { toast } = useToast();
  const { user, login } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null);

  const [isPublic, setIsPublic] = useState<boolean>(true);
  const [publicLoading, setPublicLoading] = useState(false);

  React.useEffect(() => {
    axios.get('/api/auth/me').then(r => setIsPublic(r.data.is_public)).catch(() => {});
  }, []);

  const handleTogglePublic = async (val: boolean) => {
    setPublicLoading(true);
    try {
      await setPublicProfile(val);
      setIsPublic(val);
      toast(val ? 'Veřejný profil zapnut' : 'Veřejný profil skryt', 'success');
    } catch {
      toast('Chyba při ukládání', 'error');
    } finally {
      setPublicLoading(false);
    }
  };

  const [newUsername, setNewUsername] = useState('');
  const [usernameLoading, setUsernameLoading] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  const handleChangeUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim()) return;
    setUsernameLoading(true);
    try {
      const res = await changeUsername(newUsername.trim());
      login(res.access_token, { id: res.user_id, username: res.username, email: res.email });
      setNewUsername('');
      toast('Uživatelské jméno změněno', 'success');
    } catch (err: any) {
      toast(err?.response?.data?.detail || 'Chyba při změně jména', 'error');
    } finally {
      setUsernameLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordLoading(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      toast('Heslo bylo změněno', 'success');
    } catch (err: any) {
      toast(err?.response?.data?.detail || 'Chyba při změně hesla', 'error');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const data = await exportJson();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const date = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `bet_backup_${date}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast(`Záloha exportována (${data.tickets?.length ?? 0} tiketů).`);
    } catch {
      toast('Chyba při exportu.', 'error');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportResult(null);
    setImporting(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const tickets = Array.isArray(parsed) ? parsed : parsed.tickets;
      if (!Array.isArray(tickets)) throw new Error('Neplatný formát souboru.');
      const result = await importJson(tickets);
      setImportResult(result);
      toast(`Import dokončen: ${result.imported} tiketů přidáno.`);
    } catch (e: any) {
      toast(e.message || 'Chyba při importu.', 'error');
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Nastavení</h1>

      {/* Account section */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4">
        <h2 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2"><User size={16} /> Účet</h2>
        <p className="text-sm text-gray-500 mb-4">Přihlášen jako <span className="font-semibold text-gray-800">{user?.username}</span> ({user?.email})</p>

        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg mb-3">
          <div>
            <p className="text-sm font-medium text-gray-800">Veřejný profil</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {isPublic ? 'Váš profil je viditelný pro ostatní.' : 'Váš profil je skrytý – nikdo ho nemůže zobrazit.'}
            </p>
          </div>
          <button
            onClick={() => handleTogglePublic(!isPublic)}
            disabled={publicLoading}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${isPublic ? 'bg-blue-600' : 'bg-gray-300'}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isPublic ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>

        {isPublic && (
          <a
            href={`/u/${user?.username}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline"
          >
            <ExternalLink size={13} /> Zobrazit veřejný profil
          </a>
        )}
      </div>

      {/* Change username */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4">
        <h2 className="text-base font-semibold text-gray-800 mb-1">Změna uživatelského jména</h2>
        <p className="text-sm text-gray-500 mb-4">Aktuální: <span className="font-medium">{user?.username}</span></p>
        <form onSubmit={handleChangeUsername} className="flex gap-2">
          <input
            type="text"
            value={newUsername}
            onChange={e => setNewUsername(e.target.value)}
            placeholder="Nové uživatelské jméno"
            minLength={3}
            required
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={usernameLoading}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {usernameLoading ? 'Ukládám...' : 'Uložit'}
          </button>
        </form>
      </div>

      {/* Change password */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4">
        <h2 className="text-base font-semibold text-gray-800 mb-1 flex items-center gap-2"><Lock size={16} /> Změna hesla</h2>
        <p className="text-sm text-gray-500 mb-4">Zadejte současné heslo a zvolte nové.</p>
        <form onSubmit={handleChangePassword} className="flex flex-col gap-3 max-w-sm">
          <input
            type="password"
            value={currentPassword}
            onChange={e => setCurrentPassword(e.target.value)}
            placeholder="Současné heslo"
            required
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="password"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            placeholder="Nové heslo (min. 6 znaků)"
            minLength={6}
            required
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={passwordLoading}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors w-fit"
          >
            {passwordLoading ? 'Ukládám...' : 'Změnit heslo'}
          </button>
        </form>
      </div>

      {/* Backup section */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4">
        <h2 className="text-base font-semibold text-gray-800 mb-1">Záloha dat</h2>
        <p className="text-sm text-gray-500 mb-4">Exportuje všechny tikety do JSON souboru. Soubor lze použít pro obnovení dat nebo přenos na jiné zařízení.</p>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Download size={16} /> Exportovat zálohu (JSON)
        </button>
      </div>

      {/* Restore section */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-800 mb-1">Obnovení dat</h2>
        <p className="text-sm text-gray-500 mb-1">Importuje tikety ze zálohovacího JSON souboru. Tikety jsou přidány k existujícím datům (merge).</p>
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
          <AlertTriangle size={15} className="text-amber-500 shrink-0" />
          <p className="text-xs text-amber-700">Import duplikuje tikety – neodstraňuje existující záznamy.</p>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept=".json"
          onChange={handleFileChange}
          className="hidden"
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={importing}
          className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          <Upload size={16} /> {importing ? 'Importuji...' : 'Vybrat soubor a importovat'}
        </button>

        {importResult && (
          <div className={`mt-4 flex items-start gap-3 p-4 rounded-lg border ${importResult.errors.length > 0 ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200'}`}>
            <CheckCircle size={18} className={importResult.errors.length > 0 ? 'text-yellow-500 shrink-0 mt-0.5' : 'text-green-500 shrink-0 mt-0.5'} />
            <div>
              <p className="text-sm font-semibold text-gray-800">
                Importováno: {importResult.imported} tiketů
                {importResult.skipped > 0 && `, přeskočeno: ${importResult.skipped}`}
              </p>
              {importResult.errors.length > 0 && (
                <ul className="mt-1 text-xs text-yellow-700 list-disc list-inside">
                  {importResult.errors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Settings;

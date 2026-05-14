import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Ticket, PlusCircle, BookOpen, BarChart2, Sun, Moon, Bookmark, Settings, LogOut, User, ShieldCheck, Megaphone, X as XIcon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { getPublicSettings } from '../services/api';

const nav = [
  { name: 'Přehled', href: '/', icon: LayoutDashboard },
  { name: 'Tikety', href: '/tickets', icon: Ticket },
  { name: 'Přidat', href: '/import', icon: PlusCircle },
  { name: 'Reporting', href: '/reporting', icon: BarChart2 },
  { name: 'Šablony', href: '/templates', icon: Bookmark },
  { name: 'Zdroje', href: '/sources', icon: BookOpen },
  { name: 'Nastavení', href: '/settings', icon: Settings },
];

const mobileNav = nav.slice(0, 5);

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const { theme, toggle } = useTheme();
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [announcement, setAnnouncement] = useState('');
  const [announcementDismissed, setAnnouncementDismissed] = useState(false);

  useEffect(() => {
    getPublicSettings().then(s => setAnnouncement(s.announcement)).catch(() => {});
  }, []);

  const handleLogout = () => { logout(); navigate('/login'); };

  const isActive = (href: string) =>
    href === '/' ? location.pathname === '/' : location.pathname.startsWith(href);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-56 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 p-4 gap-1 shrink-0 sticky top-0 h-screen overflow-y-auto">
        <div className="text-lg font-bold text-gray-900 dark:text-white mb-4 px-2">🎯 Bet Tracker</div>
        {nav.map(item => (
          <Link
            key={item.href}
            to={item.href}
            className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              isActive(item.href)
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            <item.icon size={18} />
            {item.name}
          </Link>
        ))}
        <div className="mt-auto pt-4 flex flex-col gap-1">
          {isAdmin && (
            <Link
              to="/admin"
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive('/admin')
                  ? 'bg-purple-600 text-white'
                  : 'text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20'
              }`}
            >
              <ShieldCheck size={18} />
              Administrace
            </Link>
          )}
          {user && (
            <div className="flex items-center gap-2 px-4 py-2 text-xs text-gray-400 dark:text-gray-500">
              <User size={14} />
              <span className="truncate">{user.username}</span>
            </div>
          )}
          <button
            onClick={toggle}
            className="flex items-center gap-2 px-4 py-2.5 w-full rounded-lg text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            {theme === 'dark' ? 'Světlý režim' : 'Tmavý režim'}
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2.5 w-full rounded-lg text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <LogOut size={18} /> Odhlásit se
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile topbar */}
        <header className="lg:hidden flex items-center justify-between bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3">
          <span className="font-bold text-gray-900 dark:text-white">🎯 Bet Tracker</span>
          <button onClick={toggle} className="text-gray-500 dark:text-gray-400 p-1">
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </header>

        {announcement && !announcementDismissed && (
          <div className="bg-blue-600 text-white px-4 py-2.5 flex items-center gap-3">
            <Megaphone size={15} className="shrink-0" />
            <span className="text-sm flex-1">{announcement}</span>
            <button onClick={() => setAnnouncementDismissed(true)} className="text-white/70 hover:text-white shrink-0"><XIcon size={15} /></button>
          </div>
        )}
        <main className="flex-1 p-4 lg:p-8 max-w-7xl mx-auto w-full pb-24 lg:pb-8">
          {children}
        </main>

        {/* Mobile bottom nav */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 z-30 flex">
          {mobileNav.map(item => (
            <Link
              key={item.href}
              to={item.href}
              className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs font-medium transition-colors ${
                isActive(item.href) ? 'text-blue-500' : 'text-gray-400 dark:text-gray-500'
              }`}
            >
              <item.icon size={20} strokeWidth={isActive(item.href) ? 2.5 : 1.8} />
              <span className="text-[10px]">{item.name}</span>
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
};

export default Layout;

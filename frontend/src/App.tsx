import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import TicketList from './pages/TicketList';
import TicketDetail from './pages/TicketDetail';
import ImportTicket from './pages/ImportTicket';
import EditTicket from './pages/EditTicket';
import SourcesManagement from './pages/SourcesManagement';
import Reporting from './pages/Reporting';
import TemplatesManagement from './pages/TemplatesManagement';
import Settings from './pages/Settings';
import Admin from './pages/Admin';
import Login from './pages/Login';
import SharedTicket from './pages/SharedTicket';
import UserProfile from './pages/UserProfile';
import { useAuth } from './context/AuthContext';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Načítám...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, isLoading } = useAuth();
  if (isLoading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Načítám...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/share/:token" element={<SharedTicket />} />
      <Route path="/u/:username" element={<UserProfile />} />
      <Route path="/*" element={
        <ProtectedRoute>
          <Layout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/tickets" element={<TicketList />} />
              <Route path="/tickets/:id" element={<TicketDetail />} />
              <Route path="/tickets/:id/edit" element={<EditTicket />} />
              <Route path="/import" element={<ImportTicket />} />
              <Route path="/sources" element={<SourcesManagement />} />
              <Route path="/reporting" element={<Reporting />} />
              <Route path="/templates" element={<TemplatesManagement />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
            </Routes>
          </Layout>
        </ProtectedRoute>
      } />
    </Routes>
  );
}

export default App;

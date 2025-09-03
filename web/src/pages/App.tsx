import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Header from '../components/Header';
import API, { setToken } from '../lib/api';
import Login from './Login';
import Register from './Register';
import Dashboard from './Dashboard';
import Settings from './Settings';

type Page = 'login' | 'register' | 'dashboard' | 'settings';

export default function App() {
  const [page, setPage] = useState<Page>('login');
  const [token, setTok] = useState<string | null>(localStorage.getItem('token'));

  useEffect(() => {
    if (token) { setToken(token); setPage('dashboard'); }
  }, [token]);

  const logout = () => { localStorage.removeItem('token'); setTok(null); setToken(); setPage('login'); };

  return (
    <div>
      <Header onLogout={logout} onSettings={() => setPage('settings')} />
      <main className="max-w-5xl mx-auto p-4">
        {page === 'login' && <Login onRegister={() => setPage('register')} onLogged={(t)=>{ localStorage.setItem('token', t); setTok(t); }} />}
        {page === 'register' && <Register onLogin={() => setPage('login')} />}
        {page === 'dashboard' && token && <Dashboard />}
        {page === 'settings' && token && <Settings onBack={() => setPage('dashboard')} />}
      </main>
    </div>
  );
}

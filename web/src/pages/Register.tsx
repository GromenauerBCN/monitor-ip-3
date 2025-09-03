import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import API from '../lib/api';

export default function Register({ onLogin }: { onLogin: () => void }) {
  const { t } = useTranslation();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [ok, setOk] = useState(false); const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    try {
      await API.post('/api/auth/register', { email, password });
      setOk(true);
    } catch (e: any) { setError(e?.response?.data?.error || 'Error'); }
  };

  return (
    <div className="max-w-md mx-auto mt-8 bg-white rounded-2xl shadow p-6">
      <h2 className="text-xl font-semibold mb-4">{t('register')}</h2>
      {ok ? (
        <div>
          <div className="bg-green-100 text-green-700 p-2 rounded mb-2">Compte creat. Ja pots entrar.</div>
          <button className="underline" onClick={onLogin}>{t('login')}</button>
        </div>
      ) : (
        <>
          {error && <div className="bg-red-100 text-red-700 p-2 rounded mb-2">{error}</div>}
          <form onSubmit={submit} className="space-y-3">
            <input className="w-full border p-2 rounded" placeholder={t('email') as string} value={email} onChange={e=>setEmail(e.target.value)} />
            <input type="password" className="w-full border p-2 rounded" placeholder={t('password') as string} value={password} onChange={e=>setPassword(e.target.value)} />
            <button className="w-full bg-sky-500 text-white py-2 rounded">{t('register')}</button>
          </form>
        </>
      )}
    </div>
  );
}

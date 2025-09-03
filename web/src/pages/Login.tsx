import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import API from '../lib/api';

export default function Login({ onRegister, onLogged }: { onRegister: () => void, onLogged: (token: string) => void }) {
  const { t } = useTranslation();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    try {
      const { data } = await API.post('/api/auth/login', { email, password });
      onLogged(data.token);
    } catch (e: any) { setError(e?.response?.data?.error || 'Error'); }
  };

  return (
    <div className="max-w-md mx-auto mt-8 bg-white rounded-2xl shadow p-6">
      <h2 className="text-xl font-semibold mb-4">{t('login')}</h2>
      {error && <div className="bg-red-100 text-red-700 p-2 rounded mb-2">{error}</div>}
      <form onSubmit={submit} className="space-y-3">
        <input className="w-full border p-2 rounded" placeholder={t('email') as string} value={email} onChange={e=>setEmail(e.target.value)} />
        <input type="password" className="w-full border p-2 rounded" placeholder={t('password') as string} value={password} onChange={e=>setPassword(e.target.value)} />
        <button className="w-full bg-sky-500 text-white py-2 rounded">{t('login')}</button>
      </form>
      <div className="text-sm mt-4">
        <button className="underline" onClick={onRegister}>{t('register')}</button>
      </div>
    </div>
  );
}

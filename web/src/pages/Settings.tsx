import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import API from '../lib/api';

export default function Settings({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const [emails, setEmails] = useState(''); const [daily, setDaily] = useState(true); const [monthly, setMonthly] = useState(true);
  const [token, setToken] = useState<string|undefined>(undefined);

  const load = async () => {
    const { data } = await API.get('/api/notif/settings');
    setEmails((data.emailRecipients||[]).join(','));
    setDaily(!!data.dailyDigest); setMonthly(!!data.monthlyDigest);
  };

  useEffect(()=>{ load(); },[]);

  const save = async () => {
    const emailRecipients = emails.split(',').map((s)=>s.trim()).filter(Boolean);
    await API.put('/api/notif/settings', { emailRecipients, dailyDigest: daily, monthlyDigest: monthly });
    alert('Desat.');
  };

  const genToken = async () => {
    const { data } = await API.post('/api/notif/connect-token');
    setToken(data.token);
  };

  const registerPush = async () => {
    alert('Registra el teu dispositiu a la app mòbil (Expo) i inicia sessió amb el mateix usuari.');
  };

  return (
    <div className="max-w-xl mx-auto bg-white rounded-2xl shadow p-4">
      <button onClick={onBack} className="text-sky-600 underline">← Tornar</button>
      <h2 className="text-lg font-semibold mt-2 mb-4">{t('settings')}</h2>
      <div className="space-y-4">
        <div>
          <div className="font-medium mb-1">{t('emails')}</div>
          <input className="w-full border p-2 rounded" value={emails} onChange={e=>setEmails(e.target.value)} />
          <div className="mt-2 flex items-center gap-4">
            <label><input type="checkbox" checked={daily} onChange={e=>setDaily(e.target.checked)} /> {t('daily')}</label>
            <label><input type="checkbox" checked={monthly} onChange={e=>setMonthly(e.target.checked)} /> {t('monthly')}</label>
          </div>
        </div>
        <div>
          <div className="font-medium mb-1">{t('telegram')}</div>
          <button className="bg-slate-100 px-3 py-1 rounded" onClick={genToken}>{t('generateToken')}</button>
          {token && <div className="mt-2 p-2 bg-slate-100 rounded font-mono">/start {token}</div>}
          <p className="text-sm text-slate-500 mt-2">{t('telegramHelp')}</p>
        </div>
        <div>
          <div className="font-medium mb-1">{t('push')}</div>
          <button className="bg-slate-100 px-3 py-1 rounded" onClick={registerPush}>{t('registerPush')}</button>
        </div>
        <button className="bg-sky-500 text-white px-4 py-2 rounded" onClick={save}>{t('save')}</button>
      </div>
    </div>
  );
}

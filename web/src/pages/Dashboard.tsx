import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import API from '../lib/api';

type Target = {
  id: string;
  label: string;
  kind: 'http' | 'tcp';
  address: string;
  port?: number;
  intervalMinutes: number;
  // opcionalment podries tenir lastCheckedAt/lastStatus al model del frontend
};

type LatestEntry = {
  targetId: string;
  ok: boolean | null;
  latencyMs?: number | null;
  error?: string | null;
  checkedAt?: string | null;
};

export default function Dashboard() {
  const { t } = useTranslation();
  const [targets, setTargets] = useState<Target[]>([]);
  const [label, setLabel] = useState('');
  const [kind, setKind] = useState<'http' | 'tcp'>('http');
  const [address, setAddress] = useState('');
  const [port, setPort] = useState<number | undefined>(undefined);
  const [intervalMinutes, setInterval] = useState(20);
  const [latest, setLatest] = useState<LatestEntry[]>([]);
  const [checkingId, setCheckingId] = useState<string | null>(null);

  const load = async () => {
    const { data } = await API.get('/api/targets');
    setTargets(data);
    const latestRes = await API.get('/api/checks/latest');
    setLatest(latestRes.data);
  };

  useEffect(() => { load(); }, []);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    await API.post('/api/targets', { label, kind, address, port, intervalMinutes });
    setLabel(''); setAddress(''); setPort(undefined); setInterval(20);
    await load();
  };

  const del = async (id: string) => {
    await API.delete('/api/targets/' + id);
    await load();
  };

  // ✅ Nou: actualitza l’UI immediatament amb la resposta del backend (sense reload)
  const check = async (id: string) => {
    try {
      setCheckingId(id);
      const res = await API.post(`/api/targets/${id}/check`);
      const data = res.data as {
        ok: boolean;
        target: { id: string; label: string; lastCheckedAt?: string; lastStatus?: string };
        lastResult: { ok: boolean; latencyMs?: number | null; error?: string | null; checkedAt?: string };
      };

      // Actualitza el target in-place (per si vols mostrar lastStatus/lastCheckedAt en algun lloc)
      setTargets(prev =>
        prev.map(t =>
          t.id === id
            ? { ...t } // si vols, aquí pots afegir lastCheckedAt/lastStatus al tipus Target i al set
            : t
        )
      );

      // Actualitza/insereix l’entrada a "latest" per pintar el punt i info
      setLatest(prev => {
        const next = [...prev];
        const idx = next.findIndex(x => x.targetId === id);
        const entry: LatestEntry = {
          targetId: id,
          ok: data.lastResult?.ok ?? null,
          latencyMs: data.lastResult?.latencyMs ?? null,
          error: data.lastResult?.error ?? null,
          checkedAt: data.lastResult?.checkedAt ?? null
        };
        if (idx >= 0) next[idx] = entry;
        else next.unshift(entry);
        return next;
      });
    } finally {
      setCheckingId(null);
    }
  };

  const uploadCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    const form = new FormData(); form.append('file', f);
    await API.post('/api/targets/csv', form, { headers: { 'Content-Type': 'multipart/form-data' } });
    await load();
  };

  const statusFor = (id: string) => latest.find(x => x.targetId === id);

  return (
    <div>
      <div className="bg-white rounded-2xl shadow p-4 mb-6">
        <h2 className="text-lg font-semibold mb-3">{t('addTarget')}</h2>
        <form onSubmit={add} className="grid grid-cols-1 md:grid-cols-6 gap-2">
          <input className="border p-2 rounded col-span-2" placeholder={t('label') as string} value={label} onChange={e => setLabel(e.target.value)} />
          <select className="border p-2 rounded" value={kind} onChange={e => setKind(e.target.value as any)}>
            <option value="http">{t('http')}</option>
            <option value="tcp">{t('tcp')}</option>
          </select>
          <input className="border p-2 rounded col-span-2" placeholder={t('address') as string} value={address} onChange={e => setAddress(e.target.value)} />
          {kind === 'tcp' && <input className="border p-2 rounded" placeholder={t('port') as string} value={port || ''} onChange={e => setPort(Number(e.target.value) || undefined)} />}
          <input className="border p-2 rounded" type="number" min={1} placeholder={t('interval') as string} value={intervalMinutes} onChange={e => setInterval(Number(e.target.value))} />
          <button className="bg-sky-500 text-white rounded px-4">{t('save')}</button>
        </form>
      </div>

      <div className="bg-white rounded-2xl shadow p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">{t('targets')}</h2>
          <label className="cursor-pointer bg-slate-100 px-3 py-1 rounded">
            {t('csvImport')}: <input type="file" accept=".csv" className="hidden" onChange={uploadCsv} />
          </label>
        </div>
        <div className="divide-y">
          {targets.map(tg => {
            const st = statusFor(tg.id);
            const dotColor = st?.ok === false ? '#ef4444' : st?.ok === true ? '#22c55e' : '#cbd5e1';
            return (
              <div key={tg.id} className="py-3 flex items-center gap-3">
                <div className="w-2 h-2 rounded-full" style={{ background: dotColor }}></div>
                <div className="flex-1">
                  <div className="font-medium">{tg.label}</div>
                  <div className="text-sm text-slate-500">{tg.kind.toUpperCase()} · {tg.address}{tg.port ? ':' + tg.port : ''}</div>
                  <div className="text-xs text-slate-400">
                    {t('lastCheck')}: {st?.checkedAt ? new Date(st.checkedAt).toLocaleString() : '—'} · {t('latency')}: {st?.latencyMs ?? '—'} ms
                    {st?.error ? <> · <span className="text-rose-500">{st.error}</span></> : null}
                  </div>
                </div>
                <button
                  className="px-3 py-1 rounded bg-slate-100 disabled:opacity-60"
                  onClick={() => check(tg.id)}
                  disabled={checkingId === tg.id}
                >
                  {checkingId === tg.id ? t('checking') || 'Comprovant…' : t('checkNow')}
                </button>
                <button className="px-3 py-1 rounded bg-red-500 text-white" onClick={() => del(tg.id)}>{t('delete')}</button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  );
}

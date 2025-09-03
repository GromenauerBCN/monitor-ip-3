import React from 'react';
import { useTranslation } from 'react-i18next';

const LANGS = [
  { code: 'ca', label: 'Català', flag: '🇦🇩' },
  { code: 'gl', label: 'Galego', flag: '🇪🇸' },
  { code: 'eu', label: 'Euskara', flag: '🇪🇸' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'it', label: 'Italiano', flag: '🇮🇹' },
  { code: 'ru', label: 'Русский', flag: '🇷🇺' },
  { code: 'bg', label: 'Български', flag: '🇧🇬' },
  { code: 'ro', label: 'Română', flag: '🇷🇴' },
  { code: 'sr', label: 'Српски', flag: '🇷🇸' },
  { code: 'zh-Hans', label: '简体中文', flag: '🇨🇳' },
  { code: 'ja', label: '日本語', flag: '🇯🇵' },
  { code: 'hi', label: 'हिन्दी', flag: '🇮🇳' },
  { code: 'id', label: 'Indonesia', flag: '🇮🇩' },
  { code: 'ar', label: 'العربية', flag: '🇸🇦' },
  { code: 'sw', label: 'Kiswahili', flag: '🇹🇿' },
  { code: 'tsw', label: 'Taushiro', flag: '🇵🇪' },
  { code: 'mi', label: 'Māori', flag: '🇳🇿' },
  { code: 'qu', label: 'Kichwa', flag: '🇪🇨' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
];

export default function Header({ onLogout, onSettings }: { onLogout: () => void, onSettings: () => void }) {
  const { t, i18n } = useTranslation();
  return (
    <header className="sticky top-0 z-50 bg-slate-900 text-white">
      <div className="max-w-5xl mx-auto flex items-center gap-3 p-3">
        <img src="/icons/radar-64.png" onError={(e:any)=>{e.currentTarget.src='/icons/radar-192.png'}} className="w-8 h-8 rounded" />
        <h1 className="text-xl font-semibold">{t('appTitle')}</h1>
        <div className="ml-auto flex items-center gap-2">
          <select
            className="bg-slate-800 px-2 py-1 rounded"
            value={i18n.language}
            onChange={(e) => { i18n.changeLanguage(e.target.value); localStorage.setItem('lang', e.target.value); }}>
            {LANGS.map(l => <option key={l.code} value={l.code}>{l.flag} {l.label}</option>)}
          </select>
          <button onClick={onSettings} className="bg-sky-500 hover:bg-sky-400 text-slate-900 px-3 py-1 rounded-full">⚙️</button>
          <button onClick={onLogout} className="bg-slate-800 hover:bg-slate-700 px-3 py-1 rounded-full">{t('logout')}</button>
        </div>
      </div>
    </header>
  );
}

'use client';

import { useTranslation } from '@/i18n/context';

export default function LanguageSwitcher() {
  const { lang, setLang, supportedLanguages } = useTranslation();

  return (
    <div className="lang-switcher">
      {supportedLanguages.map((l) => (
        <button
          key={l}
          className={`lang-btn ${lang === l ? 'active' : ''}`}
          onClick={() => setLang(l)}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

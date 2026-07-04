'use client';

import { useState } from 'react';
import { useTranslation } from '@/i18n/context';

export default function DeliveryCard({ items }) {
  const { t } = useTranslation();

  if (!items || items.length === 0) return null;

  return (
    <div style={{ marginTop: '2rem' }}>
      <h2 className="title">{t('deliveryTitle') || 'Your Product Details'}</h2>
      <p className="subtitle" style={{ marginBottom: '1.5rem' }}>
        {t('deliverySubtitle') || 'Please save these credentials securely.'}
      </p>

      {items.map((item, index) => (
        <div key={index} className="card animate-fade-in" style={{ marginBottom: '1rem' }}>
          <h4 style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>
            {t('credentialsLabel') || 'Credentials'} {items.length > 1 ? `#${index + 1}` : ''}
          </h4>

          {item.user && (
            <CredentialRow label={t('usernameLabel') || 'Username/Email'} value={item.user} t={t} />
          )}
          {item.password && (
            <CredentialRow label={t('passwordLabel') || 'Password'} value={item.password} t={t} />
          )}
          {item.otherInfo && (
            <CredentialRow label={t('otherInfoLabel') || 'Other Info'} value={item.otherInfo} t={t} />
          )}
          {item.expiryText && (
            <div style={{ marginTop: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              <strong>{t('expiryLabel') || 'Expiry'}:</strong> {item.expiryText}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function CredentialRow({ label, value, t }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="credential-row">
      <div>
        <div className="credential-label">{label}</div>
        <div className="credential-value">{value}</div>
      </div>
      <button 
        onClick={handleCopy} 
        className={`copy-btn ${copied ? 'copied' : ''}`}
        title="Copy to clipboard"
      >
        {copied ? (t('copiedButton') || 'Copied!') : (t('copyButton') || 'Copy')}
      </button>
    </div>
  );
}

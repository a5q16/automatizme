'use client';

import { useTranslation } from '@/i18n/context';

export default function OrderStatus({ status }) {
  const { t } = useTranslation();

  let badgeClass = 'status-badge ';
  let labelText = '';

  switch (status) {
    case 'processing':
      badgeClass += 'processing';
      labelText = t('statusProcessing') || 'Processing';
      break;
    case 'delivered':
      badgeClass += 'delivered';
      labelText = t('statusDelivered') || 'Delivered';
      break;
    case 'delayed':
    case 'failed':
      badgeClass += 'failed';
      labelText = t('statusFailed') || 'Delayed';
      break;
    default:
      badgeClass += 'processing';
      labelText = t('statusPending') || 'Pending';
      break;
  }

  return (
    <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
      <h3 style={{ margin: 0, fontWeight: 500, fontSize: '1rem', color: 'var(--text-secondary)' }}>
        Status:
      </h3>
      <span className={badgeClass}>{labelText}</span>
    </div>
  );
}

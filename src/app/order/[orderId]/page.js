'use client';

import { useEffect, useState, use } from 'react';
import { useTranslation } from '@/i18n/context';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import LoadingSpinner from '@/components/LoadingSpinner';
import OrderStatus from '@/components/OrderStatus';
import DeliveryCard from '@/components/DeliveryCard';

export default function OrderPage({ params }) {
  // Unwrap params using React.use() to avoid Next.js 15 sync params error
  const unwrappedParams = use(params);
  const orderId = unwrappedParams.orderId;
  
  const { t, dir } = useTranslation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    let pollInterval;

    const fetchOrder = async () => {
      try {
        const res = await fetch(`/api/orders/${orderId}`);
        const json = await res.json();
        
        if (!isMounted) return;

        if (res.ok && json.found) {
          setData(json);
          setError(null);
          
          // Stop polling if delivered or permanently failed
          if (json.status === 'delivered' || json.status === 'delayed' || json.status === 'failed') {
            if (pollInterval) clearInterval(pollInterval);
          }
        } else {
          setError(json.message || 'Order not found');
          if (pollInterval) clearInterval(pollInterval);
        }
      } catch (err) {
        if (!isMounted) return;
        console.error('Failed to fetch order:', err);
        // Don't set error on network fail during polling, just try again next time
        if (!data) {
          setError('Network error. Retrying...');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchOrder();

    // Poll every 5 seconds while processing
    pollInterval = setInterval(fetchOrder, 5000);

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
    };
  }, [orderId, data?.status]);

  if (loading && !data) {
    return (
      <div className="container" dir={dir}>
        <LanguageSwitcher />
        <div style={{ paddingTop: '10vh', textAlign: 'center' }}>
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="container" dir={dir}>
        <LanguageSwitcher />
        <div className="card" style={{ marginTop: '5vh', textAlign: 'center' }}>
          <h2 className="title" style={{ color: 'var(--error-color)' }}>Oops!</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  const isDelivered = data.status === 'delivered';
  const isDelayed = data.status === 'delayed' || data.status === 'failed';
  const isProcessing = data.status === 'processing' || data.status === 'pending_slot';

  return (
    <div className="container animate-fade-in" dir={dir}>
      <LanguageSwitcher />
      
      <div style={{ padding: '2rem 0' }}>
        <h1 className="title" style={{ fontSize: '2rem' }}>
          {t('pageTitle') || 'Order Details'}
        </h1>
        <p className="subtitle" style={{ marginBottom: '2rem' }}>
          {t('pageDescription') || `Invoice #${orderId}`}
          {data.productName && ` • ${data.productName}`}
        </p>

        <OrderStatus status={data.status} />

        {isProcessing && (
          <div className="card" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
            <LoadingSpinner />
            <h3 style={{ marginTop: '1.5rem', marginBottom: '0.5rem' }}>
              {data.isSlotProduct 
                ? (t('processingSlotMessage') || 'Awaiting Seller Processing')
                : (t('processingMessage') || 'Processing Your Order...')}
            </h3>
            <p style={{ color: 'var(--text-secondary)' }}>
              {data.isSlotProduct
                ? (t('processingSlotSubMessage') || 'You will receive your product once the seller processes your slot.')
                : (t('processingSubMessage') || 'This page will automatically update when your product is ready.')}
            </p>
          </div>
        )}

        {isDelayed && (
          <div className="card" style={{ borderLeft: '4px solid var(--error-color)' }}>
            <h3 style={{ marginBottom: '0.5rem' }}>
              {t('failedMessage') || 'Order Delayed'}
            </h3>
            <p style={{ color: 'var(--text-secondary)' }}>
              {t('failedSubMessage') || 'Our team is reviewing your order. Your payment is 100% safe.'}
            </p>
          </div>
        )}

        {isDelivered && data.deliveryData && (
          <DeliveryCard items={data.deliveryData} />
        )}

        {isDelivered && (
          <div className="card" style={{ marginTop: '2rem', background: '#fafafa', textAlign: 'center' }}>
            <h3 style={{ marginBottom: '0.5rem' }}>
              {t('thankYouMessage') || 'Thank you for your purchase!'}
            </h3>
            <p style={{ color: 'var(--text-secondary)' }}>
              {t('reviewPrompt') || 'If everything works well, please leave a positive review on Digiseller.'}
            </p>
          </div>
        )}

        <div style={{ marginTop: '4rem', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          <p>{t('supportMessage') || 'Need help?'}</p>
          <p style={{ marginTop: '0.25rem' }}>
            {t('supportContact') || 'Contact us via Digiseller chat.'}
          </p>
        </div>
      </div>
    </div>
  );
}

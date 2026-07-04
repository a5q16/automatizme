'use client';

import { useState, useEffect } from 'react';

export default function WalletBadge() {
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWallet = async () => {
      try {
        const res = await fetch('/api/admin/wallet');
        if (res.ok) {
          const data = await res.json();
          setWallet(data);
        } else {
          const errData = await res.text();
          console.error('Failed to fetch wallet info. Status:', res.status, 'Response:', errData);
        }
      } catch (err) {
        console.error('Network or parsing error fetching wallet info:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchWallet();
  }, []);

  if (loading) return <div className="wallet-badge">Loading wallet...</div>;
  if (!wallet) return <div className="wallet-badge emergency">Wallet Error</div>;

  const balance = parseFloat(wallet.balance) || 0;
  const isLow = balance < 50; 
  const isEmergency = wallet.emergencyActive || isLow;

  return (
    <div className={`wallet-badge ${isEmergency ? 'emergency' : ''}`}>
      <span>BALANCE: <strong>${balance.toFixed(2)}</strong></span>
      {isEmergency && <span>[ ⚠️ NEEDS ATTENTION ]</span>}
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import OrderTable from '@/components/OrderTable';
import WalletBadge from '@/components/WalletBadge';

export default function AdminDashboard() {
  const [mappings, setMappings] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetchMappings();
  }, []);

  const fetchMappings = async () => {
    try {
      const res = await fetch('/api/admin/mappings');
      if (res.ok) {
        const data = await res.json();
        setMappings(data.mappings || []);
      }
    } catch (err) {
      console.error('Error fetching mappings', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="dashboard-header">
        <h1>Dashboard</h1>
        <WalletBadge />
      </div>

      <h2 className="section-title">Recent Orders</h2>
      <OrderTable />

      <h2 className="section-title">Product Mappings</h2>
      {loading ? (
        <div className="loading">Loading mappings...</div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Source Product ID</th>
                <th>Source Product Name</th>
                <th>Target Provider</th>
                <th>Provider Product ID</th>
              </tr>
            </thead>
            <tbody>
              {mappings.length === 0 ? (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center' }}>No product mappings found.</td>
                </tr>
              ) : (
                mappings.map((mapping, index) => (
                  <tr key={index}>
                    <td><strong>{mapping.sourceId}</strong></td>
                    <td>{mapping.sourceName || '-'}</td>
                    <td>{mapping.provider}</td>
                    <td>{mapping.providerProductId}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

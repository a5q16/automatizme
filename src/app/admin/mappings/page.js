'use client';

import { useEffect, useState } from 'react';

export default function AdminMappings() {
  const [mappings, setMappings] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetchMappings();
  }, []);

  const fetchMappings = async () => {
    try {
      const res = await fetch('/api/admin/mappings', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setMappings(data.mappings || []);
      } else {
        const errData = await res.json();
        console.error('Failed to fetch mappings data. Status:', res.status, 'Error:', errData);
      }
    } catch (err) {
      console.error('Network or parsing error fetching mappings', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="dashboard-header">
        <h1>Product Mappings</h1>
      </div>

      <h2 className="section-title">All Product Mappings</h2>
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

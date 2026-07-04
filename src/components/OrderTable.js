'use client';

import { useState, useEffect } from 'react';

export default function OrderTable() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retrying, setRetrying] = useState(null);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const res = await fetch('/api/admin/orders');
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
      } else {
        const errData = await res.text();
        console.error('Failed to fetch orders data. Status:', res.status, 'Response:', errData);
        setError('Failed to fetch orders data.');
      }
    } catch (err) {
      console.error('Network or parsing error fetching orders:', err);
      setError('An error occurred while fetching orders.');
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = async (orderId) => {
    setRetrying(orderId);
    try {
      const res = await fetch('/api/admin/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId })
      });
      
      if (res.ok) {
        await fetchOrders();
      } else {
        const errData = await res.json();
        alert(`Failed to retry order: ${errData.message || 'Unknown error'}`);
      }
    } catch (err) {
      alert('Network error while retrying order.');
    } finally {
      setRetrying(null);
    }
  };

  if (loading) return <div className="loading">Loading orders...</div>;
  if (error) return <div className="error-message">{error}</div>;

  return (
    <div className="table-container">
      <table>
        <thead>
          <tr>
            <th>Order ID</th>
            <th>Customer Email</th>
            <th>Product Name</th>
            <th>Status</th>
            <th>Error Reason</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {orders.length === 0 ? (
            <tr>
              <td colSpan="6" style={{ textAlign: 'center', fontStyle: 'italic' }}>
                No orders to display.
              </td>
            </tr>
          ) : (
            orders.map(order => (
              <tr key={order.id}>
                <td><strong>{order.id}</strong></td>
                <td>{order.customerEmail || '-'}</td>
                <td>{order.productName || '-'}</td>
                <td>
                  <span className={`status-badge ${order.status === 'failed' ? 'status-error' : order.status === 'success' ? 'status-success' : ''}`}>
                    {order.status || 'pending'}
                  </span>
                </td>
                <td style={{ fontWeight: order.errorReason ? 'bold' : 'normal' }}>
                  {order.errorReason || '-'}
                </td>
                <td>
                  {order.status === 'failed' && (
                    <button 
                      className="btn btn-small"
                      onClick={() => handleRetry(order.id)}
                      disabled={retrying === order.id}
                    >
                      {retrying === order.id ? 'Retrying...' : 'Retry'}
                    </button>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

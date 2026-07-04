'use client';

import OrderTable from '@/components/OrderTable';
import WalletBadge from '@/components/WalletBadge';

export default function AdminDashboard() {
  return (
    <div>
      <div className="dashboard-header">
        <h1>Dashboard</h1>
        <WalletBadge />
      </div>

      <h2 className="section-title">Recent Orders</h2>
      <OrderTable />
    </div>
  );
}

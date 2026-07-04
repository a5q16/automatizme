'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async (e) => {
    e.preventDefault();
    try {
      await fetch('/api/admin/logout', { method: 'POST' }).catch(() => {});
      router.push('/admin/login');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  return (
    <aside className="admin-sidebar">
      <h2>Control Panel</h2>
      <nav className="sidebar-nav">
        <Link 
          href="/admin" 
          className={`sidebar-link ${pathname === '/admin' ? 'active' : ''}`}
        >
          Dashboard
        </Link>
        <Link 
          href="/admin/mappings" 
          className={`sidebar-link ${pathname === '/admin/mappings' ? 'active' : ''}`}
        >
          Mappings
        </Link>
        <a 
          href="#" 
          onClick={handleLogout} 
          className="sidebar-link logout-link"
        >
          Logout
        </a>
      </nav>
    </aside>
  );
}

import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

const pageTitles = {
  '/': 'Dashboard',
  '/pos': 'Point of Sale',
  '/menu': 'Menu Management',
  '/ingredients': 'Bahan Baku',
  '/recipes': 'Resep & HPP',
  '/categories': 'Kategori Menu',
  '/units': 'Satuan',
  '/modifiers': 'Modifier',
  '/suppliers': 'Supplier',
  '/purchases': 'Pembelian',
  '/transactions': 'Histori Transaksi',
  '/reports': 'Laporan',
  '/users': 'Manajemen Pengguna',
  '/settings': 'Pengaturan Toko',
};

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const title = pageTitles[location.pathname] || 'Skyra Coffee';
  const isPOS = location.pathname === '/pos';

  return (
    <div className="app-layout">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="app-main">
        <TopBar title={title} onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />
        <main className="app-content" style={isPOS ? { padding: 0, overflow: 'hidden' } : undefined}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

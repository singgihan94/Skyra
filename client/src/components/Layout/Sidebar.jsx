import { NavLink, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useShift } from '../../context/ShiftContext';
import ShiftModal from '../ShiftModal';
import {
  LayoutDashboard, ShoppingCart, Coffee, Package, BookOpen,
  Truck, ClipboardList, BarChart3, Settings, Users, Layers,
  Ruler, LogOut, Printer, Lock, Unlock
} from 'lucide-react';

const sections = [
  { section: 'Utama', items: [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/pos', icon: ShoppingCart, label: 'POS Kasir' },
  ]},
  { section: 'Master Data', items: [
    { to: '/menu', icon: Coffee, label: 'Menu', permission: 'manage_menu' },
    { to: '/ingredients', icon: Package, label: 'Bahan Baku', permission: 'manage_stock' },
    { to: '/recipes', icon: BookOpen, label: 'Resep & HPP', permission: 'manage_recipes' },
    { to: '/categories', icon: Layers, label: 'Kategori', permission: 'manage_menu' },
    { to: '/units', icon: Ruler, label: 'Satuan', permission: 'manage_menu' },
    { to: '/modifiers', icon: Settings, label: 'Modifier', permission: 'manage_menu' },
    { to: '/suppliers', icon: Truck, label: 'Supplier', permission: 'manage_stock' },
  ]},
  { section: 'Operasional', items: [
    { to: '/purchases', icon: Package, label: 'Pembelian', permission: 'manage_purchases' },
    { to: '/transactions', icon: ClipboardList, label: 'Transaksi' },
    { to: '/transactions-void', icon: ClipboardList, label: 'Transaksi Void', permission: 'manage_users' }, // Owner usually has manage_users
    { to: '/reports', icon: BarChart3, label: 'Laporan', permission: 'view_reports' },
    { to: '/cashier-performance', icon: BarChart3, label: 'Performa Kasir', permission: 'manage_users' },
  ]},
  { section: 'Pengaturan', items: [
    { to: '/users', icon: Users, label: 'Pengguna', permission: 'manage_users' },
    { to: '/settings', icon: Settings, label: 'Pengaturan Toko', permission: 'manage_settings' },
  ]},
];

export default function Sidebar({ open, onClose }) {
  const { user, logout, isAdmin } = useAuth();
  const { theme } = useTheme();
  const { currentShift } = useShift();
  const [showShiftModal, setShowShiftModal] = useState(null);
  const location = useLocation();

  const filteredSections = sections.map(section => ({
    ...section,
    items: section.items.filter(item => {
      // Admin gets everything
      if (isAdmin) return true;
      // Filter by permission if item has one
      if (item.permission) {
        return user?.permissions?.includes(item.permission);
      }
      // Dashboard and POS are always available to cashiers
      if (item.to === '/' || item.to === '/pos' || item.to === '/transactions') return true;
      return false;
    })
  })).filter(section => section.items.length > 0);

  return (
    <>
      {open && <div className="sidebar-backdrop" onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 99,
        display: 'none'
      }} />}
      <aside className={`app-sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-logo">
          {theme.storeLogoUrl ? (
            <img 
              src={`${theme.storeLogoUrl}`} 
              alt="Logo" 
              className="logo-icon" 
              style={{ objectFit: 'cover' }} 
            />
          ) : (
            <div className="logo-icon">☕</div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{theme.storeName}</h1>
            <small>POS & Management System</small>
          </div>
        </div>

        <nav className="sidebar-nav">
          {filteredSections.map(section => (
            <div key={section.section} className="sidebar-section">
              <div className="sidebar-section-title">{section.section}</div>
              {section.items.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `sidebar-link ${isActive && location.pathname === item.to ? 'active' : ''}`
                  }
                  end={item.to === '/'}
                  onClick={onClose}
                >
                  <item.icon className="icon" size={18} />
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-shift-status" style={{ padding: '12px 20px', borderTop: '1px solid var(--border-color)', marginBottom: 8 }}>
          <button 
            className={`btn btn-${currentShift ? 'danger' : 'success'} btn-sm`} 
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            onClick={() => setShowShiftModal(currentShift ? 'close' : 'open')}
          >
            {currentShift ? <><Lock size={14}/> Tutup Kasir</> : <><Unlock size={14}/> Buka Kasir</>}
          </button>
        </div>

        <div className="sidebar-user">
          <div className="sidebar-user-avatar">
            {user?.name?.charAt(0)?.toUpperCase()}
          </div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">{user?.name}</div>
            <div className="sidebar-user-role">{user?.role === 'admin' ? 'Owner' : 'Kasir'}</div>
          </div>
          <button className="btn-ghost btn-icon" onClick={logout} title="Logout">
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {showShiftModal && (
        <ShiftModal 
          mode={showShiftModal} 
          onClose={() => setShowShiftModal(null)} 
          onComplete={() => setShowShiftModal(null)}
        />
      )}
    </>
  );
}

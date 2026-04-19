import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Menu, LogOut } from 'lucide-react';

export default function TopBar({ title, onMenuToggle }) {
  const { user, logout } = useAuth();
  const [clock, setClock] = useState('');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setClock(now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="app-topbar">
      <div className="topbar-left">
        <button className="menu-toggle" onClick={onMenuToggle}>
          <Menu size={22} />
        </button>
        <h2 className="topbar-title">{title}</h2>
      </div>
      <div className="topbar-right">
        <span className="topbar-clock">{clock}</span>
        <button className="topbar-btn" onClick={logout}>
          <LogOut size={14} />
          Logout
        </button>
      </div>
    </header>
  );
}

import { useState, useEffect } from 'react';
import { api } from '../api';
import { Plus, Edit2, X, ShieldCheck } from 'lucide-react';

const availablePermissions = [
  { id: 'manage_menu', label: 'Kelola Menu' },
  { id: 'manage_stock', label: 'Kelola Stok & Supplier' },
  { id: 'manage_recipes', label: 'Kelola Resep & HPP' },
  { id: 'manage_purchases', label: 'Kelola Pembelian' },
  { id: 'view_reports', label: 'Lihat Laporan' },
  { id: 'manage_users', label: 'Kelola Pengguna' },
  { id: 'manage_settings', label: 'Kelola Pengaturan Toko' },
];

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'cashier', is_active: 1, permissions: [] });

  useEffect(() => { load(); }, []);
  async function load() { setUsers(await api.get('/api/users')); }

  async function handleSave(e) {
    e.preventDefault();
    try {
      const data = { ...form };
      if (!data.password && editing) delete data.password;
      if (editing) { 
        await api.put(`/api/users/${editing.id}`, data); 
        alert('User berhasil diperbarui!');
      }
      else { 
        await api.post('/api/users', data); 
        alert('User berhasil ditambahkan!');
      }
      setShowModal(false); 
      load();
    } catch (err) {
      alert(err.message || 'Gagal menyimpan data.');
    }
  }

  async function toggleActive(u) {
    await api.put(`/api/users/${u.id}`, { ...u, is_active: u.is_active ? 0 : 1 }); load();
  }

  function handlePermissionToggle(permId) {
    setForm(prev => {
      const perms = prev.permissions.includes(permId)
        ? prev.permissions.filter(p => p !== permId)
        : [...prev.permissions, permId];
      return { ...prev, permissions: perms };
    });
  }

  return (
    <div className="animate-in">
      <div className="page-header">
        <h1 className="page-title">Manajemen Pengguna</h1>
        <button className="btn btn-primary" onClick={() => { setForm({ name: '', email: '', password: '', role: 'cashier', is_active: 1, permissions: [] }); setEditing(null); setShowModal(true); }}><Plus size={16} /> Tambah</button>
      </div>
      <div className="table-container">
        <table className="table">
          <thead><tr><th>Nama</th><th>Email</th><th>Role</th><th>Status</th><th>Aksi</th></tr></thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td style={{ fontWeight: 600 }}>{u.name}</td>
                <td>{u.email}</td>
                <td>
                  <span className={`badge ${u.role === 'admin' ? 'badge-gold' : 'badge-info'}`}>{u.role === 'admin' ? 'Owner' : 'Kasir'}</span>
                  {u.role === 'cashier' && u.permissions?.length > 0 && (
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 4 }}>
                       {u.permissions.length} akses khusus
                    </div>
                  )}
                </td>
                <td>
                  <button className={`badge ${u.is_active ? 'badge-success' : 'badge-danger'}`} onClick={() => toggleActive(u)} style={{ cursor: 'pointer', border: 'none' }}>
                    {u.is_active ? 'Aktif' : 'Nonaktif'}
                  </button>
                </td>
                <td><button className="btn btn-ghost btn-icon" onClick={() => { setForm({ name: u.name, email: u.email, password: '', role: u.role, is_active: u.is_active, permissions: u.permissions || [] }); setEditing(u); setShowModal(true); }}><Edit2 size={14} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
            <div className="modal-header"><h3 className="modal-title">{editing ? 'Edit' : 'Tambah'} Pengguna</h3><button className="modal-close" onClick={() => setShowModal(false)}><X size={20} /></button></div>
            <form onSubmit={handleSave}>
              <div className="modal-body overflow-auto" style={{ maxHeight: '70vh' }}>
                <div className="form-row">
                  <div className="form-group"><label className="form-label">Nama *</label><input className="form-input" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
                  <div className="form-group"><label className="form-label">Email *</label><input className="form-input" type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
                </div>
                <div className="form-row">
                  <div className="form-group"><label className="form-label">{editing ? 'Password Baru (kosongkan jika tidak diubah)' : 'Password *'}</label><input className="form-input" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required={!editing} /></div>
                  <div className="form-group"><label className="form-label">Role *</label>
                    <select className="form-select" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                      <option value="admin">Owner / Admin</option><option value="cashier">Kasir</option>
                    </select>
                  </div>
                </div>

                {form.role === 'cashier' && (
                  <div style={{ marginTop: 24 }}>
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                      <ShieldCheck size={18} style={{ color: 'var(--accent-gold)' }} /> Hak Akses Kasir
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, background: 'var(--bg-secondary)', padding: 16, borderRadius: 12 }}>
                      {availablePermissions.map(perm => (
                        <label key={perm.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.9rem' }}>
                          <input 
                            type="checkbox" 
                            checked={form.permissions.includes(perm.id)} 
                            onChange={() => handlePermissionToggle(perm.id)} 
                            style={{ width: 16, height: 16, accentColor: 'var(--accent-gold)' }}
                          />
                          {perm.label}
                        </label>
                      ))}
                    </div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 8 }}>
                      💡 Centang fitur yang boleh diakses/dikelola oleh kasir ini.
                    </p>
                  </div>
                )}
              </div>
              <div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Batal</button><button type="submit" className="btn btn-primary">Simpan</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

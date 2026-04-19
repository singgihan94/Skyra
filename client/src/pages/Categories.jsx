import { useState, useEffect } from 'react';
import { api } from '../api';
import { Plus, Edit2, Trash2, X } from 'lucide-react';

export default function Categories() {
  const [items, setItems] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState('');

  useEffect(() => { load(); }, []);
  async function load() { setItems(await api.get('/api/categories')); }

  async function handleSave(e) {
    e.preventDefault();
    if (editing) { await api.put(`/api/categories/${editing.id}`, { name, is_active: editing.is_active }); }
    else { await api.post('/api/categories', { name }); }
    setShowModal(false); load();
  }

  async function handleDelete(id) {
    if (!confirm('Hapus kategori ini?')) return;
    try { await api.delete(`/api/categories/${id}`); load(); } catch (e) { alert(e.message); }
  }

  return (
    <div className="animate-in">
      <div className="page-header">
        <h1 className="page-title">Kategori Menu</h1>
        <button className="btn btn-primary" onClick={() => { setName(''); setEditing(null); setShowModal(true); }}><Plus size={16} /> Tambah</button>
      </div>
      <div className="table-container">
        <table className="table">
          <thead><tr><th>ID</th><th>Nama</th><th>Status</th><th>Aksi</th></tr></thead>
          <tbody>
            {items.map(i => (
              <tr key={i.id}>
                <td className="text-muted">{i.id}</td>
                <td style={{ fontWeight: 600 }}>{i.name}</td>
                <td><span className={`badge ${i.is_active ? 'badge-success' : 'badge-danger'}`}>{i.is_active ? 'Aktif' : 'Nonaktif'}</span></td>
                <td>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-ghost btn-icon" onClick={() => { setName(i.name); setEditing(i); setShowModal(true); }}><Edit2 size={14} /></button>
                    <button className="btn btn-ghost btn-icon" onClick={() => handleDelete(i.id)}><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editing ? 'Edit Kategori' : 'Tambah Kategori'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Nama Kategori *</label>
                  <input className="form-input" required value={name} onChange={e => setName(e.target.value)} autoFocus />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Batal</button>
                <button type="submit" className="btn btn-primary">Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

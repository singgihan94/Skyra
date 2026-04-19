import { useState, useEffect } from 'react';
import { api } from '../api';
import { Plus, Edit2, Trash2, X } from 'lucide-react';

export default function Suppliers() {
  const [items, setItems] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', phone: '', address: '' });

  useEffect(() => { load(); }, []);
  async function load() { setItems(await api.get('/api/suppliers')); }

  async function handleSave(e) {
    e.preventDefault();
    if (editing) { await api.put(`/api/suppliers/${editing.id}`, form); }
    else { await api.post('/api/suppliers', form); }
    setShowModal(false); load();
  }

  async function handleDelete(id) { if (confirm('Hapus?')) { await api.delete(`/api/suppliers/${id}`); load(); } }

  return (
    <div className="animate-in">
      <div className="page-header">
        <h1 className="page-title">Supplier</h1>
        <button className="btn btn-primary" onClick={() => { setForm({ name: '', phone: '', address: '' }); setEditing(null); setShowModal(true); }}><Plus size={16} /> Tambah</button>
      </div>
      <div className="table-container">
        <table className="table">
          <thead><tr><th>Nama</th><th>Telepon</th><th>Alamat</th><th>Status</th><th>Aksi</th></tr></thead>
          <tbody>
            {items.map(i => (
              <tr key={i.id}>
                <td style={{ fontWeight: 600 }}>{i.name}</td>
                <td>{i.phone || '-'}</td>
                <td>{i.address || '-'}</td>
                <td><span className={`badge ${i.is_active ? 'badge-success' : 'badge-danger'}`}>{i.is_active ? 'Aktif' : 'Nonaktif'}</span></td>
                <td><div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-ghost btn-icon" onClick={() => { setForm({ name: i.name, phone: i.phone || '', address: i.address || '' }); setEditing(i); setShowModal(true); }}><Edit2 size={14} /></button>
                  <button className="btn btn-ghost btn-icon" onClick={() => handleDelete(i.id)}><Trash2 size={14} /></button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3 className="modal-title">{editing ? 'Edit' : 'Tambah'} Supplier</h3><button className="modal-close" onClick={() => setShowModal(false)}><X size={20} /></button></div>
            <form onSubmit={handleSave}><div className="modal-body">
              <div className="form-group"><label className="form-label">Nama *</label><input className="form-input" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
              <div className="form-group"><label className="form-label">Telepon</label><input className="form-input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
              <div className="form-group"><label className="form-label">Alamat</label><textarea className="form-textarea" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
            </div><div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Batal</button><button type="submit" className="btn btn-primary">Simpan</button></div></form>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { api, formatRp } from '../api';
import { Plus, Edit2, Trash2, X, Search, AlertTriangle } from 'lucide-react';

export default function Ingredients() {
  const [items, setItems] = useState([]);
  const [units, setUnits] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ name: '', unit_id: '', current_stock: '', min_stock: '', last_cost: '' });

  useEffect(() => { load(); }, []);

  async function load() {
    const [i, u] = await Promise.all([api.get('/api/ingredients'), api.get('/api/units')]);
    setItems(i); setUnits(u);
  }

  function openNew() { setForm({ name: '', unit_id: units[0]?.id || '', current_stock: '0', min_stock: '0', last_cost: '0' }); setEditing(null); setShowModal(true); }
  function openEdit(i) { setForm({ name: i.name, unit_id: i.unit_id, current_stock: i.current_stock, min_stock: i.min_stock, last_cost: i.last_cost }); setEditing(i); setShowModal(true); }

  async function handleSave(e) {
    e.preventDefault();
    const data = { ...form, unit_id: parseInt(form.unit_id), current_stock: parseFloat(form.current_stock), min_stock: parseFloat(form.min_stock), last_cost: parseFloat(form.last_cost), avg_cost: parseFloat(form.last_cost) };
    if (editing) {
      await api.put(`/api/ingredients/${editing.id}`, data);
    } else {
      await api.post('/api/ingredients', data);
    }
    setShowModal(false); load();
  }

  async function handleDelete(id) {
    if (!confirm('Hapus bahan ini?')) return;
    try { await api.delete(`/api/ingredients/${id}`); load(); } catch (err) { alert(err.message); }
  }

  const filtered = items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="animate-in">
      <div className="page-header">
        <h1 className="page-title">Bahan Baku</h1>
        <button className="btn btn-primary" onClick={openNew}><Plus size={16} /> Tambah Bahan</button>
      </div>

      <div className="search-bar">
        <Search className="search-icon" size={18} />
        <input placeholder="Cari bahan..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="table-container">
        <table className="table">
          <thead><tr>
            <th>Nama</th><th>Satuan</th><th>Stok</th><th>Stok Min</th><th>Harga Terakhir</th><th>Harga Rata²</th><th>Status</th><th>Aksi</th>
          </tr></thead>
          <tbody>
            {filtered.map(i => {
              const isLow = i.current_stock <= i.min_stock;
              return (
                <tr key={i.id}>
                  <td style={{ fontWeight: 600 }}>{i.name}</td>
                  <td>{i.unit_name} ({i.unit_code})</td>
                  <td className={`font-mono ${isLow ? 'text-danger' : ''}`} style={{ fontWeight: isLow ? 700 : 400 }}>
                    {isLow && <AlertTriangle size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />}
                    {i.current_stock}
                  </td>
                  <td className="font-mono text-muted">{i.min_stock}</td>
                  <td className="font-mono">{formatRp(i.last_cost)}</td>
                  <td className="font-mono">{formatRp(i.avg_cost)}</td>
                  <td><span className={`badge ${i.is_active ? 'badge-success' : 'badge-danger'}`}>{i.is_active ? 'Aktif' : 'Nonaktif'}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-ghost btn-icon" onClick={() => openEdit(i)}><Edit2 size={14} /></button>
                      <button className="btn btn-ghost btn-icon" onClick={() => handleDelete(i.id)}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editing ? 'Edit Bahan Baku' : 'Tambah Bahan Baku'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Nama Bahan *</label>
                    <input className="form-input" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Satuan *</label>
                    <select className="form-select" required value={form.unit_id} onChange={e => setForm({ ...form, unit_id: e.target.value })}>
                      <option value="">Pilih...</option>
                      {units.map(u => <option key={u.id} value={u.id}>{u.name} ({u.code})</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Stok Awal</label>
                    <input className="form-input" type="number" step="any" value={form.current_stock} onChange={e => setForm({ ...form, current_stock: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Stok Minimum</label>
                    <input className="form-input" type="number" step="any" value={form.min_stock} onChange={e => setForm({ ...form, min_stock: e.target.value })} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Harga Beli (Rp)</label>
                  <input className="form-input" type="number" value={form.last_cost} onChange={e => setForm({ ...form, last_cost: e.target.value })} />
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

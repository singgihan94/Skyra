import { useState, useEffect } from 'react';
import { api, formatRp } from '../api';
import { Plus, Edit2, Trash2, X, Search } from 'lucide-react';

export default function MenuManager() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ name: '', category_id: '', selling_price: '', sku: '', description: '' });
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    const [p, c] = await Promise.all([api.get('/api/products'), api.get('/api/categories')]);
    setProducts(p); setCategories(c);
  }

  function openNew() { setForm({ name: '', category_id: categories[0]?.id || '', selling_price: '', sku: '', description: '' }); setEditing(null); setFile(null); setPreview(null); setShowModal(true); }
  function openEdit(p) { setForm({ name: p.name, category_id: p.category_id, selling_price: p.selling_price, sku: p.sku || '', description: p.description || '' }); setEditing(p); setFile(null); setPreview(p.image_url ? `${p.image_url}` : null); setShowModal(true); }

  function handleFileChange(e) {
    const f = e.target.files[0];
    if (f) {
      setFile(f);
      setPreview(URL.createObjectURL(f));
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    const formData = new FormData();
    formData.append('name', form.name);
    formData.append('category_id', form.category_id);
    formData.append('selling_price', parseFloat(form.selling_price) || 0);
    formData.append('sku', form.sku);
    formData.append('description', form.description);
    if (file) formData.append('image', file);

    if (editing) {
      await api.put(`/api/products/${editing.id}`, formData);
    } else {
      await api.post('/api/products', formData);
    }
    setShowModal(false); load();
  }

  async function handleDelete(id) {
    if (!confirm('Hapus menu ini?')) return;
    await api.delete(`/api/products/${id}`); load();
  }

  async function toggleActive(p) {
    await api.put(`/api/products/${p.id}`, { ...p, is_active: p.is_active ? 0 : 1 }); load();
  }

  const filtered = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="animate-in">
      <div className="page-header">
        <h1 className="page-title">Menu</h1>
        <button className="btn btn-primary" onClick={openNew}><Plus size={16} /> Tambah Menu</button>
      </div>

      <div className="search-bar">
        <Search className="search-icon" size={18} />
        <input placeholder="Cari menu..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="table-container">
        <table className="table">
          <thead><tr>
            <th>Photo</th><th>SKU</th><th>Nama</th><th>Kategori</th><th>Harga Jual</th><th>Status</th><th>Aksi</th>
          </tr></thead>
          <tbody>
            {filtered.map(p => (
              <tr key={p.id}>
                <td>
                  {p.image_url ? (
                    <img src={`${p.image_url}`} alt={p.name} style={{ width: 40, height: 40, borderRadius: 'var(--radius-sm)', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-sm)', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', color: 'var(--text-muted)' }}>No Pic</div>
                  )}
                </td>
                <td className="text-muted">{p.sku || '-'}</td>
                <td style={{ fontWeight: 600 }}>{p.name}</td>
                <td><span className="badge badge-gold">{p.category_name}</span></td>
                <td className="text-gold font-mono">{formatRp(p.selling_price)}</td>
                <td>
                  <button className={`badge ${p.is_active ? 'badge-success' : 'badge-danger'}`} onClick={() => toggleActive(p)} style={{ cursor: 'pointer', border: 'none' }}>
                    {p.is_active ? 'Aktif' : 'Nonaktif'}
                  </button>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-ghost btn-icon" onClick={() => openEdit(p)}><Edit2 size={14} /></button>
                    <button className="btn btn-ghost btn-icon" onClick={() => handleDelete(p.id)}><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editing ? 'Edit Menu' : 'Tambah Menu'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Nama Menu *</label>
                    <input className="form-input" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">SKU</label>
                    <input className="form-input" value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Kategori *</label>
                    <select className="form-select" required value={form.category_id} onChange={e => setForm({ ...form, category_id: e.target.value })}>
                      <option value="">Pilih...</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Harga Jual (Rp) *</label>
                    <input className="form-input" type="number" required value={form.selling_price} onChange={e => setForm({ ...form, selling_price: e.target.value })} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Deskripsi</label>
                  <textarea className="form-textarea" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Photo Menu</label>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    {preview && <img src={preview} style={{ width: 64, height: 64, borderRadius: 'var(--radius-md)', objectFit: 'cover' }} alt="Preview" />}
                    <input type="file" accept="image/*" onChange={handleFileChange} />
                  </div>
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

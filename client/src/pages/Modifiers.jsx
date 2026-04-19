import { useState, useEffect } from 'react';
import { api, formatRp } from '../api';
import { Plus, Edit2, Trash2, X } from 'lucide-react';

export default function Modifiers() {
  const [groups, setGroups] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', type: '', is_required: false, is_multiple: false });
  const [showOptModal, setShowOptModal] = useState(null);
  const [optForm, setOptForm] = useState({ name: '', price_adjustment: 0 });
  const [editingOpt, setEditingOpt] = useState(null);

  useEffect(() => { load(); }, []);
  async function load() { setGroups(await api.get('/api/modifiers/groups')); }

  async function saveGroup(e) {
    e.preventDefault();
    if (editing) { await api.put(`/api/modifiers/groups/${editing.id}`, form); }
    else { await api.post('/api/modifiers/groups', form); }
    setShowModal(false); load();
  }

  async function deleteGroup(id) { if (confirm('Hapus modifier group?')) { await api.delete(`/api/modifiers/groups/${id}`); load(); } }

  async function saveOption(e) {
    e.preventDefault();
    const data = { ...optForm, price_adjustment: parseFloat(optForm.price_adjustment) || 0 };
    if (editingOpt) { await api.put(`/api/modifiers/options/${editingOpt.id}`, data); }
    else { await api.post('/api/modifiers/options', { ...data, group_id: showOptModal }); }
    setShowOptModal(null); setEditingOpt(null); load();
  }

  async function deleteOption(id) { if (confirm('Hapus option?')) { await api.delete(`/api/modifiers/options/${id}`); load(); } }

  return (
    <div className="animate-in">
      <div className="page-header">
        <h1 className="page-title">Modifier</h1>
        <button className="btn btn-primary" onClick={() => { setForm({ name: '', type: '', is_required: false, is_multiple: false }); setEditing(null); setShowModal(true); }}><Plus size={16} /> Tambah Group</button>
      </div>

      {groups.map(g => (
        <div key={g.id} className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <div>
              <span className="card-title">{g.name}</span>
              <span className="text-muted" style={{ marginLeft: 8, fontSize: '0.75rem' }}>
                {g.is_required ? 'Wajib' : 'Opsional'} • {g.is_multiple ? 'Pilih banyak' : 'Pilih satu'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => { setOptForm({ name: '', price_adjustment: 0 }); setEditingOpt(null); setShowOptModal(g.id); }}><Plus size={14} /> Option</button>
              <button className="btn btn-ghost btn-icon" onClick={() => { setForm({ name: g.name, type: g.type || '', is_required: !!g.is_required, is_multiple: !!g.is_multiple }); setEditing(g); setShowModal(true); }}><Edit2 size={14} /></button>
              <button className="btn btn-ghost btn-icon" onClick={() => deleteGroup(g.id)}><Trash2 size={14} /></button>
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {g.options?.map(opt => (
              <div key={opt.id} className="badge badge-gold" style={{ padding: '6px 12px', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', gap: 8, alignItems: 'center' }}>
                {opt.name} {opt.price_adjustment > 0 && <span>+{formatRp(opt.price_adjustment)}</span>}
                <button onClick={() => { setOptForm({ name: opt.name, price_adjustment: opt.price_adjustment }); setEditingOpt(opt); setShowOptModal(g.id); }} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0 }}><Edit2 size={12} /></button>
                <button onClick={() => deleteOption(opt.id)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: 0 }}><Trash2 size={12} /></button>
              </div>
            ))}
            {!g.options?.length && <span className="text-muted">Belum ada opsi.</span>}
          </div>
        </div>
      ))}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3 className="modal-title">{editing ? 'Edit' : 'Tambah'} Modifier Group</h3><button className="modal-close" onClick={() => setShowModal(false)}><X size={20} /></button></div>
            <form onSubmit={saveGroup}>
              <div className="modal-body">
                <div className="form-group"><label className="form-label">Nama *</label><input className="form-input" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
                <div className="form-group"><label className="form-label">Tipe</label><input className="form-input" placeholder="e.g. size, sugar, topping" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} /></div>
                <div className="form-inline">
                  <label><input type="checkbox" checked={form.is_required} onChange={e => setForm({ ...form, is_required: e.target.checked })} /> Wajib pilih</label>
                  <label><input type="checkbox" checked={form.is_multiple} onChange={e => setForm({ ...form, is_multiple: e.target.checked })} /> Boleh pilih banyak</label>
                </div>
              </div>
              <div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Batal</button><button type="submit" className="btn btn-primary">Simpan</button></div>
            </form>
          </div>
        </div>
      )}

      {showOptModal && (
        <div className="modal-overlay" onClick={() => setShowOptModal(null)}>
          <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3 className="modal-title">{editingOpt ? 'Edit' : 'Tambah'} Option</h3><button className="modal-close" onClick={() => setShowOptModal(null)}><X size={20} /></button></div>
            <form onSubmit={saveOption}>
              <div className="modal-body">
                <div className="form-group"><label className="form-label">Nama *</label><input className="form-input" required value={optForm.name} onChange={e => setOptForm({ ...optForm, name: e.target.value })} /></div>
                <div className="form-group"><label className="form-label">Penyesuaian Harga (Rp)</label><input className="form-input" type="number" value={optForm.price_adjustment} onChange={e => setOptForm({ ...optForm, price_adjustment: e.target.value })} /></div>
              </div>
              <div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={() => setShowOptModal(null)}>Batal</button><button type="submit" className="btn btn-primary">Simpan</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

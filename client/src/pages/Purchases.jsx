import { useState, useEffect } from 'react';
import { api, formatRp, formatDate } from '../api';
import { Plus, X, Trash2, Eye } from 'lucide-react';

export default function Purchases() {
  const [purchases, setPurchases] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showDetail, setShowDetail] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [form, setForm] = useState({ supplier_id: '', purchase_date: new Date().toISOString().slice(0, 10), notes: '', items: [{ ingredient_id: '', qty: '', unit_cost: '' }] });

  useEffect(() => { load(); }, []);

  async function load() {
    const [p, s, i] = await Promise.all([api.get('/api/purchases'), api.get('/api/suppliers'), api.get('/api/ingredients')]);
    setPurchases(p); setSuppliers(s); setIngredients(i);
  }

  function addItem() { setForm({ ...form, items: [...form.items, { ingredient_id: '', qty: '', unit_cost: '' }] }); }
  function removeItem(idx) { setForm({ ...form, items: form.items.filter((_, i) => i !== idx) }); }
  function updateItem(idx, field, value) { setForm({ ...form, items: form.items.map((it, i) => i === idx ? { ...it, [field]: value } : it) }); }

  async function handleSave(e) {
    e.preventDefault();
    try {
      await api.post('/api/purchases', {
        supplier_id: parseInt(form.supplier_id) || null,
        purchase_date: form.purchase_date,
        notes: form.notes,
        items: form.items.filter(i => i.ingredient_id).map(i => ({
          ingredient_id: parseInt(i.ingredient_id),
          qty: parseFloat(i.qty) || 0,
          unit_cost: parseFloat(i.unit_cost) || 0
        }))
      });
      setShowModal(false); load();
    } catch (err) { alert(err.message); }
  }

  async function viewDetail(id) {
    const data = await api.get(`/api/purchases/${id}`);
    setShowDetail(data);
  }

  const formTotal = form.items.reduce((sum, i) => sum + (parseFloat(i.qty) || 0) * (parseFloat(i.unit_cost) || 0), 0);

  return (
    <div className="animate-in">
      <div className="page-header">
        <h1 className="page-title">Pembelian Bahan Baku</h1>
        <button className="btn btn-primary" onClick={() => { setForm({ supplier_id: '', purchase_date: new Date().toISOString().slice(0, 10), notes: '', items: [{ ingredient_id: '', qty: '', unit_cost: '' }] }); setShowModal(true); }}><Plus size={16} /> Buat Pembelian</button>
      </div>

      <div className="table-container">
        <table className="table">
          <thead><tr><th>No. PO</th><th>Tanggal</th><th>Supplier</th><th>Total</th><th>Oleh</th><th>Aksi</th></tr></thead>
          <tbody>
            {purchases.map(p => (
              <tr key={p.id}>
                <td style={{ fontWeight: 600 }}>{p.purchase_no}</td>
                <td>{formatDate(p.purchase_date)}</td>
                <td>{p.supplier_name || '-'}</td>
                <td className="text-gold font-mono">{formatRp(p.total)}</td>
                <td>{p.created_by_name}</td>
                <td><button className="btn btn-ghost btn-sm" onClick={() => viewDetail(p.id)}><Eye size={14} /> Detail</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3 className="modal-title">Buat Pembelian Baru</h3><button className="modal-close" onClick={() => setShowModal(false)}><X size={20} /></button></div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group"><label className="form-label">Supplier</label>
                    <select className="form-select" value={form.supplier_id} onChange={e => setForm({ ...form, supplier_id: e.target.value })}>
                      <option value="">Pilih supplier...</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group"><label className="form-label">Tanggal</label><input className="form-input" type="date" value={form.purchase_date} onChange={e => setForm({ ...form, purchase_date: e.target.value })} /></div>
                </div>

                <table className="table" style={{ marginBottom: 12 }}>
                  <thead><tr><th>Bahan</th><th>Jumlah</th><th>Harga/Unit</th><th>Total</th><th></th></tr></thead>
                  <tbody>
                    {form.items.map((item, idx) => (
                      <tr key={idx}>
                        <td><select className="form-select" value={item.ingredient_id} onChange={e => updateItem(idx, 'ingredient_id', e.target.value)}><option value="">Pilih...</option>{ingredients.map(i => <option key={i.id} value={i.id}>{i.name} ({i.unit_code})</option>)}</select></td>
                        <td><input className="form-input" type="number" step="any" value={item.qty} onChange={e => updateItem(idx, 'qty', e.target.value)} style={{ width: 100 }} /></td>
                        <td><input className="form-input" type="number" value={item.unit_cost} onChange={e => updateItem(idx, 'unit_cost', e.target.value)} style={{ width: 120 }} /></td>
                        <td className="text-gold font-mono">{formatRp((parseFloat(item.qty) || 0) * (parseFloat(item.unit_cost) || 0))}</td>
                        <td><button type="button" className="btn btn-ghost btn-icon" onClick={() => removeItem(idx)}><Trash2 size={14} /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button type="button" className="btn btn-secondary btn-sm" onClick={addItem}><Plus size={14} /> Tambah Bahan</button>
                <div style={{ marginTop: 12, textAlign: 'right', fontWeight: 700, fontSize: '1.1rem' }}>Total: <span className="text-gold">{formatRp(formTotal)}</span></div>

                <div className="form-group" style={{ marginTop: 12 }}><label className="form-label">Catatan</label><textarea className="form-textarea" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
              </div>
              <div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Batal</button><button type="submit" className="btn btn-primary">Simpan Pembelian</button></div>
            </form>
          </div>
        </div>
      )}

      {showDetail && (
        <div className="modal-overlay" onClick={() => setShowDetail(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3 className="modal-title">Detail: {showDetail.purchase_no}</h3><button className="modal-close" onClick={() => setShowDetail(null)}><X size={20} /></button></div>
            <div className="modal-body">
              <p className="text-muted" style={{ marginBottom: 12 }}>Supplier: {showDetail.supplier_name || '-'} | Tanggal: {formatDate(showDetail.purchase_date)}</p>
              <table className="table">
                <thead><tr><th>Bahan</th><th>Qty</th><th>Harga/Unit</th><th>Total</th></tr></thead>
                <tbody>
                  {showDetail.items?.map(i => (
                    <tr key={i.id}><td>{i.ingredient_name}</td><td className="font-mono">{i.qty} {i.unit_code}</td><td className="font-mono">{formatRp(i.unit_cost)}</td><td className="text-gold font-mono">{formatRp(i.line_total)}</td></tr>
                  ))}
                </tbody>
              </table>
              <div style={{ marginTop: 12, textAlign: 'right', fontWeight: 700 }}>Total: <span className="text-gold">{formatRp(showDetail.total)}</span></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

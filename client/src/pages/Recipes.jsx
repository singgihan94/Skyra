import { useState, useEffect } from 'react';
import { api, formatRp } from '../api';
import { Plus, Trash2, X, Save } from 'lucide-react';

export default function Recipes() {
  const [products, setProducts] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [recipe, setRecipe] = useState([]);
  const [hpp, setHpp] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/api/products').then(setProducts);
    api.get('/api/ingredients').then(setIngredients);
  }, []);

  async function loadRecipe(productId) {
    const product = products.find(p => p.id === productId);
    setSelectedProduct(product);
    const data = await api.get(`/api/recipes/${productId}`);
    setRecipe(data.items || []);
    setHpp(data.hpp || 0);
  }

  function addRecipeRow() {
    setRecipe([...recipe, { ingredient_id: '', qty: 0, waste_pct: 0 }]);
  }

  function removeRow(idx) {
    setRecipe(recipe.filter((_, i) => i !== idx));
  }

  function updateRow(idx, field, value) {
    setRecipe(recipe.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  }

  async function saveRecipe() {
    if (!selectedProduct) return;
    setSaving(true);
    try {
      await api.put(`/api/recipes/${selectedProduct.id}`, {
        items: recipe.filter(r => r.ingredient_id).map(r => ({
          ingredient_id: parseInt(r.ingredient_id),
          qty: parseFloat(r.qty) || 0,
          waste_pct: parseFloat(r.waste_pct) || 0
        }))
      });
      await loadRecipe(selectedProduct.id);
      alert('Resep berhasil disimpan!');
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  // Calculate live HPP
  const liveHpp = recipe.reduce((sum, r) => {
    if (!r.ingredient_id) return sum;
    const ing = ingredients.find(i => i.id === parseInt(r.ingredient_id));
    return sum + (parseFloat(r.qty) || 0) * (ing?.avg_cost || ing?.last_cost || 0);
  }, 0);

  return (
    <div className="animate-in">
      <div className="page-header">
        <h1 className="page-title">Resep & HPP</h1>
      </div>

      <div className="grid-2">
        {/* Product List */}
        <div className="card">
          <div className="card-header"><span className="card-title">Pilih Menu</span></div>
          <div style={{ maxHeight: 500, overflow: 'auto' }}>
            {products.map(p => (
              <div key={p.id}
                onClick={() => loadRecipe(p.id)}
                style={{
                  padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border-light)',
                  background: selectedProduct?.id === p.id ? 'var(--accent-gold-glow)' : 'transparent',
                  borderLeft: selectedProduct?.id === p.id ? '3px solid var(--accent-gold)' : '3px solid transparent',
                  display: 'flex', justifyContent: 'space-between'
                }}
              >
                <span style={{ fontWeight: 600 }}>{p.name}</span>
                <span className="text-gold font-mono">{formatRp(p.selling_price)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recipe Editor */}
        <div className="card">
          {selectedProduct ? (
            <>
              <div className="card-header">
                <span className="card-title">Resep: {selectedProduct.name}</span>
                <button className="btn btn-primary btn-sm" onClick={saveRecipe} disabled={saving}>
                  <Save size={14} /> {saving ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>

              <div className="table-container" style={{ border: 'none', marginBottom: 12 }}>
                <table className="table">
                  <thead><tr><th>Bahan</th><th>Jumlah</th><th>Waste %</th><th>Biaya</th><th></th></tr></thead>
                  <tbody>
                    {recipe.map((r, idx) => {
                      const ing = ingredients.find(i => i.id === parseInt(r.ingredient_id));
                      const cost = (parseFloat(r.qty) || 0) * (ing?.avg_cost || ing?.last_cost || 0);
                      return (
                        <tr key={idx}>
                          <td>
                            <select className="form-select" value={r.ingredient_id} onChange={e => updateRow(idx, 'ingredient_id', e.target.value)} style={{ minWidth: 140 }}>
                              <option value="">Pilih...</option>
                              {ingredients.map(i => <option key={i.id} value={i.id}>{i.name} ({i.unit_code})</option>)}
                            </select>
                          </td>
                          <td><input className="form-input" type="number" step="any" value={r.qty} onChange={e => updateRow(idx, 'qty', e.target.value)} style={{ width: 80 }} /></td>
                          <td><input className="form-input" type="number" step="any" value={r.waste_pct} onChange={e => updateRow(idx, 'waste_pct', e.target.value)} style={{ width: 60 }} /></td>
                          <td className="text-gold font-mono">{formatRp(cost)}</td>
                          <td><button className="btn btn-ghost btn-icon" onClick={() => removeRow(idx)}><Trash2 size={14} /></button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <button className="btn btn-secondary btn-sm" onClick={addRecipeRow}><Plus size={14} /> Tambah Bahan</button>

              <div style={{ marginTop: 16, padding: 16, background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)' }}>
                <div className="flex-between" style={{ marginBottom: 6 }}>
                  <span className="text-muted">HPP</span>
                  <span className="text-gold font-mono" style={{ fontWeight: 700, fontSize: '1.1rem' }}>{formatRp(liveHpp)}</span>
                </div>
                <div className="flex-between" style={{ marginBottom: 6 }}>
                  <span className="text-muted">Harga Jual</span>
                  <span className="font-mono">{formatRp(selectedProduct.selling_price)}</span>
                </div>
                <div className="flex-between" style={{ paddingTop: 6, borderTop: '1px solid var(--border-color)' }}>
                  <span style={{ fontWeight: 600 }}>Laba Kotor</span>
                  <span className="text-success font-mono" style={{ fontWeight: 700, fontSize: '1.1rem' }}>{formatRp(selectedProduct.selling_price - liveHpp)}</span>
                </div>
              </div>
            </>
          ) : (
            <div className="empty-state"><p>Pilih menu di sebelah kiri untuk mengelola resepnya.</p></div>
          )}
        </div>
      </div>
    </div>
  );
}

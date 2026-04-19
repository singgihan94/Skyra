const express = require('express');
const db = require('../db').getDb();
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/ingredients
router.get('/', authenticate, async (req, res) => {
  try {
    const items = await db.prepare(`
      SELECT i.*, u.name as unit_name, u.code as unit_code
      FROM ingredients i
      LEFT JOIN units u ON i.unit_id = u.id
      ORDER BY i.name
    `).all();
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/ingredients/low-stock
router.get('/low-stock', authenticate, async (req, res) => {
  try {
    const items = await db.prepare(`
      SELECT i.*, u.name as unit_name, u.code as unit_code
      FROM ingredients i
      LEFT JOIN units u ON i.unit_id = u.id
      WHERE i.current_stock <= i.min_stock AND i.is_active = 1
      ORDER BY (i.current_stock / CASE WHEN i.min_stock = 0 THEN 1 ELSE i.min_stock END) ASC
    `).all();
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ingredients
router.post('/', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { name, unit_id, current_stock, min_stock, last_cost, avg_cost } = req.body;
    if (!name || !unit_id) return res.status(400).json({ error: 'Nama dan satuan wajib diisi.' });

    const result = await db.prepare(
      'INSERT INTO ingredients (name, unit_id, current_stock, min_stock, last_cost, avg_cost) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(name, unit_id, current_stock || 0, min_stock || 0, last_cost || 0, avg_cost || 0);

    res.status(201).json({ id: result.lastInsertRowid, name, unit_id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/ingredients/:id
router.put('/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { name, unit_id, min_stock, is_active } = req.body;
    const item = await db.prepare('SELECT * FROM ingredients WHERE id = ?').get(req.params.id);
    if (!item) return res.status(404).json({ error: 'Bahan tidak ditemukan.' });

    await db.prepare(
      'UPDATE ingredients SET name=?, unit_id=?, min_stock=?, is_active=?, updated_at=datetime(\'now\',\'localtime\') WHERE id=?'
    ).run(name || item.name, unit_id || item.unit_id, min_stock ?? item.min_stock, is_active ?? item.is_active, req.params.id);

    res.json({ message: 'Bahan berhasil diperbarui.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/ingredients/:id
router.delete('/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const usedInRecipe = await db.prepare('SELECT id FROM product_recipe_items WHERE ingredient_id = ? LIMIT 1').get(req.params.id);
    if (usedInRecipe) return res.status(400).json({ error: 'Bahan masih digunakan dalam resep.' });
    await db.prepare('DELETE FROM ingredients WHERE id = ?').run(req.params.id);
    res.json({ message: 'Bahan berhasil dihapus.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

const express = require('express');
const db = require('../db').getDb();
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/categories
router.get('/', authenticate, async (req, res) => {
  try {
    const cats = await db.prepare('SELECT * FROM product_categories ORDER BY name').all();
    res.json(cats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/categories
router.post('/', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Nama kategori wajib.' });
    const result = await db.prepare('INSERT INTO product_categories (name) VALUES (?)').run(name);
    res.status(201).json({ id: result.lastInsertRowid, name, is_active: 1 });
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(400).json({ error: 'Kategori sudah ada.' });
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/categories/:id
router.put('/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { name, is_active } = req.body;
    await db.prepare('UPDATE product_categories SET name=?, is_active=? WHERE id=?').run(name, is_active ?? 1, req.params.id);
    res.json({ message: 'Kategori berhasil diperbarui.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/categories/:id
router.delete('/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const used = await db.prepare('SELECT id FROM products WHERE category_id = ? LIMIT 1').get(req.params.id);
    if (used) return res.status(400).json({ error: 'Kategori masih digunakan oleh menu.' });
    await db.prepare('DELETE FROM product_categories WHERE id = ?').run(req.params.id);
    res.json({ message: 'Kategori berhasil dihapus.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

const express = require('express');
const db = require('../db').getDb();
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/suppliers
router.get('/', authenticate, async (req, res) => {
  try {
    const suppliers = await db.prepare('SELECT * FROM suppliers ORDER BY name').all();
    res.json(suppliers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/suppliers
router.post('/', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { name, phone, address } = req.body;
    if (!name) return res.status(400).json({ error: 'Nama supplier wajib.' });
    const result = await db.prepare('INSERT INTO suppliers (name, phone, address) VALUES (?, ?, ?)').run(name, phone || null, address || null);
    res.status(201).json({ id: result.lastInsertRowid, name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/suppliers/:id
router.put('/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { name, phone, address, is_active } = req.body;
    await db.prepare('UPDATE suppliers SET name=?, phone=?, address=?, is_active=? WHERE id=?')
      .run(name, phone, address, is_active ?? 1, req.params.id);
    res.json({ message: 'Supplier berhasil diperbarui.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/suppliers/:id
router.delete('/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    await db.prepare('DELETE FROM suppliers WHERE id = ?').run(req.params.id);
    res.json({ message: 'Supplier berhasil dihapus.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

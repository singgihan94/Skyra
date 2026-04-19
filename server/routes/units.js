const express = require('express');
const db = require('../db').getDb();
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/units
router.get('/', authenticate, async (req, res) => {
  try {
    const units = await db.prepare('SELECT * FROM units ORDER BY name').all();
    res.json(units);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/units
router.post('/', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { name, code } = req.body;
    if (!name || !code) return res.status(400).json({ error: 'Nama dan kode satuan wajib.' });
    const result = await db.prepare('INSERT INTO units (name, code) VALUES (?, ?)').run(name, code);
    res.status(201).json({ id: result.lastInsertRowid, name, code });
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(400).json({ error: 'Satuan sudah ada.' });
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/units/:id
router.put('/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { name, code } = req.body;
    await db.prepare('UPDATE units SET name=?, code=? WHERE id=?').run(name, code, req.params.id);
    res.json({ message: 'Satuan berhasil diperbarui.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/units/:id
router.delete('/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const used = await db.prepare('SELECT id FROM ingredients WHERE unit_id = ? LIMIT 1').get(req.params.id);
    if (used) return res.status(400).json({ error: 'Satuan masih digunakan oleh bahan baku.' });
    await db.prepare('DELETE FROM units WHERE id = ?').run(req.params.id);
    res.json({ message: 'Satuan berhasil dihapus.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

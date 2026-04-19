const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db').getDb();
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/users
router.get('/', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const users = await db.prepare('SELECT id, name, email, role, is_active, created_at, permissions FROM users ORDER BY id').all();
    res.json(users.map(u => ({
      ...u,
      permissions: JSON.parse(u.permissions || '[]')
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/users
router.post('/', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { name, email, password, role, permissions } = req.body;
    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'Semua field wajib diisi.' });
    }
    const hash = bcrypt.hashSync(password, 10);
    const permsStr = JSON.stringify(permissions || []);
    const result = await db.prepare('INSERT INTO users (name, email, password_hash, role, permissions) VALUES (?, ?, ?, ?, ?)').run(name, email, hash, role, permsStr);
    res.status(201).json({ id: result.lastInsertRowid, name, email, role, permissions: permissions || [] });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'Email sudah terdaftar.' });
    }
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/users/:id
router.put('/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { name, email, role, is_active, password, permissions } = req.body;
    const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!user) return res.status(404).json({ error: 'User tidak ditemukan.' });

    const permsStr = permissions ? JSON.stringify(permissions) : user.permissions;

    if (password) {
      const hash = bcrypt.hashSync(password, 10);
      await db.prepare('UPDATE users SET name=?, email=?, password_hash=?, role=?, is_active=?, permissions=?, updated_at=datetime(\'now\',\'localtime\') WHERE id=?')
        .run(name || user.name, email || user.email, hash, role || user.role, is_active ?? user.is_active, permsStr, Number(req.params.id));
    } else {
      await db.prepare('UPDATE users SET name=?, email=?, role=?, is_active=?, permissions=?, updated_at=datetime(\'now\',\'localtime\') WHERE id=?')
        .run(name || user.name, email || user.email, role || user.role, is_active ?? user.is_active, permsStr, Number(req.params.id));
    }

    res.json({ message: 'User berhasil diperbarui.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

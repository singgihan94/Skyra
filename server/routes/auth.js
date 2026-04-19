const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db').getDb();
const { JWT_SECRET, authenticate } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  console.log('[AUTH] Login attempt for:', req.body.email);
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email dan password wajib diisi.' });
    }

    console.log('[AUTH] Querying database for user...');
    const user = await db.prepare('SELECT * FROM users WHERE email = ? AND is_active = 1').get(email);
    console.log('[AUTH] User found:', user ? 'Yes' : 'No');

    if (!user) {
      return res.status(401).json({ error: 'Email atau password salah.' });
    }

    console.log('[AUTH] Verifying password...');
    const valid = bcrypt.compareSync(password, user.password_hash);
    console.log('[AUTH] Password valid:', valid);
    if (!valid) {
      return res.status(401).json({ error: 'Email atau password salah.' });
    }

    console.log('[AUTH] Generating JWT...');
    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log('[AUTH] Setting cookie and sending response...');
    res.cookie('token', token, {
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: 'lax'
    });

    console.log('[AUTH] Login successful for:', user.email);
    res.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      token
    });
  } catch (err) {
    console.error('LOGIN ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/logout
router.post('/logout', async (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logout berhasil.' });
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  const user = await db.prepare('SELECT id, name, email, role, is_active, permissions FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User tidak ditemukan.' });
  res.json({
    ...user,
    permissions: JSON.parse(user.permissions || '[]')
  });
});

module.exports = router;

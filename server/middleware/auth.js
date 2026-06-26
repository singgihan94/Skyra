const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'skyra-coffee-secret-key-2024';

// Verify JWT token from cookie or Authorization header
function authenticate(req, res, next) {
  const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'Akses ditolak. Silakan login.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token tidak valid. Silakan login ulang.' });
  }
}

// Role guard middleware factory
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Akses ditolak.' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Anda tidak memiliki akses ke fitur ini.' });
    }
    next();
  };
}

// Permission guard middleware
function requirePermission(permission) {
  return async (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Akses ditolak.' });
    
    // Admin automatically has all permissions
    if (req.user.role === 'admin') return next();

    try {
      const db = require('../db').getDb();
      const user = await db.prepare('SELECT permissions FROM users WHERE id = ?').get(req.user.id);
      
      if (!user) return res.status(401).json({ error: 'User tidak valid.' });
      
      const perms = JSON.parse(user.permissions || '[]');
      if (perms.includes(permission)) {
        return next();
      }
      
      return res.status(403).json({ error: 'Kasir tidak memiliki izin untuk fitur ini.' });
    } catch (err) {
      return res.status(500).json({ error: 'Gagal memverifikasi izin kasir.' });
    }
  };
}

module.exports = { authenticate, requireRole, requirePermission, JWT_SECRET };

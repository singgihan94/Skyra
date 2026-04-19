const express = require('express');
const router = express.Router();
const db = require('../db').getDb();
const { authenticate, requireRole } = require('../middleware/auth');
const multer = require('multer');
const { logoStorage, backgroundStorage } = require('../utils/cloudinary');

const upload = multer({
  storage: logoStorage,
  limits: { fileSize: 2 * 1024 * 1024 }
});

// GET /api/settings/public - Get public store settings (No auth required)
router.get('/public', async (req, res) => {
  try {
    const settings = await db.prepare('SELECT store_name, store_logo_url, theme_mode, brand_color, bg_image_url FROM store_settings WHERE id = 1').get();
    res.json(settings || {
      store_name: 'Skyra Coffee',
      store_logo_url: '',
      theme_mode: 'dark',
      brand_color: '#d4a843',
      bg_image_url: ''
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/settings - Get store settings (any authenticated user)
router.get('/', authenticate, async (req, res) => {
  try {
    const settings = await db.prepare('SELECT * FROM store_settings WHERE id = 1').get();
    res.json(settings || {
      store_name: 'Skyra Coffee',
      store_address: '',
      store_phone: '',
      store_instagram: '@skyra.coffee',
      store_logo_url: '',
      receipt_footer: 'Terima Kasih!'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/settings - Update store settings (admin only)
router.put('/', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { store_name, store_address, store_phone, store_instagram, receipt_footer, system_password } = req.body;

    await db.prepare(`
      UPDATE store_settings SET
        store_name = ?,
        store_address = ?,
        store_phone = ?,
        store_instagram = ?,
        qris_base_string = ?,
        receipt_footer = ?,
        system_password = ?,
        theme_mode = ?,
        brand_color = ?,
        updated_at = datetime('now', 'localtime')
      WHERE id = 1
    `).run(
      store_name || 'Skyra Coffee',
      store_address || '',
      store_phone || '',
      store_instagram || '',
      req.body.qris_base_string || '',
      receipt_footer || 'Terima Kasih!',
      system_password || '123456',
      req.body.theme_mode || 'dark',
      req.body.brand_color || '#d4a843'
    );

    const updated = await db.prepare('SELECT * FROM store_settings WHERE id = 1').get();
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/settings/logo - Upload store logo (admin only)
router.post('/logo', authenticate, requireRole('admin'), upload.single('logo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'File logo tidak ditemukan.' });

    const logoUrl = req.file.path;

    await db.prepare(`
      UPDATE store_settings SET store_logo_url = ?, updated_at = datetime('now', 'localtime') WHERE id = 1
    `).run(logoUrl);

    res.json({ logo_url: logoUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const bgUpload = multer({
  storage: backgroundStorage,
  limits: { fileSize: 5 * 1024 * 1024 }
});

router.post('/background', authenticate, requireRole('admin'), bgUpload.single('background'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'File background tidak ditemukan.' });

    const bgUrl = req.file.path;

    await db.prepare(`
      UPDATE store_settings SET bg_image_url = ?, updated_at = datetime('now', 'localtime') WHERE id = 1
    `).run(bgUrl);

    res.json({ bg_image_url: bgUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/settings/background - Remove background image
router.delete('/background', authenticate, requireRole('admin'), async (req, res) => {
  try {
    await db.prepare(`
      UPDATE store_settings SET bg_image_url = '', updated_at = datetime('now', 'localtime') WHERE id = 1
    `).run();
    res.json({ message: 'Background dihapus.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

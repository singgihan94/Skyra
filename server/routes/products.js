const express = require('express');
const db = require('../db').getDb();
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
const multer = require('multer');
const { productStorage, cloudinary } = require('../utils/cloudinary');
const upload = multer({ storage: productStorage });

// GET /api/products - list all products with category
router.get('/', authenticate, async (req, res) => {
  try {
    const products = await db.prepare(`
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN product_categories c ON p.category_id = c.id
      ORDER BY p.name
    `).all();
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/products/active - for POS (only active products)
router.get('/active', authenticate, async (req, res) => {
  try {
    const products = await db.prepare(`
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN product_categories c ON p.category_id = c.id
      WHERE p.is_active = 1
      ORDER BY c.name, p.name
    `).all();

    // Attach modifier groups to each product
    const modGroupStmt = db.prepare(`
      SELECT mg.*, pmg.sort_order
      FROM modifier_groups mg
      JOIN product_modifier_groups pmg ON pmg.group_id = mg.id
      WHERE pmg.product_id = ? AND mg.is_active = 1
      ORDER BY pmg.sort_order
    `);
    const modOptionStmt = db.prepare(`
      SELECT * FROM modifier_options WHERE group_id = ? AND is_active = 1
    `);

    const result = await Promise.all(products.map(async p => {
      const dbGroups = await await modGroupStmt.all(p.id);
      const groups = await Promise.all(dbGroups.map(async g => ({
        ...g,
        options: await await modOptionStmt.all(g.id)
      })));
      return { ...p, modifier_groups: groups };
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/products/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const product = await db.prepare(`
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN product_categories c ON p.category_id = c.id
      WHERE p.id = ?
    `).get(req.params.id);

    if (!product) return res.status(404).json({ error: 'Menu tidak ditemukan.' });

    // Get recipe
    const recipe = await db.prepare(`
      SELECT pri.*, i.name as ingredient_name, i.avg_cost, u.code as unit_code
      FROM product_recipe_items pri
      JOIN ingredients i ON pri.ingredient_id = i.id
      JOIN units u ON i.unit_id = u.id
      WHERE pri.product_id = ?
    `).all(req.params.id);

    // Get modifier groups
    const modGroups = await db.prepare(`
      SELECT mg.*, pmg.sort_order
      FROM modifier_groups mg
      JOIN product_modifier_groups pmg ON pmg.group_id = mg.id
      WHERE pmg.product_id = ?
      ORDER BY pmg.sort_order
    `).all(req.params.id);

    const modOptionStmt = db.prepare('SELECT * FROM modifier_options WHERE group_id = ?');
    const groups = await Promise.all(modGroups.map(async g => ({ ...g, options: await await modOptionStmt.all(g.id) })));

    // Calculate HPP
    let hpp = 0;
    recipe.forEach(r => {
      hpp += r.qty * r.avg_cost;
    });

    res.json({ ...product, recipe, modifier_groups: groups, hpp });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/products
router.post('/', authenticate, requireRole('admin'), upload.single('image'), async (req, res) => {
  try {
    const { category_id, sku, name, selling_price, description } = req.body;
    if (!name || !category_id) return res.status(400).json({ error: 'Nama dan kategori wajib.' });

    const imageUrl = req.file ? req.file.path : null;

    const result = await db.prepare(
      'INSERT INTO products (category_id, sku, name, selling_price, description, image_url) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(category_id, sku || null, name, selling_price || 0, description || null, imageUrl);

    res.status(201).json({ id: result.lastInsertRowid, name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/products/:id
router.put('/:id', authenticate, requireRole('admin'), upload.single('image'), async (req, res) => {
  try {
    const { category_id, sku, name, selling_price, description, is_active } = req.body;
    const p = await db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    if (!p) return res.status(404).json({ error: 'Menu tidak ditemukan.' });

    let imageUrl = p.image_url;
    if (req.file) {
      imageUrl = req.file.path;
    }

    await db.prepare(
      'UPDATE products SET category_id=?, sku=?, name=?, selling_price=?, description=?, is_active=?, image_url=?, updated_at=datetime(\'now\',\'localtime\') WHERE id=?'
    ).run(
      category_id || p.category_id, 
      sku ?? p.sku, 
      name || p.name, 
      selling_price ?? p.selling_price, 
      description ?? p.description, 
      is_active ?? p.is_active, 
      imageUrl,
      req.params.id
    );

    res.json({ message: 'Menu berhasil diperbarui.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/products/:id
router.delete('/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    await db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
    res.json({ message: 'Menu berhasil dihapus.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

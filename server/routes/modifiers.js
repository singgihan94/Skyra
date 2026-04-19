const express = require('express');
const db = require('../db').getDb();
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// ─── MODIFIER GROUPS ────────────────────────────────────────────────

// GET /api/modifiers/groups
router.get('/groups', authenticate, async (req, res) => {
  try {
    const groups = await db.prepare('SELECT * FROM modifier_groups ORDER BY name').all();
    const optionStmt = db.prepare('SELECT * FROM modifier_options WHERE group_id = ? ORDER BY name');
    const result = await Promise.all(groups.map(async g => ({ ...g, options: await await optionStmt.all(g.id) })));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/modifiers/groups
router.post('/groups', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { name, type, is_required, is_multiple } = req.body;
    if (!name) return res.status(400).json({ error: 'Nama group wajib.' });
    const result = await db.prepare(
      'INSERT INTO modifier_groups (name, type, is_required, is_multiple) VALUES (?, ?, ?, ?)'
    ).run(name, type || null, is_required ? 1 : 0, is_multiple ? 1 : 0);
    res.status(201).json({ id: result.lastInsertRowid, name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/modifiers/groups/:id
router.put('/groups/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { name, type, is_required, is_multiple, is_active } = req.body;
    await db.prepare(
      'UPDATE modifier_groups SET name=?, type=?, is_required=?, is_multiple=?, is_active=? WHERE id=?'
    ).run(name, type, is_required ? 1 : 0, is_multiple ? 1 : 0, is_active ?? 1, req.params.id);
    res.json({ message: 'Group berhasil diperbarui.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/modifiers/groups/:id
router.delete('/groups/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    await db.prepare('DELETE FROM modifier_groups WHERE id = ?').run(req.params.id);
    res.json({ message: 'Group berhasil dihapus.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── MODIFIER OPTIONS ───────────────────────────────────────────────

// POST /api/modifiers/options
router.post('/options', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { group_id, name, price_adjustment } = req.body;
    if (!group_id || !name) return res.status(400).json({ error: 'Group dan nama wajib.' });
    const result = await db.prepare(
      'INSERT INTO modifier_options (group_id, name, price_adjustment) VALUES (?, ?, ?)'
    ).run(group_id, name, price_adjustment || 0);
    res.status(201).json({ id: result.lastInsertRowid, name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/modifiers/options/:id
router.put('/options/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { name, price_adjustment, is_active } = req.body;
    await db.prepare('UPDATE modifier_options SET name=?, price_adjustment=?, is_active=? WHERE id=?')
      .run(name, price_adjustment || 0, is_active ?? 1, req.params.id);
    res.json({ message: 'Option berhasil diperbarui.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/modifiers/options/:id
router.delete('/options/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    await db.prepare('DELETE FROM modifier_options WHERE id = ?').run(req.params.id);
    res.json({ message: 'Option berhasil dihapus.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── MODIFIER OPTION RECIPE ITEMS ───────────────────────────────────

// GET /api/modifiers/options/:optionId/recipe
router.get('/options/:optionId/recipe', authenticate, async (req, res) => {
  try {
    const items = await db.prepare(`
      SELECT mori.*, i.name as ingredient_name, u.code as unit_code
      FROM modifier_option_recipe_items mori
      JOIN ingredients i ON mori.ingredient_id = i.id
      JOIN units u ON i.unit_id = u.id
      WHERE mori.option_id = ?
    `).all(req.params.optionId);
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/modifiers/options/:optionId/recipe
router.put('/options/:optionId/recipe', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { items } = req.body; // [{ ingredient_id, qty_delta }]
    const deleteStmt = db.prepare('DELETE FROM modifier_option_recipe_items WHERE option_id = ?');
    const insertStmt = db.prepare(
      'INSERT INTO modifier_option_recipe_items (option_id, ingredient_id, qty_delta) VALUES (?, ?, ?)'
    );

    await db.transaction(async () => {
      await deleteStmt.run(req.params.optionId);
      if (items && items.length) {
        for (const item of items) {
          await insertStmt.run(req.params.optionId, item.ingredient_id, item.qty_delta);
        }
      }
    })();

    res.json({ message: 'Resep modifier berhasil disimpan.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PRODUCT-MODIFIER LINK ─────────────────────────────────────────

// GET /api/modifiers/product/:productId
router.get('/product/:productId', authenticate, async (req, res) => {
  try {
    const links = await db.prepare(`
      SELECT pmg.*, mg.name as group_name, mg.type, mg.is_required, mg.is_multiple
      FROM product_modifier_groups pmg
      JOIN modifier_groups mg ON pmg.group_id = mg.id
      WHERE pmg.product_id = ?
      ORDER BY pmg.sort_order
    `).all(req.params.productId);
    res.json(links);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/modifiers/product/:productId
router.put('/product/:productId', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { groups } = req.body; // [{ group_id, sort_order }]
    const deleteStmt = db.prepare('DELETE FROM product_modifier_groups WHERE product_id = ?');
    const insertStmt = db.prepare(
      'INSERT INTO product_modifier_groups (product_id, group_id, sort_order) VALUES (?, ?, ?)'
    );

    await db.transaction(async () => {
      await deleteStmt.run(req.params.productId);
      if (groups && groups.length) {
        for (let i = 0; i < groups.length; i++) {
          const g = groups[i];
          await insertStmt.run(req.params.productId, g.group_id, g.sort_order ?? i);
        }
      }
    })();

    res.json({ message: 'Modifier product berhasil disimpan.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

const express = require('express');
const db = require('../db').getDb();
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/recipes/:productId - get recipe for a product
router.get('/:productId', authenticate, async (req, res) => {
  try {
    const items = await db.prepare(`
      SELECT pri.*, i.name as ingredient_name, i.avg_cost, i.last_cost, u.name as unit_name, u.code as unit_code
      FROM product_recipe_items pri
      JOIN ingredients i ON pri.ingredient_id = i.id
      JOIN units u ON i.unit_id = u.id
      WHERE pri.product_id = ?
    `).all(req.params.productId);

    let totalHpp = 0;
    const result = items.map(item => {
      const cost = item.qty * (item.avg_cost || item.last_cost || 0);
      totalHpp += cost;
      return { ...item, cost };
    });

    res.json({ items: result, hpp: totalHpp });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/recipes/:productId - save recipe (replaces all items)
router.put('/:productId', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { items } = req.body; // [{ ingredient_id, qty, waste_pct }]
    if (!Array.isArray(items)) return res.status(400).json({ error: 'Items harus berupa array.' });

    const deleteStmt = db.prepare('DELETE FROM product_recipe_items WHERE product_id = ?');
    const insertStmt = db.prepare(
      'INSERT INTO product_recipe_items (product_id, ingredient_id, qty, waste_pct) VALUES (?, ?, ?, ?)'
    );

    const transaction = db.transaction(async () => {
      await deleteStmt.run(req.params.productId);
      for (const item of items) {
        await insertStmt.run(req.params.productId, item.ingredient_id, item.qty, item.waste_pct || 0);
      }
    });

    await transaction();
    res.json({ message: 'Resep berhasil disimpan.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/recipes/hpp/:productId - calculate HPP for a product
router.get('/hpp/:productId', authenticate, async (req, res) => {
  try {
    const items = await db.prepare(`
      SELECT pri.qty, i.avg_cost, i.last_cost
      FROM product_recipe_items pri
      JOIN ingredients i ON pri.ingredient_id = i.id
      WHERE pri.product_id = ?
    `).all(req.params.productId);

    let hpp = 0;
    items.forEach(item => {
      hpp += item.qty * (item.avg_cost || item.last_cost || 0);
    });

    const product = await db.prepare('SELECT selling_price FROM products WHERE id = ?').get(req.params.productId);
    const sellingPrice = product ? product.selling_price : 0;
    const profit = sellingPrice - hpp;

    res.json({ hpp, selling_price: sellingPrice, profit });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

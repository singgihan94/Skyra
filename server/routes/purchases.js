const express = require('express');
const db = require('../db').getDb();
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/purchases
router.get('/', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const purchases = await db.prepare(`
      SELECT p.*, s.name as supplier_name, u.name as created_by_name
      FROM purchases p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      LEFT JOIN users u ON p.created_by = u.id
      ORDER BY p.purchase_date DESC
    `).all();
    res.json(purchases);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/purchases/:id
router.get('/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const purchase = await db.prepare(`
      SELECT p.*, s.name as supplier_name
      FROM purchases p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      WHERE p.id = ?
    `).get(req.params.id);

    if (!purchase) return res.status(404).json({ error: 'Pembelian tidak ditemukan.' });

    const items = await db.prepare(`
      SELECT pi.*, i.name as ingredient_name, u.code as unit_code
      FROM purchase_items pi
      JOIN ingredients i ON pi.ingredient_id = i.id
      JOIN units u ON i.unit_id = u.id
      WHERE pi.purchase_id = ?
    `).all(req.params.id);

    res.json({ ...purchase, items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/purchases - create purchase + update stock
router.post('/', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { supplier_id, purchase_date, items, notes } = req.body;
    if (!items || !items.length) return res.status(400).json({ error: 'Minimal 1 item pembelian.' });

    // Generate purchase number
    const count = (await db.prepare('SELECT COUNT(*) as c FROM purchases').get()).c;
    const purchase_no = `PO-${String(count + 1).padStart(5, '0')}`;

    let subtotal = 0;
    items.forEach(item => {
      subtotal += (item.qty || 0) * (item.unit_cost || 0);
    });

    const transaction = db.transaction(async () => {
      // Insert purchase header
      const result = await db.prepare(
        'INSERT INTO purchases (purchase_no, supplier_id, created_by, purchase_date, subtotal, total, notes) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(purchase_no, supplier_id || null, req.user.id, purchase_date || new Date().toISOString().slice(0, 10), subtotal, subtotal, notes || null);

      const purchaseId = result.lastInsertRowid;

      // Insert items + update stock
      const insertItem = db.prepare(
        'INSERT INTO purchase_items (purchase_id, ingredient_id, qty, unit_cost, line_total) VALUES (?, ?, ?, ?, ?)'
      );
      const updateStock = db.prepare(
        'UPDATE ingredients SET current_stock = current_stock + ?, last_cost = ?, avg_cost = CASE WHEN avg_cost = 0 THEN ? ELSE (avg_cost + ?) / 2 END, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?'
      );
      const insertMovement = db.prepare(
        'INSERT INTO stock_movements (ingredient_id, movement_type, qty_in, qty_out, balance_after, ref_type, ref_id, created_by, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      );

      for (const item of items) {
        const lineTotal = item.qty * item.unit_cost;
        await insertItem.run(purchaseId, item.ingredient_id, item.qty, item.unit_cost, lineTotal);

        // Update ingredient stock
        await updateStock.run(item.qty, item.unit_cost, item.unit_cost, item.unit_cost, item.ingredient_id);

        // Get new balance
        const ing = await db.prepare('SELECT current_stock FROM ingredients WHERE id = ?').get(item.ingredient_id);
        await insertMovement.run(item.ingredient_id, 'purchase', item.qty, 0, ing.current_stock, 'purchase', purchaseId, req.user.id, `Pembelian ${purchase_no}`);
      }

      return purchaseId;
    });

    const purchaseId = await transaction();
    res.status(201).json({ id: purchaseId, purchase_no });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

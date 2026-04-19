const express = require('express');
const db = require('../db').getDb();
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/transactions
router.get('/', authenticate, async (req, res) => {
  try {
    const { date_from, date_to, cashier_id, shift_id, limit: lim } = req.query;
    let sql = `
      SELECT s.*, u.name as cashier_name, pm.name as payment_method_name
      FROM sales s
      LEFT JOIN users u ON s.cashier_id = u.id
      LEFT JOIN payment_methods pm ON s.payment_method_id = pm.id
      WHERE s.status = 'success'
    `;
    const params = [];

    if (date_from) { sql += ' AND date(s.sold_at) >= ?'; params.push(date_from); }
    if (date_to) { sql += ' AND date(s.sold_at) <= ?'; params.push(date_to); }
    if (cashier_id) { sql += ' AND s.cashier_id = ?'; params.push(cashier_id); }
    if (shift_id) { sql += ' AND s.shift_id = ?'; params.push(shift_id); }

    sql += ' ORDER BY s.sold_at DESC';
    if (lim) { sql += ' LIMIT ?'; params.push(parseInt(lim)); }

    const transactions = await db.prepare(sql).all(...params);
    res.json(transactions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/transactions/void
router.get('/void', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { date_from, date_to } = req.query;
    let sql = `
      SELECT s.*, u.name as cashier_name, pm.name as payment_method_name, uv.name as void_by_name
      FROM sales s
      LEFT JOIN users u ON s.cashier_id = u.id
      LEFT JOIN users uv ON s.void_by = uv.id
      LEFT JOIN payment_methods pm ON s.payment_method_id = pm.id
      WHERE s.status = 'void'
    `;
    const params = [];
    if (date_from) { sql += ' AND date(s.void_at) >= ?'; params.push(date_from); }
    if (date_to) { sql += ' AND date(s.void_at) <= ?'; params.push(date_to); }
    sql += ' ORDER BY s.void_at DESC LIMIT 100';

    const transactions = await db.prepare(sql).all(...params);
    res.json(transactions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/transactions/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const saleId = Number(req.params.id);
    const sale = await db.prepare(`
      SELECT s.*, u.name as cashier_name, pm.name as payment_method_name, uv.name as void_by_name
      FROM sales s
      LEFT JOIN users u ON s.cashier_id = u.id
      LEFT JOIN users uv ON s.void_by = uv.id
      LEFT JOIN payment_methods pm ON s.payment_method_id = pm.id
      WHERE s.id = ?
    `).get(saleId);

    if (!sale) return res.status(404).json({ error: 'Transaksi tidak ditemukan.' });

    const items = await db.prepare(`
      SELECT si.*, p.name as product_name
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      WHERE si.sale_id = ?
    `).all(saleId);

    const modStmt = db.prepare('SELECT * FROM sale_item_modifiers WHERE sale_item_id = ?');
    const itemsWithMods = await Promise.all(items.map(async item => {
       const mods = await modStmt.all(item.id);
       return { ...item, modifiers: mods };
    }));

    res.json({ ...sale, items: itemsWithMods });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Shared Void Logic
async function voidTransaction(req, res) {
  const saleId = Number(req.params.id);
  if (isNaN(saleId)) return res.status(400).json({ error: 'ID Transaksi tidak valid.' });

  try {
    const sale = await db.prepare('SELECT id, invoice_no, status FROM sales WHERE id = ?').get(saleId);
    if (!sale) return res.status(404).json({ error: 'Transaksi tidak ditemukan.' });
    if (sale.status === 'void') return res.status(400).json({ error: 'Transaksi ini sudah di-void.' });

    await db.transaction(async () => {
      const movements = await db.prepare('SELECT ingredient_id, qty_out FROM stock_movements WHERE ref_type = \'sale\' AND ref_id = ?').all(saleId);
      for (const m of movements) {
        if (m.qty_out > 0) {
          await db.prepare('UPDATE ingredients SET current_stock = current_stock + ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?')
            .run(m.qty_out, m.ingredient_id);
          
          await db.prepare(`
            INSERT INTO stock_movements (ingredient_id, movement_type, qty_in, qty_out, balance_after, ref_type, ref_id, created_by, notes)
            SELECT i.id, 'void_restore', ?, 0, i.current_stock, 'sale', ?, ?, 'Restorasi dari pembatalan transaksi ' || ?
            FROM ingredients i WHERE i.id = ?
          `).run(m.qty_out, saleId, req.user.id, sale.invoice_no, m.ingredient_id);
        }
      }
      await db.prepare('UPDATE sales SET status = \'void\', void_at = datetime(\'now\',\'localtime\'), void_by = ? WHERE id = ?')
        .run(req.user.id, saleId);
    })();

    res.json({ message: `Transaksi ${sale.invoice_no} berhasil dibatalkan (void) dan stok telah dikembalikan.` });
  } catch (err) {
    console.error('Void Error:', err);
    res.status(500).json({ error: err.message });
  }
}

// POST and DELETE endpoints for Void
router.post('/:id/void', authenticate, requireRole('admin'), voidTransaction);
router.delete('/:id', authenticate, requireRole('admin'), voidTransaction);

module.exports = router;

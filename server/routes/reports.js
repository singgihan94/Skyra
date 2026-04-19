const express = require('express');
const db = require('../db').getDb();
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/reports/revenue?period=daily|monthly|yearly&date=YYYY-MM-DD
router.get('/revenue', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { period, date_from, date_to } = req.query;
    let sql, params = [];

    if (period === 'daily') {
      sql = `
        SELECT date(sold_at) as date, SUM(total) as revenue, SUM(hpp_total) as hpp, SUM(profit_total) as profit, COUNT(*) as transactions
        FROM sales
        WHERE date(sold_at) >= ? AND date(sold_at) <= ?
        GROUP BY date(sold_at) ORDER BY date(sold_at) DESC
      `;
      params = [date_from || new Date().toISOString().slice(0, 10), date_to || new Date().toISOString().slice(0, 10)];
    } else if (period === 'monthly') {
      sql = `
        SELECT strftime('%Y-%m', sold_at) as month, SUM(total) as revenue, SUM(hpp_total) as hpp, SUM(profit_total) as profit, COUNT(*) as transactions
        FROM sales
        GROUP BY strftime('%Y-%m', sold_at) ORDER BY month DESC LIMIT 12
      `;
    } else {
      sql = `
        SELECT strftime('%Y', sold_at) as year, SUM(total) as revenue, SUM(hpp_total) as hpp, SUM(profit_total) as profit, COUNT(*) as transactions
        FROM sales
        GROUP BY strftime('%Y', sold_at) ORDER BY year DESC
      `;
    }

    const data = await db.prepare(sql).all(...params);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/sales-by-product
router.get('/sales-by-product', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { date_from, date_to } = req.query;
    let sql = `
      SELECT p.name as product_name, c.name as category_name, SUM(si.qty) as qty_sold, SUM(si.line_total) as total_revenue, SUM(si.line_hpp) as total_hpp, SUM(si.line_profit) as total_profit
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      LEFT JOIN product_categories c ON p.category_id = c.id
      JOIN sales s ON si.sale_id = s.id
      WHERE 1=1
    `;
    const params = [];
    if (date_from) { sql += ' AND date(s.sold_at) >= ?'; params.push(date_from); }
    if (date_to) { sql += ' AND date(s.sold_at) <= ?'; params.push(date_to); }
    sql += ' GROUP BY p.id ORDER BY qty_sold DESC';

    const data = await db.prepare(sql).all(...params);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/sales-by-category
router.get('/sales-by-category', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { date_from, date_to } = req.query;
    let sql = `
      SELECT c.name as category_name, SUM(si.qty) as qty_sold, SUM(si.line_total) as total_revenue
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      LEFT JOIN product_categories c ON p.category_id = c.id
      JOIN sales s ON si.sale_id = s.id
      WHERE 1=1
    `;
    const params = [];
    if (date_from) { sql += ' AND date(s.sold_at) >= ?'; params.push(date_from); }
    if (date_to) { sql += ' AND date(s.sold_at) <= ?'; params.push(date_to); }
    sql += ' GROUP BY c.id ORDER BY total_revenue DESC';

    const data = await db.prepare(sql).all(...params);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/sales-by-payment
router.get('/sales-by-payment', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { date_from, date_to } = req.query;
    let sql = `
      SELECT pm.name as method, COUNT(*) as count, SUM(s.total) as total
      FROM sales s
      JOIN payment_methods pm ON s.payment_method_id = pm.id
      WHERE 1=1
    `;
    const params = [];
    if (date_from) { sql += ' AND date(s.sold_at) >= ?'; params.push(date_from); }
    if (date_to) { sql += ' AND date(s.sold_at) <= ?'; params.push(date_to); }
    sql += ' GROUP BY pm.id';

    const data = await db.prepare(sql).all(...params);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/stock
router.get('/stock', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const items = await db.prepare(`
      SELECT i.*, u.name as unit_name, u.code as unit_code,
        CASE WHEN i.current_stock <= i.min_stock THEN 1 ELSE 0 END as is_low
      FROM ingredients i
      JOIN units u ON i.unit_id = u.id
      WHERE i.is_active = 1
      ORDER BY is_low DESC, i.name
    `).all();
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/stock-movements
router.get('/stock-movements', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { ingredient_id, date_from, date_to, limit: lim } = req.query;
    let sql = `
      SELECT sm.*, i.name as ingredient_name, u.name as user_name, un.code as unit_code
      FROM stock_movements sm
      JOIN ingredients i ON sm.ingredient_id = i.id
      LEFT JOIN users u ON sm.created_by = u.id
      LEFT JOIN units un ON i.unit_id = un.id
      WHERE 1=1
    `;
    const params = [];
    if (ingredient_id) { sql += ' AND sm.ingredient_id = ?'; params.push(ingredient_id); }
    if (date_from) { sql += ' AND date(sm.created_at) >= ?'; params.push(date_from); }
    if (date_to) { sql += ' AND date(sm.created_at) <= ?'; params.push(date_to); }
    sql += ' ORDER BY sm.created_at DESC';
    if (lim) { sql += ' LIMIT ?'; params.push(parseInt(lim)); }
    else { sql += ' LIMIT 200'; }

    const data = await db.prepare(sql).all(...params);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/reports/stock-adjustment
router.post('/stock-adjustment', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { ingredient_id, type, qty, notes } = req.body;
    // type: adjustment_in, adjustment_out, waste, opname
    if (!ingredient_id || !type || qty === undefined) {
      return res.status(400).json({ error: 'ingredient_id, type, dan qty wajib.' });
    }

    const ing = await db.prepare('SELECT * FROM ingredients WHERE id = ?').get(ingredient_id);
    if (!ing) return res.status(404).json({ error: 'Bahan tidak ditemukan.' });

    const isIn = type === 'adjustment_in' || type === 'opname';
    let newStock;
    if (type === 'opname') {
      newStock = qty; // Set exact stock
    } else if (isIn) {
      newStock = ing.current_stock + qty;
    } else {
      newStock = ing.current_stock - qty;
    }

    await db.transaction(async () => {
      await db.prepare('UPDATE ingredients SET current_stock = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(newStock, ingredient_id);
      await db.prepare(
        'INSERT INTO stock_movements (ingredient_id, movement_type, qty_in, qty_out, balance_after, ref_type, created_by, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(
        ingredient_id, type,
        isIn ? (type === 'opname' ? Math.abs(newStock - ing.current_stock) : qty) : 0,
        !isIn ? qty : 0,
        newStock, 'manual', req.user.id, notes || `${type}`
      );
    })();

    res.json({ message: 'Stok berhasil disesuaikan.', new_stock: newStock });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

const express = require('express');
const db = require('../db').getDb();
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/shifts/current - Get active shift for current user
router.get('/current', authenticate, async (req, res) => {
  try {
    const shift = await db.prepare(`SELECT * FROM cashier_shifts WHERE cashier_id = ? AND status = 'open' ORDER BY id DESC LIMIT 1`).get(req.user.id);
    res.json({ shift: shift || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/shifts/start - Start a new shift
router.post('/start', authenticate, async (req, res) => {
  try {
    const { starting_cash } = req.body;
    if (typeof starting_cash !== 'number' || starting_cash < 0) {
      return res.status(400).json({ error: 'Uang modal awal (starting cash) tidak valid.' });
    }

    // Check if there's already an open shift
    const existing = await db.prepare(`SELECT * FROM cashier_shifts WHERE cashier_id = ? AND status = 'open'`).get(req.user.id);
    if (existing) {
      return res.status(400).json({ error: 'Anda masih memiliki shift yang terbuka.' });
    }

    const result = await db.prepare(`
      INSERT INTO cashier_shifts (cashier_id, starting_cash, status)
      VALUES (?, ?, 'open')
    `).run(req.user.id, starting_cash);

    const shift = await db.prepare('SELECT * FROM cashier_shifts WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ shift });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/shifts/end - End current shift
router.post('/end', authenticate, async (req, res) => {
  try {
    const { ending_cash, notes } = req.body;
    if (typeof ending_cash !== 'number' || ending_cash < 0) {
      return res.status(400).json({ error: 'Uang aktual saat tutup (ending cash) wajib diisi.' });
    }

    const shift = await db.prepare(`SELECT * FROM cashier_shifts WHERE cashier_id = ? AND status = 'open' ORDER BY id DESC LIMIT 1`).get(req.user.id);
    if (!shift) {
      return res.status(404).json({ error: 'Tidak ada shift aktif.' });
    }

    // Calculate sales during this shift
    const salesData = await db.prepare(`
      SELECT COUNT(id) as total_tx, SUM(total) as revenue, SUM(cash_received - change_amount) as cash_expected
      FROM sales 
      WHERE shift_id = ? AND cashier_id = ?
    `).get(shift.id, req.user.id);

    const totalTx = salesData.total_tx || 0;
    const cashExpectedFromSales = salesData.cash_expected || 0;
    // Expected ending cash = Starting cash + cash revenue
    // (Assuming all cash_expected values are only from CASH payment method, so we should filter by payment method!)
    
    const cashSalesData = await db.prepare(`
      SELECT SUM(s.cash_received - s.change_amount) as real_cash
      FROM sales s
      JOIN payment_methods pm ON s.payment_method_id = pm.id
      WHERE s.shift_id = ? AND s.cashier_id = ? AND pm.name = 'Cash'
    `).get(shift.id, req.user.id);
    
    // total revenue is all methods, but expected cash only adds cash collected
    const totalSales = salesData.revenue || 0;
    const receivedCash = cashSalesData.real_cash || 0;

    const expected_ending_cash = shift.starting_cash + receivedCash;

    await db.prepare(`
      UPDATE cashier_shifts
      SET end_time = datetime('now', 'localtime'),
          ending_cash = ?,
          expected_ending_cash = ?,
          total_sales = ?,
          total_transactions = ?,
          status = 'closed',
          notes = ?
      WHERE id = ?
    `).run(ending_cash, expected_ending_cash, totalSales, totalTx, notes || null, shift.id);

    const updatedShift = await db.prepare('SELECT * FROM cashier_shifts WHERE id = ?').get(shift.id);

    res.json({ message: 'Shift berhasil ditutup', shift: updatedShift, summary: {
      selisih: ending_cash - expected_ending_cash
    } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/shifts (admin) - History
router.get('/', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const shifts = await db.prepare(`
      SELECT s.*, u.name as cashier_name
      FROM cashier_shifts s
      JOIN users u ON s.cashier_id = u.id
      ORDER BY s.id DESC
      LIMIT 100
    `).all();
    res.json(shifts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/shifts/:id (admin) - Delete a shift record
router.delete('/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    
    // Optional: check if shift is still open? Usually we delete history.
    // If it's open, maybe we shouldn't allow deleting without closing first?
    // But owner probably knows what they are doing.
    
    await db.prepare('DELETE FROM cashier_shifts WHERE id = ?').run(id);
    res.json({ message: 'Data performa kasir berhasil dihapus.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;


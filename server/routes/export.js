const express = require('express');
const db = require('../db').getDb();
const { authenticate, requireRole } = require('../middleware/auth');
const XLSX = require('xlsx');

const router = express.Router();

// Helper: format currency
function formatRp(val) {
  return `Rp ${(val || 0).toLocaleString('id-ID')}`;
}

// GET /api/export/excel/revenue
router.get('/excel/revenue', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { period, date_from, date_to } = req.query;
    let data;

    if (period === 'daily') {
      data = await db.prepare(`
        SELECT date(sold_at) as Tanggal, COUNT(*) as Transaksi, SUM(total) as Omzet, SUM(hpp_total) as HPP, SUM(profit_total) as Laba
        FROM sales WHERE date(sold_at) >= ? AND date(sold_at) <= ?
        GROUP BY date(sold_at) ORDER BY Tanggal
      `).all(date_from || '2024-01-01', date_to || '2099-12-31');
    } else {
      data = await db.prepare(`
        SELECT strftime('%Y-%m', sold_at) as Bulan, COUNT(*) as Transaksi, SUM(total) as Omzet, SUM(hpp_total) as HPP, SUM(profit_total) as Laba
        FROM sales GROUP BY strftime('%Y-%m', sold_at) ORDER BY Bulan
      `).all();
    }

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Laporan Omzet');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=laporan_omzet.xlsx');
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/export/excel/sales
router.get('/excel/sales', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const data = await db.prepare(`
      SELECT p.name as Menu, c.name as Kategori, SUM(si.qty) as 'Qty Terjual', SUM(si.line_total) as 'Total Penjualan', SUM(si.line_hpp) as 'Total HPP', SUM(si.line_profit) as 'Total Laba'
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      LEFT JOIN product_categories c ON p.category_id = c.id
      GROUP BY p.id ORDER BY SUM(si.qty) DESC
    `).all();

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Laporan Penjualan');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=laporan_penjualan.xlsx');
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/export/excel/stock
router.get('/excel/stock', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const data = await db.prepare(`
      SELECT i.name as 'Bahan Baku', u.name as Satuan, i.current_stock as 'Stok Saat Ini', i.min_stock as 'Stok Minimum', i.last_cost as 'Harga Terakhir', i.avg_cost as 'Harga Rata-rata',
        CASE WHEN i.current_stock <= i.min_stock THEN 'RENDAH' ELSE 'OK' END as Status
      FROM ingredients i JOIN units u ON i.unit_id = u.id WHERE i.is_active = 1 ORDER BY i.name
    `).all();

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Laporan Stok');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=laporan_stok.xlsx');
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/export/excel/transactions
router.get('/excel/transactions', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { date_from, date_to } = req.query;
    let sql = `
      SELECT s.invoice_no as 'No Invoice', s.sold_at as 'Waktu', u.name as Kasir, pm.name as 'Metode Bayar', s.subtotal as Subtotal, s.discount_amount as Diskon, s.total as Total, s.hpp_total as HPP, s.profit_total as Laba
      FROM sales s
      LEFT JOIN users u ON s.cashier_id = u.id
      LEFT JOIN payment_methods pm ON s.payment_method_id = pm.id WHERE 1=1
    `;
    const params = [];
    if (date_from) { sql += ' AND date(s.sold_at) >= ?'; params.push(date_from); }
    if (date_to) { sql += ' AND date(s.sold_at) <= ?'; params.push(date_to); }
    sql += ' ORDER BY s.sold_at DESC';

    const data = await db.prepare(sql).all(...params);
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Histori Transaksi');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=histori_transaksi.xlsx');
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

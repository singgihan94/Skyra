const express = require('express');
const router = express.Router();
const db = require('../db').getDb();
const { authenticate, requireRole } = require('../middleware/auth');

// Helper to verify system password
async function verifySystemPassword(password) {
  const settings = await db.prepare('SELECT system_password FROM store_settings WHERE id = 1').get();
  if (!settings) return false;
  // Ensure we compare strings and trim any whitespace
  const storedPwd = String(settings.system_password || '123456').trim();
  const inputPwd = String(password || '').trim();
  return storedPwd === inputPwd;
}

// POST /api/system/clear-transactions - Clear all sales and stock logs
router.post('/clear-transactions', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'Password sistem diperlukan.' });

    const isValid = await verifySystemPassword(password);
    if (!isValid) return res.status(401).json({ error: 'Password sistem salah!' });

    await db.transaction(async () => {
      // 1. Clear sales related data
      await db.prepare('DELETE FROM sale_item_modifiers').run();
      await db.prepare('DELETE FROM sale_items').run();
      await db.prepare('DELETE FROM sales').run();
      
      // 2. Clear stock movements
      await db.prepare('DELETE FROM stock_movements').run();
      
      // 3. Clear shifts/performance data
      await db.prepare('DELETE FROM cashier_shifts').run();
      
      // 4. Reset ingredient stock to 0
      await db.prepare('UPDATE ingredients SET current_stock = 0').run();

      console.log('✅ Transactions and Stock Logs cleared by admin');
    })();

    res.json({ message: 'Semua transaksi dan riwayat stok telah dihapus.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/system/reset-all - Reset everything except users and settings
router.post('/reset-all', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'Password sistem diperlukan.' });

    const isValid = await verifySystemPassword(password);
    if (!isValid) return res.status(401).json({ error: 'Password sistem salah!' });

    await db.transaction(async () => {
      // Order matters due to foreign keys
      const tablesToClear = [
        'sale_item_modifiers', 'sale_items', 'sales',
        'purchase_items', 'purchases', 'stock_movements',
        'modifier_option_recipe_items', 'product_modifier_groups',
        'modifier_options', 'modifier_groups',
        'product_recipe_items', 'products', 'ingredients',
        'suppliers', 'product_categories', 'units', 'payment_methods',
        'cashier_shifts'
      ];

      for (const table of tablesToClear) {
        try {
          await db.prepare(`DELETE FROM ${table}`).run();
          // Reset autoincrement
          await db.prepare(`DELETE FROM sqlite_sequence WHERE name = ?`).run(table);
        } catch (e) {
          console.warn(`[System Reset] Could not clear table ${table}:`, e.message);
        }
      }

      // Re-seed essential master data
      const units = [['Gram','gr'],['Kilogram','kg'],['Mililiter','ml'],['Liter','L'],['Pcs','pcs'],['Pack','pack'],['Botol','btl']];
      for (const [n,c] of units) {
        await db.prepare('INSERT INTO units (name, code) VALUES (?, ?)').run(n, c);
      }

      const cats = ['Kopi','Non-Kopi','Snack','Add-on'];
      for (const c of cats) {
        await db.prepare('INSERT INTO product_categories (name) VALUES (?)').run(c);
      }

      const pms = ['Cash','Transfer','QRIS'];
      for (const p of pms) {
        await db.prepare('INSERT INTO payment_methods (name) VALUES (?)').run(p);
      }

      console.log('✅ Database fully reset by admin');
    })();

    res.json({ message: 'Seluruh data (kecuali User & Pengaturan) telah direset ke nol.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

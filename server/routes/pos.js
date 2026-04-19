const express = require('express');
const db = require('../db').getDb();
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// POST /api/pos/sale - Process a sale transaction
router.post('/sale', authenticate, async (req, res) => {
  try {
    const { payment_method_id, customer_name, discount_amount, cash_received, notes, items } = req.body;

    if (!items || !items.length) return res.status(400).json({ error: 'Minimal 1 item.' });
    if (!payment_method_id) return res.status(400).json({ error: 'Metode pembayaran wajib.' });

    // Ensure there is an active shift
    const activeShift = await db.prepare("SELECT id FROM cashier_shifts WHERE cashier_id = ? AND status = 'open' ORDER BY id DESC LIMIT 1").get(req.user.id);
    if (!activeShift) return res.status(403).json({ error: 'Kasir belum dibuka. Harap buka kasir terlebih dahulu.' });

    // Generate invoice number
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const count = (await db.prepare("SELECT COUNT(*) as c FROM sales WHERE sold_at LIKE ?").get(`${new Date().toISOString().slice(0, 10)}%`)).c;
    const invoice_no = `INV-${today}-${String(count + 1).padStart(4, '0')}`;

    const transaction = db.transaction(async () => {
      let subtotal = 0;
      let hppTotal = 0;
      const processedItems = [];

      for (const item of items) {
        const product = await db.prepare('SELECT * FROM products WHERE id = ?').get(item.product_id);
        if (!product) throw new Error(`Menu ID ${item.product_id} tidak ditemukan.`);

        // Calculate base price with modifiers
        let unitPrice = product.selling_price;
        let unitHpp = 0;

        // Calculate HPP from recipe
        const recipe = await db.prepare(`
          SELECT pri.qty, i.avg_cost, i.last_cost
          FROM product_recipe_items pri
          JOIN ingredients i ON pri.ingredient_id = i.id
          WHERE pri.product_id = ?
        `).all(item.product_id);

        recipe.forEach(r => {
          unitHpp += r.qty * (r.avg_cost || r.last_cost || 0);
        });

        // Process modifiers
        const modifierDetails = [];
        if (item.modifier_option_ids && item.modifier_option_ids.length) {
          for (const optionId of item.modifier_option_ids) {
            const option = await db.prepare('SELECT * FROM modifier_options WHERE id = ?').get(optionId);
            if (option) {
              unitPrice += option.price_adjustment;

              // Calculate HPP impact from modifier
              let modHpp = 0;
              const modRecipe = await db.prepare(`
                SELECT mori.qty_delta, i.avg_cost, i.last_cost
                FROM modifier_option_recipe_items mori
                JOIN ingredients i ON mori.ingredient_id = i.id
                WHERE mori.option_id = ?
              `).all(optionId);

              modRecipe.forEach(r => {
                modHpp += r.qty_delta * (r.avg_cost || r.last_cost || 0);
              });

              unitHpp += modHpp;

              modifierDetails.push({
                option_id: optionId,
                option_name_snapshot: option.name,
                price_adjustment: option.price_adjustment,
                hpp_adjustment: modHpp
              });
            }
          }
        }

        const qty = item.qty || 1;
        const lineTotal = unitPrice * qty;
        const lineHpp = unitHpp * qty;
        const lineProfit = lineTotal - lineHpp;

        subtotal += lineTotal;
        hppTotal += lineHpp;

        processedItems.push({
          product_id: item.product_id,
          qty,
          unit_price: unitPrice,
          unit_hpp_snapshot: unitHpp,
          line_total: lineTotal,
          line_hpp: lineHpp,
          line_profit: lineProfit,
          notes: item.notes || null,
          modifiers: modifierDetails
        });
      }

      const disc = discount_amount || 0;
      const total = subtotal - disc;
      const profitTotal = total - hppTotal;
      const change = (cash_received || 0) - total;

      // Insert sale header
      const saleResult = await db.prepare(`
        INSERT INTO sales (invoice_no, cashier_id, shift_id, payment_method_id, customer_name, subtotal, discount_amount, total, hpp_total, profit_total, cash_received, change_amount, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(invoice_no, req.user.id, activeShift.id, payment_method_id, customer_name || null, subtotal, disc, total, hppTotal, profitTotal, cash_received || 0, change > 0 ? change : 0, notes || null);

      const saleId = saleResult.lastInsertRowid;

      // Insert sale items + modifiers + deduct stock
      const insertSaleItem = db.prepare(`
        INSERT INTO sale_items (sale_id, product_id, qty, unit_price, unit_hpp_snapshot, line_total, line_hpp, line_profit, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const insertModifier = db.prepare(`
        INSERT INTO sale_item_modifiers (sale_item_id, option_id, option_name_snapshot, price_adjustment, hpp_adjustment)
        VALUES (?, ?, ?, ?, ?)
      `);
      const deductStock = db.prepare('UPDATE ingredients SET current_stock = current_stock - ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?');
      const insertMovement = db.prepare(
        'INSERT INTO stock_movements (ingredient_id, movement_type, qty_in, qty_out, balance_after, ref_type, ref_id, created_by, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      );

      for (const pi of processedItems) {
        const siResult = await insertSaleItem.run(saleId, pi.product_id, pi.qty, pi.unit_price, pi.unit_hpp_snapshot, pi.line_total, pi.line_hpp, pi.line_profit, pi.notes);
        const saleItemId = siResult.lastInsertRowid;

        // Insert modifiers
        for (const mod of pi.modifiers) {
          await insertModifier.run(saleItemId, mod.option_id, mod.option_name_snapshot, mod.price_adjustment, mod.hpp_adjustment);
        }

        // Deduct stock from recipe
        const recipe = await db.prepare(`
          SELECT pri.ingredient_id, pri.qty
          FROM product_recipe_items pri
          WHERE pri.product_id = ?
        `).all(pi.product_id);

        for (const r of recipe) {
          const totalDeduct = r.qty * pi.qty;
          await deductStock.run(totalDeduct, r.ingredient_id);
          const ing = await db.prepare('SELECT current_stock FROM ingredients WHERE id = ?').get(r.ingredient_id);
          await insertMovement.run(r.ingredient_id, 'sale', 0, totalDeduct, ing.current_stock, 'sale', saleId, req.user.id, `Penjualan ${invoice_no}`);
        }

        // Deduct stock from modifiers
        if (pi.modifiers.length) {
          for (const mod of pi.modifiers) {
            const modRecipe = await db.prepare('SELECT * FROM modifier_option_recipe_items WHERE option_id = ?').all(mod.option_id);
            for (const mr of modRecipe) {
              const totalDeduct = mr.qty_delta * pi.qty;
              if (totalDeduct > 0) {
                await deductStock.run(totalDeduct, mr.ingredient_id);
                const ing = await db.prepare('SELECT current_stock FROM ingredients WHERE id = ?').get(mr.ingredient_id);
                await insertMovement.run(mr.ingredient_id, 'sale', 0, totalDeduct, ing.current_stock, 'sale', saleId, req.user.id, `Modifier: ${mod.option_name_snapshot}`);
              }
            }
          }
        }
      }

      // Return receipt data
      const paymentMethod = await db.prepare('SELECT name FROM payment_methods WHERE id = ?').get(payment_method_id);

      return {
        id: saleId,
        invoice_no,
        cashier: req.user.name,
        payment_method: paymentMethod?.name || 'Unknown',
        customer_name: customer_name || null,
        items: processedItems,
        subtotal,
        discount_amount: disc,
        total,
        hpp_total: hppTotal,
        profit_total: profitTotal,
        cash_received: cash_received || 0,
        change_amount: change > 0 ? change : 0,
        sold_at: new Date().toISOString()
      };
    });

    const receipt = await transaction();
    res.status(201).json(receipt);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/pos/payment-methods
router.get('/payment-methods', authenticate, async (req, res) => {
  try {
    const methods = await db.prepare('SELECT * FROM payment_methods WHERE is_active = 1').all();
    res.json(methods);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

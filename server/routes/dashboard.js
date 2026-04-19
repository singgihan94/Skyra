const express = require('express');
const db = require('../db').getDb();
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET /api/dashboard
router.get('/', authenticate, async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const currentMonth = today.slice(0, 7);
    const currentYear = today.slice(0, 4);

    if (req.user.role === 'admin') {
      // Owner dashboard
      const todayRevenue = (await db.prepare("SELECT COALESCE(SUM(total),0) as val FROM sales WHERE date(sold_at) = ?").get(today)).val;
      const monthRevenue = (await db.prepare("SELECT COALESCE(SUM(total),0) as val FROM sales WHERE strftime('%Y-%m', sold_at) = ?").get(currentMonth)).val;
      const yearRevenue = (await db.prepare("SELECT COALESCE(SUM(total),0) as val FROM sales WHERE strftime('%Y', sold_at) = ?").get(currentYear)).val;
      const todayProfit = (await db.prepare("SELECT COALESCE(SUM(profit_total),0) as val FROM sales WHERE date(sold_at) = ?").get(today)).val;
      const monthProfit = (await db.prepare("SELECT COALESCE(SUM(profit_total),0) as val FROM sales WHERE strftime('%Y-%m', sold_at) = ?").get(currentMonth)).val;
      const todayTransactions = (await db.prepare("SELECT COUNT(*) as val FROM sales WHERE date(sold_at) = ?").get(today)).val;

      // Top 5 Menu
      const topMenu = await db.prepare(`
        SELECT p.name, SUM(si.qty) as qty
        FROM sale_items si
        JOIN products p ON si.product_id = p.id
        JOIN sales s ON si.sale_id = s.id
        WHERE date(s.sold_at) >= date('now', '-30 days', 'localtime')
        GROUP BY p.id ORDER BY qty DESC LIMIT 5
      `).all();

      // Low stock
      const lowStock = await db.prepare(`
        SELECT i.name, i.current_stock, i.min_stock, u.code as unit_code
        FROM ingredients i
        JOIN units u ON i.unit_id = u.id
        WHERE i.current_stock <= i.min_stock AND i.is_active = 1
        ORDER BY (i.current_stock / CASE WHEN i.min_stock = 0 THEN 1 ELSE i.min_stock END) ASC
        LIMIT 10
      `).all();

      // Revenue last 7 days
      const last7Days = await db.prepare(`
        SELECT date(sold_at) as date, SUM(total) as revenue, SUM(profit_total) as profit
        FROM sales
        WHERE date(sold_at) >= date('now', '-6 days', 'localtime')
        GROUP BY date(sold_at) ORDER BY date ASC
      `).all();

      // Revenue by month (last 6 months)
      const monthlyRevenue = await db.prepare(`
        SELECT strftime('%Y-%m', sold_at) as month, SUM(total) as revenue
        FROM sales
        WHERE sold_at >= date('now', '-6 months', 'localtime')
        GROUP BY strftime('%Y-%m', sold_at) ORDER BY month ASC
      `).all();

      // Payment method breakdown today
      const paymentBreakdown = await db.prepare(`
        SELECT pm.name as method, COUNT(*) as count, SUM(s.total) as total
        FROM sales s
        JOIN payment_methods pm ON s.payment_method_id = pm.id
        WHERE date(s.sold_at) = ?
        GROUP BY pm.id
      `).all(today);

      res.json({
        role: 'admin',
        today_revenue: todayRevenue,
        month_revenue: monthRevenue,
        year_revenue: yearRevenue,
        today_profit: todayProfit,
        month_profit: monthProfit,
        today_transactions: todayTransactions,
        top_menu: topMenu,
        low_stock: lowStock,
        last_7_days: last7Days,
        monthly_revenue: monthlyRevenue,
        payment_breakdown: paymentBreakdown
      });
    } else {
      // Cashier dashboard
      const todayTransactions = (await db.prepare("SELECT COUNT(*) as val FROM sales WHERE date(sold_at) = ? AND cashier_id = ?").get(today, req.user.id)).val;
      const todayItems = (await db.prepare(`
        SELECT COALESCE(SUM(si.qty), 0) as val
        FROM sale_items si
        JOIN sales s ON si.sale_id = s.id
        WHERE date(s.sold_at) = ? AND s.cashier_id = ?
      `).get(today, req.user.id)).val;

      const popularToday = await db.prepare(`
        SELECT p.name, SUM(si.qty) as qty
        FROM sale_items si
        JOIN products p ON si.product_id = p.id
        JOIN sales s ON si.sale_id = s.id
        WHERE date(s.sold_at) = ?
        GROUP BY p.id ORDER BY qty DESC LIMIT 5
      `).all(today);

      res.json({
        role: 'cashier',
        today_transactions: todayTransactions,
        today_items: todayItems,
        popular_today: popularToday
      });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

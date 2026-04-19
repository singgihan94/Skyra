const { createClient } = require('@libsql/client');
const bcrypt = require('bcryptjs');
const { AsyncLocalStorage } = require('async_hooks');

const asyncLocalStorage = new AsyncLocalStorage();

let db = null;

async function initDb() {
  if (db) return db;

  const url = process.env.TURSO_DB_URL || 'file:./data/skyra.db';
  const authToken = process.env.TURSO_DB_AUTH_TOKEN;

  db = createClient({ url, authToken });

  // ─── CREATE ALL 18 TABLES ───────────────────────────────────
  // Note: PRAGMA foreign_keys = ON is enabled by default in libSQL, but we can execute it.
  await db.execute('PRAGMA foreign_keys = ON');

  await db.batch([
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'cashier')),
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    )`,
    `CREATE TABLE IF NOT EXISTS product_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      is_active INTEGER NOT NULL DEFAULT 1
    )`,
    `CREATE TABLE IF NOT EXISTS units (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      code TEXT NOT NULL UNIQUE
    )`,
    `CREATE TABLE IF NOT EXISTS ingredients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      unit_id INTEGER NOT NULL,
      current_stock REAL NOT NULL DEFAULT 0,
      min_stock REAL NOT NULL DEFAULT 0,
      last_cost REAL NOT NULL DEFAULT 0,
      avg_cost REAL NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (unit_id) REFERENCES units(id)
    )`,
    `CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL,
      sku TEXT,
      name TEXT NOT NULL,
      selling_price REAL NOT NULL DEFAULT 0,
      description TEXT,
      image_url TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (category_id) REFERENCES product_categories(id)
    )`,
    `CREATE TABLE IF NOT EXISTS product_recipe_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      ingredient_id INTEGER NOT NULL,
      qty REAL NOT NULL DEFAULT 0,
      waste_pct REAL NOT NULL DEFAULT 0,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY (ingredient_id) REFERENCES ingredients(id)
    )`,
    `CREATE TABLE IF NOT EXISTS modifier_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT,
      is_required INTEGER NOT NULL DEFAULT 0,
      is_multiple INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1
    )`,
    `CREATE TABLE IF NOT EXISTS modifier_options (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      price_adjustment REAL NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (group_id) REFERENCES modifier_groups(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS product_modifier_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      group_id INTEGER NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY (group_id) REFERENCES modifier_groups(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS modifier_option_recipe_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      option_id INTEGER NOT NULL,
      ingredient_id INTEGER NOT NULL,
      qty_delta REAL NOT NULL DEFAULT 0,
      FOREIGN KEY (option_id) REFERENCES modifier_options(id) ON DELETE CASCADE,
      FOREIGN KEY (ingredient_id) REFERENCES ingredients(id)
    )`,
    `CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      address TEXT,
      is_active INTEGER NOT NULL DEFAULT 1
    )`,
    `CREATE TABLE IF NOT EXISTS purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_no TEXT NOT NULL,
      supplier_id INTEGER,
      created_by INTEGER NOT NULL,
      purchase_date TEXT NOT NULL DEFAULT (date('now', 'localtime')),
      subtotal REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    )`,
    `CREATE TABLE IF NOT EXISTS purchase_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_id INTEGER NOT NULL,
      ingredient_id INTEGER NOT NULL,
      qty REAL NOT NULL DEFAULT 0,
      unit_cost REAL NOT NULL DEFAULT 0,
      line_total REAL NOT NULL DEFAULT 0,
      FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
      FOREIGN KEY (ingredient_id) REFERENCES ingredients(id)
    )`,
    `CREATE TABLE IF NOT EXISTS payment_methods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      is_active INTEGER NOT NULL DEFAULT 1
    )`,
    `CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_no TEXT NOT NULL,
      cashier_id INTEGER NOT NULL,
      payment_method_id INTEGER NOT NULL,
      sold_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      customer_name TEXT,
      subtotal REAL NOT NULL DEFAULT (0),
      discount_amount REAL NOT NULL DEFAULT (0),
      total REAL NOT NULL DEFAULT (0),
      hpp_total REAL NOT NULL DEFAULT (0),
      profit_total REAL NOT NULL DEFAULT (0),
      cash_received REAL NOT NULL DEFAULT (0),
      change_amount REAL NOT NULL DEFAULT (0),
      notes TEXT,
      status TEXT NOT NULL DEFAULT ('success'),
      void_at TEXT,
      void_by INTEGER,
      FOREIGN KEY (cashier_id) REFERENCES users(id),
      FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id),
      FOREIGN KEY (void_by) REFERENCES users(id)
    )`,
    `CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      qty INTEGER NOT NULL DEFAULT 1,
      unit_price REAL NOT NULL DEFAULT 0,
      unit_hpp_snapshot REAL NOT NULL DEFAULT 0,
      line_total REAL NOT NULL DEFAULT 0,
      line_hpp REAL NOT NULL DEFAULT 0,
      line_profit REAL NOT NULL DEFAULT 0,
      notes TEXT,
      FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id)
    )`,
    `CREATE TABLE IF NOT EXISTS sale_item_modifiers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_item_id INTEGER NOT NULL,
      option_id INTEGER NOT NULL,
      option_name_snapshot TEXT NOT NULL,
      price_adjustment REAL NOT NULL DEFAULT 0,
      hpp_adjustment REAL NOT NULL DEFAULT 0,
      FOREIGN KEY (sale_item_id) REFERENCES sale_items(id) ON DELETE CASCADE,
      FOREIGN KEY (option_id) REFERENCES modifier_options(id)
    )`,
    `CREATE TABLE IF NOT EXISTS stock_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ingredient_id INTEGER NOT NULL,
      movement_type TEXT NOT NULL,
      qty_in REAL NOT NULL DEFAULT 0,
      qty_out REAL NOT NULL DEFAULT 0,
      balance_after REAL NOT NULL DEFAULT 0,
      ref_type TEXT,
      ref_id INTEGER,
      created_by INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      notes TEXT,
      FOREIGN KEY (ingredient_id) REFERENCES ingredients(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    )`,
    `CREATE TABLE IF NOT EXISTS store_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      store_name TEXT NOT NULL DEFAULT 'Skyra Coffee',
      store_address TEXT DEFAULT '',
      store_phone TEXT DEFAULT '',
      store_instagram TEXT DEFAULT '@skyra.coffee',
      store_logo_url TEXT DEFAULT '',
      qris_base_string TEXT DEFAULT '',
      receipt_footer TEXT DEFAULT 'Terima Kasih!',
      system_password TEXT DEFAULT '123456',
      theme_mode TEXT DEFAULT 'dark',
      brand_color TEXT DEFAULT '#d4a843',
      bg_image_url TEXT DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    )`,
    `CREATE TABLE IF NOT EXISTS cashier_shifts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cashier_id INTEGER NOT NULL,
      start_time TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      end_time TEXT,
      starting_cash REAL NOT NULL DEFAULT 0,
      ending_cash REAL,
      expected_ending_cash REAL,
      total_sales REAL DEFAULT 0,
      total_transactions INTEGER DEFAULT 0,
      status TEXT NOT NULL CHECK(status IN ('open', 'closed')),
      notes TEXT,
      FOREIGN KEY (cashier_id) REFERENCES users(id)
    )`
  ], 'write');

  // Ensure new columns exist for existing DBs
  try {
    const tableMigrations = [
      {
        table: 'store_settings',
        columns: [
          { name: 'system_password', def: "TEXT DEFAULT '123456'" },
          { name: 'qris_base_string', def: "TEXT DEFAULT ''" },
          { name: 'theme_mode', def: "TEXT DEFAULT 'dark'" },
          { name: 'brand_color', def: "TEXT DEFAULT '#d4a843'" },
          { name: 'bg_image_url', def: "TEXT DEFAULT ''" },
        ]
      },
      {
        table: 'sales',
        columns: [
          { name: 'shift_id', def: "INTEGER" },
          { name: 'status', def: "TEXT DEFAULT 'success'" },
          { name: 'void_at', def: "TEXT" },
          { name: 'void_by', def: "INTEGER" }
        ]
      },
      {
        table: 'users',
        columns: [
          { name: 'permissions', def: "TEXT DEFAULT '[]'" }
        ]
      }
    ];

    for (const tm of tableMigrations) {
      const info = await db.execute(`PRAGMA table_info(${tm.table})`);
      const cols = info.rows.map(col => col.name);
      for (const col of tm.columns) {
        if (!cols.includes(col.name)) {
          await db.execute(`ALTER TABLE ${tm.table} ADD COLUMN ${col.name} ${col.def}`);
          console.log(`✅ Added ${col.name} column to ${tm.table}`);
        }
      }
    }
  } catch (err) {
    console.warn('⚠️ Notice: Could not check/add columns:', err.message);
  }

  // ─── SEED DATA ──────────────────────────────────────────────
  const adminCheck = await queryOne('SELECT id FROM users WHERE email = ?', ['admin@skyra.com']);
  if (!adminCheck) {
    const hash = bcrypt.hashSync('admin123', 10);
    await runSql('INSERT INTO users (name, email, password_hash, role, permissions) VALUES (?, ?, ?, ?, ?)', ['Owner', 'admin@skyra.com', hash, 'admin', '[]']);
    const cashierHash = bcrypt.hashSync('kasir123', 10);
    const cashierPerms = JSON.stringify([]);
    await runSql('INSERT INTO users (name, email, password_hash, role, permissions) VALUES (?, ?, ?, ?, ?)', ['Kasir 1', 'kasir@skyra.com', cashierHash, 'cashier', cashierPerms]);
  }

  const unitCheck = await queryOne('SELECT id FROM units LIMIT 1');
  if (!unitCheck) {
    const units = [['Gram','gr'],['Kilogram','kg'],['Mililiter','ml'],['Liter','L'],['Pcs','pcs'],['Pack','pack'],['Botol','btl']];
    for (const [n,c] of units) {
      await runSql('INSERT OR IGNORE INTO units (name, code) VALUES (?, ?)', [n, c]);
    }
  }

  const catCheck = await queryOne('SELECT id FROM product_categories LIMIT 1');
  if (!catCheck) {
    const cats = ['Kopi','Non-Kopi','Snack','Add-on'];
    for (const c of cats) {
      await runSql('INSERT OR IGNORE INTO product_categories (name) VALUES (?)', [c]);
    }
  }

  const pmCheck = await queryOne('SELECT id FROM payment_methods LIMIT 1');
  if (!pmCheck) {
    const pms = ['Cash','Transfer','QRIS'];
    for (const p of pms) {
      await runSql('INSERT OR IGNORE INTO payment_methods (name) VALUES (?)', [p]);
    }
  }

  const settingsCheck = await queryOne('SELECT id FROM store_settings WHERE id = 1');
  if (!settingsCheck) {
    await runSql(`INSERT OR IGNORE INTO store_settings (id, store_name, store_instagram, receipt_footer) VALUES (1, 'Skyra Coffee', '@skyra.coffee', 'Terima Kasih!')`);
  }

  console.log('✅ Turso Database initialized with all 18 tables + seed data');
  return db;
}

// ─── Internal helpers for initDb ─────────
async function queryOne(sql, params = []) {
  const result = await db.execute({ sql, args: params });
  return result.rows[0] || null;
}

async function runSql(sql, params = []) {
  const result = await db.execute({ sql, args: params });
  return {
    lastInsertRowid: result.lastInsertRowid ? Number(result.lastInsertRowid) : undefined,
    changes: result.rowsAffected
  };
}

// ─── Exported Wrapper for the route handlers ─────────
const dbWrapper = {
  prepare: (sql) => ({
    all: async (...params) => {
      const client = asyncLocalStorage.getStore() || db;
      console.log(`[DB] Executing ALL: ${sql.slice(0, 50)}...`);
      const result = await client.execute({ sql, args: params });
      console.log(`[DB] ALL completed, rows: ${result.rows.length}`);
      return result.rows;
    },
    get: async (...params) => {
      const client = asyncLocalStorage.getStore() || db;
      console.log(`[DB] Executing GET: ${sql.slice(0, 50)}...`);
      const result = await client.execute({ sql, args: params });
      console.log(`[DB] GET completed, rows: ${result.rows.length}`);
      return result.rows[0] || null;
    },
    run: async (...params) => {
      const client = asyncLocalStorage.getStore() || db;
      const result = await client.execute({ sql, args: params });
      return {
        lastInsertRowid: result.lastInsertRowid ? Number(result.lastInsertRowid) : undefined,
        changes: result.rowsAffected
      };
    }
  }),
  exec: async (sql) => { 
    const client = asyncLocalStorage.getStore() || db;
    await client.execute(sql); 
  },
  transaction: (fn) => async () => {
    // using libsql transaction features natively and making connection sticky via AsyncLocalStorage
    const trx = await db.transaction('write');
    return asyncLocalStorage.run(trx, async () => {
        try {
            const result = await fn();
            await trx.commit();
            return result;
        } catch (err) {
            await trx.rollback();
            throw err;
        }
    });
  },
  getDb: () => db,
  // saveToFile is discarded as it's Turso
  saveToFile: () => {}
};

module.exports = { initDb, getDb: () => dbWrapper };

const { initDb, getDb } = require('../server/db');
const fs = require('fs');

async function check() {
  try {
    await initDb();
    const db = getDb().getDb();
    const info = await db.execute('PRAGMA table_info(sales)');
    const cols = info.rows.map(r => r.name);
    fs.writeFileSync('scratch/db_check.txt', 'Sales columns: ' + cols.join(', '));
  } catch (err) {
    fs.writeFileSync('scratch/db_check.txt', 'Error: ' + err.message);
  }
  process.exit(0);
}

check();

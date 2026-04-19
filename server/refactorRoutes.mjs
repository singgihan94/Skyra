import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const routesDir = path.resolve(__dirname, 'routes');
const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));

for (const file of files) {
  const filePath = path.join(routesDir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  // 1. Make routes async
  content = content.replace(/router\.(get|post|put|delete)\(\s*(['"][^'"]+['"])\s*,\s*(.*?)(req,\s*res.*?)=>\s*{/g, 'router.$1($2, $3async ($4) => {');

  // 2. Wrap db.prepare(...).all(), get(), run() in await
  // A regex can handle most of this since we made the wrapper methods async
  // Look for: db.prepare(...).all(...)
  // We need to be careful with variable statements like const stmt = db.prepare(...)
  content = content.replace(/db\.prepare\(([^)]*?)\)\.(all|get|run)\(([^)]*?)\)/gs, 'await db.prepare($1).$2($3)');

  // Look for: somethingStmt.all(..)
  content = content.replace(/([a-zA-Z0-9_]+Stmt)\.(all|get|run)\(([^)]*?)\)/gs, 'await $1.$2($3)');

  // 3. db.exec
  content = content.replace(/db\.exec\(([^)]*?)\)/g, 'await db.exec($1)');

  // 4. db.transaction
  // Replace: db.transaction(() => { with db.transaction(async () => {
  content = content.replace(/db\.transaction\(\(\)\s*=>\s*{/g, 'db.transaction(async () => {');
  
  // Replace: transaction(); with await transaction();
  content = content.replace(/transaction\(\);/g, 'await transaction();');

  // Any immediate transaction execution: db.transaction(...)() -> await db.transaction(...)()
  content = content.replace(/\)\(\);/g, ')();');
  content = content.replace(/db\.transaction\(async\s*\(\)\s*=>\s*{.*?\}\)\(\);/gs, (match) => {
    return 'await ' + match;
  });

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Refactored ${file}`);
}

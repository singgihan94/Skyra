const fs = require('fs');
const path = require('path');
const jscodeshift = require('jscodeshift');

const j = jscodeshift.withParser('babel');
const routesDir = path.resolve(__dirname, 'routes');
const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));

for (const file of files) {
  const filePath = path.join(routesDir, file);
  const source = fs.readFileSync(filePath, 'utf8');
  let root = j(source);

  // 1. Make all Express route handlers async
  root.find(j.CallExpression, {
    callee: {
      type: 'MemberExpression',
      property: { name: (name) => ['get', 'post', 'put', 'delete'].includes(name) }
    }
  }).forEach(routePath => {
    const args = routePath.node.arguments;
    for (let i = 0; i < args.length; i++) {
        if (['ArrowFunctionExpression', 'FunctionExpression'].includes(args[i].type)) {
            if (!args[i].async) {
                args[i].async = true;
            }
        }
    }
  });

  // 2. Wrap db.prepare(...).all(), get(), run() in await
  root.find(j.CallExpression).forEach(p => {
    const callee = p.node.callee;
    if (callee.type === 'MemberExpression') {
        const propName = callee.property.name;
        if (['all', 'get', 'run'].includes(propName)) {
            // Only wrap if it's not already an await
            if (p.parentPath.node.type !== 'AwaitExpression') {
                 // Check if object is a call to db.prepare or an identifier (like stmt)
                 let isDbCall = false;
                 if (callee.object.type === 'CallExpression') {
                     if (callee.object.callee.type === 'MemberExpression' && callee.object.callee.property.name === 'prepare') {
                         isDbCall = true;
                     }
                 } else if (callee.object.type === 'Identifier') {
                     isDbCall = true;
                 } else if (callee.object.type === 'AwaitExpression') {
                     // Wait, if the user or my previous script already did `await db.prepare('...').all()` without awaiting the .all(), it would be `(await db.prepare('...')).all()`. Let's fix that.
                     isDbCall = true; // Still needs an outer await!
                 }
                 
                 if (isDbCall) {
                    j(p).replaceWith(j.awaitExpression(p.node));
                 }
            }
        } else if (propName === 'exec' && callee.object.name === 'db') {
            if (p.parentPath.node.type !== 'AwaitExpression') {
                j(p).replaceWith(j.awaitExpression(p.node));
            }
        }
    }
  });

  // 3. transaction blocks
  root.find(j.CallExpression, {
    callee: {
      type: 'MemberExpression',
      property: { name: 'transaction' }
    }
  }).forEach(p => {
    const args = p.node.arguments;
    if (args.length > 0 && ['ArrowFunctionExpression', 'FunctionExpression'].includes(args[0].type)) {
        args[0].async = true;
    }
  });

  // 4. Any standalone identifier `transaction();`
  root.find(j.CallExpression, {
      callee: { type: 'Identifier', name: 'transaction' }
  }).forEach(p => {
      if (p.parentPath.node.type !== 'AwaitExpression') {
          j(p).replaceWith(j.awaitExpression(p.node));
      }
  });

  // 5. Cleanup `await await` just in case my previous regex messed it up
  // Actually jscodeshift doesn't output `await await`.
  
  // We should fetch the original source and apply AST properly to start fresh
  fs.writeFileSync(filePath, root.toSource(), 'utf8');
  console.log(`AST Refactored ${file}`);
}

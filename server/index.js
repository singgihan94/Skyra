require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { initDb } = require('./db');

async function start() {
  // Initialize database first
  await initDb();

  const app = express();
  const PORT = process.env.PORT || 3001;

  // Middleware
  const isProd = process.env.NODE_ENV === 'production';
  const allowedOrigins = [
    'http://localhost:5173', 
    'http://127.0.0.1:5173', 
    'http://localhost:3001',
    process.env.PRODUCTION_URL
  ].filter(Boolean);

  app.use(cors({ 
    origin: isProd ? (process.env.PRODUCTION_URL || true) : allowedOrigins, 
    credentials: true 
  }));
  app.use(express.json());
  app.use(cookieParser());

  // Serve static files from uploads
  const fs = require('fs');
  const path = require('path');
  const uploadsDir = path.join(__dirname, 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  app.use('/uploads', express.static(uploadsDir));

  // Routes
  app.use('/api/shifts', require('./routes/shifts'));
  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/users', require('./routes/users'));
  app.use('/api/units', require('./routes/units'));
  app.use('/api/categories', require('./routes/categories'));
  app.use('/api/ingredients', require('./routes/ingredients'));
  app.use('/api/products', require('./routes/products'));
  app.use('/api/recipes', require('./routes/recipes'));
  app.use('/api/modifiers', require('./routes/modifiers'));
  app.use('/api/suppliers', require('./routes/suppliers'));
  app.use('/api/purchases', require('./routes/purchases'));
  app.use('/api/pos', require('./routes/pos'));
  app.use('/api/transactions', require('./routes/transactions'));
  app.use('/api/reports', require('./routes/reports'));
  app.use('/api/dashboard', require('./routes/dashboard'));
  app.use('/api/export', require('./routes/export'));
  app.use('/api/settings', require('./routes/settings'));
  app.use('/api/system', require('./routes/system'));

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Serve static files from React app in production
  if (isProd) {
    const clientDist = path.join(__dirname, '../client/dist');
    app.use(express.static(clientDist));
    
    // Catch-all route for React Router SPA
    app.get('*', (req, res) => {
      // Don't catch API or uploads routes
      if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
        return res.status(404).json({ error: 'Not found' });
      }
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  } else {
    // 404 Not Found Handler (JSON)
    app.use((req, res) => {
      res.status(404).json({ error: `Route ${req.method} ${req.originalUrl} not found.` });
    });
  }

  // Global Error Handler
  app.use((err, req, res, next) => {
    console.error('SERVER ERROR:', err);
    res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
  });

  // Start server
  app.listen(PORT, () => {
    console.log(`☕ Skyra Coffee Server running on http://localhost:${PORT}`);
  });
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

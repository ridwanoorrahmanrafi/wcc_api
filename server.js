import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB, isDatabaseConnected } from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import memberRoutes from './routes/memberRoutes.js';
import financeRoutes from './routes/financeRoutes.js';
import auditRoutes from './routes/auditRoutes.js';
import wingRoutes from './routes/wingRoutes.js';
import programRoutes from './routes/programRoutes.js';
import eventRoutes from './routes/eventRoutes.js';
import issueRoutes from './routes/issueRoutes.js';
import statsRoutes from './routes/statsRoutes.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize Database connection (handles MongoDB or resilient store)
connectDB();

// Middleware
app.use(
  cors({
    origin: '*',
    credentials: true
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// Root route
app.get('/', (req, res) => {
  res.json({
    name: 'We Can Change (WCC) API Service',
    version: '1.0.0',
    status: 'active',
    database: isDatabaseConnected() ? 'MongoDB (Connected)' : 'Resilient In-Memory Store (Active)',
    endpoints: {
      auth: '/api/auth',
      members: '/api/members',
      finance: '/api/finance',
      audit: '/api/audit',
      wings: '/api/wings',
      programs: '/api/programs',
      events: '/api/events',
      issues: '/api/issues',
      stats: '/api/stats',
      health: '/api/health'
    }
  });
});

// Health check route
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'wcc_api is running smoothly',
    database: isDatabaseConnected() ? 'MongoDB' : 'MemoryCache',
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/wings', wingRoutes);
app.use('/api/programs', programRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/issues', issueRoutes);
app.use('/api/stats', statsRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.originalUrl} not found` });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[API Error]', err.stack || err.message);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error'
  });
});

// Start listening
const server = app.listen(PORT, () => {
  console.log(`[wcc_api] Server running on http://localhost:${PORT}`);
  console.log(`[wcc_api] Health check: http://localhost:${PORT}/api/health`);
});

export default app;

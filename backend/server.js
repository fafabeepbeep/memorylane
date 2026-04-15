// server.js – MemoryLane Express Server

require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const connectDB = require('./config/db');
const { initFirebase } = require('./config/firebase');
const { initWS } = require('./sockets/wsServer');

const eventsRouter = require('./routes/events');
const usersRouter = require('./routes/users');
const photosRouter = require('./routes/photos');

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Security & Middleware ────────────────────────────────────────────────────

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (curl, Postman, same-origin)
      if (!origin) return callback(null, true);

      const allowed = process.env.CORS_ORIGIN || '';

      // In development: allow any localhost / 127.0.0.1 port
      const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

      if (isLocalhost || origin === allowed) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin ${origin} not allowed`));
      }
    },
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'x-admin-secret', 'Authorization'],
    credentials: true,
  })
);

app.use(morgan('dev'));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ─── Rate Limiting ─────────────────────────────────────────────────────────
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  message: { success: false, message: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 uploads per minute per IP
  message: { success: false, message: 'Upload limit reached. Please wait a moment.' },
});

app.use('/api/', generalLimiter);
app.use('/api/photos/upload', uploadLimiter);

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/events', eventsRouter);
app.use('/api/users', usersRouter);
app.use('/api/photos', photosRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), service: 'MemoryLane API' });
});

// 404
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found` });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
  });
});

// ─── Bootstrap ────────────────────────────────────────────────────────────────
const startServer = async () => {
  await connectDB();
  initFirebase();

  const httpServer = http.createServer(app);
  initWS(httpServer);

  httpServer.listen(PORT, () => {
    console.log(`\n🚀 MemoryLane server running on http://localhost:${PORT}`);
    console.log(`   WebSocket: ws://localhost:${PORT}/ws?event=EVENTCODE`);
    console.log(`   Health:    http://localhost:${PORT}/health\n`);
  });
};

startServer().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
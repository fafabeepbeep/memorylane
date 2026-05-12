// server.js – MemoryLane Express Server (production-ready)

require('dotenv').config();
const http = require('http');
const os = require('os');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const connectDB = require('./config/db');
const { initFirebase } = require('./config/firebase');
const { initWS } = require('./sockets/wsServer');
const { initCleanupJob } = require('./cron/cleanup');

const eventsRouter = require('./routes/events');
const usersRouter = require('./routes/users');
const photosRouter = require('./routes/photos');
const adminRouter = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0'; // listen on all interfaces

app.set('trust proxy', 1); // required for Render/Railway/etc.

// ─── Security ─────────────────────────────────────────────────────────────────
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false,
  })
);

// ─── CORS (LAN + tunnel + production aware) ──────────────────────────────────
const explicitOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);

      let hostname = '';
      try { hostname = new URL(origin).hostname; } catch { hostname = ''; }

      const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|192\.168\.)/.test(origin);
      const isTunnel = /\.(ngrok-free\.app|ngrok\.io|trycloudflare\.com|loca\.lt|vercel\.app|netlify\.app|onrender\.com|railway\.app)$/.test(hostname);
      const isAllowed = explicitOrigins.includes(origin) || explicitOrigins.includes('*');

      if (isLocal || isTunnel || isAllowed) return callback(null, true);
      console.warn(`⚠️  CORS blocked origin: ${origin}`);
      callback(new Error(`CORS: ${origin} not allowed`));
    },
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'x-admin-secret', 'Authorization'],
    credentials: true,
  })
);

app.use(morgan(process.env.NODE_ENV === 'production' ? 'tiny' : 'dev'));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ─── Rate Limiting ────────────────────────────────────────────────────────────
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { success: false, message: 'Too many requests, please try again later.' },
  standardHeaders: true, legacyHeaders: false,
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 12,
  message: { success: false, message: 'Upload limit reached. Please wait a moment.' },
  standardHeaders: true, legacyHeaders: false,
});

app.use('/api/', generalLimiter);
app.use('/api/photos/upload', uploadLimiter);

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/admin', adminRouter);
app.use('/api/events', eventsRouter);
app.use('/api/users', usersRouter);
app.use('/api/photos', photosRouter);

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'MemoryLane API',
    uptime_sec: Math.floor(process.uptime()),
  });
});

app.get('/', (req, res) => {
  res.json({
    service: 'MemoryLane API',
    health: '/health',
    endpoints: ['/api/admin/login', '/api/events', '/api/users/join', '/api/photos/:eventCode'],
  });
});

app.use((req, res) => res.status(404).json({ success: false, message: `Not found: ${req.method} ${req.path}` }));

app.use((err, req, res, next) => {
  console.error('❌ Error:', err.message);
  res.status(err.status || 500).json({ success: false, message: err.message || 'Internal server error' });
});

// ─── Helper: discover LAN IPs for nice startup banner ────────────────────────
function getLanIPs() {
  const ifaces = os.networkInterfaces();
  const ips = [];
  Object.values(ifaces).forEach((iface) =>
    iface.forEach((addr) => { if (addr.family === 'IPv4' && !addr.internal) ips.push(addr.address); })
  );
  return ips;
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────
const startServer = async () => {
  await connectDB();
  initFirebase();

  const httpServer = http.createServer(app);
  initWS(httpServer);

  httpServer.listen(PORT, HOST, () => {
    const lanIPs = getLanIPs();
    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║   🚀  MemoryLane API — RUNNING                          ');
    console.log('╠════════════════════════════════════════════════════════╣');
    console.log(`║   Local:    http://localhost:${PORT}`);
    lanIPs.forEach((ip) => console.log(`║   LAN:      http://${ip}:${PORT}     ← share this on WiFi`));
    console.log(`║   Health:   /health`);
    console.log(`║   WS:       ws://<host>:${PORT}/ws?event=CODE`);
    console.log('╚════════════════════════════════════════════════════════╝\n');

    initCleanupJob();
  });

  process.on('SIGTERM', () => {
    console.log('\n⚠️  SIGTERM, shutting down…');
    httpServer.close(() => process.exit(0));
  });
};

startServer().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
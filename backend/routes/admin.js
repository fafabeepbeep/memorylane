// routes/admin.js – Admin authentication endpoint

const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { manualCleanup, getStatus } = require('../cron/cleanup');

// Strict rate limit on login attempts to prevent brute force
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 8, // 8 attempts per IP per 15min
  message: { success: false, message: 'Too many login attempts. Try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── POST /api/admin/login ────────────────────────────────────────────────────
router.post('/login', loginLimiter, (req, res) => {
  // Accept either { secret } or { password } in body
  const provided = (req.body?.secret || req.body?.password || '').toString().trim();
  const expected = (process.env.ADMIN_SECRET || '').trim();

  if (!expected) {
    return res.status(500).json({
      success: false,
      message: 'Server misconfigured: ADMIN_SECRET not set in environment',
    });
  }

  if (!provided) {
    return res.status(400).json({ success: false, message: 'Secret is required' });
  }

  if (provided !== expected) {
    return res.status(401).json({ success: false, message: 'Wrong secret key' });
  }

  // Success — return the same secret as the "token" (frontend stores it for header auth)
  res.json({
    success: true,
    message: 'Authenticated',
    token: provided,
    expires_in: 24 * 60 * 60, // logical hint only — frontend sets its own session
  });
});

// ─── POST /api/admin/verify ─────────────────────────────────────────────────
// Lightweight check used on page load to confirm a stored token is still valid
router.post('/verify', (req, res) => {
  const provided = (req.headers['x-admin-secret'] || req.body?.token || '').toString().trim();
  const expected = (process.env.ADMIN_SECRET || '').trim();
  if (!provided || provided !== expected) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
  res.json({ success: true });
});

// ─── Admin auth middleware (used below) ────────────────────────────────────
const requireAdmin = (req, res, next) => {
  const secret = (req.headers['x-admin-secret'] || '').trim();
  if (secret !== (process.env.ADMIN_SECRET || '').trim()) {
    return res.status(403).json({ success: false, message: 'Unauthorized' });
  }
  next();
};

// ─── POST /api/admin/cleanup ────────────────────────────────────────────────
// Manually trigger 24h cleanup (e.g. from admin dashboard)
router.post('/cleanup', requireAdmin, async (req, res) => {
  try {
    const result = await manualCleanup();
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/admin/cleanup/status ──────────────────────────────────────────
router.get('/cleanup/status', requireAdmin, (req, res) => {
  res.json({ success: true, status: getStatus() });
});

module.exports = router;
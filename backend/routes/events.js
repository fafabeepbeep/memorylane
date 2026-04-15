// routes/events.js – Event CRUD + validation

const express = require('express');
const router = express.Router();
const Event = require('../models/Event');
const User = require('../models/User');
const Photo = require('../models/Photo');
const { broadcastToEvent } = require('../sockets/wsServer');

// ─── Admin Auth Middleware ─────────────────────────────────────────────────────
const requireAdmin = (req, res, next) => {
  const secret = (req.headers['x-admin-secret'] || req.body?.admin_secret || req.query?.admin_secret || '').trim();
  const expected = (process.env.ADMIN_SECRET || '').trim();

  if (!expected) {
    return res.status(500).json({ success: false, message: 'ADMIN_SECRET not set in .env' });
  }
  if (secret !== expected) {
    return res.status(403).json({ success: false, message: 'Unauthorized – wrong admin secret' });
  }
  next();
};

// ─── GET /api/events – list all events (admin) ───────────────────────────────
router.get('/', requireAdmin, async (req, res) => {
  try {
    const events = await Event.find().sort({ created_at: -1 }).lean();
    res.json({ success: true, events });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /api/events – create new event (admin) ─────────────────────────────
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { event_name, event_code, event_end_time, moderation_enabled } = req.body;

    if (!event_name || !event_code) {
      return res.status(400).json({ success: false, message: 'event_name and event_code are required' });
    }

    // Normalize code
    const code = event_code.toUpperCase().replace(/\s+/g, '');

    const existing = await Event.findOne({ event_code: code });
    if (existing) {
      return res.status(409).json({ success: false, message: `Event code "${code}" already exists` });
    }

    const event = await Event.create({
      event_name: event_name.trim(),
      event_code: code,
      event_end_time: event_end_time ? new Date(event_end_time) : null,
      moderation_enabled: moderation_enabled === true || moderation_enabled === 'true',
      is_active: true,
    });

    res.status(201).json({
      success: true,
      message: 'Event created',
      event,
      join_url: `${req.protocol}://${req.get('host').replace('3001', '5500')}/index.html?event=${code}`,
      qr_url: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(`http://localhost:5500/index.html?event=${code}`)}`,
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'Event code already taken' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/events/validate/:code – validate event code (public) ────────────
router.get('/validate/:code', async (req, res) => {
  try {
    const code = req.params.code.toUpperCase();
    const event = await Event.findOne({ event_code: code }).lean();

    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    if (!event.is_active) {
      return res.status(403).json({ success: false, message: 'This event is no longer active' });
    }

    if (event.event_end_time && new Date() > new Date(event.event_end_time)) {
      return res.status(403).json({ success: false, message: 'This event has ended' });
    }

    res.json({
      success: true,
      event: {
        _id: event._id,
        event_name: event.event_name,
        event_code: event.event_code,
        is_active: event.is_active,
        event_end_time: event.event_end_time,
        moderation_enabled: event.moderation_enabled,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/events/:id – get single event info (admin) ─────────────────────
router.get('/:id', requireAdmin, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id).lean();
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

    const [userCount, photoCount] = await Promise.all([
      User.countDocuments({ event_id: event._id }),
      Photo.countDocuments({ event_id: event._id }),
    ]);

    res.json({ success: true, event: { ...event, userCount, photoCount } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── PATCH /api/events/:id – update event (admin) ────────────────────────────
router.patch('/:id', requireAdmin, async (req, res) => {
  try {
    const allowed = ['event_name', 'is_active', 'event_end_time', 'moderation_enabled'];
    const update = {};
    allowed.forEach((k) => { if (req.body[k] !== undefined) update[k] = req.body[k]; });

    const event = await Event.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!event) return res.status(404).json({ success: false, message: 'Not found' });

    broadcastToEvent(event.event_code, { type: 'EVENT_UPDATED', event });

    res.json({ success: true, event });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── DELETE /api/events/:id – delete event + all data (admin) ────────────────
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ success: false, message: 'Not found' });

    await Promise.all([
      Photo.deleteMany({ event_id: event._id }),
      User.deleteMany({ event_id: event._id }),
      Event.deleteOne({ _id: event._id }),
    ]);

    res.json({ success: true, message: 'Event and all associated data deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
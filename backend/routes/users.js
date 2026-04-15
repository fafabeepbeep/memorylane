// routes/users.js – User join / session handling

const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Event = require('../models/Event');

// ─── POST /api/users/join – join an event ─────────────────────────────────────
router.post('/join', async (req, res) => {
  try {
    const { name, event_code } = req.body;

    if (!name || !event_code) {
      return res.status(400).json({ success: false, message: 'name and event_code are required' });
    }

    const code = event_code.toUpperCase().trim();
    const cleanName = name.trim().slice(0, 60);

    // Validate event
    const event = await Event.findOne({ event_code: code });

    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found. Check the event code.' });
    }

    if (!event.is_active) {
      return res.status(403).json({ success: false, message: 'This event is closed.' });
    }

    if (event.event_end_time && new Date() > new Date(event.event_end_time)) {
      return res.status(403).json({ success: false, message: 'This event has ended.' });
    }

    // Create user (allow multiple entries with same name – they're just display names)
    const user = await User.create({
      name: cleanName,
      event_id: event._id,
    });

    // Increment event guest count
    await Event.updateOne({ _id: event._id }, { $inc: { guest_count: 1 } });

    res.status(201).json({
      success: true,
      message: `Welcome, ${cleanName}!`,
      user: {
        _id: user._id,
        name: user.name,
        joined_at: user.joined_at,
      },
      event: {
        _id: event._id,
        event_name: event.event_name,
        event_code: event.event_code,
        moderation_enabled: event.moderation_enabled,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/users/event/:eventCode – get all users in event (admin) ─────────
router.get('/event/:eventCode', async (req, res) => {
  try {
    const secret = req.headers['x-admin-secret'];
    if (secret !== process.env.ADMIN_SECRET) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const event = await Event.findOne({ event_code: req.params.eventCode.toUpperCase() });
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

    const users = await User.find({ event_id: event._id }).sort({ joined_at: 1 }).lean();
    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
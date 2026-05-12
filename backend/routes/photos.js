// routes/photos.js – Photo upload, gallery, like, comment, approve, delete

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const upload = require('../middleware/upload');
const Photo = require('../models/Photo');
const Event = require('../models/Event');
const User = require('../models/User');
const { uploadToFirebase, deleteFromFirebase } = require('../config/firebase');
const { broadcastToEvent } = require('../sockets/wsServer');

// ─── Admin middleware ─────────────────────────────────────────────────────────
const requireAdmin = (req, res, next) => {
  const secret = req.headers['x-admin-secret'] || req.body?.admin_secret;
  if (secret !== process.env.ADMIN_SECRET) {
    return res.status(403).json({ success: false, message: 'Unauthorized' });
  }
  next();
};

// ─── POST /api/photos/upload ──────────────────────────────────────────────────
router.post('/upload', upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const { event_code, user_id } = req.body;

    if (!event_code || !user_id) {
      return res.status(400).json({ success: false, message: 'event_code and user_id are required' });
    }

    // Validate event
    const event = await Event.findOne({ event_code: event_code.toUpperCase() });
    if (!event || !event.is_active) {
      return res.status(404).json({ success: false, message: 'Event not found or inactive' });
    }

    // Validate user belongs to this event
    const user = await User.findOne({ _id: user_id, event_id: event._id });
    if (!user) {
      return res.status(403).json({ success: false, message: 'User not part of this event' });
    }

    // Build Firebase path
    const ext = req.file.mimetype === 'image/png' ? 'png' : 'jpg';
    const uid = uuidv4();
    const firebasePath = `events/${event.event_code}/${uid}.${ext}`;

    // Upload to Firebase
    const imageUrl = await uploadToFirebase(req.file.buffer, firebasePath, req.file.mimetype);

    // Save metadata to MongoDB
    const photo = await Photo.create({
      event_id: event._id,
      user_id: user._id,
      user_name: user.name,
      image_url: imageUrl,
      firebase_path: firebasePath,
      file_size: req.file.size,
      mime_type: req.file.mimetype,
      approved: !event.moderation_enabled, // auto-approve if moderation is off
    });

    // Increment counters
    await Promise.all([
      Event.updateOne({ _id: event._id }, { $inc: { photo_count: 1 } }),
      User.updateOne({ _id: user._id }, { $inc: { photo_count: 1 } }),
    ]);

    // Broadcast via WebSocket if auto-approved
    if (photo.approved) {
      broadcastToEvent(event.event_code, {
        type: 'NEW_PHOTO',
        photo: {
          _id: photo._id,
          image_url: photo.image_url,
          user_name: photo.user_name,
          likes: 0,
          comments: [],
          timestamp: photo.timestamp,
        },
      });
    }

    res.status(201).json({
      success: true,
      message: photo.approved ? 'Photo uploaded!' : 'Photo uploaded – pending approval',
      photo: {
        _id: photo._id,
        image_url: photo.image_url,
        user_name: photo.user_name,
        approved: photo.approved,
        timestamp: photo.timestamp,
      },
    });
  } catch (err) {
    console.error('Upload error:', err);
    if (err.message?.includes('File too large')) {
      return res.status(413).json({ success: false, message: 'File too large. Max 3MB.' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/photos/:eventCode – fetch photos for gallery ────────────────────
router.get('/:eventCode', async (req, res) => {
  try {
    const event = await Event.findOne({ event_code: req.params.eventCode.toUpperCase() }).lean();
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 30;
    const skip = (page - 1) * limit;

    // Admin can see unapproved; public only sees approved AND non-expired
    const isAdmin = req.headers['x-admin-secret'] === process.env.ADMIN_SECRET;
    const filter = { event_id: event._id };
    if (!isAdmin) {
      filter.approved = true;
      filter.expires_at = { $gt: new Date() }; // hide expired photos in real-time
    }

    const [photos, total] = await Promise.all([
      Photo.find(filter)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .select('-liked_by -__v')
        .lean(),
      Photo.countDocuments(filter),
    ]);

    res.json({
      success: true,
      photos,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/photos/:eventCode/since/:timestamp – polling endpoint ───────────
router.get('/:eventCode/since/:timestamp', async (req, res) => {
  try {
    const event = await Event.findOne({ event_code: req.params.eventCode.toUpperCase() }).lean();
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

    const since = new Date(parseInt(req.params.timestamp));

    const photos = await Photo.find({
      event_id: event._id,
      approved: true,
      timestamp: { $gt: since },
      expires_at: { $gt: new Date() }, // exclude any that just expired
    })
      .sort({ timestamp: -1 })
      .select('-liked_by -__v')
      .lean();

    res.json({ success: true, photos, timestamp: Date.now() });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /api/photos/:photoId/like – like / unlike ──────────────────────────
router.post('/:photoId/like', async (req, res) => {
  try {
    const { user_id } = req.body;
    if (!user_id) return res.status(400).json({ success: false, message: 'user_id required' });

    const photo = await Photo.findById(req.params.photoId);
    if (!photo) return res.status(404).json({ success: false, message: 'Photo not found' });

    const alreadyLiked = photo.liked_by.includes(user_id.toString());

    if (alreadyLiked) {
      // Unlike
      photo.liked_by.pull(user_id.toString());
      photo.likes = Math.max(0, photo.likes - 1);
    } else {
      // Like
      photo.liked_by.push(user_id.toString());
      photo.likes += 1;
    }

    await photo.save();

    // Broadcast like count update
    const event = await Event.findById(photo.event_id).lean();
    if (event) {
      broadcastToEvent(event.event_code, {
        type: 'LIKE_UPDATE',
        photoId: photo._id,
        likes: photo.likes,
      });
    }

    res.json({ success: true, liked: !alreadyLiked, likes: photo.likes });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /api/photos/:photoId/comment ───────────────────────────────────────
router.post('/:photoId/comment', async (req, res) => {
  try {
    const { user_id, text } = req.body;
    if (!user_id || !text) {
      return res.status(400).json({ success: false, message: 'user_id and text required' });
    }

    const photo = await Photo.findById(req.params.photoId);
    if (!photo) return res.status(404).json({ success: false, message: 'Photo not found' });

    const user = await User.findById(user_id).lean();
    const comment = {
      user_id,
      user_name: user?.name || 'Anonymous',
      text: text.trim().slice(0, 300),
      created_at: new Date(),
    };

    photo.comments.push(comment);
    await photo.save();

    const event = await Event.findById(photo.event_id).lean();
    if (event) {
      broadcastToEvent(event.event_code, {
        type: 'NEW_COMMENT',
        photoId: photo._id,
        comment,
      });
    }

    res.status(201).json({ success: true, comment });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── PATCH /api/photos/:photoId/approve – admin approve/reject ───────────────
router.patch('/:photoId/approve', requireAdmin, async (req, res) => {
  try {
    const { approved } = req.body;
    const photo = await Photo.findByIdAndUpdate(
      req.params.photoId,
      { approved },
      { new: true }
    ).lean();

    if (!photo) return res.status(404).json({ success: false, message: 'Not found' });

    const event = await Event.findById(photo.event_id).lean();
    if (event && approved) {
      broadcastToEvent(event.event_code, { type: 'NEW_PHOTO', photo });
    }

    res.json({ success: true, photo });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── DELETE /api/photos/:photoId – admin delete ───────────────────────────────
router.delete('/:photoId', requireAdmin, async (req, res) => {
  try {
    const photo = await Photo.findById(req.params.photoId);
    if (!photo) return res.status(404).json({ success: false, message: 'Not found' });

    if (photo.firebase_path) {
      await deleteFromFirebase(photo.firebase_path);
    }

    const event = await Event.findById(photo.event_id).lean();
    await Photo.deleteOne({ _id: photo._id });

    if (event) {
      broadcastToEvent(event.event_code, { type: 'PHOTO_DELETED', photoId: photo._id });
    }

    res.json({ success: true, message: 'Photo deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
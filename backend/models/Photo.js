// models/Photo.js

const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  user_name: String,
  text: { type: String, maxlength: 300 },
  created_at: { type: Date, default: Date.now },
});

const photoSchema = new mongoose.Schema(
  {
    event_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    user_name: {
      type: String,
      default: 'Anonymous',
    },
    image_url: {
      type: String,
      required: true,
    },
    firebase_path: {
      type: String, // e.g. events/EVENTCODE/uuid.jpg — for deletion
    },
    thumbnail_url: {
      type: String,
      default: null,
    },
    likes: {
      type: Number,
      default: 0,
    },
    liked_by: [
      {
        type: String, // stores session IDs / user IDs as strings to prevent duplicate likes
      },
    ],
    approved: {
      type: Boolean,
      default: true, // true = visible immediately; false = pending moderation
    },
    comments: [commentSchema],
    file_size: {
      type: Number, // bytes
      default: 0,
    },
    mime_type: {
      type: String,
      default: 'image/jpeg',
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: false }
);

photoSchema.index({ event_id: 1, approved: 1, timestamp: -1 });
photoSchema.index({ event_id: 1, timestamp: -1 });
photoSchema.index({ user_id: 1 });

module.exports = mongoose.model('Photo', photoSchema);
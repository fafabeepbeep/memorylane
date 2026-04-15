// models/Event.js

const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema(
  {
    event_name: {
      type: String,
      required: [true, 'Event name is required'],
      trim: true,
      maxlength: [100, 'Event name cannot exceed 100 characters'],
    },
    event_code: {
      type: String,
      required: [true, 'Event code is required'],
      unique: true,
      uppercase: true,
      trim: true,
      minlength: [4, 'Event code must be at least 4 characters'],
      maxlength: [20, 'Event code cannot exceed 20 characters'],
      match: [/^[A-Z0-9]+$/, 'Event code must contain only letters and numbers'],
    },
    is_active: {
      type: Boolean,
      default: true,
    },
    moderation_enabled: {
      type: Boolean,
      default: false, // if true, photos require admin approval before display
    },
    event_end_time: {
      type: Date,
      default: null, // null means no set end time
    },
    created_at: {
      type: Date,
      default: Date.now,
    },
    photo_count: {
      type: Number,
      default: 0,
    },
    guest_count: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: false }
);

// Index for fast lookup by event code
eventSchema.index({ event_code: 1 });
eventSchema.index({ is_active: 1 });

// Virtual: is the event expired?
eventSchema.virtual('is_expired').get(function () {
  if (!this.event_end_time) return false;
  return new Date() > this.event_end_time;
});

// Before saving, uppercase the event code
eventSchema.pre('save', function (next) {
  this.event_code = this.event_code.toUpperCase();
  next();
});

module.exports = mongoose.model('Event', eventSchema);
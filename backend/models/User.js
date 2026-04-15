// models/User.js

const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [60, 'Name cannot exceed 60 characters'],
    },
    event_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
    },
    joined_at: {
      type: Date,
      default: Date.now,
    },
    photo_count: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: false }
);

userSchema.index({ event_id: 1 });
userSchema.index({ event_id: 1, name: 1 }); // Quick lookup by name within event

module.exports = mongoose.model('User', userSchema);
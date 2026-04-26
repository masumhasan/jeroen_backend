const mongoose = require('mongoose');

const supportMessageSchema = new mongoose.Schema(
  {
    from: {
      type: String,
      enum: ['user', 'admin'],
      required: true,
    },
    body: {
      type: String,
      default: '',
      trim: true,
      maxlength: 4000,
    },
    imageUrl: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

const supportThreadSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    messages: [supportMessageSchema],
    /** New user messages since admin last opened thread (dashboard badge). */
    adminUnreadCount: { type: Number, default: 0 },
    /** New admin replies since user last called mark-read (optional app badge). */
    userUnreadCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

supportThreadSchema.index({ updatedAt: -1 });

module.exports = mongoose.model('SupportThread', supportThreadSchema);

const mongoose = require('mongoose');

const bookAccessRequestSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    bookSku: {
      type: String,
      required: true,
      trim: true,
    },
    bookTitle: {
      type: String,
      required: true,
      trim: true,
    },
    requestEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    note: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
    adminNote: {
      type: String,
      trim: true,
      default: null,
    },
    dismissedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

const BookAccessRequest = mongoose.model('BookAccessRequest', bookAccessRequestSchema);
module.exports = BookAccessRequest;

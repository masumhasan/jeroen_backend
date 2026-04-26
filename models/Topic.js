const mongoose = require('mongoose');

const topicSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Topic name is required'],
      trim: true,
      unique: true,
      minlength: [2, 'Topic name must be at least 2 characters'],
      maxlength: [60, 'Topic name must be at most 60 characters']
    },
    description: {
      type: String,
      trim: true,
      default: ''
    },
    color: {
      type: String,
      trim: true,
      default: '#89957F'
    },
    followerCount: {
      type: Number,
      default: 0
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  { timestamps: true }
);

topicSchema.index({ name: 1 }, { unique: true });

module.exports = mongoose.model('Topic', topicSchema);

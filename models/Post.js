const mongoose = require('mongoose');

const postCommentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: [500, 'Comment must be at most 500 characters']
    }
  },
  { timestamps: true }
);

const postSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    topic: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Topic',
      required: true,
      index: true
    },
    topics: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Topic'
        }
      ],
      default: [],
      index: true,
      validate: {
        validator: function (value) {
          return Array.isArray(value) && value.length > 0;
        },
        message: 'At least one topic is required'
      }
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: [2000, 'Post content must be at most 2000 characters']
    },
    image: {
      type: String,
      trim: true,
      default: null
    },
    likedBy: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: 'User',
      default: []
    },
    comments: {
      type: [postCommentSchema],
      default: []
    }
  },
  { timestamps: true }
);

postSchema.index({ createdAt: -1 });

postSchema.pre('validate', function (next) {
  if ((!this.topics || this.topics.length === 0) && this.topic) {
    this.topics = [this.topic];
  }
  if ((!this.topic || String(this.topic).trim() === '') && this.topics?.length) {
    this.topic = this.topics[0];
  }
  next();
});

module.exports = mongoose.model('Post', postSchema);

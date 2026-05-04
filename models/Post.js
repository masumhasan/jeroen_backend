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
      trim: true,
      maxlength: [2000, 'Post content must be at most 2000 characters']
    },
    postType: {
      type: String,
      enum: ['text', 'meal_plan'],
      default: 'text'
    },
    mealPlanData: {
      day: { type: String },
      targetCalories: { type: Number },
      meals: [
        {
          mealType: { type: String },
          name: { type: String },
          calories: { type: Number },
          protein: { type: Number },
          carbs: { type: Number },
          fat: { type: Number },
          image: { type: String }
        }
      ],
      totalCalories: { type: Number },
      totalProtein: { type: Number },
      totalCarbs: { type: Number },
      totalFat: { type: Number }
    },
    mealPlanHtml: {
      type: String,
      default: null
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
  if (!this.content && this.postType === 'meal_plan') {
    this.content = 'Shared my daily meal plan';
  }
  next();
});

module.exports = mongoose.model('Post', postSchema);

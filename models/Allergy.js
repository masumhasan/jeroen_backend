const mongoose = require('mongoose');

const allergySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Allergy name is required'],
      trim: true,
      unique: true,
      minlength: [2, 'Allergy name must be at least 2 characters'],
      maxlength: [60, 'Allergy name must be at most 60 characters']
    },
    description: {
      type: String,
      trim: true,
      default: ''
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  { timestamps: true }
);

allergySchema.index({ name: 1 }, { unique: true });

module.exports = mongoose.model('Allergy', allergySchema);

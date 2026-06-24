const express = require('express');
const { uploadSupport } = require('../config/multer');
const { protect } = require('../middleware/authMiddleware');
const supportController = require('../controllers/supportController');

const router = express.Router();

function optionalSupportImageUpload(req, res, next) {
  if (req.is('multipart/form-data')) {
    return uploadSupport.single('support_image')(req, res, next);
  }
  return next();
}

router.get('/thread', protect, supportController.getMyThread);
router.patch('/thread/read', protect, supportController.markMyThreadRead);
router.post(
  '/messages',
  protect,
  optionalSupportImageUpload,
  supportController.postUserMessage
);

module.exports = router;

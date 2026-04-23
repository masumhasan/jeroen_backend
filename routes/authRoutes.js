const express = require('express');
const authController = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/signup', authController.signup);
router.post('/signin', authController.signin);
router.get('/me', protect, authController.getMe);
router.patch('/me', protect, authController.updateMe);

module.exports = router;

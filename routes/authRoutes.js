const express = require('express');
const authController = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/signup', authController.signup);
router.post('/signin', authController.signin);
router.get('/me', protect, authController.getMe);
router.patch('/me', protect, authController.updateMe);

router.get('/meal-plan', protect, authController.getMealPlan);
router.post('/meal-plan', protect, authController.generateMealPlan);

// Dashboard user management
router.get('/admin/users', authController.getUsersForAdmin);
router.get('/admin/users/search', authController.searchUsersForAdmin);
router.patch('/admin/users/:userId/status', authController.updateUserStatusForAdmin);

module.exports = router;

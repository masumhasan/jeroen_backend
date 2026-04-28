const express = require('express');
const authController = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/signup', authController.signup);
router.post('/signin', authController.signin);
router.post('/dashboard-signin', authController.dashboardSignin);
router.get('/me', protect, authController.getMe);
router.patch('/me', protect, authController.updateMe);
router.patch('/me/weight', protect, authController.updateMyWeight);
router.get('/progress', protect, authController.getProgress);

router.get('/meal-plan', protect, authController.getMealPlan);
router.post('/meal-plan', protect, authController.generateMealPlan);
router.get('/meal-plan/swap-alternatives', protect, authController.getMealSwapAlternatives);
router.patch('/meal-plan/swap', protect, authController.swapMeal);

module.exports = router;

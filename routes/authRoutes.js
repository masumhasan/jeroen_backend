const express = require('express');
const authController = require('../controllers/authController');
const catalogController = require('../controllers/catalogController');
const { protect } = require('../middleware/authMiddleware');
const { uploadAvatar } = require('../config/multer');

const router = express.Router();

router.get('/catalog/allergies', catalogController.getAllergiesList);
router.get('/catalog/dietary-preferences', catalogController.getDietaryPreferencesList);

router.post('/signup', authController.signup);
router.post('/signup/check-availability', authController.checkSignupAvailability);
router.post('/signin', authController.signin);
router.post('/dashboard-signin', authController.dashboardSignin);
router.get('/me', protect, authController.getMe);
router.patch('/me', protect, authController.updateMe);
router.patch('/me/weight', protect, authController.updateMyWeight);
router.patch('/me/avatar', protect, uploadAvatar.single('avatar'), authController.uploadAvatar);
router.post('/me/claim-books', protect, authController.claimBooks);
router.get('/progress', protect, authController.getProgress);

router.get('/meal-plan', protect, authController.getMealPlan);
router.post('/meal-plan', protect, authController.generateMealPlan);
router.get('/meal-plan/swap-alternatives', protect, authController.getMealSwapAlternatives);
router.patch('/meal-plan/swap', protect, authController.swapMeal);

module.exports = router;

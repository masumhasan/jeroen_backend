const express = require('express');
const authController = require('../controllers/authController');

const router = express.Router();

router.get('/users', authController.getUsersForAdmin);
router.get('/users/search', authController.searchUsersForAdmin);
router.patch('/users/:userId/status', authController.updateUserStatusForAdmin);

module.exports = router;

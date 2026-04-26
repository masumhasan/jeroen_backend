const express = require('express');
const authController = require('../controllers/authController');
const communityController = require('../controllers/communityController');

const router = express.Router();

router.get('/users', authController.getUsersForAdmin);
router.get('/users/search', authController.searchUsersForAdmin);
router.patch('/users/:userId/status', authController.updateUserStatusForAdmin);
router.get('/topics', communityController.getTopicsForAdmin);
router.post('/topics', communityController.createTopicByAdmin);
router.put('/topics/:topicId', communityController.updateTopicByAdmin);
router.delete('/topics/:topicId', communityController.deleteTopicByAdmin);

module.exports = router;

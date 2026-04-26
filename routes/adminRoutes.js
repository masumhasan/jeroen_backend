const express = require('express');
const authController = require('../controllers/authController');
const communityController = require('../controllers/communityController');
const supportController = require('../controllers/supportController');

const router = express.Router();

router.get('/users', authController.getUsersForAdmin);
router.get('/users/search', authController.searchUsersForAdmin);
router.patch('/users/:userId/status', authController.updateUserStatusForAdmin);
router.get('/topics', communityController.getTopicsForAdmin);
router.post('/topics', communityController.createTopicByAdmin);
router.put('/topics/:topicId', communityController.updateTopicByAdmin);
router.delete('/topics/:topicId', communityController.deleteTopicByAdmin);

router.get('/support/threads', supportController.listThreadsAdmin);
router.get('/support/threads/:threadId', supportController.getThreadAdmin);
router.patch('/support/threads/:threadId/read', supportController.markThreadReadAdmin);
router.post('/support/threads/:threadId/replies', supportController.postAdminReply);

module.exports = router;

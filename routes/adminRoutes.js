const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const {
  requireDashboardAccess,
  requireAdminOrSuperadmin,
} = require('../middleware/dashboardAuthMiddleware');
const authController = require('../controllers/authController');
const communityController = require('../controllers/communityController');
const supportController = require('../controllers/supportController');

const router = express.Router();

router.use(protect);
router.use(requireDashboardAccess);

router.get('/users', authController.getUsersForAdmin);
router.get('/users/search', authController.searchUsersForAdmin);
router.delete('/users/:userId', authController.deleteUserForAdmin);
router.patch(
  '/users/:userId/role',
  requireAdminOrSuperadmin,
  authController.updateUserRoleForAdmin
);

router.get('/topics', communityController.getTopicsForAdmin);
router.post('/topics', communityController.createTopicByAdmin);
router.put('/topics/:topicId', communityController.updateTopicByAdmin);
router.delete('/topics/:topicId', communityController.deleteTopicByAdmin);

router.get('/support/threads', supportController.listThreadsAdmin);
router.get('/support/threads/:threadId', supportController.getThreadAdmin);
router.patch('/support/threads/:threadId/read', supportController.markThreadReadAdmin);
router.post('/support/threads/:threadId/replies', supportController.postAdminReply);

module.exports = router;

const express = require('express');
const upload = require('../config/multer');
const { protect } = require('../middleware/authMiddleware');
const communityController = require('../controllers/communityController');

const router = express.Router();

router.get('/topics', protect, communityController.getTopics);
router.patch('/topics/:topicId/follow', protect, communityController.toggleFollowTopic);

router.get('/feed', protect, communityController.getFeed);
router.post('/posts/meal-plan', protect, communityController.shareMealPlan);
router.post('/posts', protect, upload.single('post_image'), communityController.createPost);
router.patch('/posts/:postId', protect, communityController.updatePost);
router.delete('/posts/:postId', protect, communityController.deletePost);
router.get('/posts/:postId', protect, communityController.getPostDetails);
router.patch('/posts/:postId/like', protect, communityController.toggleLikePost);
router.post('/posts/:postId/comments', protect, communityController.addComment);

module.exports = router;

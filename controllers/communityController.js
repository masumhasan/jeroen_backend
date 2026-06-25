const path = require('path');
const fs = require('fs');
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const s3 = require('../config/s3');
const Topic = require('../models/Topic');
const Post = require('../models/Post');
const User = require('../models/User');
const { buildMealPlanHtml } = require('../utils/mealPlanTemplate');

const parseTopicIdsFromBody = (body) => {
  const directTopicIds = body.topicIds;
  const singleTopicId = body.topicId;

  let parsedTopicIds = [];

  if (Array.isArray(directTopicIds)) {
    parsedTopicIds = directTopicIds;
  } else if (typeof directTopicIds === 'string') {
    const raw = directTopicIds.trim();
    if (raw.startsWith('[')) {
      try {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) parsedTopicIds = arr;
      } catch (_error) {
        parsedTopicIds = [raw];
      }
    } else if (raw.length > 0) {
      parsedTopicIds = raw.includes(',') ? raw.split(',') : [raw];
    }
  }

  if (parsedTopicIds.length === 0 && singleTopicId) {
    parsedTopicIds = [singleTopicId];
  }

  const normalized = parsedTopicIds
    .map((id) => String(id || '').trim())
    .filter(Boolean);

  return [...new Set(normalized)];
};

const getTopics = async (req, res, next) => {
  try {
    const search = String(req.query.search || '').trim();
    const query = search ? { name: { $regex: search, $options: 'i' } } : {};

    const topics = await Topic.find(query).sort({ followerCount: -1, name: 1 }).lean();
    const user = await User.findById(req.user._id).select('followedTopics').lean();
    const followedSet = new Set((user?.followedTopics || []).map((id) => String(id)));

    const mapped = topics.map((topic) => ({
      id: topic._id,
      name: topic.name,
      description: topic.description || '',
      color: topic.color || '#89957F',
      followerCount: topic.followerCount || 0,
      following: followedSet.has(String(topic._id))
    }));

    res.status(200).json({ status: 'success', data: { topics: mapped } });
  } catch (error) {
    next(error);
  }
};

const toggleFollowTopic = async (req, res, next) => {
  try {
    const { topicId } = req.params;
    const topic = await Topic.findById(topicId);
    if (!topic) {
      return res.status(404).json({ message: 'Topic not found' });
    }

    const user = await User.findById(req.user._id);
    const hasFollowed = (user.followedTopics || []).some((id) => String(id) === String(topicId));

    if (hasFollowed) {
      user.followedTopics = (user.followedTopics || []).filter(
        (id) => String(id) !== String(topicId)
      );
      topic.followerCount = Math.max((topic.followerCount || 1) - 1, 0);
    } else {
      user.followedTopics.push(topicId);
      topic.followerCount = (topic.followerCount || 0) + 1;
    }

    await Promise.all([user.save(), topic.save()]);

    res.status(200).json({
      status: 'success',
      data: { following: !hasFollowed, followerCount: topic.followerCount }
    });
  } catch (error) {
    next(error);
  }
};

const buildFeedPostResponse = (post, meId) => ({
  topics: Array.isArray(post.topics)
    ? post.topics
        .filter(Boolean)
        .map((item) => {
          if (item._id) {
            return {
              id: item._id,
              name: item.name,
              color: item.color
            };
          }
          return { id: item };
        })
    : [],
  id: post._id,
  content: post.content,
  image: post.image,
  createdAt: post.createdAt,
  topic:
    (Array.isArray(post.topics) && post.topics.length > 0
      ? post.topics[0]
      : post.topic)
    ? {
        id:
          (Array.isArray(post.topics) && post.topics.length > 0
            ? post.topics[0]?._id || post.topics[0]
            : post.topic?._id || post.topic),
        name:
          (Array.isArray(post.topics) && post.topics.length > 0
            ? post.topics[0]?.name
            : post.topic?.name) || 'Topic',
        color:
          (Array.isArray(post.topics) && post.topics.length > 0
            ? post.topics[0]?.color
            : post.topic?.color) || '#89957F'
      }
    : null,
  user: post.user
    ? {
        id: post.user._id,
        firstName: post.user.firstName,
        lastName: post.user.lastName,
        fullName: `${post.user.firstName || ''} ${post.user.lastName || ''}`.trim(),
        avatar: post.user.avatar || null,
      }
    : null,
  userAvatar: post.user?.avatar || null,
  postType: post.postType || 'text',
  mealPlanData: post.mealPlanData || null,
  mealPlanHtml: post.mealPlanHtml || null,
  likeCount: (post.likedBy || []).length,
  commentCount: (post.comments || []).length,
  likedByMe: (post.likedBy || []).some((id) => String(id) === String(meId)),
  isAuthor: String(post.user?._id || post.user || '') === String(meId)
});

const getFeed = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('followedTopics').lean();
    const followedTopics = user?.followedTopics || [];
    const search = String(req.query.search || '').trim();

    if (followedTopics.length === 0) {
      return res.status(200).json({ status: 'success', data: { posts: [] } });
    }

    const query = {
      $or: [{ topic: { $in: followedTopics } }, { topics: { $in: followedTopics } }]
    };
    if (search) {
      query.content = { $regex: search, $options: 'i' };
    }

    const posts = await Post.find(query)
      .sort({ createdAt: -1 })
      .populate('user', 'firstName lastName avatar')
      .populate('topic', 'name color')
      .populate('topics', 'name color')
      .lean();

    res.status(200).json({
      status: 'success',
      data: { posts: posts.map((post) => buildFeedPostResponse(post, req.user._id)) }
    });
  } catch (error) {
    next(error);
  }
};

const createPost = async (req, res, next) => {
  try {
    const { content } = req.body;
    const topicIds = parseTopicIdsFromBody(req.body);

    if (!topicIds.length || !content || !String(content).trim()) {
      return res.status(400).json({ message: 'topicIds and content are required' });
    }

    const topics = await Topic.find({ _id: { $in: topicIds } }).select('_id').lean();
    if (topics.length !== topicIds.length) {
      return res.status(404).json({ message: 'One or more topics not found' });
    }

    const imagePath = req.file ? req.file.location : null;
    const post = await Post.create({
      user: req.user._id,
      topic: topicIds[0],
      topics: topicIds,
      content: String(content).trim(),
      image: imagePath
    });

    const populated = await Post.findById(post._id)
      .populate('user', 'firstName lastName avatar')
      .populate('topic', 'name color')
      .populate('topics', 'name color');

    res.status(201).json({
      status: 'success',
      data: { post: buildFeedPostResponse(populated.toObject(), req.user._id) }
    });
  } catch (error) {
    next(error);
  }
};

const getPostDetails = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.postId)
      .populate('user', 'firstName lastName avatar')
      .populate('topic', 'name color')
      .populate('topics', 'name color')
      .populate('comments.user', 'firstName lastName avatar')
      .lean();

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const comments = (post.comments || []).map((comment) => ({
      id: comment._id,
      content: comment.content,
      createdAt: comment.createdAt,
      user: comment.user
        ? {
            id: comment.user._id,
            firstName: comment.user.firstName,
            lastName: comment.user.lastName,
            fullName: `${comment.user.firstName || ''} ${comment.user.lastName || ''}`.trim(),
            avatar: comment.user.avatar || null,
          }
        : null
    }));

    res.status(200).json({
      status: 'success',
      data: {
        post: buildFeedPostResponse(post, req.user._id),
        comments
      }
    });
  } catch (error) {
    next(error);
  }
};

const toggleLikePost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const likedBy = (post.likedBy || []).map((id) => String(id));
    const me = String(req.user._id);
    const alreadyLiked = likedBy.includes(me);

    if (alreadyLiked) {
      post.likedBy = post.likedBy.filter((id) => String(id) !== me);
    } else {
      post.likedBy.push(req.user._id);
    }

    await post.save();

    res.status(200).json({
      status: 'success',
      data: {
        likedByMe: !alreadyLiked,
        likeCount: post.likedBy.length
      }
    });
  } catch (error) {
    next(error);
  }
};

const addComment = async (req, res, next) => {
  try {
    const content = String(req.body.content || '').trim();
    if (!content) {
      return res.status(400).json({ message: 'Comment content is required' });
    }

    const post = await Post.findById(req.params.postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    post.comments.push({
      user: req.user._id,
      content
    });
    await post.save();

    const latestComment = post.comments[post.comments.length - 1];
    const user = await User.findById(req.user._id).select('firstName lastName avatar').lean();

    res.status(201).json({
      status: 'success',
      data: {
        comment: {
          id: latestComment._id,
          content: latestComment.content,
          createdAt: latestComment.createdAt,
          user: user
            ? {
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                fullName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
                avatar: user.avatar || null,
              }
            : null
        },
        commentCount: post.comments.length
      }
    });
  } catch (error) {
    next(error);
  }
};

const updatePost = async (req, res, next) => {
  try {
    const content = String(req.body.content || '').trim();
    if (!content) {
      return res.status(400).json({ message: 'Post content is required' });
    }

    const post = await Post.findById(req.params.postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    if (String(post.user) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Only author can edit this post' });
    }

    post.content = content;
    await post.save();

    const populated = await Post.findById(post._id)
      .populate('user', 'firstName lastName avatar')
      .populate('topic', 'name color')
      .populate('topics', 'name color')
      .lean();

    res.status(200).json({
      status: 'success',
      data: { post: buildFeedPostResponse(populated, req.user._id) }
    });
  } catch (error) {
    next(error);
  }
};

const deletePost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    if (String(post.user) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Only author can delete this post' });
    }

    await Post.findByIdAndDelete(post._id);
    res.status(200).json({ status: 'success', message: 'Post deleted' });
  } catch (error) {
    next(error);
  }
};

const getTopicsForAdmin = async (req, res, next) => {
  try {
    const search = String(req.query.search || '').trim();
    const query = search ? { name: { $regex: search, $options: 'i' } } : {};
    const topics = await Topic.find(query).sort({ createdAt: -1 }).lean();
    res.status(200).json({ success: true, data: topics });
  } catch (error) {
    next(error);
  }
};

const createTopicByAdmin = async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim();
    if (!name) {
      return res.status(400).json({ success: false, message: 'Topic name is required' });
    }
    const topic = await Topic.create({
      name,
      description: String(req.body.description || '').trim(),
      color: String(req.body.color || '#89957F').trim(),
      createdBy: req.user?._id || null
    });
    res.status(201).json({ success: true, data: topic });
  } catch (error) {
    next(error);
  }
};

const updateTopicByAdmin = async (req, res, next) => {
  try {
    const updates = {};
    if (req.body.name !== undefined) updates.name = String(req.body.name).trim();
    if (req.body.description !== undefined) updates.description = String(req.body.description).trim();
    if (req.body.color !== undefined) updates.color = String(req.body.color).trim();
    const topic = await Topic.findByIdAndUpdate(req.params.topicId, updates, {
      new: true,
      runValidators: true
    });
    if (!topic) {
      return res.status(404).json({ success: false, message: 'Topic not found' });
    }
    res.status(200).json({ success: true, data: topic });
  } catch (error) {
    next(error);
  }
};

const deleteTopicByAdmin = async (req, res, next) => {
  try {
    const topic = await Topic.findByIdAndDelete(req.params.topicId);
    if (!topic) {
      return res.status(404).json({ success: false, message: 'Topic not found' });
    }
    await Promise.all([
      Post.deleteMany({ $or: [{ topic: topic._id }, { topics: topic._id }] }),
      User.updateMany(
        { followedTopics: topic._id },
        { $pull: { followedTopics: topic._id } }
      )
    ]);
    res.status(200).json({ success: true, message: 'Topic deleted' });
  } catch (error) {
    next(error);
  }
};

const shareMealPlan = async (req, res, next) => {
  try {
    const { caption, topicIds: rawTopicIds, mealPlanData } = req.body;

    if (!mealPlanData || !Array.isArray(mealPlanData.meals) || mealPlanData.meals.length === 0) {
      return res.status(400).json({ message: 'mealPlanData with at least one meal is required' });
    }

    const topicIds = Array.isArray(rawTopicIds)
      ? rawTopicIds.map((id) => String(id).trim()).filter(Boolean)
      : [];

    if (topicIds.length === 0) {
      return res.status(400).json({ message: 'At least one topicId is required' });
    }

    const topics = await Topic.find({ _id: { $in: topicIds } }).select('_id').lean();
    if (topics.length === 0) {
      return res.status(404).json({ message: 'One or more topics not found' });
    }

    const totalCalories = mealPlanData.meals.reduce((sum, m) => sum + (Number(m.calories) || 0), 0);
    const totalProtein = mealPlanData.meals.reduce((sum, m) => sum + (Number(m.protein) || 0), 0);
    const totalCarbs = mealPlanData.meals.reduce((sum, m) => sum + (Number(m.carbs) || 0), 0);
    const totalFat = mealPlanData.meals.reduce((sum, m) => sum + (Number(m.fat) || 0), 0);

    const structuredData = {
      day: mealPlanData.day || 'Today',
      targetCalories: Number(mealPlanData.targetCalories) || totalCalories,
      meals: mealPlanData.meals.map((m) => ({
        mealType: String(m.mealType || 'Meal'),
        name: String(m.name || 'Unknown'),
        calories: Number(m.calories) || 0,
        protein: Number(m.protein) || 0,
        carbs: Number(m.carbs) || 0,
        fat: Number(m.fat) || 0,
        image: m.image || null
      })),
      totalCalories,
      totalProtein,
      totalCarbs,
      totalFat
    };

    const mealPlanHtml = buildMealPlanHtml(structuredData);

    let imagePath = null;
    try {
      const nodeHtmlToImage = require('node-html-to-image');
      const tmpDir = path.join(__dirname, '..', 'uploads');
      if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
      const filename = `mealplan-${Date.now()}-${Math.round(Math.random() * 1e9)}.png`;
      const tmpPath = path.join(tmpDir, filename);
      await nodeHtmlToImage({
        output: tmpPath,
        html: mealPlanHtml,
        transparent: false,
        puppeteerArgs: { args: ['--no-sandbox', '--disable-setuid-sandbox'] }
      });
      const fileBuffer = fs.readFileSync(tmpPath);
      const s3Key = `mealplans/${filename}`;
      await s3.send(new PutObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: s3Key,
        Body: fileBuffer,
        ContentType: 'image/png',
      }));
      fs.unlinkSync(tmpPath);
      imagePath = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;
    } catch (imgErr) {
      console.error('Meal plan image generation failed (non-fatal):', imgErr.message);
    }

    const post = await Post.create({
      user: req.user._id,
      topic: topicIds[0],
      topics: topicIds,
      content: String(caption || '').trim() || 'Shared my daily meal plan',
      postType: 'meal_plan',
      mealPlanData: structuredData,
      mealPlanHtml,
      image: imagePath
    });

    const populated = await Post.findById(post._id)
      .populate('user', 'firstName lastName avatar')
      .populate('topic', 'name color')
      .populate('topics', 'name color');

    res.status(201).json({
      status: 'success',
      data: { post: buildFeedPostResponse(populated.toObject(), req.user._id) }
    });
  } catch (error) {
    next(error);
  }
};

const getPostsForAdmin = async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    const search = String(req.query.search || '').trim();

    const filter = {};
    if (search) {
      filter.$or = [
        { content: { $regex: search, $options: 'i' } },
      ];
    }

    const totalCount = await Post.countDocuments(filter);
    const totalPages = Math.max(Math.ceil(totalCount / limit), 1);
    const safePage = Math.min(page, totalPages);
    const skip = (safePage - 1) * limit;

    const posts = await Post.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('user', 'firstName lastName email avatar')
      .populate('topic', 'name color')
      .lean();

    const mapped = posts.map((post) => ({
      id: post._id,
      content: post.content || '',
      postType: post.postType || 'text',
      image: post.image || null,
      likeCount: (post.likedBy || []).length,
      commentCount: (post.comments || []).length,
      createdAt: post.createdAt,
      user: post.user
        ? {
            id: post.user._id,
            name: `${post.user.firstName || ''} ${post.user.lastName || ''}`.trim(),
            email: post.user.email || '',
            avatar: post.user.avatar || null,
          }
        : null,
      topic: post.topic
        ? { id: post.topic._id, name: post.topic.name, color: post.topic.color }
        : null,
    }));

    res.status(200).json({
      success: true,
      message: 'Posts fetched successfully',
      data: {
        meta: { page: safePage, limit, totalCount, totalPages },
        posts: mapped,
      },
    });
  } catch (error) {
    next(error);
  }
};

const deletePostForAdmin = async (req, res, next) => {
  try {
    const { postId } = req.params;
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    // Delete image from S3 if it was uploaded
    if (post.image && post.image.includes('.amazonaws.com/')) {
      try {
        const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
        const s3Client = require('../config/s3');
        const key = post.image.split('.amazonaws.com/')[1];
        await s3Client.send(new DeleteObjectCommand({
          Bucket: process.env.AWS_S3_BUCKET_NAME,
          Key: key,
        }));
      } catch (delErr) {
        console.error('[deletePostForAdmin] S3 delete failed (non-fatal):', delErr.message);
      }
    }

    await Post.deleteOne({ _id: postId });

    res.status(200).json({ success: true, message: 'Post deleted successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getTopics,
  toggleFollowTopic,
  getFeed,
  createPost,
  shareMealPlan,
  updatePost,
  deletePost,
  getPostDetails,
  toggleLikePost,
  addComment,
  getTopicsForAdmin,
  createTopicByAdmin,
  updateTopicByAdmin,
  deleteTopicByAdmin,
  getPostsForAdmin,
  deletePostForAdmin,
};

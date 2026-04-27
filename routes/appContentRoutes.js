const express = require('express');
const appContentController = require('../controllers/appContentController');

const router = express.Router();

router.get('/:type', appContentController.getAppContentByType);
router.patch('/:type', appContentController.updateAppContentByType);

module.exports = router;

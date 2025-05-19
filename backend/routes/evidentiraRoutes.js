const express = require('express');
const router = express.Router();
const controller = require('../controllers/evidentiraController');

router.get('/', controller.getAll);
router.post('/', controller.create);

module.exports = router;

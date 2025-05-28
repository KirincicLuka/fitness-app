const express = require('express');
const router = express.Router();
const zahtjevController = require('../controllers/zahtjevController');
const { verifyToken } = require('../middlewares/authMiddleware');

console.log('[zahtjevRoutes] Ruta za rezervacije registrirana');

router.post('/', verifyToken, zahtjevController.create);
router.get('/my-reservations', verifyToken, zahtjevController.getMyReservations);
router.delete('/:id', verifyToken, zahtjevController.cancel);
router.get('/trainer-reservations', verifyToken, zahtjevController.getReservationsForTrainer);

module.exports = router;

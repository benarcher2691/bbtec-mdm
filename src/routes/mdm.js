const express = require('express');
const router = express.Router();
const mdmController = require('../controllers/mdmController');

// Enterprise management
router.post('/enterprise/create', mdmController.createEnterprise);

// Policy management
router.post('/policy', mdmController.createPolicy);

// Enrollment
router.post('/enrollment-token', mdmController.createEnrollmentToken);
router.get('/qr', mdmController.generateQRCode);
router.get('/qr/:token', mdmController.getQRCodeImage);

// Device management
router.get('/devices', mdmController.listDevices);
router.get('/devices/:deviceId', mdmController.getDevice);

module.exports = router;

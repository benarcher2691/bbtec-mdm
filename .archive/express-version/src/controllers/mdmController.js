const QRCode = require('qrcode');
const androidManagement = require('../services/androidManagement');

/**
 * Create an enterprise (first-time setup)
 */
exports.createEnterprise = async (req, res) => {
  try {
    const { projectId, displayName } = req.body;

    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' });
    }

    const result = await androidManagement.createEnterprise(projectId, displayName);
    res.json(result);
  } catch (error) {
    console.error('Error in createEnterprise:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Create or update a policy
 */
exports.createPolicy = async (req, res) => {
  try {
    const { policyId, policyConfig } = req.body;
    const policy = await androidManagement.createPolicy(policyId, policyConfig);

    res.json({
      success: true,
      policyName: policy.name,
      policy: policy,
    });
  } catch (error) {
    console.error('Error in createPolicy:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Create an enrollment token
 */
exports.createEnrollmentToken = async (req, res) => {
  try {
    const { policyId, duration } = req.body;
    const token = await androidManagement.createEnrollmentToken(
      policyId || 'default-policy',
      duration || 3600
    );

    res.json({
      success: true,
      token: token.value,
      qrCode: token.qrCode,
      name: token.name,
      expirationTimestamp: token.expirationTimestamp,
    });
  } catch (error) {
    console.error('Error in createEnrollmentToken:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Generate a QR code for enrollment
 * The QR code contains the enrollment token in the Android provisioning format
 */
exports.generateQRCode = async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ error: 'token parameter is required' });
    }

    // Format the QR code data according to Android's provisioning extras format
    // This is the JSON format that Android Setup Wizard expects
    const qrData = JSON.stringify({
      'android.app.extra.PROVISIONING_DEVICE_ADMIN_COMPONENT_NAME':
        'com.google.android.apps.work.clouddpc/.receivers.CloudDeviceAdminReceiver',
      'android.app.extra.PROVISIONING_DEVICE_ADMIN_SIGNATURE_CHECKSUM':
        'I5YvS0O5hXY46mb01BlRjq4oJJGs2kuUcHvVkAPEXlg',
      'android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_DOWNLOAD_LOCATION':
        'https://play.google.com/managed/downloadManagingApp?identifier=setup',
      'android.app.extra.PROVISIONING_ADMIN_EXTRAS_BUNDLE': {
        'com.google.android.apps.work.clouddpc.EXTRA_ENROLLMENT_TOKEN': token,
      },
    });

    // Generate QR code as PNG
    const qrCodeDataUrl = await QRCode.toDataURL(qrData, {
      errorCorrectionLevel: 'L',
      type: 'image/png',
      width: 400,
      margin: 2,
    });

    res.json({
      success: true,
      qrCodeDataUrl: qrCodeDataUrl,
      qrData: qrData,
    });
  } catch (error) {
    console.error('Error in generateQRCode:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get QR code image (alternative endpoint that returns image directly)
 */
exports.getQRCodeImage = async (req, res) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({ error: 'token parameter is required' });
    }

    const qrData = JSON.stringify({
      'android.app.extra.PROVISIONING_DEVICE_ADMIN_COMPONENT_NAME':
        'com.google.android.apps.work.clouddpc/.receivers.CloudDeviceAdminReceiver',
      'android.app.extra.PROVISIONING_DEVICE_ADMIN_SIGNATURE_CHECKSUM':
        'I5YvS0O5hXY46mb01BlRjq4oJJGs2kuUcHvVkAPEXlg',
      'android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_DOWNLOAD_LOCATION':
        'https://play.google.com/managed/downloadManagingApp?identifier=setup',
      'android.app.extra.PROVISIONING_ADMIN_EXTRAS_BUNDLE': {
        'com.google.android.apps.work.clouddpc.EXTRA_ENROLLMENT_TOKEN': token,
      },
    });

    // Generate and send QR code as PNG image
    const qrCodeBuffer = await QRCode.toBuffer(qrData, {
      errorCorrectionLevel: 'L',
      type: 'png',
      width: 400,
      margin: 2,
    });

    res.setHeader('Content-Type', 'image/png');
    res.send(qrCodeBuffer);
  } catch (error) {
    console.error('Error in getQRCodeImage:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * List all enrolled devices
 */
exports.listDevices = async (req, res) => {
  try {
    const devices = await androidManagement.listDevices();

    res.json({
      success: true,
      count: devices.length,
      devices: devices.map((device) => ({
        name: device.name,
        enrollmentTime: device.enrollmentTime,
        lastStatusReportTime: device.lastStatusReportTime,
        state: device.state,
        appliedState: device.appliedState,
        hardwareInfo: device.hardwareInfo,
      })),
    });
  } catch (error) {
    console.error('Error in listDevices:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get device details
 */
exports.getDevice = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const device = await androidManagement.getDevice(deviceId);

    res.json({
      success: true,
      device: device,
    });
  } catch (error) {
    console.error('Error in getDevice:', error);
    res.status(500).json({ error: error.message });
  }
};

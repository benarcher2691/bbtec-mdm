// DOM Elements
const createPolicyBtn = document.getElementById('createPolicyBtn');
const generateQRBtn = document.getElementById('generateQRBtn');
const refreshDevicesBtn = document.getElementById('refreshDevicesBtn');
const policyResult = document.getElementById('policyResult');
const enrollmentResult = document.getElementById('enrollmentResult');
const qrCodeContainer = document.getElementById('qrCodeContainer');
const devicesList = document.getElementById('devicesList');
const policyIdInput = document.getElementById('policyId');
const deviceModal = document.getElementById('deviceModal');
const deviceDetailContent = document.getElementById('deviceDetailContent');
const modalClose = document.querySelector('.close');

// API Base URL
const API_BASE = '/api';

// Authenticated fetch wrapper
async function authenticatedFetch(url, options = {}) {
  // Get session token from Clerk
  const token = await window.getSessionToken();

  // Add Authorization header
  const headers = {
    ...options.headers,
    'Authorization': `Bearer ${token}`,
  };

  return fetch(url, {
    ...options,
    headers,
  });
}

// Utility function to show result messages
function showResult(element, message, isError = false) {
  element.className = `result ${isError ? 'error' : 'success'}`;
  element.textContent = message;
  element.style.display = 'block';
}

// Utility function to clear result messages
function clearResult(element) {
  element.style.display = 'none';
}

// Create Policy
createPolicyBtn.addEventListener('click', async () => {
  const btn = createPolicyBtn;
  const originalText = btn.textContent;

  try {
    btn.disabled = true;
    btn.textContent = 'Creating Policy...';
    clearResult(policyResult);

    const response = await authenticatedFetch(`${API_BASE}/policy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        policyId: 'default-policy',
      }),
    });

    const data = await response.json();

    if (response.ok && data.success) {
      showResult(policyResult, `✓ Policy created successfully: ${data.policyName}`);
    } else {
      showResult(policyResult, `Error: ${data.error || 'Failed to create policy'}`, true);
    }
  } catch (error) {
    showResult(policyResult, `Error: ${error.message}`, true);
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
});

// Generate Enrollment QR Code
generateQRBtn.addEventListener('click', async () => {
  const btn = generateQRBtn;
  const originalText = btn.textContent;
  const policyId = policyIdInput.value.trim() || 'default-policy';

  try {
    btn.disabled = true;
    btn.textContent = 'Generating...';
    clearResult(enrollmentResult);
    qrCodeContainer.classList.remove('visible');

    // Step 1: Create enrollment token
    const tokenResponse = await authenticatedFetch(`${API_BASE}/enrollment-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        policyId: policyId,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData.success) {
      throw new Error(tokenData.error || 'Failed to create enrollment token');
    }

    const token = tokenData.token;

    // Step 2: Generate QR code
    const qrResponse = await authenticatedFetch(`${API_BASE}/qr?token=${encodeURIComponent(token)}`);
    const qrData = await qrResponse.json();

    if (!qrResponse.ok || !qrData.success) {
      throw new Error(qrData.error || 'Failed to generate QR code');
    }

    // Display QR code
    qrCodeContainer.innerHTML = `
      <img src="${qrData.qrCodeDataUrl}" alt="Enrollment QR Code" />
      <div class="token-info">
        <strong>Enrollment Token:</strong><br>
        ${token}
      </div>
      <p style="margin-top: 15px; color: #666;">
        Scan this QR code during Android device setup (after factory reset)
      </p>
    `;
    qrCodeContainer.classList.add('visible');

    showResult(enrollmentResult, '✓ QR Code generated successfully! Scan with your Android device.');
  } catch (error) {
    showResult(enrollmentResult, `Error: ${error.message}`, true);
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
});

// Refresh Devices List
refreshDevicesBtn.addEventListener('click', async () => {
  const btn = refreshDevicesBtn;
  const originalText = btn.textContent;

  try {
    btn.disabled = true;
    btn.textContent = 'Loading...';

    const response = await authenticatedFetch(`${API_BASE}/devices`);
    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Failed to fetch devices');
    }

    if (data.devices.length === 0) {
      devicesList.innerHTML = '<div class="empty-state">No devices enrolled yet. Scan the QR code above to enroll your first device!</div>';
    } else {
      devicesList.innerHTML = data.devices.map(device => `
        <div class="device-item" onclick="showDeviceDetails('${device.name}')">
          <h3>Device: ${device.name.split('/').pop()}</h3>
          <p><strong>State:</strong> <span class="status ${device.state === 'ACTIVE' ? 'active' : ''}">${device.state || 'Unknown'}</span></p>
          <p><strong>Enrolled:</strong> ${new Date(device.enrollmentTime).toLocaleString()}</p>
          ${device.lastStatusReportTime ? `<p><strong>Last Report:</strong> ${new Date(device.lastStatusReportTime).toLocaleString()}</p>` : ''}
          ${device.hardwareInfo ? `
            <p><strong>Device:</strong> ${device.hardwareInfo.manufacturer || 'Unknown'} ${device.hardwareInfo.model || ''}</p>
            <p><strong>Android:</strong> ${device.hardwareInfo.androidVersion || 'Unknown'}</p>
          ` : ''}
          <p style="margin-top: 10px; color: #667eea; font-weight: 600; font-size: 0.85rem;">Click for detailed information →</p>
        </div>
      `).join('');
    }
  } catch (error) {
    devicesList.innerHTML = `<div class="result error">Error: ${error.message}</div>`;
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
});

// Modal Functions
function openModal() {
  deviceModal.classList.add('show');
}

function closeModal() {
  deviceModal.classList.remove('show');
}

// Modal event listeners
modalClose.addEventListener('click', closeModal);

window.addEventListener('click', (event) => {
  if (event.target === deviceModal) {
    closeModal();
  }
});

// Show device details in modal
async function showDeviceDetails(deviceName) {
  openModal();
  deviceDetailContent.innerHTML = '<div class="loading-spinner">Loading device details...</div>';

  try {
    // Extract deviceId from the full device name (format: enterprises/{enterpriseId}/devices/{deviceId})
    const deviceId = deviceName.split('/').pop();

    const response = await authenticatedFetch(`${API_BASE}/devices/${encodeURIComponent(deviceId)}`);
    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Failed to fetch device details');
    }

    const device = data.device;
    deviceDetailContent.innerHTML = renderDeviceDetails(device);
  } catch (error) {
    deviceDetailContent.innerHTML = `<div class="result error">Error: ${error.message}</div>`;
  }
}

// Make function globally accessible for inline onclick handlers
window.showDeviceDetails = showDeviceDetails;

// Render device details
function renderDeviceDetails(device) {
  const hardware = device.hardwareInfo || {};
  const memory = device.memoryInfo || {};
  const network = device.networkInfo || {};

  let html = '';

  // Basic Information
  html += '<div class="device-detail-section">';
  html += '<h3>📱 Basic Information</h3>';
  html += '<div class="detail-grid">';
  html += createDetailItem('Device Name', device.name?.split('/').pop() || 'Unknown');
  html += createDetailItem('State', device.state || 'Unknown');
  html += createDetailItem('Management Mode', device.managementMode || 'Unknown');
  html += createDetailItem('Enrolled', device.enrollmentTime ? new Date(device.enrollmentTime).toLocaleString() : 'Unknown');
  html += createDetailItem('Last Report', device.lastStatusReportTime ? new Date(device.lastStatusReportTime).toLocaleString() : 'Unknown');
  html += createDetailItem('Last Policy Sync', device.lastPolicySyncTime ? new Date(device.lastPolicySyncTime).toLocaleString() : 'Unknown');
  html += '</div></div>';

  // Hardware Information
  if (hardware && Object.keys(hardware).length > 0) {
    html += '<div class="device-detail-section">';
    html += '<h3>💻 Hardware Information</h3>';
    html += '<div class="detail-grid">';
    html += createDetailItem('Manufacturer', hardware.manufacturer || 'Unknown');
    html += createDetailItem('Model', hardware.model || 'Unknown');
    html += createDetailItem('Brand', hardware.brand || 'Unknown');
    html += createDetailItem('Serial Number', hardware.serialNumber || 'Unknown');
    html += createDetailItem('Hardware', hardware.hardware || 'Unknown');
    html += createDetailItem('Device Type', hardware.deviceBasebandVersion || 'Unknown');
    html += '</div></div>';
  }

  // Software Information
  html += '<div class="device-detail-section">';
  html += '<h3>⚙️ Software Information</h3>';
  html += '<div class="detail-grid">';
  html += createDetailItem('Android Version', hardware.androidVersion || 'Unknown');
  html += createDetailItem('Android Build Number', hardware.androidBuildNumber || 'Unknown');
  html += createDetailItem('Security Patch', hardware.securityPatchLevel || 'Unknown');
  html += createDetailItem('Build Fingerprint', hardware.androidBuildTime ? new Date(hardware.androidBuildTime).toLocaleDateString() : 'Unknown');
  html += '</div></div>';

  // Memory Information
  if (memory && Object.keys(memory).length > 0) {
    html += '<div class="device-detail-section">';
    html += '<h3>💾 Memory Information</h3>';
    html += '<div class="detail-grid">';
    if (memory.totalRam) {
      html += createDetailItem('Total RAM', formatBytes(memory.totalRam));
    }
    if (memory.totalInternalStorage) {
      html += createDetailItem('Internal Storage', formatBytes(memory.totalInternalStorage));
    }
    html += '</div></div>';
  }

  // Network Information
  if (network && network.networkOperatorName) {
    html += '<div class="device-detail-section">';
    html += '<h3>📡 Network Information</h3>';
    html += '<div class="detail-grid">';
    html += createDetailItem('Network Operator', network.networkOperatorName || 'Unknown');
    if (network.wifiMacAddress) {
      html += createDetailItem('WiFi MAC Address', network.wifiMacAddress);
    }
    if (network.imei) {
      html += createDetailItem('IMEI', network.imei);
    }
    html += '</div></div>';
  }

  // Display Information
  if (device.displays && device.displays.length > 0) {
    const display = device.displays[0];
    html += '<div class="device-detail-section">';
    html += '<h3>🖥️ Display Information</h3>';
    html += '<div class="detail-grid">';
    html += createDetailItem('Display Name', display.name || 'Unknown');
    html += createDetailItem('Width', display.width ? `${display.width}px` : 'Unknown');
    html += createDetailItem('Height', display.height ? `${display.height}px` : 'Unknown');
    html += createDetailItem('Density', display.density ? `${display.density} dpi` : 'Unknown');
    html += '</div></div>';
  }

  // Policy Applied
  if (device.appliedPolicyName) {
    html += '<div class="device-detail-section">';
    html += '<h3>📋 Policy Information</h3>';
    html += '<div class="detail-grid">';
    html += createDetailItem('Applied Policy', device.appliedPolicyName.split('/').pop() || 'Unknown');
    html += createDetailItem('Policy Version', device.appliedPolicyVersion || 'Unknown');
    html += '</div></div>';
  }

  return html;
}

// Helper function to create detail items
function createDetailItem(label, value) {
  return `
    <div class="detail-item">
      <div class="label">${label}</div>
      <div class="value">${value || 'N/A'}</div>
    </div>
  `;
}

// Helper function to format bytes
function formatBytes(bytes) {
  if (!bytes) return 'Unknown';
  const gb = bytes / (1024 ** 3);
  if (gb >= 1) return `${gb.toFixed(2)} GB`;
  const mb = bytes / (1024 ** 2);
  return `${mb.toFixed(2)} MB`;
}

// Load devices function - will be called after Clerk is initialized
function loadDevicesOnReady() {
  if (refreshDevicesBtn) {
    refreshDevicesBtn.click();
  }
}

// Make it globally accessible so index.html can call it after Clerk loads
window.loadDevicesOnReady = loadDevicesOnReady;

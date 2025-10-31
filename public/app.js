// DOM Elements
const createPolicyBtn = document.getElementById('createPolicyBtn');
const generateQRBtn = document.getElementById('generateQRBtn');
const refreshDevicesBtn = document.getElementById('refreshDevicesBtn');
const policyResult = document.getElementById('policyResult');
const enrollmentResult = document.getElementById('enrollmentResult');
const qrCodeContainer = document.getElementById('qrCodeContainer');
const devicesList = document.getElementById('devicesList');
const policyIdInput = document.getElementById('policyId');

// API Base URL
const API_BASE = '/api';

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

    const response = await fetch(`${API_BASE}/policy`, {
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
    const tokenResponse = await fetch(`${API_BASE}/enrollment-token`, {
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
    const qrResponse = await fetch(`${API_BASE}/qr?token=${encodeURIComponent(token)}`);
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

    const response = await fetch(`${API_BASE}/devices`);
    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Failed to fetch devices');
    }

    if (data.devices.length === 0) {
      devicesList.innerHTML = '<div class="empty-state">No devices enrolled yet. Scan the QR code above to enroll your first device!</div>';
    } else {
      devicesList.innerHTML = data.devices.map(device => `
        <div class="device-item">
          <h3>Device: ${device.name.split('/').pop()}</h3>
          <p><strong>State:</strong> <span class="status ${device.state === 'ACTIVE' ? 'active' : ''}">${device.state || 'Unknown'}</span></p>
          <p><strong>Enrolled:</strong> ${new Date(device.enrollmentTime).toLocaleString()}</p>
          ${device.lastStatusReportTime ? `<p><strong>Last Report:</strong> ${new Date(device.lastStatusReportTime).toLocaleString()}</p>` : ''}
          ${device.hardwareInfo ? `
            <p><strong>Device:</strong> ${device.hardwareInfo.manufacturer || 'Unknown'} ${device.hardwareInfo.model || ''}</p>
            <p><strong>Android:</strong> ${device.hardwareInfo.androidVersion || 'Unknown'}</p>
          ` : ''}
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

// Load devices on page load
window.addEventListener('load', () => {
  refreshDevicesBtn.click();
});

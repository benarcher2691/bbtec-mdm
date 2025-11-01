const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

class AndroidManagementService {
  constructor() {
    this.androidmanagement = null;
    this.auth = null;
    this.enterpriseName = process.env.ENTERPRISE_NAME;
    this.initialized = false;
  }

  /**
   * Initialize the Android Management API client
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

      if (!credentialsPath || !fs.existsSync(credentialsPath)) {
        throw new Error(
          `Service account credentials not found at: ${credentialsPath}\n` +
          'Please set GOOGLE_APPLICATION_CREDENTIALS in your .env file'
        );
      }

      // Create auth client from service account
      this.auth = new google.auth.GoogleAuth({
        keyFile: credentialsPath,
        scopes: ['https://www.googleapis.com/auth/androidmanagement'],
      });

      // Create Android Management API client
      this.androidmanagement = google.androidmanagement({
        version: 'v1',
        auth: this.auth,
      });

      this.initialized = true;
      console.log('✅ Android Management API initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Android Management API:', error.message);
      throw error;
    }
  }

  /**
   * Create or get an enterprise
   * @param {string} projectId - Google Cloud project ID
   * @param {string} enterpriseDisplayName - Display name for the enterprise
   */
  async createEnterprise(projectId, enterpriseDisplayName = 'Educational MDM') {
    await this.initialize();

    try {
      const signupUrl = await this.androidmanagement.signupUrls.create({
        projectId: projectId,
        callbackUrl: 'https://localhost:3000/enterprise/callback',
      });

      console.log('Enterprise signup URL:', signupUrl.data.url);
      return signupUrl.data;
    } catch (error) {
      console.error('Error creating enterprise:', error.message);
      throw error;
    }
  }

  /**
   * Create a policy for enrolled devices
   * @param {string} policyId - Unique identifier for the policy
   * @param {object} policyConfig - Policy configuration object
   */
  async createPolicy(policyId = 'default-policy', policyConfig = null) {
    await this.initialize();

    if (!this.enterpriseName) {
      throw new Error('ENTERPRISE_NAME not set in environment variables');
    }

    // Default simple policy if none provided
    const defaultPolicy = {
      passwordRequirements: {
        passwordMinimumLength: 6,
        passwordQuality: 'NUMERIC',
      },
      statusReportingSettings: {
        applicationReportsEnabled: true,
        deviceSettingsEnabled: true,
        softwareInfoEnabled: true,
      },
      applications: [
        {
          packageName: 'com.android.chrome',
          installType: 'AVAILABLE',
        },
      ],
    };

    const policy = policyConfig || defaultPolicy;
    const policyName = `${this.enterpriseName}/policies/${policyId}`;

    try {
      const response = await this.androidmanagement.enterprises.policies.patch({
        name: policyName,
        requestBody: policy,
      });

      console.log('✅ Policy created/updated:', policyName);
      return response.data;
    } catch (error) {
      console.error('Error creating policy:', error.message);
      throw error;
    }
  }

  /**
   * Create an enrollment token
   * @param {string} policyId - The policy to apply to enrolled devices
   * @param {number} duration - Token validity duration in seconds (default: 1 hour)
   */
  async createEnrollmentToken(policyId = 'default-policy', duration = 3600) {
    await this.initialize();

    if (!this.enterpriseName) {
      throw new Error('ENTERPRISE_NAME not set in environment variables');
    }

    const policyName = `${this.enterpriseName}/policies/${policyId}`;

    try {
      const response = await this.androidmanagement.enterprises.enrollmentTokens.create({
        parent: this.enterpriseName,
        requestBody: {
          policyName: policyName,
          duration: `${duration}s`,
        },
      });

      console.log('✅ Enrollment token created');
      return response.data;
    } catch (error) {
      console.error('Error creating enrollment token:', error.message);
      throw error;
    }
  }

  /**
   * List all devices enrolled in the enterprise
   */
  async listDevices() {
    await this.initialize();

    if (!this.enterpriseName) {
      throw new Error('ENTERPRISE_NAME not set in environment variables');
    }

    try {
      const response = await this.androidmanagement.enterprises.devices.list({
        parent: this.enterpriseName,
      });

      return response.data.devices || [];
    } catch (error) {
      console.error('Error listing devices:', error.message);
      throw error;
    }
  }

  /**
   * Get device details
   * @param {string} deviceId - The device ID
   */
  async getDevice(deviceId) {
    await this.initialize();

    if (!this.enterpriseName) {
      throw new Error('ENTERPRISE_NAME not set in environment variables');
    }

    try {
      const response = await this.androidmanagement.enterprises.devices.get({
        name: `${this.enterpriseName}/devices/${deviceId}`,
      });

      return response.data;
    } catch (error) {
      console.error('Error getting device:', error.message);
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new AndroidManagementService();

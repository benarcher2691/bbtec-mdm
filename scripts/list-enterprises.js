require('dotenv').config();
const { google } = require('googleapis');

async function listEnterprises() {
  try {
    console.log('🔧 Initializing Android Management API...');

    // Create auth client
    const auth = new google.auth.GoogleAuth({
      keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      scopes: ['https://www.googleapis.com/auth/androidmanagement'],
    });

    // Create Android Management API client
    const androidmanagement = google.androidmanagement({
      version: 'v1',
      auth: auth,
    });

    console.log('📝 Listing enterprises...\n');

    // Get project ID from service account
    const projectId = 'bbtec-mdm';

    const response = await androidmanagement.enterprises.list({
      projectId: projectId,
    });

    if (response.data.enterprises && response.data.enterprises.length > 0) {
      console.log('✅ Found enterprises:\n');
      console.log('═══════════════════════════════════════════════════════');

      response.data.enterprises.forEach((enterprise, index) => {
        console.log(`\n${index + 1}. Enterprise Name: ${enterprise.name}`);
        console.log(`   Display Name: ${enterprise.enterpriseDisplayName || 'Not set'}`);
        console.log(`   Enabled: ${enterprise.enabledNotificationTypes ? 'Yes' : 'No'}`);
      });

      console.log('\n═══════════════════════════════════════════════════════');
      console.log('\n📋 YOUR ENTERPRISE ID (copy this!):\n');
      console.log(response.data.enterprises[0].name);
      console.log('\n═══════════════════════════════════════════════════════\n');

    } else {
      console.log('❌ No enterprises found for this project.');
      console.log('You may need to complete the signup process again.\n');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

listEnterprises();

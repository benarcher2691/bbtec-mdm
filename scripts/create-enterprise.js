require('dotenv').config();
const { google } = require('googleapis');

async function createEnterpriseSignupUrl() {
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

    console.log('📝 Creating enterprise signup URL...');

    // Get project ID from service account
    const projectId = 'bbtec-mdm'; // Your project ID

    const response = await androidmanagement.signupUrls.create({
      projectId: projectId,
      callbackUrl: 'https://localhost:3000/callback',
    });

    console.log('\n✅ SUCCESS!\n');
    console.log('═══════════════════════════════════════════════════════');
    console.log('📋 ENTERPRISE SIGNUP URL:');
    console.log('═══════════════════════════════════════════════════════\n');
    console.log(response.data.url);
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('\n📝 INSTRUCTIONS:');
    console.log('1. Copy the URL above');
    console.log('2. Open it in your browser');
    console.log('3. Sign in with your Google account');
    console.log('4. Complete the enterprise enrollment');
    console.log('5. You will be redirected and see your Enterprise ID');
    console.log('6. Copy the Enterprise ID (it looks like: enterprises/LC...)');
    console.log('═══════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
    process.exit(1);
  }
}

createEnterpriseSignupUrl();

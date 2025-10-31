# Educational MDM Enrollment System

An educational proof-of-concept Mobile Device Management (MDM) system that demonstrates Android device enrollment using QR codes and Google's Android Management API.

## Overview

This project showcases how MDM solutions like Microsoft Intune work at a fundamental level. It demonstrates:

- QR code-based device enrollment (like enterprise MDM systems)
- Policy management and enforcement
- Device inventory and monitoring
- Android Management API integration

**Purpose**: Educational and learning purposes only. Not intended for production use.

## Features

- 📱 QR code generation for device enrollment
- 🔒 Policy creation and management
- 📊 Device inventory dashboard
- 🎯 Simple, clean web interface
- ⚡ Built with Node.js and Express

## Prerequisites

Before you begin, ensure you have:

1. **Node.js** (v14 or higher) installed
2. **Google Cloud Account** with billing enabled
3. **Android device** (Android 7.0+) or emulator
4. Basic knowledge of terminal/command line

## Setup Instructions

### Step 1: Clone and Install

```bash
git clone https://github.com/benarcher2691/bbtec-mdm.git
cd bbtec-mdm
npm install
```

### Step 2: Google Cloud Setup

#### 2.1 Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (e.g., "educational-mdm")
3. Note your **Project ID**

#### 2.2 Enable Android Management API

1. In Google Cloud Console, go to **APIs & Services > Library**
2. Search for "Android Management API"
3. Click **Enable**

#### 2.3 Create Service Account

1. Go to **APIs & Services > Credentials**
2. Click **Create Credentials > Service Account**
3. Name it (e.g., "mdm-service-account")
4. Click **Create and Continue**
5. Grant role: **Android Management User**
6. Click **Done**

#### 2.4 Generate Service Account Key

1. Click on the service account you just created
2. Go to **Keys** tab
3. Click **Add Key > Create New Key**
4. Choose **JSON** format
5. Download the key file
6. Save it as `service-account-key.json` in the `config/` folder of this project

```bash
mkdir -p config
mv ~/Downloads/your-key-file.json config/service-account-key.json
```

#### 2.5 Create Enterprise

You need to create an enterprise enrollment. The easiest way is to use the signup URL:

1. Run this command with your project ID:
```bash
curl -X POST \
  "https://androidmanagement.googleapis.com/v1/signupUrls?projectId=YOUR_PROJECT_ID" \
  -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  -H "Content-Type: application/json" \
  -d '{
    "callbackUrl": "https://localhost:3000"
  }'
```

2. Visit the returned signup URL in your browser
3. Complete the enterprise creation process
4. You'll receive an enterprise name like `enterprises/LC01234567`
5. Copy this enterprise name for the next step

Alternatively, you can visit: https://androidenterprise.google.com/signup and follow the wizard.

### Step 3: Configure Environment

1. Copy the example environment file:
```bash
cp .env.example .env
```

2. Edit `.env` and fill in your details:
```env
PORT=3000
NODE_ENV=development

GOOGLE_APPLICATION_CREDENTIALS=./config/service-account-key.json
ENTERPRISE_NAME=enterprises/YOUR_ENTERPRISE_ID
GOOGLE_CLOUD_PROJECT_ID=your-project-id
```

### Step 4: Start the Server

```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

The server will start at `http://localhost:3000`

## Usage Guide

### 1. Access the Web Interface

Open your browser and navigate to:
```
http://localhost:3000
```

### 2. Create a Policy

1. Click **"Create Default Policy"** button
2. This creates a basic policy with:
   - Minimum 6-digit numeric password
   - Status reporting enabled
   - Chrome browser available for installation

### 3. Generate Enrollment QR Code

1. Enter a policy ID (or use "default-policy")
2. Click **"Generate QR Code"**
3. A QR code will be displayed on screen

### 4. Enroll an Android Device

**Important**: This requires a factory-reset or new device!

1. **Factory reset** your Android device:
   - Go to Settings > System > Reset options > Erase all data
   - Or use a fresh Android emulator

2. **Start setup**:
   - Turn on the device
   - Select your language

3. **Launch QR scanner**:
   - On the welcome screen, tap **6 times** in the same spot
   - This activates the QR code scanner
   - (Or look for "Set up for work" option)

4. **Connect to Wi-Fi** when prompted

5. **Scan the QR code** displayed in your browser

6. **Wait for enrollment**:
   - Device will download Android Device Policy app
   - Policy will be applied automatically
   - Complete the setup wizard

7. **Verify enrollment**:
   - Go back to the web interface
   - Click **"Refresh Device List"**
   - Your device should appear!

### 5. View Enrolled Devices

Click **"Refresh Device List"** to see all enrolled devices with:
- Device name/ID
- Enrollment time
- Last status report
- Hardware information
- Device state

## API Endpoints

### Policy Management
- `POST /api/policy` - Create or update a policy
- `POST /api/enterprise/create` - Create enterprise (first-time setup)

### Enrollment
- `POST /api/enrollment-token` - Generate enrollment token
- `GET /api/qr?token=TOKEN` - Get QR code as data URL
- `GET /api/qr/:token` - Get QR code as PNG image

### Device Management
- `GET /api/devices` - List all enrolled devices
- `GET /api/devices/:deviceId` - Get specific device details

### Health Check
- `GET /health` - Server health status

## Project Structure

```
bbtec-mdm/
├── config/                      # Configuration files
│   └── service-account-key.json # Google service account (not in git)
├── planning/                    # Project planning docs
│   └── mdm-enrollment-plan.md
├── public/                      # Frontend files
│   ├── index.html              # Main web interface
│   ├── styles.css              # Styling
│   └── app.js                  # Frontend JavaScript
├── src/
│   ├── controllers/            # Request handlers
│   │   └── mdmController.js
│   ├── routes/                 # API routes
│   │   └── mdm.js
│   ├── services/               # Business logic
│   │   └── androidManagement.js
│   └── server.js               # Express app entry point
├── .env.example                # Environment template
├── .gitignore
├── package.json
└── README.md
```

## Troubleshooting

### "Service account credentials not found"
- Ensure `service-account-key.json` is in the `config/` folder
- Check that `GOOGLE_APPLICATION_CREDENTIALS` path in `.env` is correct

### "ENTERPRISE_NAME not set"
- Make sure you completed the enterprise creation step
- Add the enterprise name to your `.env` file

### "Policy not found" when enrolling
- Create the policy first using the web interface
- Ensure the policy ID matches what you're using for enrollment

### QR Code scanner doesn't appear
- Try tapping 6 times in different spots on the welcome screen
- Some devices require tapping on the "Welcome" text specifically
- Ensure you're using Android 7.0 or higher
- Try with an Android emulator if physical device doesn't work

### Device not appearing in list
- Wait a few minutes for the device to fully enroll
- Click "Refresh Device List" button
- Check that the device completed setup successfully

### Authentication errors
- Verify your service account has "Android Management User" role
- Ensure the Android Management API is enabled in Google Cloud Console
- Check that your project has billing enabled

## Learn More

- [Android Management API Documentation](https://developers.google.com/android/management)
- [Android Enterprise](https://www.android.com/enterprise/)
- [QR Code Provisioning](https://developers.google.com/android/management/provision-device)

## Security Notes

- This is for **educational purposes only**
- Do not use in production environments
- Never commit `service-account-key.json` to version control
- Keep your `.env` file secure and never share it
- The `.gitignore` file is configured to exclude sensitive files

## License

MIT - Educational purposes only

## Contributing

This is an educational project. Feel free to fork and experiment!

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review the Android Management API documentation
3. Open an issue on GitHub

---

**Built with ❤️ for learning and education**

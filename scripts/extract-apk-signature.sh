#!/bin/bash

# Extract APK Signature Helper Script
# Extracts SHA-256 signature from an APK file and converts to URL-safe Base64
# Usage: ./scripts/extract-apk-signature.sh <path-to-apk>

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check arguments
if [ -z "$1" ]; then
  echo -e "${RED}Error: No APK file specified${NC}"
  echo "Usage: $0 <path-to-apk>"
  echo ""
  echo "Example:"
  echo "  $0 android-client/app/build/outputs/apk/staging/release/app-staging-release.apk"
  exit 1
fi

APK_PATH="$1"

# Check if file exists
if [ ! -f "$APK_PATH" ]; then
  echo -e "${RED}Error: APK file not found: $APK_PATH${NC}"
  exit 1
fi

# Check if apksigner is available
APKSIGNER="/opt/android-sdk/build-tools/34.0.0/apksigner"
if [ ! -f "$APKSIGNER" ]; then
  echo -e "${RED}Error: apksigner not found at $APKSIGNER${NC}"
  echo "Please install Android SDK build-tools"
  exit 1
fi

# Check if aapt is available
AAPT="/opt/android-sdk/build-tools/34.0.0/aapt"
if [ ! -f "$AAPT" ]; then
  echo -e "${RED}Error: aapt not found at $AAPT${NC}"
  echo "Please install Android SDK build-tools"
  exit 1
fi

echo -e "${GREEN}Extracting APK metadata from: $APK_PATH${NC}"
echo ""

# Extract certificate info
echo -e "${YELLOW}1. Certificate Information:${NC}"
CERT_OUTPUT=$("$APKSIGNER" verify --print-certs "$APK_PATH")
echo "$CERT_OUTPUT"
echo ""

# Extract SHA-256 hex
SHA256_HEX=$(echo "$CERT_OUTPUT" | grep "Signer #1 certificate SHA-256 digest:" | awk '{print $6}')

if [ -z "$SHA256_HEX" ]; then
  echo -e "${RED}Error: Could not extract SHA-256 digest${NC}"
  exit 1
fi

echo -e "${YELLOW}2. SHA-256 Digest (hex):${NC}"
echo "$SHA256_HEX"
echo ""

# Convert to URL-safe Base64
SIGNATURE_BASE64=$(echo "$SHA256_HEX" | xxd -r -p | base64 | tr '+/' '-_' | tr -d '=')

echo -e "${YELLOW}3. Signature Checksum (URL-safe Base64):${NC}"
echo -e "${GREEN}$SIGNATURE_BASE64${NC}"
echo ""

# Extract package info
echo -e "${YELLOW}4. Package Information:${NC}"
PACKAGE_INFO=$("$AAPT" dump badging "$APK_PATH" | grep "package: name")
echo "$PACKAGE_INFO"
echo ""

# Parse package name, version name, and version code
PACKAGE_NAME=$(echo "$PACKAGE_INFO" | sed -n "s/^package: name='\([^']*\)'.*/\1/p")
VERSION_NAME=$(echo "$PACKAGE_INFO" | sed -n "s/.*versionName='\([^']*\)'.*/\1/p")
VERSION_CODE=$(echo "$PACKAGE_INFO" | sed -n "s/.*versionCode='\([^']*\)'.*/\1/p")

echo -e "${YELLOW}5. Summary:${NC}"
echo "Package Name:      $PACKAGE_NAME"
echo "Version Name:      $VERSION_NAME"
echo "Version Code:      $VERSION_CODE"
echo "Signature:         $SIGNATURE_BASE64"
echo ""

echo -e "${GREEN}✓ Extraction complete!${NC}"
echo ""
echo -e "${YELLOW}Use this signature in your code or configuration${NC}"

#!/bin/bash
# ============================================
# APK Archiving Script
# ============================================
# Archives built APKs to artifacts directory with proper naming
# Usage: ./archive-apk.sh <flavor> [buildType]
#
# Examples:
#   ./archive-apk.sh local              # Uses debug (default for local)
#   ./archive-apk.sh staging            # Uses release (default for staging)
#   ./archive-apk.sh production         # Uses release (default for production)
#   ./archive-apk.sh local release      # Explicit: local release build
#
# Smart defaults:
#   - local      → debug (development/testing)
#   - staging    → release (distribution)
#   - production → release (distribution)

set -e  # Exit on error

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse arguments
FLAVOR=${1}
BUILD_TYPE=${2}

# Show usage if no flavor provided
if [ -z "$FLAVOR" ]; then
    echo -e "${BLUE}Usage: ./archive-apk.sh <flavor> [buildType]${NC}"
    echo ""
    echo "Flavors: local, staging, production"
    echo "Build types: debug, release (optional, uses smart defaults)"
    echo ""
    echo "Examples:"
    echo "  ./archive-apk.sh local              # → local debug"
    echo "  ./archive-apk.sh staging            # → staging release"
    echo "  ./archive-apk.sh production         # → production release"
    echo "  ./archive-apk.sh local release      # → local release (explicit)"
    exit 0
fi

# Validate flavor
if [[ ! "$FLAVOR" =~ ^(local|staging|production)$ ]]; then
    echo -e "${RED}Error: Invalid flavor '$FLAVOR'. Must be: local, staging, or production${NC}"
    exit 1
fi

# Apply smart defaults if build type not specified
if [ -z "$BUILD_TYPE" ]; then
    if [ "$FLAVOR" = "local" ]; then
        BUILD_TYPE="debug"
        echo -e "${BLUE}Using default build type for local: debug${NC}"
    else
        BUILD_TYPE="release"
        echo -e "${BLUE}Using default build type for $FLAVOR: release${NC}"
    fi
fi

# Validate build type
if [[ ! "$BUILD_TYPE" =~ ^(debug|release)$ ]]; then
    echo -e "${RED}Error: Invalid build type '$BUILD_TYPE'. Must be: debug or release${NC}"
    exit 1
fi

# Get version from build.gradle.kts
VERSION=$(grep "versionName = " app/build.gradle.kts | sed 's/.*versionName = "\(.*\)"/\1/')
if [ -z "$VERSION" ]; then
    echo -e "${RED}Error: Could not extract version from build.gradle.kts${NC}"
    exit 1
fi

# Get git commit SHA
GIT_SHA=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")

# Construct paths
SOURCE_APK="app/build/outputs/apk/${FLAVOR}/${BUILD_TYPE}/app-${FLAVOR}-${BUILD_TYPE}.apk"
DEST_DIR="../artifacts/apks/${FLAVOR}"
DEST_FILENAME="app-${FLAVOR}-${BUILD_TYPE}-${VERSION}-${GIT_SHA}.apk"
DEST_PATH="${DEST_DIR}/${DEST_FILENAME}"

# Check if source APK exists
if [ ! -f "$SOURCE_APK" ]; then
    echo -e "${RED}Error: Source APK not found: $SOURCE_APK${NC}"
    echo -e "${YELLOW}Did you run: ./gradlew assemble${FLAVOR^}${BUILD_TYPE^}?${NC}"
    exit 1
fi

# Create destination directory if it doesn't exist
mkdir -p "$DEST_DIR"

# Copy APK
echo ""
echo -e "${GREEN}Archiving APK...${NC}"
echo "  Flavor:      $FLAVOR"
echo "  Build Type:  $BUILD_TYPE"
echo "  Version:     $VERSION"
echo "  Git SHA:     $GIT_SHA"
echo ""
echo "  Source:      $SOURCE_APK"
echo "  Destination: $DEST_PATH"
echo ""

cp "$SOURCE_APK" "$DEST_PATH"

# Verify copy
if [ -f "$DEST_PATH" ]; then
    SIZE=$(du -h "$DEST_PATH" | cut -f1)
    echo -e "${GREEN}✓ Successfully archived APK (${SIZE})${NC}"
    echo ""
    echo "Archived APK location:"
    echo "  $DEST_PATH"
    echo ""
    echo "To list all archived APKs for this flavor:"
    echo "  ls -lht $DEST_DIR/"
else
    echo -e "${RED}✗ Failed to archive APK${NC}"
    exit 1
fi

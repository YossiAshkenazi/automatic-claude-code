#!/bin/bash
# Docker build script for Claude Code Python SDK
# Usage: ./scripts/docker-build.sh [tag]

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
IMAGE_NAME="claude-code-sdk"
REGISTRY="${DOCKER_REGISTRY:-ghcr.io/yossiashkenazi}"
DEFAULT_TAG="${1:-latest}"

# Build metadata
BUILD_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ')
VERSION=$(grep -o '"version": "[^"]*"' "$PROJECT_DIR/pyproject.toml" | cut -d'"' -f4 || echo "0.1.0")
VCS_REF=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")

echo "🐳 Building Claude Code Python SDK Docker Image"
echo "================================================"
echo "Image: $REGISTRY/$IMAGE_NAME:$DEFAULT_TAG"
echo "Version: $VERSION"
echo "Build Date: $BUILD_DATE"
echo "VCS Ref: $VCS_REF"
echo ""

# Change to project directory
cd "$PROJECT_DIR"

# Check if Dockerfile exists
if [[ ! -f "Dockerfile" ]]; then
    echo "❌ Error: Dockerfile not found in $PROJECT_DIR"
    exit 1
fi

# Build arguments
BUILD_ARGS=(
    --build-arg "BUILD_DATE=$BUILD_DATE"
    --build-arg "VERSION=$VERSION" 
    --build-arg "VCS_REF=$VCS_REF"
)

# Tags
TAGS=(
    --tag "$REGISTRY/$IMAGE_NAME:$DEFAULT_TAG"
    --tag "$REGISTRY/$IMAGE_NAME:$VERSION"
    --tag "$REGISTRY/$IMAGE_NAME:latest"
)

# Platform support
PLATFORMS="linux/amd64,linux/arm64"

echo "🔨 Building multi-platform image..."
echo "Platforms: $PLATFORMS"
echo ""

# Build with buildx for multi-platform support
if command -v docker &> /dev/null && docker buildx version &> /dev/null; then
    echo "Using Docker Buildx for multi-platform build..."
    
    # Create builder if it doesn't exist
    if ! docker buildx inspect claude-builder &> /dev/null; then
        echo "Creating buildx builder..."
        docker buildx create --name claude-builder --driver docker-container --bootstrap
    fi
    
    # Use the builder
    docker buildx use claude-builder
    
    # Build and push
    docker buildx build \
        "${BUILD_ARGS[@]}" \
        "${TAGS[@]}" \
        --platform "$PLATFORMS" \
        --push \
        .
        
    echo "✅ Multi-platform build complete!"
else
    echo "Using standard Docker build (single platform)..."
    docker build \
        "${BUILD_ARGS[@]}" \
        "${TAGS[@]}" \
        .
    
    echo "✅ Build complete!"
fi

# Display image information
echo ""
echo "📋 Image Details:"
docker images "$REGISTRY/$IMAGE_NAME" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"

# Security scan (if trivy is available)
if command -v trivy &> /dev/null; then
    echo ""
    echo "🔍 Running security scan..."
    trivy image --severity HIGH,CRITICAL "$REGISTRY/$IMAGE_NAME:$DEFAULT_TAG" || true
fi

# Test the image
echo ""
echo "🧪 Testing image..."
if docker run --rm --entrypoint python "$REGISTRY/$IMAGE_NAME:$DEFAULT_TAG" -c "import claude_code_sdk; print('✅ SDK import successful')"; then
    echo "✅ Image test passed!"
else
    echo "❌ Image test failed!"
    exit 1
fi

echo ""
echo "🎉 Build completed successfully!"
echo ""
echo "To run the image:"
echo "  docker run --rm -it $REGISTRY/$IMAGE_NAME:$DEFAULT_TAG"
echo ""
echo "To push to registry:"
echo "  docker push $REGISTRY/$IMAGE_NAME:$DEFAULT_TAG"
echo "  docker push $REGISTRY/$IMAGE_NAME:$VERSION"
echo ""
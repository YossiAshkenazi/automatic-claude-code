#!/bin/bash
# Docker push script for Claude Code Python SDK
# Usage: ./scripts/docker-push.sh [registry] [tag]

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
IMAGE_NAME="claude-code-sdk"
REGISTRY="${1:-${DOCKER_REGISTRY:-ghcr.io/yossiashkenazi}}"
TAG="${2:-latest}"

echo "🚀 Pushing Claude Code Python SDK to Registry"
echo "=============================================="
echo "Registry: $REGISTRY"
echo "Image: $IMAGE_NAME"
echo "Tag: $TAG"
echo ""

# Check if image exists locally
if ! docker images "$REGISTRY/$IMAGE_NAME:$TAG" --format "{{.Repository}}" | grep -q "$REGISTRY/$IMAGE_NAME"; then
    echo "❌ Error: Image $REGISTRY/$IMAGE_NAME:$TAG not found locally"
    echo "Run ./scripts/docker-build.sh first"
    exit 1
fi

# Get version from pyproject.toml
VERSION=$(grep -o '"version": "[^"]*"' "$PROJECT_DIR/pyproject.toml" | cut -d'"' -f4 || echo "0.1.0")

# Registry login check
echo "🔐 Checking registry authentication..."
if ! docker info | grep -q "Registry:"; then
    echo "⚠️  Not logged in to any registry"
    echo "Please log in first:"
    echo ""
    case "$REGISTRY" in
        *ghcr.io*)
            echo "  echo \$GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin"
            ;;
        *docker.io* | *hub.docker.com*)
            echo "  docker login"
            ;;
        *)
            echo "  docker login $REGISTRY"
            ;;
    esac
    echo ""
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Push images
echo "📤 Pushing images..."
echo ""

# Push main tag
echo "Pushing $REGISTRY/$IMAGE_NAME:$TAG..."
docker push "$REGISTRY/$IMAGE_NAME:$TAG"

# Push version tag if different from main tag
if [[ "$TAG" != "$VERSION" ]]; then
    echo "Pushing $REGISTRY/$IMAGE_NAME:$VERSION..."
    docker push "$REGISTRY/$IMAGE_NAME:$VERSION"
fi

# Push latest tag if not already pushed
if [[ "$TAG" != "latest" ]]; then
    if docker images "$REGISTRY/$IMAGE_NAME:latest" --format "{{.Repository}}" | grep -q "$REGISTRY/$IMAGE_NAME"; then
        echo "Pushing $REGISTRY/$IMAGE_NAME:latest..."
        docker push "$REGISTRY/$IMAGE_NAME:latest"
    fi
fi

echo ""
echo "✅ Push completed successfully!"
echo ""

# Display pushed images
echo "📋 Pushed Images:"
case "$REGISTRY" in
    *ghcr.io*)
        echo "  https://github.com/yossiashkenazi/automatic-claude-code/pkgs/container/claude-code-sdk"
        ;;
    *docker.io* | *hub.docker.com*)
        echo "  https://hub.docker.com/r/${REGISTRY#*docker.io/}/claude-code-sdk"
        ;;
    *)
        echo "  $REGISTRY/$IMAGE_NAME"
        ;;
esac

echo ""
echo "🎯 Usage Examples:"
echo ""
echo "Pull and run:"
echo "  docker pull $REGISTRY/$IMAGE_NAME:$TAG"
echo "  docker run --rm -it $REGISTRY/$IMAGE_NAME:$TAG"
echo ""
echo "Docker Compose:"
echo "  services:"
echo "    claude-sdk:"
echo "      image: $REGISTRY/$IMAGE_NAME:$TAG"
echo "      # ... additional config"
echo ""
echo "Kubernetes:"
echo "  spec:"
echo "    containers:"
echo "    - name: claude-sdk"
echo "      image: $REGISTRY/$IMAGE_NAME:$TAG"
echo ""

# Create GitHub Container Registry manifest (if applicable)
if [[ "$REGISTRY" == *"ghcr.io"* ]]; then
    echo "📝 GitHub Container Registry Information:"
    echo ""
    echo "To make the package public:"
    echo "1. Go to: https://github.com/yossiashkenazi/automatic-claude-code/packages"
    echo "2. Select 'claude-code-sdk'"
    echo "3. Click 'Package settings'"
    echo "4. Change visibility to 'Public'"
    echo ""
fi

echo "🎉 Push process completed!"
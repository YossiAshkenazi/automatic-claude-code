# Docker Configuration for Claude Code Python SDK

## Overview

Comprehensive Docker configuration for the Claude Code Python SDK with optimized multi-stage builds, security hardening, and production-ready deployment options.

## Quick Start

### Build and Run
```bash
# Build the image
./scripts/docker-build.sh

# Run demo
docker run --rm -it claude-code-sdk:latest

# Run with workspace mount
docker run --rm -it \
  -v "$(pwd)/workspace:/app/workspace" \
  -v "$HOME/.claude:/home/claude/.claude:ro" \
  claude-code-sdk:latest
```

### Using Docker Compose
```bash
# Start services
docker-compose up -d

# View logs
docker-compose logs -f claude-sdk

# Stop services  
docker-compose down
```

## Image Details

### Base Configuration
- **Base Image**: `python:3.11-slim`
- **Python Version**: 3.11+
- **Node.js**: v20.x (for Claude CLI)
- **User**: Non-root `claude` user
- **Size**: ~180MB (optimized)

### Multi-Stage Build
1. **Builder Stage**: Installs build dependencies, builds SDK wheel
2. **Runtime Stage**: Minimal runtime with SDK pre-installed

### Security Features
- Non-root user execution
- Read-only root filesystem
- Resource limits
- Health checks
- Security scanning with Trivy

## Usage Examples

### Basic Usage
```bash
# Run demo
docker run --rm claude-code-sdk:latest

# Interactive shell
docker run --rm -it claude-code-sdk:latest /bin/bash

# Run custom Python script
docker run --rm -v "$(pwd):/app/workspace" \
  claude-code-sdk:latest python workspace/my_script.py
```

### With Monitoring
```bash
# Run with dashboard ports exposed
docker run --rm -p 6011:6011 -p 4005:4005 \
  claude-code-sdk:latest python interactive_demo.py
```

### Development Mode
```bash
# Mount source code for development
docker run --rm -it \
  -v "$(pwd):/app" \
  -v "$HOME/.claude:/home/claude/.claude" \
  --entrypoint /bin/bash \
  claude-code-sdk:dev
```

## Docker Compose Services

### Main Service (`claude-sdk`)
- **Image**: `claude-code-sdk:latest`
- **Ports**: 6011 (dashboard), 4005 (API)
- **Volumes**: Workspace, Claude config
- **Resources**: 512MB RAM, 0.5 CPU limit

### Development Service (`claude-dev`)
- **Target**: Builder stage
- **Mode**: Interactive development
- **Volumes**: Full source mount
- **Command**: Bash shell

### Monitoring Service (`claude-monitor`)
- **Port**: 3000
- **Purpose**: Web-based monitoring
- **Dependencies**: claude-sdk

## Kubernetes Deployment

### Basic Deployment
```bash
# Deploy to Kubernetes
kubectl apply -f kubernetes/deployment.yaml

# Check status
kubectl get pods -l app=claude-sdk

# View logs
kubectl logs -l app=claude-sdk -f
```

### Features
- **Replicas**: 2 (with HPA scaling to 10)
- **Resources**: 256MB-512MB RAM, 250m-500m CPU
- **Health Checks**: Liveness and readiness probes
- **Security**: Non-root, security context
- **Networking**: Service, ingress, network policies

### Ingress Configuration
- **Dashboard**: `claude-sdk.example.com`
- **API**: `claude-api.example.com/api`
- **TLS**: Let's Encrypt certificates
- **Features**: Rate limiting, CORS, WebSocket support

## Build Scripts

### docker-build.sh
```bash
# Build with default tag
./scripts/docker-build.sh

# Build with specific tag
./scripts/docker-build.sh v0.1.0

# Features:
# - Multi-platform builds (linux/amd64, linux/arm64)
# - Security scanning with Trivy
# - Image testing
# - Metadata injection
```

### docker-push.sh
```bash
# Push to default registry (GitHub Container Registry)
./scripts/docker-push.sh

# Push to custom registry
./scripts/docker-push.sh my-registry.com/org v0.1.0

# Features:
# - Registry authentication check
# - Multi-tag pushing (version, latest)
# - Usage examples
```

## Environment Variables

### Runtime Configuration
```bash
# SDK configuration
PYTHONPATH="/app"
PYTHONUNBUFFERED="1" 
CLAUDE_SDK_DEBUG="false"

# Container metadata
POD_NAME="claude-sdk-pod"
POD_NAMESPACE="default"

# Resource limits (Kubernetes)
memory_request="256Mi"
memory_limit="512Mi"
cpu_request="250m"
cpu_limit="500m"
```

## Volume Mounts

### Required Mounts
```yaml
volumes:
  # Workspace for user projects
  - name: workspace
    source: ./workspace
    target: /app/workspace
  
  # Claude CLI configuration (read-only)
  - name: claude-config
    source: ~/.claude
    target: /home/claude/.claude
    read_only: true
```

### Optional Mounts
```yaml
volumes:
  # Development source code
  - name: source
    source: .
    target: /app
  
  # Custom examples
  - name: examples
    source: ./my-examples
    target: /app/examples
```

## Performance Optimization

### Image Size Optimization
- **Multi-stage build**: Removes build dependencies
- **Slim base image**: Minimal Python runtime
- **Selective copying**: Only necessary files
- **Layer caching**: Optimized Dockerfile order

### Runtime Performance
- **Resource limits**: Prevents resource exhaustion
- **Health checks**: Fast failure detection
- **Non-blocking**: Async SDK operations
- **Caching**: Pip cache and wheel reuse

## Security Considerations

### Container Security
- **Non-root user**: Runs as `claude` user (UID 1000)
- **Read-only filesystem**: Immutable container
- **Resource limits**: CPU/memory constraints
- **Security scanning**: Trivy integration

### Network Security
- **Network policies**: Restricted ingress/egress
- **TLS termination**: HTTPS/WSS only
- **Rate limiting**: API protection
- **CORS policies**: Cross-origin restrictions

### Secret Management
```yaml
# Kubernetes secrets
apiVersion: v1
kind: Secret
metadata:
  name: claude-cli-config
type: Opaque
data:
  config: <base64-encoded-claude-config>
```

## Monitoring and Observability

### Health Endpoints
- **Liveness**: `/health/live` (container health)
- **Readiness**: `/health/ready` (service availability)
- **Metrics**: `/metrics` (Prometheus format)

### Logging
```bash
# Container logs
docker logs claude-sdk-demo

# Kubernetes logs
kubectl logs -l app=claude-sdk

# Structured JSON logging
{"timestamp": "2024-01-15T10:30:00Z", "level": "INFO", "message": "SDK initialized"}
```

### Dashboard Integration
- **URL**: http://localhost:6011
- **WebSocket**: Real-time updates
- **Metrics**: Performance monitoring
- **Alerts**: Error notifications

## Troubleshooting

### Common Issues

**Claude CLI Not Found**
```bash
# Check CLI installation
docker run --rm claude-code-sdk:latest claude --version

# Debug build
docker build --target builder -t debug .
docker run --rm -it debug /bin/bash
```

**Permission Issues**
```bash
# Fix file permissions
docker run --rm -v "$(pwd):/app/workspace" \
  --user root claude-code-sdk:latest \
  chown -R claude:claude /app/workspace
```

**Memory Issues**
```bash
# Increase memory limits
docker run --rm -m 1g claude-code-sdk:latest

# Kubernetes resource adjustment
resources:
  limits:
    memory: "1Gi"
```

### Debug Mode
```bash
# Enable debug logging
docker run --rm -e CLAUDE_SDK_DEBUG=true \
  claude-code-sdk:latest python demo.py

# Interactive debugging
docker run --rm -it --entrypoint /bin/bash \
  claude-code-sdk:latest
```

## CI/CD Integration

### GitHub Actions
```yaml
- name: Build and push Docker image
  uses: docker/build-push-action@v4
  with:
    context: python-sdk
    file: python-sdk/Dockerfile
    platforms: linux/amd64,linux/arm64
    push: true
    tags: |
      ghcr.io/yossiashkenazi/claude-code-sdk:latest
      ghcr.io/yossiashkenazi/claude-code-sdk:${{ github.sha }}
```

### Registry Integration
- **GitHub Container Registry**: `ghcr.io/yossiashkenazi/claude-code-sdk`
- **Docker Hub**: `docker.io/yossiashkenazi/claude-code-sdk`
- **Private Registry**: Configurable via `DOCKER_REGISTRY`

## Production Deployment

### High Availability
```yaml
# docker-compose.ha.yml
version: '3.8'
services:
  claude-sdk:
    deploy:
      replicas: 3
      update_config:
        parallelism: 1
        delay: 10s
      restart_policy:
        condition: on-failure
```

### Load Balancing
```yaml
# Kubernetes with ingress
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: claude-sdk-lb
  annotations:
    nginx.ingress.kubernetes.io/load-balance: "round_robin"
```

---

## Summary

The Docker configuration provides:

✅ **Optimized Images**: Multi-stage builds, <200MB final size
✅ **Security Hardened**: Non-root user, resource limits, scanning
✅ **Production Ready**: Health checks, monitoring, scaling
✅ **Cross Platform**: linux/amd64 and linux/arm64 support
✅ **Developer Friendly**: Development mode, debug options
✅ **Kubernetes Native**: Full K8s deployment manifests
✅ **CI/CD Ready**: Automated build and push scripts

Perfect for both development and production deployments of the Claude Code Python SDK.
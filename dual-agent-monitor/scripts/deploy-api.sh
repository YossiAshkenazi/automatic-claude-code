#!/bin/bash

# Deploy API Server Script
# This script builds and deploys the dual-agent monitoring API server

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="docker-compose.api.yml"
ENV_FILE=".env.api"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Change to project directory
cd "$PROJECT_DIR"

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    log_error "Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if environment file exists
if [[ ! -f "$ENV_FILE" ]]; then
    log_warning "Environment file $ENV_FILE not found. Creating from template..."
    if [[ -f ".env.postgres" ]]; then
        cp ".env.postgres" "$ENV_FILE"
        log_success "Created $ENV_FILE from .env.postgres"
    else
        log_error "No environment template found. Please create $ENV_FILE manually."
        exit 1
    fi
fi

# Load environment variables
source "$ENV_FILE"

log_info "Starting API server deployment..."
log_info "Using environment file: $ENV_FILE"
log_info "Using compose file: $COMPOSE_FILE"

# Check if PostgreSQL is already running
if docker compose -f docker-compose.postgres.yml ps postgres | grep -q "Up.*healthy"; then
    log_success "PostgreSQL is already running and healthy"
    POSTGRES_RUNNING=true
else
    log_info "PostgreSQL not running, will start with API server"
    POSTGRES_RUNNING=false
fi

# Build the API server image
log_info "Building API server Docker image..."
if docker build -f Dockerfile.api -t dual-agent-monitor-api .; then
    log_success "API server image built successfully"
else
    log_error "Failed to build API server image"
    exit 1
fi

# Deploy the services
log_info "Deploying API server services..."
if docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d; then
    log_success "API server services deployed successfully"
else
    log_error "Failed to deploy API server services"
    exit 1
fi

# Wait for services to be healthy
log_info "Waiting for services to become healthy..."
sleep 10

# Check service health
check_service_health() {
    local service_name="$1"
    local max_attempts=30
    local attempt=1

    while [[ $attempt -le $max_attempts ]]; do
        if docker compose -f "$COMPOSE_FILE" ps "$service_name" | grep -q "Up.*healthy"; then
            log_success "$service_name is healthy"
            return 0
        fi
        
        log_info "Waiting for $service_name to become healthy (attempt $attempt/$max_attempts)..."
        sleep 5
        ((attempt++))
    done
    
    log_error "$service_name failed to become healthy within timeout"
    return 1
}

# Check PostgreSQL health
if ! check_service_health "postgres"; then
    log_error "PostgreSQL failed to become healthy"
    exit 1
fi

# Check API server health
if ! check_service_health "api-server"; then
    log_error "API server failed to become healthy"
    exit 1
fi

# Test API connectivity
log_info "Testing API connectivity..."
API_URL="http://localhost:${WEBSOCKET_SERVER_PORT:-4005}/api/health"
if curl -f -s "$API_URL" >/dev/null; then
    log_success "API server is responding at $API_URL"
else
    log_warning "API server may not be fully ready yet. Check logs with: docker compose -f $COMPOSE_FILE logs api-server"
fi

# Display service information
log_info "Deployment completed successfully!"
echo ""
log_info "Service Information:"
echo "  - API Server: http://localhost:${WEBSOCKET_SERVER_PORT:-4005}"
echo "  - WebSocket: ws://localhost:${WEBSOCKET_SERVER_PORT:-4005}"
echo "  - Health Check: http://localhost:${WEBSOCKET_SERVER_PORT:-4005}/api/health"
echo "  - PostgreSQL: localhost:${POSTGRES_PORT:-5434}"
echo ""
log_info "Management Commands:"
echo "  - View logs: docker compose -f $COMPOSE_FILE logs -f"
echo "  - Stop services: docker compose -f $COMPOSE_FILE down"
echo "  - Restart API: docker compose -f $COMPOSE_FILE restart api-server"
echo "  - View status: docker compose -f $COMPOSE_FILE ps"
echo ""
log_info "Configuration:"
echo "  - Environment file: $ENV_FILE"
echo "  - Docker compose: $COMPOSE_FILE"
echo "  - Network: ${NETWORK_NAME:-dual-agent-network}"
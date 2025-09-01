#!/bin/bash

# Full Stack Deployment Script for Dual-Agent Monitoring System
# This script deploys the complete monitoring stack with proper networking

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILE="docker-compose.full-stack.yml"
ENV_FILE=".env.full-stack"
PROJECT_NAME="dual-agent-monitor"

# Functions
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}✓${NC} $1"
}

warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

error() {
    echo -e "${RED}✗${NC} $1"
    exit 1
}

check_dependencies() {
    log "Checking dependencies..."
    
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed. Please install Docker first."
    fi
    
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        error "Docker Compose is not installed. Please install Docker Compose first."
    fi
    
    success "Dependencies check passed"
}

prepare_environment() {
    log "Preparing environment..."
    
    # Create required directories
    mkdir -p data/postgres
    mkdir -p backups
    mkdir -p logs
    
    # Copy environment file if it doesn't exist
    if [ ! -f ".env" ]; then
        cp "$ENV_FILE" ".env"
        success "Environment file created from $ENV_FILE"
    else
        warning "Using existing .env file"
    fi
    
    success "Environment prepared"
}

build_images() {
    log "Building Docker images..."
    
    # Build frontend image
    if docker-compose -f "$COMPOSE_FILE" build frontend; then
        success "Frontend image built successfully"
    else
        error "Failed to build frontend image"
    fi
    
    # Build API server image
    if docker-compose -f "$COMPOSE_FILE" build api-server; then
        success "API server image built successfully"
    else
        error "Failed to build API server image"
    fi
}

deploy_services() {
    log "Deploying services..."
    
    # Start database and cache services first
    log "Starting database and cache services..."
    if docker-compose -f "$COMPOSE_FILE" up -d postgres redis; then
        success "Database and cache services started"
    else
        error "Failed to start database and cache services"
    fi
    
    # Wait for database to be ready
    log "Waiting for database to be ready..."
    timeout=60
    while [ $timeout -gt 0 ]; do
        if docker-compose -f "$COMPOSE_FILE" exec -T postgres pg_isready -U postgres > /dev/null 2>&1; then
            success "Database is ready"
            break
        fi
        sleep 2
        timeout=$((timeout-2))
    done
    
    if [ $timeout -eq 0 ]; then
        error "Database failed to become ready within 60 seconds"
    fi
    
    # Start API server
    log "Starting API server..."
    if docker-compose -f "$COMPOSE_FILE" up -d api-server; then
        success "API server started"
    else
        error "Failed to start API server"
    fi
    
    # Wait for API server to be ready
    log "Waiting for API server to be ready..."
    timeout=60
    while [ $timeout -gt 0 ]; do
        if curl -f http://localhost:4005/api/health > /dev/null 2>&1; then
            success "API server is ready"
            break
        fi
        sleep 2
        timeout=$((timeout-2))
    done
    
    if [ $timeout -eq 0 ]; then
        error "API server failed to become ready within 60 seconds"
    fi
    
    # Start frontend and nginx
    log "Starting frontend and reverse proxy..."
    if docker-compose -f "$COMPOSE_FILE" up -d frontend nginx; then
        success "Frontend and reverse proxy started"
    else
        error "Failed to start frontend and reverse proxy"
    fi
    
    success "All services deployed successfully"
}

run_health_checks() {
    log "Running health checks..."
    
    # Run health check service
    if docker-compose -f "$COMPOSE_FILE" --profile test run --rm healthcheck; then
        success "All health checks passed"
    else
        error "Health checks failed"
    fi
}

show_status() {
    log "Service status:"
    docker-compose -f "$COMPOSE_FILE" ps
    
    echo ""
    log "Service URLs:"
    echo "  Frontend:     http://localhost:6011"
    echo "  API Server:   http://localhost:4005"
    echo "  Database:     localhost:5434"
    echo "  Redis:        localhost:6379"
    
    echo ""
    success "Deployment completed successfully!"
    success "You can now access the dual-agent monitoring dashboard at http://localhost:6011"
}

# Main deployment process
main() {
    log "Starting full stack deployment..."
    
    check_dependencies
    prepare_environment
    build_images
    deploy_services
    run_health_checks
    show_status
    
    log "Deployment process completed!"
}

# Parse command line arguments
case "${1:-deploy}" in
    "deploy")
        main
        ;;
    "stop")
        log "Stopping all services..."
        docker-compose -f "$COMPOSE_FILE" down
        success "All services stopped"
        ;;
    "restart")
        log "Restarting all services..."
        docker-compose -f "$COMPOSE_FILE" restart
        success "All services restarted"
        ;;
    "logs")
        docker-compose -f "$COMPOSE_FILE" logs -f "${2:-}"
        ;;
    "status")
        show_status
        ;;
    "clean")
        log "Cleaning up containers and images..."
        docker-compose -f "$COMPOSE_FILE" down --rmi all --volumes --remove-orphans
        success "Cleanup completed"
        ;;
    "health")
        run_health_checks
        ;;
    *)
        echo "Usage: $0 {deploy|stop|restart|logs|status|clean|health}"
        echo ""
        echo "Commands:"
        echo "  deploy   - Deploy the full stack (default)"
        echo "  stop     - Stop all services"
        echo "  restart  - Restart all services"
        echo "  logs     - View logs (optional service name)"
        echo "  status   - Show service status and URLs"
        echo "  clean    - Remove all containers, images, and volumes"
        echo "  health   - Run health checks"
        exit 1
        ;;
esac
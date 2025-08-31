#!/bin/bash

# Production Deployment Script for Dual Agent Monitor
# This script automates the deployment process with safety checks

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DEPLOY_DIR="$PROJECT_ROOT/deploy"
BACKUP_DIR="/var/backups/dual-agent-monitor"
LOG_FILE="/var/log/dual-agent-monitor-deploy.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

error() {
    log "${RED}ERROR: $1${NC}"
    exit 1
}

warn() {
    log "${YELLOW}WARNING: $1${NC}"
}

info() {
    log "${BLUE}INFO: $1${NC}"
}

success() {
    log "${GREEN}SUCCESS: $1${NC}"
}

# Check if running as root or with sudo
check_permissions() {
    if [[ $EUID -eq 0 ]]; then
        error "This script should not be run as root for security reasons"
    fi

    if ! command -v sudo &> /dev/null; then
        error "sudo is required but not installed"
    fi
}

# Check prerequisites
check_prerequisites() {
    info "Checking prerequisites..."
    
    local missing_tools=()
    
    # Check for required commands
    for cmd in docker docker-compose git node npm pnpm; do
        if ! command -v "$cmd" &> /dev/null; then
            missing_tools+=("$cmd")
        fi
    done
    
    if [ ${#missing_tools[@]} -ne 0 ]; then
        error "Missing required tools: ${missing_tools[*]}"
    fi
    
    # Check Docker is running
    if ! docker info &> /dev/null; then
        error "Docker is not running. Please start Docker and try again."
    fi
    
    # Check available disk space (minimum 5GB)
    local available_space
    available_space=$(df / | awk 'NR==2{print $4}')
    if [ "$available_space" -lt 5242880 ]; then # 5GB in KB
        error "Insufficient disk space. At least 5GB free space required."
    fi
    
    success "Prerequisites check passed"
}

# Validate environment configuration
validate_environment() {
    info "Validating environment configuration..."
    
    if [ ! -f "$DEPLOY_DIR/.env.production" ]; then
        error "Production environment file not found at $DEPLOY_DIR/.env.production"
    fi
    
    # Source the environment file
    source "$DEPLOY_DIR/.env.production"
    
    # Check critical environment variables
    local required_vars=(
        "DOMAIN"
        "POSTGRES_PASSWORD"
        "REDIS_PASSWORD"
        "JWT_SECRET"
        "SESSION_SECRET"
    )
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var:-}" ]; then
            error "Required environment variable $var is not set"
        fi
    done
    
    # Validate password strength
    if [ ${#POSTGRES_PASSWORD} -lt 12 ]; then
        error "POSTGRES_PASSWORD must be at least 12 characters long"
    fi
    
    if [ ${#JWT_SECRET} -lt 32 ]; then
        error "JWT_SECRET must be at least 32 characters long"
    fi
    
    success "Environment validation passed"
}

# Create backup
create_backup() {
    info "Creating backup before deployment..."
    
    local timestamp
    timestamp=$(date +"%Y%m%d_%H%M%S")
    local backup_name="dual-agent-monitor_backup_$timestamp"
    
    # Create backup directory
    sudo mkdir -p "$BACKUP_DIR"
    
    # Backup database if it exists
    if docker ps --format "table {{.Names}}" | grep -q "postgres"; then
        info "Backing up database..."
        docker exec dual-agent-monitor-postgres-1 pg_dump -U postgres dual_agent_monitor > "$BACKUP_DIR/${backup_name}_database.sql"
    fi
    
    # Backup application data
    if [ -d "/var/lib/docker/volumes/dual-agent-monitor_app_data" ]; then
        info "Backing up application data..."
        sudo tar -czf "$BACKUP_DIR/${backup_name}_app_data.tar.gz" -C /var/lib/docker/volumes/dual-agent-monitor_app_data/_data .
    fi
    
    # Backup configuration
    tar -czf "$BACKUP_DIR/${backup_name}_config.tar.gz" -C "$PROJECT_ROOT" deploy docker-compose.prod.yml
    
    success "Backup created: $backup_name"
}

# Build application
build_application() {
    info "Building application..."
    
    cd "$PROJECT_ROOT"
    
    # Install dependencies
    info "Installing dependencies..."
    pnpm install --frozen-lockfile
    
    # Run tests
    info "Running tests..."
    pnpm run test:all || {
        error "Tests failed. Deployment aborted."
    }
    
    # Build application
    info "Building application..."
    pnpm run build:validate || {
        error "Build failed. Deployment aborted."
    }
    
    # Build Docker image
    info "Building Docker image..."
    export VERSION="${VERSION:-$(git rev-parse --short HEAD)}"
    export BUILD_TIME="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    
    docker build -t "dual-agent-monitor:$VERSION" \
        --build-arg VERSION="$VERSION" \
        --build-arg BUILD_TIME="$BUILD_TIME" \
        . || {
        error "Docker build failed"
    }
    
    success "Application built successfully"
}

# Deploy services
deploy_services() {
    info "Deploying services..."
    
    cd "$PROJECT_ROOT"
    
    # Copy environment file
    cp "$DEPLOY_DIR/.env.production" .env.production
    
    # Generate SSL certificates if they don't exist
    if [ ! -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
        info "Generating SSL certificates..."
        ./scripts/setup-ssl.sh "$DOMAIN" "$SSL_EMAIL"
    fi
    
    # Start services
    info "Starting services..."
    docker-compose -f docker-compose.prod.yml up -d --remove-orphans
    
    # Wait for services to be healthy
    info "Waiting for services to be healthy..."
    local max_attempts=30
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if docker-compose -f docker-compose.prod.yml ps --services --filter status=running | wc -l | grep -q "$(docker-compose -f docker-compose.prod.yml config --services | wc -l)"; then
            break
        fi
        
        sleep 10
        ((attempt++))
        
        if [ $attempt -eq $max_attempts ]; then
            error "Services failed to start within expected time"
        fi
    done
    
    success "Services deployed successfully"
}

# Run health checks
run_health_checks() {
    info "Running health checks..."
    
    # Check application health
    local health_url="https://$DOMAIN/health"
    local attempt=0
    local max_attempts=20
    
    while [ $attempt -lt $max_attempts ]; do
        if curl -sSf "$health_url" > /dev/null; then
            success "Application health check passed"
            break
        fi
        
        sleep 15
        ((attempt++))
        
        if [ $attempt -eq $max_attempts ]; then
            error "Application health check failed"
        fi
    done
    
    # Check database connectivity
    if ! docker exec dual-agent-monitor-postgres-1 pg_isready -U postgres; then
        error "Database health check failed"
    fi
    
    # Check Redis connectivity
    if ! docker exec dual-agent-monitor-redis-1 redis-cli ping | grep -q "PONG"; then
        error "Redis health check failed"
    fi
    
    success "All health checks passed"
}

# Setup monitoring
setup_monitoring() {
    info "Setting up monitoring..."
    
    # Create monitoring directories
    sudo mkdir -p /var/log/dual-agent-monitor
    sudo mkdir -p /opt/monitoring
    
    # Set up log rotation
    sudo tee /etc/logrotate.d/dual-agent-monitor > /dev/null <<EOF
/var/log/dual-agent-monitor/*.log {
    daily
    rotate 30
    compress
    missingok
    create 0644 www-data www-data
    postrotate
        docker kill -s USR1 dual-agent-monitor-nginx-1 2>/dev/null || true
    endscript
}
EOF
    
    # Setup cron jobs for backups
    (crontab -l 2>/dev/null; echo "0 2 * * * $SCRIPT_DIR/backup-database.sh") | crontab -
    
    success "Monitoring setup completed"
}

# Cleanup old resources
cleanup_old_resources() {
    info "Cleaning up old resources..."
    
    # Remove unused Docker images
    docker image prune -f
    
    # Clean old backups (keep 30 days)
    find "$BACKUP_DIR" -name "*.tar.gz" -mtime +30 -delete 2>/dev/null || true
    find "$BACKUP_DIR" -name "*.sql" -mtime +30 -delete 2>/dev/null || true
    
    success "Cleanup completed"
}

# Main deployment function
main() {
    info "Starting production deployment..."
    
    # Parse command line arguments
    local skip_backup=false
    local skip_tests=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --skip-backup)
                skip_backup=true
                shift
                ;;
            --skip-tests)
                skip_tests=true
                shift
                ;;
            --help)
                echo "Usage: $0 [--skip-backup] [--skip-tests]"
                echo "  --skip-backup  Skip database backup"
                echo "  --skip-tests   Skip running tests"
                exit 0
                ;;
            *)
                error "Unknown option: $1"
                ;;
        esac
    done
    
    # Run deployment steps
    check_permissions
    check_prerequisites
    validate_environment
    
    if [ "$skip_backup" = false ]; then
        create_backup
    fi
    
    build_application
    deploy_services
    run_health_checks
    setup_monitoring
    cleanup_old_resources
    
    success "Production deployment completed successfully!"
    info "Application is available at: https://$DOMAIN"
    info "Monitoring dashboard: https://$DOMAIN:3000"
    info "Deployment log: $LOG_FILE"
}

# Handle script interruption
cleanup_on_error() {
    error "Deployment interrupted. Check logs at $LOG_FILE"
    exit 1
}

trap cleanup_on_error INT TERM ERR

# Run main function
main "$@"
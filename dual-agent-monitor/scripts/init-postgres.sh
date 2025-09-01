#!/bin/bash

# PostgreSQL Database Initialization Script
# This script sets up the PostgreSQL database for the dual-agent monitoring system

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="$PROJECT_ROOT/docker-compose.postgres.yml"
ENV_FILE="$PROJECT_ROOT/.env.postgres"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
    print_success "Docker is running"
}

# Function to load environment variables
load_env() {
    if [[ -f "$ENV_FILE" ]]; then
        print_status "Loading environment variables from .env.postgres"
        export $(grep -v '^#' "$ENV_FILE" | xargs)
        print_success "Environment variables loaded"
    else
        print_warning "Environment file not found: $ENV_FILE"
        print_status "Using default values"
    fi
}

# Function to create necessary directories
create_directories() {
    print_status "Creating necessary directories..."
    
    mkdir -p "$PROJECT_ROOT/data/postgres"
    mkdir -p "$PROJECT_ROOT/backups"
    mkdir -p "$PROJECT_ROOT/logs"
    
    print_success "Directories created successfully"
}

# Function to start PostgreSQL service
start_postgres() {
    print_status "Starting PostgreSQL container..."
    
    cd "$PROJECT_ROOT"
    docker-compose -f docker-compose.postgres.yml --env-file "$ENV_FILE" up -d postgres
    
    print_status "Waiting for PostgreSQL to be ready..."
    
    # Wait for PostgreSQL to be healthy
    local max_attempts=30
    local attempt=1
    
    while [[ $attempt -le $max_attempts ]]; do
        if docker-compose -f docker-compose.postgres.yml exec -T postgres pg_isready -U "${POSTGRES_USER:-postgres}" > /dev/null 2>&1; then
            print_success "PostgreSQL is ready!"
            break
        fi
        
        print_status "Attempt $attempt/$max_attempts - PostgreSQL not ready yet, waiting..."
        sleep 2
        ((attempt++))
    done
    
    if [[ $attempt -gt $max_attempts ]]; then
        print_error "PostgreSQL failed to start within expected time"
        docker-compose -f docker-compose.postgres.yml logs postgres
        exit 1
    fi
}

# Function to verify database schema
verify_schema() {
    print_status "Verifying database schema..."
    
    local tables_count=$(docker-compose -f docker-compose.postgres.yml exec -T postgres \
        psql -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-dual_agent_monitor}" \
        -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" | tr -d ' ')
    
    if [[ $tables_count -gt 10 ]]; then
        print_success "Database schema initialized successfully ($tables_count tables created)"
    else
        print_error "Database schema initialization failed (only $tables_count tables found)"
        exit 1
    fi
}

# Function to start Redis (optional)
start_redis() {
    print_status "Starting Redis container..."
    
    cd "$PROJECT_ROOT"
    docker-compose -f docker-compose.postgres.yml --env-file "$ENV_FILE" up -d redis
    
    print_success "Redis container started"
}

# Function to display connection information
display_connection_info() {
    print_success "PostgreSQL Setup Complete!"
    echo
    print_status "Connection Information:"
    echo "  Host: localhost"
    echo "  Port: ${POSTGRES_PORT:-5432}"
    echo "  Database: ${POSTGRES_DB:-dual_agent_monitor}"
    echo "  Username: ${POSTGRES_USER:-postgres}"
    echo "  Password: ${POSTGRES_PASSWORD:-dual_agent_secure_pass_2025}"
    echo
    echo "  Connection URL: ${DATABASE_URL:-postgresql://postgres:dual_agent_secure_pass_2025@localhost:5432/dual_agent_monitor}"
    echo
    print_status "Management Tools:"
    echo "  pgAdmin: http://localhost:8081"
    echo "    Email: ${PGADMIN_EMAIL:-admin@dual-agent-monitor.local}"
    echo "    Password: ${PGADMIN_PASSWORD:-admin123}"
    echo
    print_status "Useful Commands:"
    echo "  View logs: docker-compose -f docker-compose.postgres.yml logs -f postgres"
    echo "  Connect to DB: docker-compose -f docker-compose.postgres.yml exec postgres psql -U ${POSTGRES_USER:-postgres} -d ${POSTGRES_DB:-dual_agent_monitor}"
    echo "  Stop services: docker-compose -f docker-compose.postgres.yml down"
    echo "  Backup DB: ./scripts/backup-postgres.sh"
}

# Function to create a test connection
test_connection() {
    print_status "Testing database connection..."
    
    local test_query="SELECT version();"
    local result=$(docker-compose -f docker-compose.postgres.yml exec -T postgres \
        psql -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-dual_agent_monitor}" \
        -t -c "$test_query" 2>/dev/null | head -1 | xargs)
    
    if [[ -n "$result" ]]; then
        print_success "Database connection successful!"
        print_status "PostgreSQL version: $result"
    else
        print_error "Database connection failed"
        exit 1
    fi
}

# Main execution
main() {
    print_status "Starting PostgreSQL Database Initialization..."
    echo
    
    check_docker
    load_env
    create_directories
    start_postgres
    verify_schema
    start_redis
    test_connection
    display_connection_info
    
    echo
    print_success "🎉 PostgreSQL database setup completed successfully!"
    print_status "You can now start the dual-agent monitoring API server"
}

# Run main function
main "$@"
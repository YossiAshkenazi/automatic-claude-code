#!/bin/bash

# Network connectivity test script for dual-agent monitoring stack
# Tests all inter-container communication paths

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

COMPOSE_FILE="docker-compose.full-stack.yml"
NETWORK_NAME="dual-agent-network"

log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}✓${NC} $1"
}

error() {
    echo -e "${RED}✗${NC} $1"
}

warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

test_container_exists() {
    local container_name=$1
    if docker ps --format "table {{.Names}}" | grep -q "$container_name"; then
        success "Container $container_name is running"
        return 0
    else
        error "Container $container_name is not running"
        return 1
    fi
}

test_network_exists() {
    log "Testing Docker network..."
    if docker network ls | grep -q "$NETWORK_NAME"; then
        success "Network $NETWORK_NAME exists"
    else
        error "Network $NETWORK_NAME does not exist"
        return 1
    fi
}

test_container_connectivity() {
    local from_container=$1
    local to_container=$2
    local port=$3
    
    log "Testing connectivity from $from_container to $to_container:$port..."
    
    if docker-compose -f "$COMPOSE_FILE" exec -T "$from_container" nc -z "$to_container" "$port" > /dev/null 2>&1; then
        success "$from_container can connect to $to_container:$port"
        return 0
    else
        error "$from_container cannot connect to $to_container:$port"
        return 1
    fi
}

test_http_endpoint() {
    local container=$1
    local endpoint=$2
    local expected_status=${3:-200}
    
    log "Testing HTTP endpoint $endpoint from $container..."
    
    local status_code
    status_code=$(docker-compose -f "$COMPOSE_FILE" exec -T "$container" curl -s -o /dev/null -w "%{http_code}" "$endpoint" 2>/dev/null || echo "000")
    
    if [ "$status_code" = "$expected_status" ]; then
        success "$container: $endpoint returned $status_code"
        return 0
    else
        error "$container: $endpoint returned $status_code (expected $expected_status)"
        return 1
    fi
}

test_database_connectivity() {
    log "Testing database connectivity..."
    
    # Test from API server to database
    if docker-compose -f "$COMPOSE_FILE" exec -T api-server sh -c "timeout 5 pg_isready -h postgres -p 5432 -U postgres" > /dev/null 2>&1; then
        success "API server can connect to PostgreSQL"
    else
        error "API server cannot connect to PostgreSQL"
        return 1
    fi
    
    # Test database query
    if docker-compose -f "$COMPOSE_FILE" exec -T postgres psql -U postgres -d dual_agent_monitor -c "SELECT 1;" > /dev/null 2>&1; then
        success "Database is responding to queries"
    else
        error "Database is not responding to queries"
        return 1
    fi
}

test_redis_connectivity() {
    log "Testing Redis connectivity..."
    
    # Test from API server to Redis
    if docker-compose -f "$COMPOSE_FILE" exec -T api-server sh -c "timeout 5 nc -z redis 6379" > /dev/null 2>&1; then
        success "API server can connect to Redis"
    else
        error "API server cannot connect to Redis"
        return 1
    fi
    
    # Test Redis ping
    if docker-compose -f "$COMPOSE_FILE" exec -T redis redis-cli ping > /dev/null 2>&1; then
        success "Redis is responding to ping"
    else
        error "Redis is not responding to ping"
        return 1
    fi
}

test_api_endpoints() {
    log "Testing API server endpoints..."
    
    # Test health endpoint from nginx
    test_http_endpoint "nginx" "http://api-server:4005/api/health" "200"
    
    # Test WebSocket endpoint (should return upgrade required)
    test_http_endpoint "nginx" "http://api-server:4005/ws" "400"
    
    # Test API from frontend (internal)
    test_http_endpoint "frontend" "http://api-server:4005/api/health" "200"
}

test_frontend_nginx() {
    log "Testing frontend and nginx integration..."
    
    # Test nginx can reach frontend
    test_http_endpoint "nginx" "http://frontend:80/" "200"
    
    # Test nginx serves the frontend
    if docker-compose -f "$COMPOSE_FILE" exec -T nginx curl -s -o /dev/null -w "%{http_code}" "http://localhost/" 2>/dev/null | grep -q "200"; then
        success "Nginx serves frontend successfully"
    else
        error "Nginx cannot serve frontend"
        return 1
    fi
}

test_external_access() {
    log "Testing external access..."
    
    # Test external frontend access
    if curl -s -o /dev/null -w "%{http_code}" "http://localhost:6011/" 2>/dev/null | grep -q "200"; then
        success "Frontend accessible externally on port 6011"
    else
        error "Frontend not accessible externally on port 6011"
        return 1
    fi
    
    # Test external API access
    if curl -s -o /dev/null -w "%{http_code}" "http://localhost:6011/api/health" 2>/dev/null | grep -q "200"; then
        success "API accessible externally through nginx on port 6011"
    else
        error "API not accessible externally through nginx on port 6011"
        return 1
    fi
    
    # Test direct API access
    if curl -s -o /dev/null -w "%{http_code}" "http://localhost:4005/api/health" 2>/dev/null | grep -q "200"; then
        success "API accessible directly on port 4005"
    else
        warning "API not accessible directly on port 4005 (may be expected in production)"
    fi
}

test_service_discovery() {
    log "Testing service discovery..."
    
    # Test DNS resolution between containers
    local containers=("api-server" "postgres" "redis" "frontend" "nginx")
    
    for container in "${containers[@]}"; do
        # Test from nginx to other containers
        if docker-compose -f "$COMPOSE_FILE" exec -T nginx nslookup "$container" > /dev/null 2>&1; then
            success "DNS resolution: nginx -> $container"
        else
            error "DNS resolution failed: nginx -> $container"
        fi
    done
}

run_comprehensive_tests() {
    local failed_tests=0
    
    log "Starting comprehensive networking tests..."
    
    # Test network existence
    test_network_exists || ((failed_tests++))
    
    # Test container existence
    local containers=("dual-agent-postgres" "dual-agent-redis" "dual-agent-api" "dual-agent-frontend" "dual-agent-nginx")
    for container in "${containers[@]}"; do
        test_container_exists "$container" || ((failed_tests++))
    done
    
    # Test basic connectivity
    test_container_connectivity "api-server" "postgres" "5432" || ((failed_tests++))
    test_container_connectivity "api-server" "redis" "6379" || ((failed_tests++))
    test_container_connectivity "nginx" "api-server" "4005" || ((failed_tests++))
    test_container_connectivity "nginx" "frontend" "80" || ((failed_tests++))
    
    # Test database and Redis
    test_database_connectivity || ((failed_tests++))
    test_redis_connectivity || ((failed_tests++))
    
    # Test API endpoints
    test_api_endpoints || ((failed_tests++))
    
    # Test frontend and nginx
    test_frontend_nginx || ((failed_tests++))
    
    # Test service discovery
    test_service_discovery || ((failed_tests++))
    
    # Test external access
    test_external_access || ((failed_tests++))
    
    # Summary
    echo ""
    if [ $failed_tests -eq 0 ]; then
        success "All networking tests passed! ✨"
        echo ""
        log "Network configuration is working correctly:"
        echo "  - All containers can communicate with each other"
        echo "  - Service discovery is functioning"
        echo "  - External access is available"
        echo "  - Database and cache connections are working"
        echo ""
        success "The dual-agent monitoring stack is fully operational!"
    else
        error "$failed_tests test(s) failed"
        echo ""
        log "Please check the failed tests and verify:"
        echo "  - All containers are running"
        echo "  - Docker network is configured correctly"
        echo "  - Port mappings are correct"
        echo "  - Firewall settings allow the connections"
        exit 1
    fi
}

# Parse command line arguments
case "${1:-test}" in
    "test")
        run_comprehensive_tests
        ;;
    "network")
        test_network_exists
        ;;
    "containers")
        containers=("dual-agent-postgres" "dual-agent-redis" "dual-agent-api" "dual-agent-frontend" "dual-agent-nginx")
        for container in "${containers[@]}"; do
            test_container_exists "$container"
        done
        ;;
    "connectivity")
        test_container_connectivity "api-server" "postgres" "5432"
        test_container_connectivity "api-server" "redis" "6379"
        test_container_connectivity "nginx" "api-server" "4005"
        test_container_connectivity "nginx" "frontend" "80"
        ;;
    "external")
        test_external_access
        ;;
    *)
        echo "Usage: $0 {test|network|containers|connectivity|external}"
        echo ""
        echo "Commands:"
        echo "  test         - Run all networking tests (default)"
        echo "  network      - Test Docker network existence"
        echo "  containers   - Test container status"
        echo "  connectivity - Test inter-container connectivity"
        echo "  external     - Test external access"
        exit 1
        ;;
esac
#!/bin/bash

# Health Check Script for Dual Agent Monitor Production Environment
# Comprehensive monitoring of all system components

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
LOG_FILE="/var/log/dual-agent-monitor-health.log"

# Load environment variables
if [ -f "$PROJECT_ROOT/.env.production" ]; then
    source "$PROJECT_ROOT/.env.production"
fi

# Default configuration
DOMAIN="${DOMAIN:-localhost}"
MAX_RESPONSE_TIME="${MAX_RESPONSE_TIME:-5000}"
MIN_DISK_SPACE_MB="${MIN_DISK_SPACE_MB:-1000}"
MAX_CPU_USAGE="${MAX_CPU_USAGE:-80}"
MAX_MEMORY_USAGE="${MAX_MEMORY_USAGE:-80}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Global health status
OVERALL_HEALTH="healthy"
ISSUES_FOUND=()

# Logging function
log() {
    echo -e "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

error() {
    log "${RED}ERROR: $1${NC}"
    OVERALL_HEALTH="unhealthy"
    ISSUES_FOUND+=("ERROR: $1")
}

warn() {
    log "${YELLOW}WARNING: $1${NC}"
    if [ "$OVERALL_HEALTH" != "unhealthy" ]; then
        OVERALL_HEALTH="degraded"
    fi
    ISSUES_FOUND+=("WARNING: $1")
}

info() {
    log "${BLUE}INFO: $1${NC}"
}

success() {
    log "${GREEN}SUCCESS: $1${NC}"
}

# Check system resources
check_system_resources() {
    info "Checking system resources..."
    
    # Check disk space
    local disk_usage
    disk_usage=$(df / | awk 'NR==2{print int($4/1024)}') # Available space in MB
    
    if [ "$disk_usage" -lt "$MIN_DISK_SPACE_MB" ]; then
        error "Low disk space: ${disk_usage}MB available (minimum: ${MIN_DISK_SPACE_MB}MB)"
    else
        success "Disk space OK: ${disk_usage}MB available"
    fi
    
    # Check memory usage
    local memory_usage
    memory_usage=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}')
    
    if [ "$memory_usage" -gt "$MAX_MEMORY_USAGE" ]; then
        warn "High memory usage: ${memory_usage}% (threshold: ${MAX_MEMORY_USAGE}%)"
    else
        success "Memory usage OK: ${memory_usage}%"
    fi
    
    # Check CPU usage (average over 1 minute)
    local cpu_usage
    cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print int($2)}')
    
    if [ "$cpu_usage" -gt "$MAX_CPU_USAGE" ]; then
        warn "High CPU usage: ${cpu_usage}% (threshold: ${MAX_CPU_USAGE}%)"
    else
        success "CPU usage OK: ${cpu_usage}%"
    fi
    
    # Check load average
    local load_avg
    load_avg=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | sed 's/,//')
    local cpu_cores
    cpu_cores=$(nproc)
    
    if (( $(echo "$load_avg > $cpu_cores * 1.5" | bc -l) )); then
        warn "High load average: $load_avg (cores: $cpu_cores)"
    else
        success "Load average OK: $load_avg"
    fi
}

# Check Docker services
check_docker_services() {
    info "Checking Docker services..."
    
    # Check if Docker is running
    if ! docker info &> /dev/null; then
        error "Docker daemon is not running"
        return 1
    fi
    
    # Define expected services
    local expected_services=(
        "dual-agent-monitor"
        "postgres" 
        "redis"
        "nginx"
    )
    
    # Check each service
    for service in "${expected_services[@]}"; do
        local container_name="dual-agent-monitor-${service}-1"
        
        if docker ps --format "table {{.Names}}" | grep -q "$container_name"; then
            # Check container health
            local health_status
            health_status=$(docker inspect --format='{{.State.Health.Status}}' "$container_name" 2>/dev/null || echo "unknown")
            
            case "$health_status" in
                "healthy")
                    success "Service $service is healthy"
                    ;;
                "unhealthy")
                    error "Service $service is unhealthy"
                    ;;
                "starting")
                    warn "Service $service is starting"
                    ;;
                *)
                    # For services without health checks, check if running
                    local status
                    status=$(docker inspect --format='{{.State.Status}}' "$container_name" 2>/dev/null || echo "unknown")
                    if [ "$status" = "running" ]; then
                        success "Service $service is running"
                    else
                        error "Service $service is not running (status: $status)"
                    fi
                    ;;
            esac
        else
            error "Service $service container not found"
        fi
    done
}

# Check application endpoints
check_application_endpoints() {
    info "Checking application endpoints..."
    
    local base_url="https://$DOMAIN"
    local endpoints=(
        "/health"
        "/api/health"
        "/"
    )
    
    for endpoint in "${endpoints[@]}"; do
        local url="$base_url$endpoint"
        local start_time
        start_time=$(date +%s%3N)
        
        if response=$(curl -sSf --max-time 10 --connect-timeout 5 "$url" 2>&1); then
            local end_time
            end_time=$(date +%s%3N)
            local response_time=$((end_time - start_time))
            
            if [ "$response_time" -gt "$MAX_RESPONSE_TIME" ]; then
                warn "Slow response from $endpoint: ${response_time}ms (threshold: ${MAX_RESPONSE_TIME}ms)"
            else
                success "Endpoint $endpoint OK (${response_time}ms)"
            fi
        else
            error "Endpoint $endpoint failed: $response"
        fi
    done
}

# Check database connectivity
check_database() {
    info "Checking database connectivity..."
    
    local container_name="dual-agent-monitor-postgres-1"
    
    if docker ps --format "table {{.Names}}" | grep -q "$container_name"; then
        # Check if PostgreSQL is ready
        if docker exec "$container_name" pg_isready -U "${POSTGRES_USER:-postgres}" &> /dev/null; then
            success "Database connectivity OK"
            
            # Check database size
            local db_size
            db_size=$(docker exec "$container_name" psql -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-dual_agent_monitor}" -t -c "SELECT pg_size_pretty(pg_database_size('${POSTGRES_DB:-dual_agent_monitor}'));" | xargs)
            info "Database size: $db_size"
            
            # Check active connections
            local active_connections
            active_connections=$(docker exec "$container_name" psql -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-dual_agent_monitor}" -t -c "SELECT count(*) FROM pg_stat_activity WHERE state = 'active';" | xargs)
            info "Active database connections: $active_connections"
            
        else
            error "Database is not ready"
        fi
    else
        error "Database container not found"
    fi
}

# Check Redis connectivity  
check_redis() {
    info "Checking Redis connectivity..."
    
    local container_name="dual-agent-monitor-redis-1"
    
    if docker ps --format "table {{.Names}}" | grep -q "$container_name"; then
        if docker exec "$container_name" redis-cli ping 2>&1 | grep -q "PONG"; then
            success "Redis connectivity OK"
            
            # Check Redis memory usage
            local memory_usage
            memory_usage=$(docker exec "$container_name" redis-cli info memory | grep "used_memory_human" | cut -d: -f2 | tr -d '\r')
            info "Redis memory usage: $memory_usage"
            
            # Check connected clients
            local connected_clients
            connected_clients=$(docker exec "$container_name" redis-cli info clients | grep "connected_clients" | cut -d: -f2 | tr -d '\r')
            info "Redis connected clients: $connected_clients"
            
        else
            error "Redis ping failed"
        fi
    else
        error "Redis container not found"
    fi
}

# Check SSL certificate
check_ssl_certificate() {
    info "Checking SSL certificate..."
    
    if [ "$DOMAIN" = "localhost" ]; then
        info "Skipping SSL check for localhost"
        return 0
    fi
    
    # Check certificate expiration
    local cert_info
    if cert_info=$(echo | openssl s_client -servername "$DOMAIN" -connect "$DOMAIN:443" 2>/dev/null | openssl x509 -noout -dates 2>/dev/null); then
        local expiry_date
        expiry_date=$(echo "$cert_info" | grep "notAfter" | cut -d= -f2)
        local expiry_timestamp
        expiry_timestamp=$(date -d "$expiry_date" +%s)
        local current_timestamp
        current_timestamp=$(date +%s)
        local days_until_expiry
        days_until_expiry=$(( (expiry_timestamp - current_timestamp) / 86400 ))
        
        if [ "$days_until_expiry" -lt 30 ]; then
            warn "SSL certificate expires in $days_until_expiry days"
        else
            success "SSL certificate OK (expires in $days_until_expiry days)"
        fi
    else
        error "Failed to check SSL certificate"
    fi
}

# Check log files for errors
check_logs_for_errors() {
    info "Checking logs for errors..."
    
    local log_dirs=(
        "/var/log/dual-agent-monitor"
        "$PROJECT_ROOT/logs"
    )
    
    local error_patterns=(
        "ERROR"
        "FATAL"
        "Exception"
        "failed to start"
        "connection refused"
    )
    
    for log_dir in "${log_dirs[@]}"; do
        if [ -d "$log_dir" ]; then
            for pattern in "${error_patterns[@]}"; do
                local recent_errors
                recent_errors=$(find "$log_dir" -name "*.log" -mtime -1 -exec grep -l "$pattern" {} \; 2>/dev/null | wc -l)
                
                if [ "$recent_errors" -gt 0 ]; then
                    warn "Found $recent_errors log files with '$pattern' errors in last 24 hours"
                fi
            done
        fi
    done
}

# Check backup status
check_backup_status() {
    info "Checking backup status..."
    
    local backup_dir="${BACKUP_DIR:-/var/backups/dual-agent-monitor}"
    
    if [ -d "$backup_dir" ]; then
        # Check for recent backups
        local recent_backups
        recent_backups=$(find "$backup_dir" -name "*.gz" -mtime -1 | wc -l)
        
        if [ "$recent_backups" -eq 0 ]; then
            warn "No recent backups found (last 24 hours)"
        else
            success "Recent backups found: $recent_backups"
        fi
        
        # Check backup disk usage
        local backup_size
        backup_size=$(du -sh "$backup_dir" 2>/dev/null | cut -f1)
        info "Backup directory size: $backup_size"
    else
        warn "Backup directory not found: $backup_dir"
    fi
}

# Generate health report
generate_health_report() {
    local report_file="/tmp/health-report-$(date +%s).json"
    local timestamp
    timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    
    cat > "$report_file" <<EOF
{
    "timestamp": "$timestamp",
    "overall_status": "$OVERALL_HEALTH",
    "hostname": "$(hostname)",
    "domain": "$DOMAIN",
    "issues": [
        $(printf '"%s",' "${ISSUES_FOUND[@]}" | sed 's/,$//')
    ],
    "system": {
        "uptime": "$(uptime -p)",
        "load_average": "$(uptime | awk -F'load average:' '{print $2}')",
        "disk_usage": "$(df -h / | awk 'NR==2{print $5}')",
        "memory_usage": "$(free | awk 'NR==2{printf "%.1f%%", $3*100/$2}')"
    },
    "docker": {
        "containers_running": $(docker ps -q | wc -l),
        "containers_total": $(docker ps -aq | wc -l)
    }
}
EOF
    
    info "Health report generated: $report_file"
    echo "$report_file"
}

# Send health notification
send_health_notification() {
    local report_file="$1"
    local status_emoji
    local color
    
    case "$OVERALL_HEALTH" in
        "healthy")
            status_emoji="✅"
            color="good"
            ;;
        "degraded")
            status_emoji="⚠️"
            color="warning"
            ;;
        "unhealthy")
            status_emoji="❌"
            color="danger"
            ;;
    esac
    
    local issues_text=""
    if [ ${#ISSUES_FOUND[@]} -gt 0 ]; then
        issues_text="\n\n**Issues Found:**\n$(printf '• %s\n' "${ISSUES_FOUND[@]}")"
    fi
    
    # Send Slack notification if configured
    if [ -n "${SLACK_WEBHOOK_URL:-}" ]; then
        local payload
        payload=$(cat <<EOF
{
    "attachments": [
        {
            "color": "$color",
            "title": "$status_emoji Dual Agent Monitor Health Check",
            "text": "Overall Status: **$OVERALL_HEALTH**$issues_text",
            "fields": [
                {
                    "title": "Server",
                    "value": "$(hostname)",
                    "short": true
                },
                {
                    "title": "Domain", 
                    "value": "$DOMAIN",
                    "short": true
                },
                {
                    "title": "Timestamp",
                    "value": "$(date)",
                    "short": false
                }
            ]
        }
    ]
}
EOF
        )
        
        curl -X POST -H 'Content-type: application/json' \
            --data "$payload" \
            "$SLACK_WEBHOOK_URL" &> /dev/null || warn "Failed to send Slack notification"
    fi
    
    # Log to system log
    logger -t "dual-agent-monitor-health" "$OVERALL_HEALTH: ${#ISSUES_FOUND[@]} issues found"
}

# Main health check function
main() {
    info "Starting comprehensive health check..."
    
    local start_time
    start_time=$(date +%s)
    
    # Parse command line arguments
    local verbose=false
    local report_only=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --verbose|-v)
                verbose=true
                shift
                ;;
            --report-only)
                report_only=true
                shift
                ;;
            --help)
                echo "Usage: $0 [--verbose] [--report-only]"
                echo "  --verbose      Show detailed output"
                echo "  --report-only  Generate report without notifications"
                exit 0
                ;;
            *)
                error "Unknown option: $1"
                ;;
        esac
    done
    
    # Run all health checks
    check_system_resources
    check_docker_services  
    check_application_endpoints
    check_database
    check_redis
    check_ssl_certificate
    check_logs_for_errors
    check_backup_status
    
    # Generate report
    local report_file
    report_file=$(generate_health_report)
    
    local end_time
    end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    # Summary
    success "Health check completed in ${duration}s"
    info "Overall status: $OVERALL_HEALTH"
    info "Issues found: ${#ISSUES_FOUND[@]}"
    
    if [ "$verbose" = true ] && [ ${#ISSUES_FOUND[@]} -gt 0 ]; then
        info "Issues details:"
        printf '%s\n' "${ISSUES_FOUND[@]}"
    fi
    
    # Send notifications
    if [ "$report_only" = false ]; then
        send_health_notification "$report_file"
    fi
    
    # Exit with appropriate code
    case "$OVERALL_HEALTH" in
        "healthy")
            exit 0
            ;;
        "degraded")
            exit 1
            ;;
        "unhealthy")
            exit 2
            ;;
    esac
}

# Run main function
main "$@"
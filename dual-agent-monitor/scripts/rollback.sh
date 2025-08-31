#!/bin/bash

# Rollback Script for Dual Agent Monitor
# Emergency rollback procedures with data preservation

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/dual-agent-monitor}"
LOG_FILE="/var/log/dual-agent-monitor-rollback.log"

# Load environment variables
if [ -f "$PROJECT_ROOT/.env.production" ]; then
    source "$PROJECT_ROOT/.env.production"
fi

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

# Show usage
show_usage() {
    cat <<EOF
Usage: $0 [OPTIONS] ROLLBACK_TYPE

Rollback Types:
  config         - Rollback to previous configuration only
  database       - Rollback database to specific backup
  application    - Rollback application to previous Docker image
  full           - Full system rollback (application + database)
  emergency      - Emergency rollback with minimal checks

Options:
  --backup-id ID          - Specific backup ID to restore from
  --backup-timestamp TS   - Backup timestamp (YYYYMMDD_HHMMSS)
  --docker-tag TAG        - Docker image tag to rollback to
  --skip-backup          - Skip creating rollback backup
  --force                - Force rollback without confirmation
  --dry-run              - Show what would be done without executing
  --help                 - Show this help message

Examples:
  $0 application --docker-tag v1.2.0
  $0 database --backup-timestamp 20241201_020000
  $0 full --backup-id backup_20241201_020000
  $0 emergency --force

EOF
}

# Confirm rollback action
confirm_rollback() {
    local rollback_type="$1"
    local details="$2"
    
    warn "CAUTION: You are about to perform a $rollback_type rollback"
    warn "Details: $details"
    warn "This action may result in data loss or service disruption"
    
    if [ "${FORCE:-false}" = true ]; then
        warn "Proceeding with force flag enabled"
        return 0
    fi
    
    read -p "Are you sure you want to continue? (type 'ROLLBACK' to confirm): " confirmation
    
    if [ "$confirmation" != "ROLLBACK" ]; then
        info "Rollback cancelled by user"
        exit 0
    fi
}

# Create pre-rollback backup
create_pre_rollback_backup() {
    if [ "${SKIP_BACKUP:-false}" = true ]; then
        warn "Skipping pre-rollback backup as requested"
        return 0
    fi
    
    info "Creating pre-rollback backup..."
    local timestamp
    timestamp=$(date +"%Y%m%d_%H%M%S")
    local backup_name="pre_rollback_$timestamp"
    
    # Backup current database state
    if docker ps --format "table {{.Names}}" | grep -q "dual-agent-monitor-postgres-1"; then
        info "Backing up current database state..."
        docker exec dual-agent-monitor-postgres-1 pg_dump \
            -U "${POSTGRES_USER:-postgres}" \
            "${POSTGRES_DB:-dual_agent_monitor}" \
            > "$BACKUP_DIR/${backup_name}_current_db.sql"
        
        gzip "$BACKUP_DIR/${backup_name}_current_db.sql"
        success "Database backup created: ${backup_name}_current_db.sql.gz"
    fi
    
    # Backup current application data
    if docker volume ls --format "table {{.Name}}" | grep -q "dual-agent-monitor_app_data"; then
        info "Backing up current application data..."
        docker run --rm \
            -v dual-agent-monitor_app_data:/data:ro \
            -v "$BACKUP_DIR:/backup" \
            alpine tar -czf "/backup/${backup_name}_current_app_data.tar.gz" -C /data .
        
        success "Application data backup created: ${backup_name}_current_app_data.tar.gz"
    fi
    
    # Save current Docker image information
    local current_image
    current_image=$(docker inspect dual-agent-monitor-dual-agent-monitor-1 --format '{{.Image}}' 2>/dev/null || echo "unknown")
    echo "$current_image" > "$BACKUP_DIR/${backup_name}_current_image.txt"
    
    info "Current image information saved: ${backup_name}_current_image.txt"
}

# List available backups
list_backups() {
    info "Available backups:"
    
    if [ ! -d "$BACKUP_DIR" ]; then
        warn "Backup directory does not exist: $BACKUP_DIR"
        return 1
    fi
    
    echo "Database Backups:"
    find "$BACKUP_DIR" -name "*_db_*.sql.gz" -printf "%T@ %Tc %p\n" | sort -rn | head -10 | while read -r line; do
        filename=$(echo "$line" | awk '{print $NF}')
        date_str=$(echo "$line" | cut -d' ' -f2-7)
        size=$(du -h "$filename" | cut -f1)
        echo "  $(basename "$filename") - $date_str ($size)"
    done
    
    echo ""
    echo "Application Data Backups:"
    find "$BACKUP_DIR" -name "*_app_data_*.tar.gz" -printf "%T@ %Tc %p\n" | sort -rn | head -10 | while read -r line; do
        filename=$(echo "$line" | awk '{print $NF}')
        date_str=$(echo "$line" | cut -d' ' -f2-7)
        size=$(du -h "$filename" | cut -f1)
        echo "  $(basename "$filename") - $date_str ($size)"
    done
    
    echo ""
    echo "Docker Images:"
    docker images dual-agent-monitor --format "table {{.Repository}}\t{{.Tag}}\t{{.CreatedAt}}\t{{.Size}}"
}

# Rollback configuration
rollback_config() {
    info "Rolling back configuration..."
    
    # Stop services
    info "Stopping services..."
    cd "$PROJECT_ROOT"
    docker-compose -f docker-compose.prod.yml down
    
    # Restore configuration from git
    if git status --porcelain | grep -q "deploy/"; then
        warn "Found uncommitted changes in deploy/. Stashing changes..."
        git stash push -m "Pre-rollback config stash $(date)"
    fi
    
    # Reset to previous commit if specified
    if [ -n "${GIT_COMMIT:-}" ]; then
        info "Rolling back to commit: $GIT_COMMIT"
        git checkout "$GIT_COMMIT" -- deploy/
    else
        # Go back one commit
        info "Rolling back to previous commit"
        git log --oneline -n 5 deploy/
        read -p "Enter commit hash to rollback to: " commit_hash
        git checkout "$commit_hash" -- deploy/
    fi
    
    # Restart services with old configuration
    info "Restarting services with rolled back configuration..."
    docker-compose -f docker-compose.prod.yml up -d
    
    success "Configuration rollback completed"
}

# Rollback database
rollback_database() {
    local backup_file="$1"
    
    info "Rolling back database from: $backup_file"
    
    # Validate backup file
    if [ ! -f "$backup_file" ]; then
        error "Backup file not found: $backup_file"
    fi
    
    # Test backup file integrity
    if [[ "$backup_file" == *.gz ]]; then
        if ! gunzip -t "$backup_file"; then
            error "Backup file is corrupted: $backup_file"
        fi
    fi
    
    # Stop application to prevent database access
    info "Stopping application..."
    docker-compose -f docker-compose.prod.yml stop dual-agent-monitor
    
    # Wait for connections to close
    sleep 10
    
    # Restore database
    info "Restoring database..."
    if [[ "$backup_file" == *.gz ]]; then
        gunzip -c "$backup_file" | docker exec -i dual-agent-monitor-postgres-1 psql \
            -U "${POSTGRES_USER:-postgres}" \
            -d "${POSTGRES_DB:-dual_agent_monitor}"
    else
        docker exec -i dual-agent-monitor-postgres-1 psql \
            -U "${POSTGRES_USER:-postgres}" \
            -d "${POSTGRES_DB:-dual_agent_monitor}" < "$backup_file"
    fi
    
    # Restart application
    info "Restarting application..."
    docker-compose -f docker-compose.prod.yml start dual-agent-monitor
    
    success "Database rollback completed"
}

# Rollback application
rollback_application() {
    local docker_tag="$1"
    
    info "Rolling back application to Docker tag: $docker_tag"
    
    # Verify image exists
    if ! docker image inspect "dual-agent-monitor:$docker_tag" &> /dev/null; then
        error "Docker image not found: dual-agent-monitor:$docker_tag"
    fi
    
    # Update docker-compose to use specific tag
    cd "$PROJECT_ROOT"
    
    # Backup current compose file
    cp docker-compose.prod.yml "docker-compose.prod.yml.backup.$(date +%s)"
    
    # Update image tag in compose file
    sed -i.bak "s|image: dual-agent-monitor:.*|image: dual-agent-monitor:$docker_tag|g" docker-compose.prod.yml
    
    # Restart services with old image
    info "Restarting services with rolled back image..."
    docker-compose -f docker-compose.prod.yml up -d --force-recreate dual-agent-monitor
    
    success "Application rollback completed"
}

# Rollback application data
rollback_app_data() {
    local backup_file="$1"
    
    info "Rolling back application data from: $backup_file"
    
    # Validate backup file
    if [ ! -f "$backup_file" ]; then
        error "Backup file not found: $backup_file"
    fi
    
    # Stop application
    info "Stopping application..."
    docker-compose -f docker-compose.prod.yml stop dual-agent-monitor
    
    # Restore application data
    info "Restoring application data..."
    docker run --rm \
        -v dual-agent-monitor_app_data:/data \
        -v "$BACKUP_DIR:/backup" \
        alpine sh -c "cd /data && rm -rf * && tar -xzf /backup/$(basename "$backup_file")"
    
    # Restart application
    info "Restarting application..."
    docker-compose -f docker-compose.prod.yml start dual-agent-monitor
    
    success "Application data rollback completed"
}

# Emergency rollback
emergency_rollback() {
    warn "Performing emergency rollback..."
    
    # Find the most recent backups automatically
    local latest_db_backup
    latest_db_backup=$(find "$BACKUP_DIR" -name "*_db_*.sql.gz" -type f -printf '%T@ %p\n' | sort -rn | head -1 | cut -d' ' -f2-)
    
    local latest_app_backup
    latest_app_backup=$(find "$BACKUP_DIR" -name "*_app_data_*.tar.gz" -type f -printf '%T@ %p\n' | sort -rn | head -1 | cut -d' ' -f2-)
    
    # Find previous Docker image
    local previous_image
    previous_image=$(docker images dual-agent-monitor --format "{{.Tag}}" | grep -v latest | head -1)
    
    info "Emergency rollback using:"
    info "  Database backup: $(basename "$latest_db_backup")"
    info "  App data backup: $(basename "$latest_app_backup")"
    info "  Docker image: dual-agent-monitor:$previous_image"
    
    # Execute rollback steps
    if [ -n "$latest_db_backup" ]; then
        rollback_database "$latest_db_backup"
    fi
    
    if [ -n "$latest_app_backup" ]; then
        rollback_app_data "$latest_app_backup"
    fi
    
    if [ -n "$previous_image" ]; then
        rollback_application "$previous_image"
    fi
    
    success "Emergency rollback completed"
}

# Verify rollback success
verify_rollback() {
    info "Verifying rollback success..."
    
    # Wait for services to be ready
    sleep 30
    
    # Run basic health checks
    local health_script="$SCRIPT_DIR/health-check.sh"
    
    if [ -f "$health_script" ]; then
        info "Running health checks..."
        if bash "$health_script" --report-only; then
            success "Health checks passed after rollback"
        else
            warn "Some health checks failed after rollback"
        fi
    else
        # Manual verification
        local health_url="https://${DOMAIN}/health"
        
        if curl -sSf "$health_url" > /dev/null; then
            success "Application is responding after rollback"
        else
            warn "Application health check failed after rollback"
        fi
    fi
}

# Send rollback notification
send_rollback_notification() {
    local rollback_type="$1"
    local status="$2"
    local details="$3"
    
    # Send Slack notification if configured
    if [ -n "${SLACK_WEBHOOK_URL:-}" ]; then
        local color
        case "$status" in
            "success") color="warning" ;;  # Orange for rollbacks
            "error") color="danger" ;;
            *) color="warning" ;;
        esac
        
        local payload
        payload=$(cat <<EOF
{
    "attachments": [
        {
            "color": "$color",
            "title": "🔄 Dual Agent Monitor - Rollback $status",
            "text": "Rollback Type: **$rollback_type**\n$details",
            "fields": [
                {
                    "title": "Server",
                    "value": "$(hostname)",
                    "short": true
                },
                {
                    "title": "Timestamp",
                    "value": "$(date)",
                    "short": true
                }
            ]
        }
    ]
}
EOF
        )
        
        curl -X POST -H 'Content-type: application/json' \
            --data "$payload" \
            "$SLACK_WEBHOOK_URL" &> /dev/null || true
    fi
    
    # Log to system log
    logger -t "dual-agent-monitor-rollback" "$status: $rollback_type rollback - $details"
}

# Main rollback function
main() {
    local rollback_type=""
    local backup_id=""
    local backup_timestamp=""
    local docker_tag=""
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --backup-id)
                backup_id="$2"
                shift 2
                ;;
            --backup-timestamp)
                backup_timestamp="$2"
                shift 2
                ;;
            --docker-tag)
                docker_tag="$2"
                shift 2
                ;;
            --skip-backup)
                SKIP_BACKUP=true
                shift
                ;;
            --force)
                FORCE=true
                shift
                ;;
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --help)
                show_usage
                exit 0
                ;;
            config|database|application|full|emergency)
                rollback_type="$1"
                shift
                ;;
            *)
                error "Unknown option: $1. Use --help for usage information."
                ;;
        esac
    done
    
    # Validate arguments
    if [ -z "$rollback_type" ]; then
        error "Rollback type is required. Use --help for usage information."
    fi
    
    # Show available backups for reference
    if [ "$rollback_type" != "emergency" ]; then
        list_backups
        echo ""
    fi
    
    # Dry run mode
    if [ "${DRY_RUN:-false}" = true ]; then
        info "DRY RUN MODE - No changes will be made"
        info "Would perform: $rollback_type rollback"
        info "Parameters: backup_id=$backup_id, backup_timestamp=$backup_timestamp, docker_tag=$docker_tag"
        exit 0
    fi
    
    local start_time
    start_time=$(date +%s)
    
    info "Starting $rollback_type rollback..."
    
    # Determine backup files
    local db_backup_file=""
    local app_backup_file=""
    
    if [ -n "$backup_id" ]; then
        db_backup_file="$BACKUP_DIR/${backup_id}_database.sql.gz"
        app_backup_file="$BACKUP_DIR/${backup_id}_app_data.tar.gz"
    elif [ -n "$backup_timestamp" ]; then
        db_backup_file=$(find "$BACKUP_DIR" -name "*${backup_timestamp}*_db*.sql.gz" | head -1)
        app_backup_file=$(find "$BACKUP_DIR" -name "*${backup_timestamp}*_app_data*.tar.gz" | head -1)
    fi
    
    # Confirm rollback action
    local details="backup_id=$backup_id, timestamp=$backup_timestamp, docker_tag=$docker_tag"
    confirm_rollback "$rollback_type" "$details"
    
    # Create pre-rollback backup
    create_pre_rollback_backup
    
    # Execute rollback based on type
    case "$rollback_type" in
        config)
            rollback_config
            ;;
        database)
            if [ -z "$db_backup_file" ] || [ ! -f "$db_backup_file" ]; then
                error "Database backup file not found. Specify --backup-id or --backup-timestamp"
            fi
            rollback_database "$db_backup_file"
            ;;
        application)
            if [ -z "$docker_tag" ]; then
                error "Docker tag is required for application rollback. Use --docker-tag"
            fi
            rollback_application "$docker_tag"
            ;;
        full)
            if [ -n "$docker_tag" ]; then
                rollback_application "$docker_tag"
            fi
            if [ -n "$db_backup_file" ] && [ -f "$db_backup_file" ]; then
                rollback_database "$db_backup_file"
            fi
            if [ -n "$app_backup_file" ] && [ -f "$app_backup_file" ]; then
                rollback_app_data "$app_backup_file"
            fi
            ;;
        emergency)
            emergency_rollback
            ;;
        *)
            error "Unknown rollback type: $rollback_type"
            ;;
    esac
    
    # Verify rollback
    verify_rollback
    
    local end_time
    end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    success "Rollback completed successfully in ${duration}s"
    
    # Send notification
    send_rollback_notification "$rollback_type" "success" "Rollback completed in ${duration}s"
}

# Handle script interruption
cleanup_on_error() {
    error "Rollback process interrupted or failed"
    send_rollback_notification "${rollback_type:-unknown}" "error" "Rollback process was interrupted or failed"
    exit 1
}

trap cleanup_on_error INT TERM ERR

# Run main function
main "$@"
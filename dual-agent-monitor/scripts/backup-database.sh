#!/bin/bash

# Database Backup Script for Dual Agent Monitor
# Automated backup with rotation and cloud storage support

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/dual-agent-monitor}"
LOG_FILE="/var/log/dual-agent-monitor-backup.log"

# Load environment variables
if [ -f "$PROJECT_ROOT/.env.production" ]; then
    source "$PROJECT_ROOT/.env.production"
fi

# Backup configuration
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-dual-agent-monitor-postgres-1}"
DATABASE_NAME="${POSTGRES_DB:-dual_agent_monitor}"
DATABASE_USER="${POSTGRES_USER:-postgres}"

# Cloud backup configuration
AWS_S3_BUCKET="${S3_BACKUP_BUCKET:-}"
AWS_REGION="${S3_BACKUP_REGION:-us-east-1}"
ENABLE_CLOUD_BACKUP="${ENABLE_CLOUD_BACKUP:-false}"

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

# Check prerequisites
check_prerequisites() {
    info "Checking backup prerequisites..."
    
    # Check if Docker is running
    if ! docker info &> /dev/null; then
        error "Docker is not running"
    fi
    
    # Check if PostgreSQL container exists
    if ! docker ps --format "table {{.Names}}" | grep -q "$POSTGRES_CONTAINER"; then
        error "PostgreSQL container '$POSTGRES_CONTAINER' not found"
    fi
    
    # Create backup directory
    if [ ! -d "$BACKUP_DIR" ]; then
        info "Creating backup directory: $BACKUP_DIR"
        sudo mkdir -p "$BACKUP_DIR"
        sudo chown "$(whoami):$(whoami)" "$BACKUP_DIR"
    fi
    
    # Check available disk space (minimum 1GB)
    local available_space
    available_space=$(df "$BACKUP_DIR" | awk 'NR==2{print $4}')
    if [ "$available_space" -lt 1048576 ]; then # 1GB in KB
        warn "Low disk space available for backups: ${available_space}KB"
    fi
    
    success "Prerequisites check passed"
}

# Create database backup
create_database_backup() {
    local timestamp
    timestamp=$(date +"%Y%m%d_%H%M%S")
    local backup_file="$BACKUP_DIR/db_backup_$timestamp.sql"
    local compressed_file="$BACKUP_DIR/db_backup_$timestamp.sql.gz"
    
    info "Creating database backup: $backup_file"
    
    # Create SQL dump
    if ! docker exec "$POSTGRES_CONTAINER" pg_dump \
        -U "$DATABASE_USER" \
        -h localhost \
        --no-password \
        --verbose \
        --clean \
        --if-exists \
        --create \
        "$DATABASE_NAME" > "$backup_file"; then
        error "Database backup failed"
    fi
    
    # Compress the backup
    info "Compressing backup..."
    if ! gzip "$backup_file"; then
        error "Failed to compress backup"
    fi
    
    # Verify backup integrity
    info "Verifying backup integrity..."
    if ! gunzip -t "$compressed_file"; then
        error "Backup file is corrupted"
    fi
    
    local backup_size
    backup_size=$(du -h "$compressed_file" | cut -f1)
    success "Database backup created: $compressed_file (size: $backup_size)"
    
    echo "$compressed_file"
}

# Create application data backup
create_app_data_backup() {
    local timestamp
    timestamp=$(date +"%Y%m%d_%H%M%S")
    local backup_file="$BACKUP_DIR/app_data_backup_$timestamp.tar.gz"
    
    # Check if app data volume exists
    if ! docker volume ls --format "table {{.Name}}" | grep -q "dual-agent-monitor_app_data"; then
        warn "Application data volume not found, skipping"
        return 0
    fi
    
    info "Creating application data backup: $backup_file"
    
    # Create temporary container to access volume data
    if ! docker run --rm \
        -v dual-agent-monitor_app_data:/data:ro \
        -v "$BACKUP_DIR:/backup" \
        alpine tar -czf "/backup/app_data_backup_$timestamp.tar.gz" -C /data .; then
        error "Application data backup failed"
    fi
    
    local backup_size
    backup_size=$(du -h "$backup_file" | cut -f1)
    success "Application data backup created: $backup_file (size: $backup_size)"
    
    echo "$backup_file"
}

# Upload backup to cloud storage
upload_to_cloud() {
    local backup_file="$1"
    local filename
    filename=$(basename "$backup_file")
    
    if [ "$ENABLE_CLOUD_BACKUP" != "true" ]; then
        info "Cloud backup disabled, skipping upload"
        return 0
    fi
    
    if [ -z "$AWS_S3_BUCKET" ]; then
        warn "AWS S3 bucket not configured, skipping cloud upload"
        return 0
    fi
    
    info "Uploading backup to S3: s3://$AWS_S3_BUCKET/$filename"
    
    # Check if AWS CLI is available
    if ! command -v aws &> /dev/null; then
        warn "AWS CLI not found, skipping cloud upload"
        return 0
    fi
    
    # Upload to S3 with server-side encryption
    if aws s3 cp "$backup_file" "s3://$AWS_S3_BUCKET/$filename" \
        --region "$AWS_REGION" \
        --server-side-encryption AES256 \
        --storage-class STANDARD_IA; then
        success "Backup uploaded to cloud storage"
    else
        warn "Failed to upload backup to cloud storage"
    fi
}

# Clean old backups
cleanup_old_backups() {
    info "Cleaning up backups older than $RETENTION_DAYS days..."
    
    # Clean local backups
    local deleted_count=0
    while IFS= read -r -d '' file; do
        info "Removing old backup: $(basename "$file")"
        rm "$file"
        ((deleted_count++))
    done < <(find "$BACKUP_DIR" -name "*.sql.gz" -o -name "*.tar.gz" -mtime "+$RETENTION_DAYS" -print0)
    
    info "Removed $deleted_count old local backups"
    
    # Clean cloud backups if enabled
    if [ "$ENABLE_CLOUD_BACKUP" = "true" ] && [ -n "$AWS_S3_BUCKET" ] && command -v aws &> /dev/null; then
        info "Cleaning old cloud backups..."
        
        local cutoff_date
        cutoff_date=$(date -d "$RETENTION_DAYS days ago" +"%Y-%m-%d")
        
        aws s3 ls "s3://$AWS_S3_BUCKET/" --region "$AWS_REGION" | \
        awk -v cutoff="$cutoff_date" '$1 < cutoff {print $4}' | \
        while read -r filename; do
            if [ -n "$filename" ]; then
                info "Removing old cloud backup: $filename"
                aws s3 rm "s3://$AWS_S3_BUCKET/$filename" --region "$AWS_REGION"
            fi
        done
    fi
    
    success "Backup cleanup completed"
}

# Send notification
send_notification() {
    local status="$1"
    local message="$2"
    
    # Send Slack notification if webhook URL is configured
    if [ -n "${SLACK_WEBHOOK_URL:-}" ]; then
        local color
        case "$status" in
            "success") color="good" ;;
            "error") color="danger" ;;
            *) color="warning" ;;
        esac
        
        local payload
        payload=$(cat <<EOF
{
    "attachments": [
        {
            "color": "$color",
            "title": "Dual Agent Monitor - Backup $status",
            "text": "$message",
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
    logger -t "dual-agent-monitor-backup" "$status: $message"
}

# Main backup function
main() {
    local start_time
    start_time=$(date +%s)
    
    info "Starting backup process..."
    
    # Handle command line arguments
    local skip_app_data=false
    local skip_cloud=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --skip-app-data)
                skip_app_data=true
                shift
                ;;
            --skip-cloud)
                skip_cloud=true
                ENABLE_CLOUD_BACKUP=false
                shift
                ;;
            --help)
                echo "Usage: $0 [--skip-app-data] [--skip-cloud]"
                echo "  --skip-app-data  Skip application data backup"
                echo "  --skip-cloud     Skip cloud storage upload"
                exit 0
                ;;
            *)
                error "Unknown option: $1"
                ;;
        esac
    done
    
    local backup_files=()
    
    # Run backup steps
    check_prerequisites
    
    # Create database backup
    if db_backup=$(create_database_backup); then
        backup_files+=("$db_backup")
        upload_to_cloud "$db_backup"
    else
        send_notification "error" "Database backup failed"
        exit 1
    fi
    
    # Create application data backup
    if [ "$skip_app_data" = false ]; then
        if app_backup=$(create_app_data_backup); then
            backup_files+=("$app_backup")
            upload_to_cloud "$app_backup"
        fi
    fi
    
    # Clean old backups
    cleanup_old_backups
    
    # Calculate total backup size
    local total_size=0
    for file in "${backup_files[@]}"; do
        if [ -f "$file" ]; then
            size=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null || echo 0)
            ((total_size += size))
        fi
    done
    
    local human_readable_size
    human_readable_size=$(numfmt --to=iec-i --suffix=B $total_size)
    
    local end_time
    end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    success "Backup process completed successfully!"
    info "Total backup size: $human_readable_size"
    info "Duration: ${duration}s"
    
    send_notification "success" "Backup completed successfully. Size: $human_readable_size, Duration: ${duration}s"
}

# Handle script interruption
cleanup_on_error() {
    error "Backup process interrupted"
    send_notification "error" "Backup process was interrupted"
    exit 1
}

trap cleanup_on_error INT TERM ERR

# Run main function
main "$@"
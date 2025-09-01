#!/bin/bash

# PostgreSQL Backup Script
# Creates backups of the dual-agent monitor database

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
BACKUP_DIR="$PROJECT_ROOT/backups"

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

# Function to load environment variables
load_env() {
    if [[ -f "$ENV_FILE" ]]; then
        export $(grep -v '^#' "$ENV_FILE" | xargs)
    fi
}

# Function to create backup
create_backup() {
    local backup_type=$1
    local timestamp=$(date +"%Y%m%d_%H%M%S")
    local backup_file="$BACKUP_DIR/${backup_type}_backup_${timestamp}.sql"
    
    print_status "Creating $backup_type backup..."
    
    case $backup_type in
        "full")
            docker-compose -f "$COMPOSE_FILE" exec -T postgres \
                pg_dump -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-dual_agent_monitor}" \
                --verbose --no-password > "$backup_file"
            ;;
        "schema")
            docker-compose -f "$COMPOSE_FILE" exec -T postgres \
                pg_dump -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-dual_agent_monitor}" \
                --schema-only --verbose --no-password > "$backup_file"
            ;;
        "data")
            docker-compose -f "$COMPOSE_FILE" exec -T postgres \
                pg_dump -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-dual_agent_monitor}" \
                --data-only --verbose --no-password > "$backup_file"
            ;;
    esac
    
    if [[ -f "$backup_file" && -s "$backup_file" ]]; then
        local size=$(du -h "$backup_file" | cut -f1)
        print_success "$backup_type backup created: $(basename "$backup_file") (${size})"
        
        # Compress backup if larger than 1MB
        if [[ $(stat -f%z "$backup_file" 2>/dev/null || stat -c%s "$backup_file" 2>/dev/null) -gt 1048576 ]]; then
            print_status "Compressing backup..."
            gzip "$backup_file"
            print_success "Backup compressed: $(basename "$backup_file").gz"
            echo "$backup_file.gz"
        else
            echo "$backup_file"
        fi
    else
        print_error "Backup creation failed"
        exit 1
    fi
}

# Function to cleanup old backups
cleanup_old_backups() {
    local retention_days=${1:-7}
    
    print_status "Cleaning up backups older than $retention_days days..."
    
    local deleted_count=0
    while IFS= read -r -d '' file; do
        rm "$file"
        ((deleted_count++))
        print_status "Deleted: $(basename "$file")"
    done < <(find "$BACKUP_DIR" -name "*_backup_*.sql*" -mtime +$retention_days -print0)
    
    if [[ $deleted_count -eq 0 ]]; then
        print_status "No old backups found to clean up"
    else
        print_success "Cleaned up $deleted_count old backup files"
    fi
}

# Function to list existing backups
list_backups() {
    print_status "Existing backups:"
    
    if [[ -d "$BACKUP_DIR" ]]; then
        local backup_files=$(find "$BACKUP_DIR" -name "*_backup_*.sql*" -type f | sort)
        
        if [[ -n "$backup_files" ]]; then
            while IFS= read -r file; do
                local size=$(du -h "$file" | cut -f1)
                local date=$(stat -f%Sm -t%Y-%m-%d\ %H:%M "$file" 2>/dev/null || stat -c%y "$file" 2>/dev/null | cut -d' ' -f1,2 | cut -d'.' -f1)
                echo "  $(basename "$file") - ${size} - ${date}"
            done <<< "$backup_files"
        else
            print_warning "No backup files found"
        fi
    else
        print_warning "Backup directory does not exist: $BACKUP_DIR"
    fi
}

# Function to restore from backup
restore_backup() {
    local backup_file=$1
    
    if [[ ! -f "$backup_file" ]]; then
        print_error "Backup file not found: $backup_file"
        exit 1
    fi
    
    print_warning "This will restore the database from backup and OVERWRITE existing data!"
    read -p "Are you sure you want to continue? (y/N): " -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_status "Restore cancelled"
        exit 0
    fi
    
    print_status "Restoring database from: $(basename "$backup_file")"
    
    # Decompress if needed
    local restore_file="$backup_file"
    if [[ "$backup_file" == *.gz ]]; then
        print_status "Decompressing backup file..."
        restore_file="${backup_file%.gz}"
        gunzip -c "$backup_file" > "$restore_file"
    fi
    
    # Drop and recreate database
    print_status "Dropping existing database..."
    docker-compose -f "$COMPOSE_FILE" exec -T postgres \
        psql -U "${POSTGRES_USER:-postgres}" -d postgres \
        -c "DROP DATABASE IF EXISTS ${POSTGRES_DB:-dual_agent_monitor};"
    
    print_status "Creating fresh database..."
    docker-compose -f "$COMPOSE_FILE" exec -T postgres \
        psql -U "${POSTGRES_USER:-postgres}" -d postgres \
        -c "CREATE DATABASE ${POSTGRES_DB:-dual_agent_monitor};"
    
    # Restore data
    print_status "Restoring data..."
    docker-compose -f "$COMPOSE_FILE" exec -T postgres \
        psql -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-dual_agent_monitor}" \
        < "$restore_file"
    
    # Cleanup temporary file if we decompressed
    if [[ "$backup_file" == *.gz && "$restore_file" != "$backup_file" ]]; then
        rm "$restore_file"
    fi
    
    print_success "Database restore completed!"
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo
    echo "Commands:"
    echo "  backup [full|schema|data]  Create a database backup (default: full)"
    echo "  list                       List existing backup files"
    echo "  cleanup [days]             Remove backups older than N days (default: 7)"
    echo "  restore <file>             Restore database from backup file"
    echo "  help                       Show this help message"
    echo
    echo "Examples:"
    echo "  $0 backup                  # Create full backup"
    echo "  $0 backup schema           # Create schema-only backup"
    echo "  $0 list                    # List all backups"
    echo "  $0 cleanup 14              # Remove backups older than 14 days"
    echo "  $0 restore backups/full_backup_20250901_120000.sql"
}

# Main execution
main() {
    load_env
    mkdir -p "$BACKUP_DIR"
    
    case ${1:-backup} in
        "backup")
            backup_type=${2:-full}
            if [[ "$backup_type" =~ ^(full|schema|data)$ ]]; then
                backup_file=$(create_backup "$backup_type")
                echo
                print_success "Backup completed: $backup_file"
            else
                print_error "Invalid backup type: $backup_type"
                echo "Valid types: full, schema, data"
                exit 1
            fi
            ;;
        "list")
            list_backups
            ;;
        "cleanup")
            cleanup_old_backups "${2:-7}"
            ;;
        "restore")
            if [[ -z "$2" ]]; then
                print_error "Please specify backup file to restore"
                show_usage
                exit 1
            fi
            restore_backup "$2"
            ;;
        "help"|"-h"|"--help")
            show_usage
            ;;
        *)
            print_error "Unknown command: $1"
            show_usage
            exit 1
            ;;
    esac
}

# Check if PostgreSQL container is running
if ! docker-compose -f "$COMPOSE_FILE" ps postgres | grep -q "Up"; then
    print_error "PostgreSQL container is not running. Please start it first:"
    print_status "Run: ./scripts/init-postgres.sh"
    exit 1
fi

# Run main function
main "$@"
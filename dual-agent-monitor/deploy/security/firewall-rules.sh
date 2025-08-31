#!/bin/bash

# Firewall Rules Setup Script for Dual Agent Monitor
# Configures iptables/ufw firewall rules for production security

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="/var/log/dual-agent-monitor-firewall.log"

# Application ports
HTTP_PORT=80
HTTPS_PORT=443
APP_PORT=8080
SSH_PORT=22
PROMETHEUS_PORT=9090
GRAFANA_PORT=3000
DB_PORT=5432
REDIS_PORT=6379

# Allowed IP ranges (customize as needed)
ADMIN_IPS=("10.0.0.0/8" "172.16.0.0/12" "192.168.0.0/16")  # Private networks
OFFICE_IPS=()  # Add your office IP ranges here
MONITOR_IPS=()  # Add monitoring service IPs here

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
Usage: $0 [OPTIONS] [ACTION]

Actions:
  setup       - Set up firewall rules (default)
  reset       - Reset all firewall rules to defaults
  status      - Show current firewall status
  test        - Test firewall configuration
  backup      - Backup current firewall rules
  restore     - Restore firewall rules from backup

Options:
  --firewall TYPE    - Firewall type: iptables, ufw (auto-detect if not specified)
  --allow-ip IP      - Add IP/CIDR to admin allow list
  --ssh-port PORT    - SSH port (default: 22)
  --dry-run          - Show what would be done without executing
  --help             - Show this help message

Examples:
  $0 setup                                    # Set up default firewall rules
  $0 --firewall ufw setup                     # Force use of ufw
  $0 --allow-ip 203.0.113.0/24 setup        # Add specific IP range to admin list
  $0 --ssh-port 2222 setup                   # Use custom SSH port
  $0 status                                   # Check firewall status
  $0 reset                                    # Reset to default (open) rules

EOF
}

# Detect firewall system
detect_firewall() {
    if command -v ufw &> /dev/null && ufw status &> /dev/null; then
        echo "ufw"
    elif command -v iptables &> /dev/null; then
        echo "iptables"
    else
        error "No supported firewall found (ufw or iptables)"
    fi
}

# Check if running as root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        error "This script must be run as root or with sudo"
    fi
}

# Backup current firewall rules
backup_rules() {
    local backup_dir="/etc/dual-agent-monitor/firewall-backup"
    local timestamp
    timestamp=$(date +"%Y%m%d_%H%M%S")
    
    mkdir -p "$backup_dir"
    
    case "$FIREWALL_TYPE" in
        "iptables")
            info "Backing up iptables rules..."
            iptables-save > "$backup_dir/iptables_$timestamp.rules"
            success "Iptables rules backed up to: $backup_dir/iptables_$timestamp.rules"
            ;;
        "ufw")
            info "Backing up ufw rules..."
            cp /etc/ufw/user.rules "$backup_dir/ufw_user_$timestamp.rules" 2>/dev/null || true
            cp /etc/ufw/user6.rules "$backup_dir/ufw_user6_$timestamp.rules" 2>/dev/null || true
            ufw status numbered > "$backup_dir/ufw_status_$timestamp.txt"
            success "UFW rules backed up to: $backup_dir/"
            ;;
    esac
}

# Set up iptables rules
setup_iptables() {
    info "Setting up iptables firewall rules..."
    
    if [ "$DRY_RUN" = true ]; then
        info "DRY RUN: Would execute the following iptables commands:"
        local cmd_prefix="echo DRYRUN:"
    else
        local cmd_prefix=""
    fi
    
    # Flush existing rules
    $cmd_prefix iptables -F
    $cmd_prefix iptables -X
    $cmd_prefix iptables -t nat -F
    $cmd_prefix iptables -t nat -X
    $cmd_prefix iptables -t mangle -F
    $cmd_prefix iptables -t mangle -X
    
    # Set default policies
    $cmd_prefix iptables -P INPUT DROP
    $cmd_prefix iptables -P FORWARD DROP
    $cmd_prefix iptables -P OUTPUT ACCEPT
    
    # Allow loopback traffic
    $cmd_prefix iptables -A INPUT -i lo -j ACCEPT
    $cmd_prefix iptables -A OUTPUT -o lo -j ACCEPT
    
    # Allow established and related connections
    $cmd_prefix iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
    
    # Allow ICMP (ping)
    $cmd_prefix iptables -A INPUT -p icmp --icmp-type echo-request -j ACCEPT
    
    # SSH access (restricted to admin IPs)
    for ip in "${ADMIN_IPS[@]}" "${OFFICE_IPS[@]}"; do
        if [ -n "$ip" ]; then
            $cmd_prefix iptables -A INPUT -p tcp -s "$ip" --dport "$SSH_PORT" -j ACCEPT
        fi
    done
    
    # HTTP and HTTPS (public access)
    $cmd_prefix iptables -A INPUT -p tcp --dport "$HTTP_PORT" -j ACCEPT
    $cmd_prefix iptables -A INPUT -p tcp --dport "$HTTPS_PORT" -j ACCEPT
    
    # Application port (restricted to load balancer/proxy)
    for ip in "${ADMIN_IPS[@]}"; do
        if [ -n "$ip" ]; then
            $cmd_prefix iptables -A INPUT -p tcp -s "$ip" --dport "$APP_PORT" -j ACCEPT
        fi
    done
    
    # Monitoring ports (restricted to admin IPs)
    for ip in "${ADMIN_IPS[@]}" "${OFFICE_IPS[@]}" "${MONITOR_IPS[@]}"; do
        if [ -n "$ip" ]; then
            $cmd_prefix iptables -A INPUT -p tcp -s "$ip" --dport "$PROMETHEUS_PORT" -j ACCEPT
            $cmd_prefix iptables -A INPUT -p tcp -s "$ip" --dport "$GRAFANA_PORT" -j ACCEPT
        fi
    done
    
    # Database and Redis (internal network only)
    for ip in "${ADMIN_IPS[@]}"; do
        if [ -n "$ip" ]; then
            $cmd_prefix iptables -A INPUT -p tcp -s "$ip" --dport "$DB_PORT" -j ACCEPT
            $cmd_prefix iptables -A INPUT -p tcp -s "$ip" --dport "$REDIS_PORT" -j ACCEPT
        fi
    done
    
    # Rate limiting for HTTP/HTTPS
    $cmd_prefix iptables -A INPUT -p tcp --dport "$HTTP_PORT" -m limit --limit 25/minute --limit-burst 100 -j ACCEPT
    $cmd_prefix iptables -A INPUT -p tcp --dport "$HTTPS_PORT" -m limit --limit 25/minute --limit-burst 100 -j ACCEPT
    
    # Drop invalid packets
    $cmd_prefix iptables -A INPUT -m state --state INVALID -j DROP
    
    # Log dropped packets (optional - can generate lots of logs)
    # $cmd_prefix iptables -A INPUT -j LOG --log-prefix "IPTables-Dropped: " --log-level 4
    
    # Drop everything else
    $cmd_prefix iptables -A INPUT -j DROP
    
    if [ "$DRY_RUN" = false ]; then
        # Save rules
        if command -v iptables-save &> /dev/null; then
            iptables-save > /etc/iptables/rules.v4 2>/dev/null || \
            iptables-save > /etc/iptables.rules 2>/dev/null || true
        fi
        
        success "Iptables rules configured successfully"
    fi
}

# Set up UFW rules
setup_ufw() {
    info "Setting up UFW firewall rules..."
    
    if [ "$DRY_RUN" = true ]; then
        info "DRY RUN: Would execute the following UFW commands:"
        local cmd_prefix="echo DRYRUN:"
    else
        local cmd_prefix=""
    fi
    
    # Reset UFW to defaults
    $cmd_prefix ufw --force reset
    
    # Set default policies
    $cmd_prefix ufw default deny incoming
    $cmd_prefix ufw default allow outgoing
    
    # SSH access (restricted to admin IPs)
    for ip in "${ADMIN_IPS[@]}" "${OFFICE_IPS[@]}"; do
        if [ -n "$ip" ]; then
            $cmd_prefix ufw allow from "$ip" to any port "$SSH_PORT"
        fi
    done
    
    # HTTP and HTTPS (public access)
    $cmd_prefix ufw allow "$HTTP_PORT"
    $cmd_prefix ufw allow "$HTTPS_PORT"
    
    # Application port (restricted)
    for ip in "${ADMIN_IPS[@]}"; do
        if [ -n "$ip" ]; then
            $cmd_prefix ufw allow from "$ip" to any port "$APP_PORT"
        fi
    done
    
    # Monitoring ports (restricted to admin IPs)
    for ip in "${ADMIN_IPS[@]}" "${OFFICE_IPS[@]}" "${MONITOR_IPS[@]}"; do
        if [ -n "$ip" ]; then
            $cmd_prefix ufw allow from "$ip" to any port "$PROMETHEUS_PORT"
            $cmd_prefix ufw allow from "$ip" to any port "$GRAFANA_PORT"
        fi
    done
    
    # Database and Redis (internal network only)
    for ip in "${ADMIN_IPS[@]}"; do
        if [ -n "$ip" ]; then
            $cmd_prefix ufw allow from "$ip" to any port "$DB_PORT"
            $cmd_prefix ufw allow from "$ip" to any port "$REDIS_PORT"
        fi
    done
    
    # Rate limiting
    $cmd_prefix ufw limit ssh
    $cmd_prefix ufw limit "$HTTP_PORT"
    $cmd_prefix ufw limit "$HTTPS_PORT"
    
    # Enable UFW
    if [ "$DRY_RUN" = false ]; then
        echo "y" | ufw enable
        success "UFW rules configured and enabled successfully"
    fi
}

# Reset firewall rules
reset_firewall() {
    info "Resetting firewall rules to defaults..."
    
    case "$FIREWALL_TYPE" in
        "iptables")
            iptables -F
            iptables -X
            iptables -P INPUT ACCEPT
            iptables -P FORWARD ACCEPT
            iptables -P OUTPUT ACCEPT
            success "Iptables rules reset to defaults"
            ;;
        "ufw")
            ufw --force reset
            ufw --force disable
            success "UFW rules reset and disabled"
            ;;
    esac
}

# Show firewall status
show_status() {
    info "Current firewall status:"
    
    case "$FIREWALL_TYPE" in
        "iptables")
            echo "=== INPUT Chain ==="
            iptables -L INPUT -n -v --line-numbers
            echo ""
            echo "=== OUTPUT Chain ==="
            iptables -L OUTPUT -n -v --line-numbers
            ;;
        "ufw")
            ufw status verbose
            ;;
    esac
}

# Test firewall configuration
test_firewall() {
    info "Testing firewall configuration..."
    
    # Test SSH connectivity
    info "Testing SSH connectivity on port $SSH_PORT..."
    if ss -tlnp | grep -q ":$SSH_PORT "; then
        success "SSH port $SSH_PORT is listening"
    else
        warn "SSH port $SSH_PORT is not listening"
    fi
    
    # Test HTTP/HTTPS connectivity
    info "Testing HTTP/HTTPS ports..."
    for port in $HTTP_PORT $HTTPS_PORT; do
        if ss -tlnp | grep -q ":$port "; then
            success "Port $port is listening"
        else
            warn "Port $port is not listening"
        fi
    done
    
    # Test application port
    info "Testing application port $APP_PORT..."
    if ss -tlnp | grep -q ":$APP_PORT "; then
        success "Application port $APP_PORT is listening"
    else
        warn "Application port $APP_PORT is not listening"
    fi
    
    # Check firewall status
    case "$FIREWALL_TYPE" in
        "iptables")
            if iptables -L | grep -q "Chain INPUT (policy DROP)"; then
                success "Iptables is configured with DROP policy"
            else
                warn "Iptables may not be properly configured"
            fi
            ;;
        "ufw")
            if ufw status | grep -q "Status: active"; then
                success "UFW is active"
            else
                warn "UFW is not active"
            fi
            ;;
    esac
    
    success "Firewall configuration test completed"
}

# Install fail2ban for additional security
install_fail2ban() {
    info "Installing and configuring fail2ban..."
    
    # Install fail2ban
    if command -v apt-get &> /dev/null; then
        apt-get update
        apt-get install -y fail2ban
    elif command -v yum &> /dev/null; then
        yum install -y epel-release
        yum install -y fail2ban
    elif command -v dnf &> /dev/null; then
        dnf install -y fail2ban
    else
        warn "Could not install fail2ban automatically"
        return 0
    fi
    
    # Configure fail2ban
    cat > /etc/fail2ban/jail.local <<EOF
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5
backend = auto

[sshd]
enabled = true
port = $SSH_PORT
logpath = /var/log/auth.log
maxretry = 3

[nginx-http-auth]
enabled = true
filter = nginx-http-auth
logpath = /var/log/nginx/error.log
maxretry = 3

[nginx-limit-req]
enabled = true
filter = nginx-limit-req
logpath = /var/log/nginx/error.log
maxretry = 10

[dual-agent-monitor]
enabled = true
filter = dual-agent-monitor
logpath = /var/log/dual-agent-monitor/app.log
maxretry = 5
bantime = 1800
EOF
    
    # Create custom fail2ban filter for dual-agent-monitor
    cat > /etc/fail2ban/filter.d/dual-agent-monitor.conf <<EOF
[Definition]
failregex = ^.*\[ERROR\].*Authentication failed.*from <HOST>.*$
            ^.*\[WARN\].*Suspicious activity.*from <HOST>.*$
ignoreregex = 
EOF
    
    # Start and enable fail2ban
    systemctl enable fail2ban
    systemctl restart fail2ban
    
    success "Fail2ban installed and configured"
}

# Main function
main() {
    local action="setup"
    local firewall_type=""
    local additional_ips=()
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --firewall)
                firewall_type="$2"
                shift 2
                ;;
            --allow-ip)
                additional_ips+=("$2")
                shift 2
                ;;
            --ssh-port)
                SSH_PORT="$2"
                shift 2
                ;;
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --help)
                show_usage
                exit 0
                ;;
            setup|reset|status|test|backup|restore)
                action="$1"
                shift
                ;;
            *)
                error "Unknown option: $1. Use --help for usage information."
                ;;
        esac
    done
    
    # Add additional IPs to admin list
    ADMIN_IPS+=("${additional_ips[@]}")
    
    # Detect firewall type if not specified
    if [ -z "$firewall_type" ]; then
        FIREWALL_TYPE=$(detect_firewall)
    else
        FIREWALL_TYPE="$firewall_type"
    fi
    
    info "Using firewall type: $FIREWALL_TYPE"
    
    # Check root permissions for most actions
    if [ "$action" != "status" ] && [ "$action" != "test" ]; then
        check_root
    fi
    
    # Execute requested action
    case "$action" in
        setup)
            backup_rules
            case "$FIREWALL_TYPE" in
                "iptables")
                    setup_iptables
                    ;;
                "ufw")
                    setup_ufw
                    ;;
            esac
            install_fail2ban
            test_firewall
            ;;
        reset)
            backup_rules
            reset_firewall
            ;;
        status)
            show_status
            ;;
        test)
            test_firewall
            ;;
        backup)
            backup_rules
            ;;
        restore)
            warn "Restore functionality not implemented yet"
            warn "Please manually restore from backup files in /etc/dual-agent-monitor/firewall-backup/"
            ;;
        *)
            error "Unknown action: $action"
            ;;
    esac
    
    success "Firewall $action completed successfully!"
}

# Global variables
FIREWALL_TYPE=""
DRY_RUN=false

# Run main function
main "$@"
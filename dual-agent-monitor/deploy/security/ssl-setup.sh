#!/bin/bash

# SSL Certificate Setup Script for Dual Agent Monitor
# Supports both Let's Encrypt (automated) and manual certificate installation

set -euo pipefail

# Configuration
DOMAIN=""
EMAIL=""
STAGING=false
MANUAL_CERT_PATH=""
CERT_DIR="/etc/letsencrypt/live"
NGINX_CONF_DIR="/etc/nginx/ssl"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
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
Usage: $0 [OPTIONS]

SSL Certificate Setup Options:
  --domain DOMAIN           - Domain name for the certificate (required)
  --email EMAIL            - Email address for Let's Encrypt notifications
  --staging                - Use Let's Encrypt staging environment (for testing)
  --manual-cert PATH       - Path to manual certificate files directory
  --renew                  - Renew existing Let's Encrypt certificate
  --help                   - Show this help message

Examples:
  # Set up Let's Encrypt certificate
  $0 --domain example.com --email admin@example.com

  # Set up staging certificate for testing
  $0 --domain test.example.com --email admin@example.com --staging

  # Install manual certificate
  $0 --domain example.com --manual-cert /path/to/cert/files

  # Renew existing certificate
  $0 --domain example.com --renew

Manual Certificate Structure:
  /path/to/cert/files/
  ├── fullchain.pem (or cert.pem)
  ├── privkey.pem (or private.key)
  └── dhparam.pem (optional)

EOF
}

# Check prerequisites
check_prerequisites() {
    info "Checking prerequisites..."
    
    # Check if running as root
    if [[ $EUID -ne 0 ]]; then
        error "This script must be run as root or with sudo"
    fi
    
    # Check required commands
    local missing_tools=()
    
    if [ -z "$MANUAL_CERT_PATH" ]; then
        # Check for certbot if using Let's Encrypt
        if ! command -v certbot &> /dev/null; then
            missing_tools+=("certbot")
        fi
    fi
    
    if [ ${#missing_tools[@]} -ne 0 ]; then
        warn "Missing tools: ${missing_tools[*]}"
        info "Installing missing tools..."
        
        # Install certbot based on OS
        if command -v apt-get &> /dev/null; then
            apt-get update
            apt-get install -y certbot python3-certbot-nginx openssl
        elif command -v yum &> /dev/null; then
            yum install -y certbot python3-certbot-nginx openssl
        elif command -v dnf &> /dev/null; then
            dnf install -y certbot python3-certbot-nginx openssl
        else
            error "Unable to install certbot. Please install manually."
        fi
    fi
    
    # Create SSL directory
    mkdir -p "$NGINX_CONF_DIR"
    
    success "Prerequisites check passed"
}

# Generate DH parameters
generate_dhparam() {
    local dhparam_file="$NGINX_CONF_DIR/dhparam.pem"
    
    if [ ! -f "$dhparam_file" ]; then
        info "Generating DH parameters (this may take a while)..."
        openssl dhparam -out "$dhparam_file" 2048
        chmod 600 "$dhparam_file"
        success "DH parameters generated"
    else
        info "DH parameters already exist"
    fi
}

# Set up Let's Encrypt certificate
setup_letsencrypt() {
    info "Setting up Let's Encrypt certificate for domain: $DOMAIN"
    
    # Prepare certbot command
    local certbot_cmd="certbot certonly --standalone"
    
    if [ "$STAGING" = true ]; then
        certbot_cmd+=" --staging"
        warn "Using Let's Encrypt staging environment"
    fi
    
    # Add domain and email
    certbot_cmd+=" -d $DOMAIN"
    
    if [ -n "$EMAIL" ]; then
        certbot_cmd+=" --email $EMAIL"
    else
        certbot_cmd+=" --register-unsafely-without-email"
    fi
    
    # Add non-interactive flags
    certbot_cmd+=" --agree-tos --non-interactive"
    
    # Stop nginx temporarily to free port 80
    if systemctl is-active --quiet nginx; then
        info "Stopping nginx temporarily..."
        systemctl stop nginx
        local restart_nginx=true
    fi
    
    # Run certbot
    info "Running: $certbot_cmd"
    if eval "$certbot_cmd"; then
        success "Let's Encrypt certificate obtained successfully"
    else
        error "Failed to obtain Let's Encrypt certificate"
    fi
    
    # Restart nginx if it was running
    if [ "${restart_nginx:-false}" = true ]; then
        systemctl start nginx
    fi
    
    # Copy certificates to nginx directory
    copy_letsencrypt_certs
    
    # Set up auto-renewal
    setup_auto_renewal
}

# Copy Let's Encrypt certificates to nginx directory
copy_letsencrypt_certs() {
    info "Copying certificates to nginx directory..."
    
    local le_cert_dir="$CERT_DIR/$DOMAIN"
    
    if [ ! -d "$le_cert_dir" ]; then
        error "Let's Encrypt certificate directory not found: $le_cert_dir"
    fi
    
    # Copy certificate files
    cp "$le_cert_dir/fullchain.pem" "$NGINX_CONF_DIR/fullchain.pem"
    cp "$le_cert_dir/privkey.pem" "$NGINX_CONF_DIR/privkey.pem"
    
    # Set proper permissions
    chmod 644 "$NGINX_CONF_DIR/fullchain.pem"
    chmod 600 "$NGINX_CONF_DIR/privkey.pem"
    
    success "Certificates copied to nginx directory"
}

# Install manual certificates
install_manual_certs() {
    info "Installing manual certificates from: $MANUAL_CERT_PATH"
    
    if [ ! -d "$MANUAL_CERT_PATH" ]; then
        error "Manual certificate directory not found: $MANUAL_CERT_PATH"
    fi
    
    # Find certificate files (support different naming conventions)
    local cert_file=""
    local key_file=""
    local dhparam_file=""
    
    # Look for certificate file
    for cert_name in fullchain.pem cert.pem certificate.crt; do
        if [ -f "$MANUAL_CERT_PATH/$cert_name" ]; then
            cert_file="$MANUAL_CERT_PATH/$cert_name"
            break
        fi
    done
    
    # Look for private key file
    for key_name in privkey.pem private.key key.pem; do
        if [ -f "$MANUAL_CERT_PATH/$key_name" ]; then
            key_file="$MANUAL_CERT_PATH/$key_name"
            break
        fi
    done
    
    # Look for DH parameters
    if [ -f "$MANUAL_CERT_PATH/dhparam.pem" ]; then
        dhparam_file="$MANUAL_CERT_PATH/dhparam.pem"
    fi
    
    # Validate required files
    if [ -z "$cert_file" ]; then
        error "Certificate file not found in $MANUAL_CERT_PATH"
    fi
    
    if [ -z "$key_file" ]; then
        error "Private key file not found in $MANUAL_CERT_PATH"
    fi
    
    # Validate certificate
    info "Validating certificate..."
    if ! openssl x509 -in "$cert_file" -text -noout > /dev/null; then
        error "Invalid certificate file: $cert_file"
    fi
    
    # Validate private key
    if ! openssl rsa -in "$key_file" -check > /dev/null 2>&1; then
        error "Invalid private key file: $key_file"
    fi
    
    # Check if certificate and key match
    local cert_md5
    local key_md5
    cert_md5=$(openssl x509 -noout -modulus -in "$cert_file" | openssl md5)
    key_md5=$(openssl rsa -noout -modulus -in "$key_file" | openssl md5)
    
    if [ "$cert_md5" != "$key_md5" ]; then
        error "Certificate and private key do not match"
    fi
    
    # Copy files
    info "Installing certificate files..."
    cp "$cert_file" "$NGINX_CONF_DIR/fullchain.pem"
    cp "$key_file" "$NGINX_CONF_DIR/privkey.pem"
    
    if [ -n "$dhparam_file" ]; then
        cp "$dhparam_file" "$NGINX_CONF_DIR/dhparam.pem"
    fi
    
    # Set proper permissions
    chmod 644 "$NGINX_CONF_DIR/fullchain.pem"
    chmod 600 "$NGINX_CONF_DIR/privkey.pem"
    
    if [ -f "$NGINX_CONF_DIR/dhparam.pem" ]; then
        chmod 600 "$NGINX_CONF_DIR/dhparam.pem"
    fi
    
    success "Manual certificates installed successfully"
}

# Set up auto-renewal for Let's Encrypt
setup_auto_renewal() {
    info "Setting up auto-renewal for Let's Encrypt certificates..."
    
    # Create renewal script
    local renewal_script="/usr/local/bin/renew-ssl-cert.sh"
    
    cat > "$renewal_script" <<EOF
#!/bin/bash
# Auto-renewal script for Let's Encrypt certificates

# Renew certificates
certbot renew --quiet --no-self-upgrade

# Copy renewed certificates
if [ -d "$CERT_DIR/$DOMAIN" ]; then
    cp "$CERT_DIR/$DOMAIN/fullchain.pem" "$NGINX_CONF_DIR/fullchain.pem"
    cp "$CERT_DIR/$DOMAIN/privkey.pem" "$NGINX_CONF_DIR/privkey.pem"
    
    # Reload nginx
    systemctl reload nginx
fi
EOF
    
    chmod +x "$renewal_script"
    
    # Add cron job for auto-renewal (runs twice daily)
    local cron_job="0 */12 * * * $renewal_script >> /var/log/ssl-renewal.log 2>&1"
    
    # Check if cron job already exists
    if ! crontab -l 2>/dev/null | grep -q "$renewal_script"; then
        (crontab -l 2>/dev/null; echo "$cron_job") | crontab -
        success "Auto-renewal cron job added"
    else
        info "Auto-renewal cron job already exists"
    fi
}

# Renew existing certificate
renew_certificate() {
    info "Renewing certificate for domain: $DOMAIN"
    
    if [ ! -d "$CERT_DIR/$DOMAIN" ]; then
        error "No existing certificate found for domain: $DOMAIN"
    fi
    
    # Run renewal
    if certbot renew --cert-name "$DOMAIN" --quiet; then
        success "Certificate renewed successfully"
        copy_letsencrypt_certs
        
        # Reload nginx
        if systemctl is-active --quiet nginx; then
            systemctl reload nginx
            success "Nginx reloaded with new certificate"
        fi
    else
        error "Failed to renew certificate"
    fi
}

# Test SSL configuration
test_ssl_config() {
    info "Testing SSL configuration..."
    
    # Test nginx configuration
    if nginx -t; then
        success "Nginx configuration test passed"
    else
        error "Nginx configuration test failed"
    fi
    
    # Test SSL certificate
    if [ -f "$NGINX_CONF_DIR/fullchain.pem" ] && [ -f "$NGINX_CONF_DIR/privkey.pem" ]; then
        # Check certificate expiry
        local expiry_date
        expiry_date=$(openssl x509 -enddate -noout -in "$NGINX_CONF_DIR/fullchain.pem" | cut -d= -f2)
        info "Certificate expires on: $expiry_date"
        
        # Check if certificate is valid for domain
        if openssl x509 -in "$NGINX_CONF_DIR/fullchain.pem" -text -noout | grep -q "$DOMAIN"; then
            success "Certificate is valid for domain: $DOMAIN"
        else
            warn "Certificate may not be valid for domain: $DOMAIN"
        fi
        
        success "SSL configuration test completed"
    else
        error "SSL certificate files not found"
    fi
}

# Generate self-signed certificate for development
generate_self_signed() {
    info "Generating self-signed certificate for development..."
    
    local cert_file="$NGINX_CONF_DIR/fullchain.pem"
    local key_file="$NGINX_CONF_DIR/privkey.pem"
    
    # Generate private key
    openssl genrsa -out "$key_file" 2048
    
    # Generate certificate
    openssl req -new -x509 -key "$key_file" -out "$cert_file" -days 365 \
        -subj "/C=US/ST=State/L=City/O=Organization/CN=$DOMAIN"
    
    # Set permissions
    chmod 644 "$cert_file"
    chmod 600 "$key_file"
    
    warn "Self-signed certificate generated for development use only"
    warn "This certificate will show browser warnings in production"
    
    success "Self-signed certificate created"
}

# Main function
main() {
    local renew=false
    local self_signed=false
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --domain)
                DOMAIN="$2"
                shift 2
                ;;
            --email)
                EMAIL="$2"
                shift 2
                ;;
            --staging)
                STAGING=true
                shift
                ;;
            --manual-cert)
                MANUAL_CERT_PATH="$2"
                shift 2
                ;;
            --renew)
                renew=true
                shift
                ;;
            --self-signed)
                self_signed=true
                shift
                ;;
            --help)
                show_usage
                exit 0
                ;;
            *)
                error "Unknown option: $1. Use --help for usage information."
                ;;
        esac
    done
    
    # Validate required parameters
    if [ -z "$DOMAIN" ]; then
        error "Domain is required. Use --domain to specify."
    fi
    
    info "Starting SSL setup for domain: $DOMAIN"
    
    # Run setup steps
    check_prerequisites
    generate_dhparam
    
    if [ "$renew" = true ]; then
        renew_certificate
    elif [ "$self_signed" = true ]; then
        generate_self_signed
    elif [ -n "$MANUAL_CERT_PATH" ]; then
        install_manual_certs
    else
        setup_letsencrypt
    fi
    
    test_ssl_config
    
    success "SSL setup completed successfully!"
    info "Certificate files are located in: $NGINX_CONF_DIR"
    info "Make sure to update your nginx configuration to use SSL"
}

# Run main function
main "$@"
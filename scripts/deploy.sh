#!/bin/bash
# Kafka Infrastructure Deployment Script
# Automated deployment for high-performance Kafka cluster (100K+ msgs/sec)
# Supports both ZooKeeper and KRaft modes with comprehensive monitoring

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
TERRAFORM_DIR="$PROJECT_ROOT/terraform"
ANSIBLE_DIR="$PROJECT_ROOT/ansible"

# Default values
CLUSTER_NAME="${CLUSTER_NAME:-kafka-production}"
ENVIRONMENT="${ENVIRONMENT:-prod}"
AWS_REGION="${AWS_REGION:-us-west-2}"
USE_KRAFT_MODE="${USE_KRAFT_MODE:-true}"
ENABLE_SSL="${ENABLE_SSL:-true}"
ENABLE_SASL="${ENABLE_SASL:-true}"
SKIP_MONITORING="${SKIP_MONITORING:-false}"
DRY_RUN="${DRY_RUN:-false}"
FORCE_DESTROY="${FORCE_DESTROY:-false}"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${PURPLE}[STEP]${NC} $1"
}

# Print usage
usage() {
    cat << EOF
Usage: $0 [COMMAND] [OPTIONS]

COMMANDS:
    deploy      Deploy complete Kafka infrastructure
    plan        Show Terraform plan without deploying
    destroy     Destroy infrastructure (use with caution)
    validate    Validate configuration files
    monitoring  Deploy only monitoring stack
    status      Show deployment status

OPTIONS:
    --cluster-name NAME     Cluster name (default: kafka-production)
    --environment ENV       Environment (dev/staging/prod, default: prod)
    --region REGION         AWS region (default: us-west-2)
    --use-kraft            Use KRaft mode instead of ZooKeeper (default: true)
    --use-zookeeper        Use ZooKeeper mode instead of KRaft
    --enable-ssl           Enable SSL/TLS encryption (default: true)
    --disable-ssl          Disable SSL/TLS encryption
    --enable-sasl          Enable SASL authentication (default: true)
    --disable-sasl         Disable SASL authentication
    --skip-monitoring      Skip monitoring stack deployment
    --dry-run              Show what would be done without executing
    --force                Force deployment (skip confirmations)
    --help, -h             Show this help message

EXAMPLES:
    # Deploy production cluster with KRaft mode
    $0 deploy --cluster-name my-kafka --environment prod --use-kraft

    # Plan deployment with ZooKeeper mode
    $0 plan --cluster-name test-kafka --use-zookeeper --region us-east-1

    # Deploy only monitoring stack
    $0 monitoring --cluster-name existing-kafka

    # Destroy infrastructure (BE CAREFUL!)
    $0 destroy --cluster-name my-kafka --force

ENVIRONMENT VARIABLES:
    AWS_ACCESS_KEY_ID       AWS access key
    AWS_SECRET_ACCESS_KEY   AWS secret key
    TF_VAR_public_key       SSH public key for EC2 instances
    TF_VAR_grafana_admin_password  Grafana admin password

REQUIREMENTS:
    - Terraform >= 1.5
    - Ansible >= 2.14
    - AWS CLI configured
    - SSH key pair for EC2 access
EOF
}

# Validate prerequisites
validate_prerequisites() {
    log_step "Validating prerequisites..."
    
    local errors=0
    
    # Check required commands
    for cmd in terraform ansible aws ssh; do
        if ! command -v "$cmd" &> /dev/null; then
            log_error "$cmd is not installed or not in PATH"
            ((errors++))
        fi
    done
    
    # Check Terraform version
    if command -v terraform &> /dev/null; then
        local tf_version
        tf_version=$(terraform version -json | jq -r '.terraform_version')
        if [[ "$(printf '%s\n' "1.5.0" "$tf_version" | sort -V | head -n1)" != "1.5.0" ]]; then
            log_error "Terraform version must be >= 1.5.0, found $tf_version"
            ((errors++))
        fi
    fi
    
    # Check Ansible version
    if command -v ansible &> /dev/null; then
        local ansible_version
        ansible_version=$(ansible --version | head -n1 | grep -oE '[0-9]+\.[0-9]+' | head -n1)
        if [[ "$(printf '%s\n' "2.14" "$ansible_version" | sort -V | head -n1)" != "2.14" ]]; then
            log_error "Ansible version must be >= 2.14, found $ansible_version"
            ((errors++))
        fi
    fi
    
    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        log_error "AWS credentials not configured. Run 'aws configure' or set environment variables"
        ((errors++))
    fi
    
    # Check required environment variables
    if [[ -z "${TF_VAR_public_key:-}" ]]; then
        log_error "TF_VAR_public_key environment variable is required"
        log_info "Example: export TF_VAR_public_key=\$(cat ~/.ssh/id_rsa.pub)"
        ((errors++))
    fi
    
    # Check project structure
    for dir in "$TERRAFORM_DIR" "$ANSIBLE_DIR"; do
        if [[ ! -d "$dir" ]]; then
            log_error "Directory not found: $dir"
            ((errors++))
        fi
    done
    
    if [[ $errors -gt 0 ]]; then
        log_error "Prerequisites validation failed with $errors error(s)"
        return 1
    fi
    
    log_success "Prerequisites validation passed"
    return 0
}

# Initialize Terraform
init_terraform() {
    log_step "Initializing Terraform..."
    
    cd "$TERRAFORM_DIR"
    
    # Initialize Terraform
    terraform init -upgrade
    
    # Validate configuration
    terraform validate
    
    log_success "Terraform initialization completed"
}

# Generate Terraform plan
terraform_plan() {
    log_step "Generating Terraform plan..."
    
    cd "$TERRAFORM_DIR"
    
    # Set Terraform variables
    export TF_VAR_cluster_name="$CLUSTER_NAME"
    export TF_VAR_environment="$ENVIRONMENT"
    export TF_VAR_aws_region="$AWS_REGION"
    export TF_VAR_use_kraft_mode="$USE_KRAFT_MODE"
    export TF_VAR_enable_ssl="$ENABLE_SSL"
    export TF_VAR_enable_sasl="$ENABLE_SASL"
    
    # Generate plan
    terraform plan -out=tfplan
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "Dry run mode - showing plan only"
        return 0
    fi
    
    # Show estimated costs if available
    if command -v infracost &> /dev/null; then
        log_info "Generating cost estimate..."
        infracost breakdown --path . --format table
    fi
    
    log_success "Terraform plan generated successfully"
}

# Apply Terraform configuration
terraform_apply() {
    log_step "Applying Terraform configuration..."
    
    cd "$TERRAFORM_DIR"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "Dry run mode - skipping apply"
        return 0
    fi
    
    # Apply the plan
    terraform apply tfplan
    
    # Generate inventory for Ansible
    generate_ansible_inventory
    
    log_success "Infrastructure deployed successfully"
}

# Generate Ansible inventory from Terraform outputs
generate_ansible_inventory() {
    log_step "Generating Ansible inventory..."
    
    cd "$TERRAFORM_DIR"
    
    # Get Terraform outputs
    local kafka_ips
    local zookeeper_ips
    local monitoring_ip
    
    kafka_ips=$(terraform output -json kafka_broker_private_ips | jq -r '.[]')
    zookeeper_ips=$(terraform output -json zookeeper_private_ips | jq -r '.[]' 2>/dev/null || echo "")
    monitoring_ip=$(terraform output -raw monitoring_private_ip)
    
    # Create Ansible inventory
    cat > "$ANSIBLE_DIR/inventory/hosts.yml" << EOF
all:
  children:
    kafka_brokers:
      hosts:
EOF

    # Add Kafka brokers
    local broker_id=1
    for ip in $kafka_ips; do
        cat >> "$ANSIBLE_DIR/inventory/hosts.yml" << EOF
        kafka-broker-$broker_id:
          ansible_host: $ip
          broker_id: $broker_id
EOF
        ((broker_id++))
    done

    # Add ZooKeeper nodes if not using KRaft
    if [[ "$USE_KRAFT_MODE" != "true" && -n "$zookeeper_ips" ]]; then
        cat >> "$ANSIBLE_DIR/inventory/hosts.yml" << EOF
    zookeeper:
      hosts:
EOF
        local zk_id=1
        for ip in $zookeeper_ips; do
            cat >> "$ANSIBLE_DIR/inventory/hosts.yml" << EOF
        zookeeper-$zk_id:
          ansible_host: $ip
          zookeeper_id: $zk_id
EOF
            ((zk_id++))
        done
    fi

    # Add monitoring node
    cat >> "$ANSIBLE_DIR/inventory/hosts.yml" << EOF
    monitoring:
      hosts:
        monitoring-1:
          ansible_host: $monitoring_ip
          
  vars:
    ansible_user: ec2-user
    ansible_ssh_private_key_file: ~/.ssh/kafka-cluster-key.pem
    cluster_name: $CLUSTER_NAME
    use_kraft_mode: $USE_KRAFT_MODE
    enable_ssl: $ENABLE_SSL
    enable_sasl: $ENABLE_SASL
EOF

    log_success "Ansible inventory generated"
}

# Deploy Kafka using Ansible
deploy_kafka() {
    log_step "Deploying Kafka cluster with Ansible..."
    
    cd "$ANSIBLE_DIR"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "Dry run mode - would run Ansible playbooks"
        return 0
    fi
    
    # Run Kafka deployment playbook
    ansible-playbook -i inventory/hosts.yml kafka-deployment.yml \
        --extra-vars "cluster_name=$CLUSTER_NAME" \
        --extra-vars "use_kraft_mode=$USE_KRAFT_MODE" \
        --extra-vars "enable_ssl=$ENABLE_SSL" \
        --extra-vars "enable_sasl=$ENABLE_SASL"
    
    log_success "Kafka cluster deployed successfully"
}

# Deploy monitoring stack
deploy_monitoring() {
    log_step "Deploying monitoring stack..."
    
    cd "$ANSIBLE_DIR"
    
    if [[ "$SKIP_MONITORING" == "true" ]]; then
        log_info "Skipping monitoring deployment"
        return 0
    fi
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "Dry run mode - would deploy monitoring stack"
        return 0
    fi
    
    # Run monitoring deployment playbook
    ansible-playbook -i inventory/hosts.yml monitoring-setup.yml \
        --extra-vars "cluster_name=$CLUSTER_NAME"
    
    log_success "Monitoring stack deployed successfully"
}

# Validate cluster health
validate_cluster() {
    log_step "Validating cluster health..."
    
    cd "$TERRAFORM_DIR"
    
    # Get cluster endpoints
    local bootstrap_servers
    local schema_registry
    local grafana_url
    
    bootstrap_servers=$(terraform output -raw kafka_bootstrap_servers)
    schema_registry=$(terraform output -raw schema_registry_endpoint)
    grafana_url=$(terraform output -json monitoring_access | jq -r '.value.grafana_url')
    
    log_info "Cluster endpoints:"
    log_info "  Kafka Bootstrap Servers: $bootstrap_servers"
    log_info "  Schema Registry: $schema_registry"
    log_info "  Grafana Dashboard: $grafana_url"
    
    # Basic connectivity test (would require SSH tunnel or bastion)
    log_warning "Manual validation required from within VPC:"
    log_info "1. SSH into monitoring instance"
    log_info "2. Access Grafana at: $grafana_url"
    log_info "3. Verify Kafka metrics in dashboards"
    log_info "4. Test message production/consumption"
    
    log_success "Cluster deployment completed"
}

# Show deployment status
show_status() {
    log_step "Checking deployment status..."
    
    cd "$TERRAFORM_DIR"
    
    if [[ ! -f "terraform.tfstate" ]]; then
        log_warning "No Terraform state found. Infrastructure may not be deployed."
        return 0
    fi
    
    # Show Terraform outputs
    echo
    log_info "Infrastructure Summary:"
    terraform output cluster_summary
    
    echo
    log_info "Performance Configuration:"
    terraform output performance_config
    
    echo
    log_info "Security Configuration:"
    terraform output security_config
    
    echo
    log_info "Connection Information:"
    terraform output client_connection_instructions
    
    echo
    log_info "Monitoring Access:"
    terraform output monitoring_access
}

# Destroy infrastructure
destroy_infrastructure() {
    log_step "Destroying infrastructure..."
    
    if [[ "$FORCE_DESTROY" != "true" ]]; then
        log_warning "This will PERMANENTLY DESTROY all infrastructure!"
        log_warning "Cluster: $CLUSTER_NAME"
        log_warning "Environment: $ENVIRONMENT"
        echo
        read -p "Are you absolutely sure? Type 'DELETE' to confirm: " confirm
        
        if [[ "$confirm" != "DELETE" ]]; then
            log_info "Destruction cancelled"
            return 0
        fi
    fi
    
    cd "$TERRAFORM_DIR"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "Dry run mode - would destroy infrastructure"
        terraform plan -destroy
        return 0
    fi
    
    # Destroy infrastructure
    terraform destroy -auto-approve
    
    # Clean up generated files
    rm -f tfplan
    rm -f "$ANSIBLE_DIR/inventory/hosts.yml"
    
    log_success "Infrastructure destroyed"
}

# Parse command line arguments
parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --cluster-name)
                CLUSTER_NAME="$2"
                shift 2
                ;;
            --environment)
                ENVIRONMENT="$2"
                shift 2
                ;;
            --region)
                AWS_REGION="$2"
                shift 2
                ;;
            --use-kraft)
                USE_KRAFT_MODE="true"
                shift
                ;;
            --use-zookeeper)
                USE_KRAFT_MODE="false"
                shift
                ;;
            --enable-ssl)
                ENABLE_SSL="true"
                shift
                ;;
            --disable-ssl)
                ENABLE_SSL="false"
                shift
                ;;
            --enable-sasl)
                ENABLE_SASL="true"
                shift
                ;;
            --disable-sasl)
                ENABLE_SASL="false"
                shift
                ;;
            --skip-monitoring)
                SKIP_MONITORING="true"
                shift
                ;;
            --dry-run)
                DRY_RUN="true"
                shift
                ;;
            --force)
                FORCE_DESTROY="true"
                shift
                ;;
            --help|-h)
                usage
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                usage
                exit 1
                ;;
        esac
    done
}

# Main execution
main() {
    local command="${1:-}"
    shift || true
    
    # Parse remaining arguments
    parse_arguments "$@"
    
    # Show configuration
    log_info "Deployment Configuration:"
    log_info "  Cluster Name: $CLUSTER_NAME"
    log_info "  Environment: $ENVIRONMENT"
    log_info "  AWS Region: $AWS_REGION"
    log_info "  Mode: $([ "$USE_KRAFT_MODE" == "true" ] && echo "KRaft" || echo "ZooKeeper")"
    log_info "  SSL: $ENABLE_SSL"
    log_info "  SASL: $ENABLE_SASL"
    log_info "  Monitoring: $([ "$SKIP_MONITORING" == "true" ] && echo "Disabled" || echo "Enabled")"
    log_info "  Dry Run: $DRY_RUN"
    echo
    
    case "$command" in
        deploy)
            validate_prerequisites
            init_terraform
            terraform_plan
            terraform_apply
            deploy_kafka
            deploy_monitoring
            validate_cluster
            ;;
        plan)
            validate_prerequisites
            init_terraform
            terraform_plan
            ;;
        destroy)
            validate_prerequisites
            destroy_infrastructure
            ;;
        validate)
            validate_prerequisites
            log_success "Validation completed"
            ;;
        monitoring)
            # Deploy only monitoring stack (assumes infrastructure exists)
            deploy_monitoring
            ;;
        status)
            show_status
            ;;
        *)
            log_error "Unknown command: $command"
            echo
            usage
            exit 1
            ;;
    esac
    
    log_success "Operation completed successfully!"
}

# Create necessary directories
mkdir -p "$ANSIBLE_DIR/inventory"

# Execute main function
main "$@"
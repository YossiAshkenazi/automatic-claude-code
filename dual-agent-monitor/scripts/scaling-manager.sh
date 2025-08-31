#!/bin/bash

# Scaling Manager for Dual Agent Monitor
# Automated scaling based on metrics and manual scaling operations

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CONFIG_FILE="$PROJECT_ROOT/scaling-config.json"
LOG_FILE="/var/log/dual-agent-monitor-scaling.log"

# Default thresholds
CPU_SCALE_UP_THRESHOLD=70
CPU_SCALE_DOWN_THRESHOLD=30
MEMORY_SCALE_UP_THRESHOLD=80
MEMORY_SCALE_DOWN_THRESHOLD=40
MIN_INSTANCES=2
MAX_INSTANCES=10
SCALE_UP_COOLDOWN=300    # 5 minutes
SCALE_DOWN_COOLDOWN=600  # 10 minutes

# Metrics collection
PROMETHEUS_URL="http://localhost:9090"
METRICS_WINDOW="5m"

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
  auto-scale         - Run automated scaling loop
  scale-up COUNT     - Manually scale up by COUNT instances
  scale-down COUNT   - Manually scale down by COUNT instances
  scale-to COUNT     - Scale to exact COUNT instances
  status            - Show current scaling status
  metrics           - Show current metrics
  config            - Show scaling configuration

Options:
  --deployment TYPE     - Deployment type: docker-compose, kubernetes (default: auto-detect)
  --service NAME       - Service name to scale (default: dual-agent-monitor)
  --dry-run           - Show what would be done without executing
  --config-file FILE  - Configuration file path
  --prometheus URL    - Prometheus endpoint URL
  --help              - Show this help message

Examples:
  $0 auto-scale                          # Start automated scaling
  $0 scale-up 2                         # Scale up by 2 instances
  $0 scale-to 5                         # Scale to exactly 5 instances
  $0 --dry-run scale-up 1               # Preview scaling action
  $0 status                             # Show current status

EOF
}

# Load configuration from file
load_config() {
    if [ -f "$CONFIG_FILE" ]; then
        info "Loading configuration from: $CONFIG_FILE"
        
        # Parse JSON configuration
        CPU_SCALE_UP_THRESHOLD=$(jq -r '.cpu_scale_up_threshold // 70' "$CONFIG_FILE")
        CPU_SCALE_DOWN_THRESHOLD=$(jq -r '.cpu_scale_down_threshold // 30' "$CONFIG_FILE")
        MEMORY_SCALE_UP_THRESHOLD=$(jq -r '.memory_scale_up_threshold // 80' "$CONFIG_FILE")
        MEMORY_SCALE_DOWN_THRESHOLD=$(jq -r '.memory_scale_down_threshold // 40' "$CONFIG_FILE")
        MIN_INSTANCES=$(jq -r '.min_instances // 2' "$CONFIG_FILE")
        MAX_INSTANCES=$(jq -r '.max_instances // 10' "$CONFIG_FILE")
        SCALE_UP_COOLDOWN=$(jq -r '.scale_up_cooldown // 300' "$CONFIG_FILE")
        SCALE_DOWN_COOLDOWN=$(jq -r '.scale_down_cooldown // 600' "$CONFIG_FILE")
    else
        info "Configuration file not found, using defaults"
        create_default_config
    fi
}

# Create default configuration file
create_default_config() {
    info "Creating default configuration file: $CONFIG_FILE"
    
    cat > "$CONFIG_FILE" <<EOF
{
  "cpu_scale_up_threshold": $CPU_SCALE_UP_THRESHOLD,
  "cpu_scale_down_threshold": $CPU_SCALE_DOWN_THRESHOLD,
  "memory_scale_up_threshold": $MEMORY_SCALE_UP_THRESHOLD,
  "memory_scale_down_threshold": $MEMORY_SCALE_DOWN_THRESHOLD,
  "min_instances": $MIN_INSTANCES,
  "max_instances": $MAX_INSTANCES,
  "scale_up_cooldown": $SCALE_UP_COOLDOWN,
  "scale_down_cooldown": $SCALE_DOWN_COOLDOWN,
  "metrics_window": "$METRICS_WINDOW",
  "prometheus_url": "$PROMETHEUS_URL",
  "last_scale_action": 0,
  "last_scale_direction": "none"
}
EOF
    
    success "Default configuration created"
}

# Detect deployment type
detect_deployment() {
    if command -v kubectl &> /dev/null && kubectl cluster-info &> /dev/null; then
        echo "kubernetes"
    elif command -v docker-compose &> /dev/null && [ -f "$PROJECT_ROOT/docker-compose.prod.yml" ]; then
        echo "docker-compose"
    else
        error "Could not detect deployment type. Please specify with --deployment"
    fi
}

# Get current instance count
get_current_instances() {
    case "$DEPLOYMENT_TYPE" in
        "kubernetes")
            kubectl get deployment "$SERVICE_NAME" -o jsonpath='{.status.replicas}' 2>/dev/null || echo "0"
            ;;
        "docker-compose")
            docker-compose -f "$PROJECT_ROOT/docker-compose.prod.yml" ps -q "$SERVICE_NAME" | wc -l
            ;;
        *)
            error "Unknown deployment type: $DEPLOYMENT_TYPE"
            ;;
    esac
}

# Get current metrics from Prometheus
get_metrics() {
    local cpu_query="avg(rate(container_cpu_usage_seconds_total{name=~\".*${SERVICE_NAME}.*\"}[${METRICS_WINDOW}])) * 100"
    local memory_query="avg(container_memory_usage_bytes{name=~\".*${SERVICE_NAME}.*\"} / container_spec_memory_limit_bytes{name=~\".*${SERVICE_NAME}.*\"}) * 100"
    local request_rate_query="sum(rate(http_requests_total{job=\"${SERVICE_NAME}\"}[${METRICS_WINDOW}]))"
    local response_time_query="histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{job=\"${SERVICE_NAME}\"}[${METRICS_WINDOW}]))"
    
    # Query Prometheus
    local cpu_usage
    local memory_usage
    local request_rate
    local response_time
    
    cpu_usage=$(curl -s "${PROMETHEUS_URL}/api/v1/query?query=${cpu_query}" | jq -r '.data.result[0].value[1] // "0"' 2>/dev/null || echo "0")
    memory_usage=$(curl -s "${PROMETHEUS_URL}/api/v1/query?query=${memory_query}" | jq -r '.data.result[0].value[1] // "0"' 2>/dev/null || echo "0")
    request_rate=$(curl -s "${PROMETHEUS_URL}/api/v1/query?query=${request_rate_query}" | jq -r '.data.result[0].value[1] // "0"' 2>/dev/null || echo "0")
    response_time=$(curl -s "${PROMETHEUS_URL}/api/v1/query?query=${response_time_query}" | jq -r '.data.result[0].value[1] // "0"' 2>/dev/null || echo "0")
    
    echo "{
        \"cpu_usage\": $cpu_usage,
        \"memory_usage\": $memory_usage,
        \"request_rate\": $request_rate,
        \"response_time\": $response_time,
        \"current_instances\": $(get_current_instances),
        \"timestamp\": $(date +%s)
    }"
}

# Scale instances up
scale_up() {
    local count="$1"
    local current_instances
    current_instances=$(get_current_instances)
    local target_instances=$((current_instances + count))
    
    if [ "$target_instances" -gt "$MAX_INSTANCES" ]; then
        target_instances=$MAX_INSTANCES
        warn "Scaling limited to maximum instances: $MAX_INSTANCES"
    fi
    
    if [ "$target_instances" -eq "$current_instances" ]; then
        info "No scaling needed. Current instances: $current_instances"
        return 0
    fi
    
    info "Scaling up from $current_instances to $target_instances instances"
    
    if [ "$DRY_RUN" = true ]; then
        info "DRY RUN: Would scale $SERVICE_NAME to $target_instances instances"
        return 0
    fi
    
    case "$DEPLOYMENT_TYPE" in
        "kubernetes")
            kubectl scale deployment "$SERVICE_NAME" --replicas="$target_instances"
            ;;
        "docker-compose")
            cd "$PROJECT_ROOT"
            docker-compose -f docker-compose.prod.yml up -d --scale "$SERVICE_NAME"="$target_instances"
            ;;
    esac
    
    # Wait for instances to be ready
    wait_for_instances "$target_instances"
    
    # Update configuration with last scale action
    jq ".last_scale_action = $(date +%s) | .last_scale_direction = \"up\"" "$CONFIG_FILE" > "${CONFIG_FILE}.tmp" && mv "${CONFIG_FILE}.tmp" "$CONFIG_FILE"
    
    success "Successfully scaled up to $target_instances instances"
    
    # Send notification
    send_notification "scale-up" "Scaled up to $target_instances instances (was $current_instances)"
}

# Scale instances down
scale_down() {
    local count="$1"
    local current_instances
    current_instances=$(get_current_instances)
    local target_instances=$((current_instances - count))
    
    if [ "$target_instances" -lt "$MIN_INSTANCES" ]; then
        target_instances=$MIN_INSTANCES
        warn "Scaling limited to minimum instances: $MIN_INSTANCES"
    fi
    
    if [ "$target_instances" -eq "$current_instances" ]; then
        info "No scaling needed. Current instances: $current_instances"
        return 0
    fi
    
    info "Scaling down from $current_instances to $target_instances instances"
    
    if [ "$DRY_RUN" = true ]; then
        info "DRY RUN: Would scale $SERVICE_NAME to $target_instances instances"
        return 0
    fi
    
    case "$DEPLOYMENT_TYPE" in
        "kubernetes")
            kubectl scale deployment "$SERVICE_NAME" --replicas="$target_instances"
            ;;
        "docker-compose")
            cd "$PROJECT_ROOT"
            docker-compose -f docker-compose.prod.yml up -d --scale "$SERVICE_NAME"="$target_instances"
            ;;
    esac
    
    # Wait for scaling to complete
    wait_for_instances "$target_instances"
    
    # Update configuration with last scale action
    jq ".last_scale_action = $(date +%s) | .last_scale_direction = \"down\"" "$CONFIG_FILE" > "${CONFIG_FILE}.tmp" && mv "${CONFIG_FILE}.tmp" "$CONFIG_FILE"
    
    success "Successfully scaled down to $target_instances instances"
    
    # Send notification
    send_notification "scale-down" "Scaled down to $target_instances instances (was $current_instances)"
}

# Scale to exact number
scale_to() {
    local target_instances="$1"
    local current_instances
    current_instances=$(get_current_instances)
    
    if [ "$target_instances" -lt "$MIN_INSTANCES" ] || [ "$target_instances" -gt "$MAX_INSTANCES" ]; then
        error "Target instances ($target_instances) must be between $MIN_INSTANCES and $MAX_INSTANCES"
    fi
    
    if [ "$target_instances" -eq "$current_instances" ]; then
        info "Already at target instances: $target_instances"
        return 0
    fi
    
    if [ "$target_instances" -gt "$current_instances" ]; then
        scale_up $((target_instances - current_instances))
    else
        scale_down $((current_instances - target_instances))
    fi
}

# Wait for instances to be ready
wait_for_instances() {
    local target_instances="$1"
    local timeout=300  # 5 minutes
    local interval=10
    local elapsed=0
    
    info "Waiting for $target_instances instances to be ready..."
    
    while [ $elapsed -lt $timeout ]; do
        local ready_instances
        
        case "$DEPLOYMENT_TYPE" in
            "kubernetes")
                ready_instances=$(kubectl get deployment "$SERVICE_NAME" -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0")
                ;;
            "docker-compose")
                ready_instances=$(docker-compose -f "$PROJECT_ROOT/docker-compose.prod.yml" ps -q "$SERVICE_NAME" | xargs -I {} docker inspect {} --format '{{.State.Health.Status}}' 2>/dev/null | grep -c "healthy" || echo "0")
                ;;
        esac
        
        if [ "$ready_instances" -eq "$target_instances" ]; then
            success "All $target_instances instances are ready"
            return 0
        fi
        
        info "Waiting... ($ready_instances/$target_instances ready)"
        sleep $interval
        elapsed=$((elapsed + interval))
    done
    
    warn "Timeout waiting for instances to be ready. Some instances may still be starting."
}

# Check if scaling is in cooldown period
check_cooldown() {
    local action="$1"
    local current_time
    current_time=$(date +%s)
    local last_scale_action
    local last_scale_direction
    
    last_scale_action=$(jq -r '.last_scale_action // 0' "$CONFIG_FILE")
    last_scale_direction=$(jq -r '.last_scale_direction // "none"' "$CONFIG_FILE")
    
    local cooldown_period
    if [ "$action" = "up" ]; then
        cooldown_period=$SCALE_UP_COOLDOWN
    else
        cooldown_period=$SCALE_DOWN_COOLDOWN
    fi
    
    local time_since_last_scale=$((current_time - last_scale_action))
    
    if [ $time_since_last_scale -lt $cooldown_period ]; then
        local remaining_cooldown=$((cooldown_period - time_since_last_scale))
        warn "Scaling is in cooldown. $remaining_cooldown seconds remaining."
        return 1
    fi
    
    return 0
}

# Automated scaling logic
auto_scale() {
    info "Starting automated scaling evaluation..."
    
    local metrics
    metrics=$(get_metrics)
    
    local cpu_usage
    local memory_usage
    local current_instances
    
    cpu_usage=$(echo "$metrics" | jq -r '.cpu_usage')
    memory_usage=$(echo "$metrics" | jq -r '.memory_usage')
    current_instances=$(echo "$metrics" | jq -r '.current_instances')
    
    info "Current metrics: CPU=${cpu_usage}%, Memory=${memory_usage}%, Instances=${current_instances}"
    
    # Convert to integer for comparison
    cpu_usage_int=$(echo "$cpu_usage" | cut -d. -f1)
    memory_usage_int=$(echo "$memory_usage" | cut -d. -f1)
    
    # Determine if scaling is needed
    local scale_action="none"
    local scale_reason=""
    
    if [ "$cpu_usage_int" -gt "$CPU_SCALE_UP_THRESHOLD" ] || [ "$memory_usage_int" -gt "$MEMORY_SCALE_UP_THRESHOLD" ]; then
        if [ "$current_instances" -lt "$MAX_INSTANCES" ]; then
            scale_action="up"
            scale_reason="High resource usage (CPU: ${cpu_usage}%, Memory: ${memory_usage}%)"
        else
            warn "Maximum instances reached, cannot scale up"
        fi
    elif [ "$cpu_usage_int" -lt "$CPU_SCALE_DOWN_THRESHOLD" ] && [ "$memory_usage_int" -lt "$MEMORY_SCALE_DOWN_THRESHOLD" ]; then
        if [ "$current_instances" -gt "$MIN_INSTANCES" ]; then
            scale_action="down"
            scale_reason="Low resource usage (CPU: ${cpu_usage}%, Memory: ${memory_usage}%)"
        else
            info "Minimum instances reached, cannot scale down"
        fi
    else
        info "No scaling needed. Metrics within thresholds."
    fi
    
    # Execute scaling if needed and not in cooldown
    if [ "$scale_action" != "none" ]; then
        if check_cooldown "$scale_action"; then
            info "Scaling $scale_action: $scale_reason"
            
            if [ "$scale_action" = "up" ]; then
                scale_up 1
            else
                scale_down 1
            fi
        fi
    fi
}

# Continuous auto-scaling loop
auto_scale_loop() {
    info "Starting continuous auto-scaling loop (Ctrl+C to stop)"
    
    local check_interval=60  # 1 minute
    
    while true; do
        auto_scale
        info "Next evaluation in $check_interval seconds..."
        sleep $check_interval
    done
}

# Show scaling status
show_status() {
    local current_instances
    current_instances=$(get_current_instances)
    
    local metrics
    metrics=$(get_metrics)
    
    echo "=== Dual Agent Monitor Scaling Status ==="
    echo "Deployment Type: $DEPLOYMENT_TYPE"
    echo "Service Name: $SERVICE_NAME"
    echo "Current Instances: $current_instances"
    echo "Min/Max Instances: $MIN_INSTANCES/$MAX_INSTANCES"
    echo ""
    echo "=== Current Metrics ==="
    echo "CPU Usage: $(echo "$metrics" | jq -r '.cpu_usage')%"
    echo "Memory Usage: $(echo "$metrics" | jq -r '.memory_usage')%"
    echo "Request Rate: $(echo "$metrics" | jq -r '.request_rate') req/s"
    echo "Response Time (95p): $(echo "$metrics" | jq -r '.response_time')s"
    echo ""
    echo "=== Scaling Thresholds ==="
    echo "CPU Scale Up/Down: $CPU_SCALE_UP_THRESHOLD%/$CPU_SCALE_DOWN_THRESHOLD%"
    echo "Memory Scale Up/Down: $MEMORY_SCALE_UP_THRESHOLD%/$MEMORY_SCALE_DOWN_THRESHOLD%"
    echo "Cooldown Periods: ${SCALE_UP_COOLDOWN}s up / ${SCALE_DOWN_COOLDOWN}s down"
    
    # Check cooldown status
    local last_scale_action
    local last_scale_direction
    last_scale_action=$(jq -r '.last_scale_action // 0' "$CONFIG_FILE")
    last_scale_direction=$(jq -r '.last_scale_direction // "none"' "$CONFIG_FILE")
    
    if [ "$last_scale_action" -gt 0 ]; then
        local time_since_last_scale=$(($(date +%s) - last_scale_action))
        echo "Last Scale Action: $last_scale_direction (${time_since_last_scale}s ago)"
    fi
}

# Send notification
send_notification() {
    local action="$1"
    local message="$2"
    
    # Send Slack notification if webhook URL is configured
    if [ -n "${SLACK_WEBHOOK_URL:-}" ]; then
        local color
        case "$action" in
            "scale-up") color="warning" ;;
            "scale-down") color="good" ;;
            *) color="warning" ;;
        esac
        
        local payload
        payload=$(cat <<EOF
{
    "attachments": [
        {
            "color": "$color",
            "title": "🔄 Dual Agent Monitor - Auto Scaling",
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
    logger -t "dual-agent-monitor-scaling" "$action: $message"
}

# Main function
main() {
    local action=""
    local count=""
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --deployment)
                DEPLOYMENT_TYPE="$2"
                shift 2
                ;;
            --service)
                SERVICE_NAME="$2"
                shift 2
                ;;
            --config-file)
                CONFIG_FILE="$2"
                shift 2
                ;;
            --prometheus)
                PROMETHEUS_URL="$2"
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
            auto-scale)
                action="auto-scale"
                shift
                ;;
            scale-up|scale-down)
                action="$1"
                count="$2"
                shift 2
                ;;
            scale-to)
                action="scale-to"
                count="$2"
                shift 2
                ;;
            status|metrics|config)
                action="$1"
                shift
                ;;
            *)
                error "Unknown option: $1. Use --help for usage information."
                ;;
        esac
    done
    
    # Set defaults
    if [ -z "${DEPLOYMENT_TYPE:-}" ]; then
        DEPLOYMENT_TYPE=$(detect_deployment)
    fi
    
    if [ -z "${SERVICE_NAME:-}" ]; then
        SERVICE_NAME="dual-agent-monitor"
    fi
    
    # Load configuration
    load_config
    
    # Execute action
    case "$action" in
        auto-scale)
            auto_scale_loop
            ;;
        scale-up)
            if [ -z "$count" ] || ! [[ "$count" =~ ^[0-9]+$ ]]; then
                error "Scale up count must be a positive number"
            fi
            scale_up "$count"
            ;;
        scale-down)
            if [ -z "$count" ] || ! [[ "$count" =~ ^[0-9]+$ ]]; then
                error "Scale down count must be a positive number"
            fi
            scale_down "$count"
            ;;
        scale-to)
            if [ -z "$count" ] || ! [[ "$count" =~ ^[0-9]+$ ]]; then
                error "Scale to count must be a positive number"
            fi
            scale_to "$count"
            ;;
        status)
            show_status
            ;;
        metrics)
            get_metrics | jq .
            ;;
        config)
            cat "$CONFIG_FILE" | jq .
            ;;
        *)
            if [ -z "$action" ]; then
                show_usage
            else
                error "Unknown action: $action"
            fi
            ;;
    esac
}

# Global variables
DEPLOYMENT_TYPE=""
SERVICE_NAME=""
DRY_RUN=false

# Handle script interruption
cleanup_on_exit() {
    info "Scaling manager stopped"
    exit 0
}

trap cleanup_on_exit INT TERM

# Run main function
main "$@"
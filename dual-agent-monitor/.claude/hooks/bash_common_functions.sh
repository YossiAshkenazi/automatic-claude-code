#!/usr/bin/env bash
# Common functions for all Bash hook scripts
# Source this file in hook scripts for shared functionality

# Set bash options for better error handling
set -eo pipefail

# WSL and Docker environment detection
detect_server_url() {
    local server_url="http://localhost:4000"
    
    # Check for environment variable override
    if [[ -n "${OBSERVABILITY_SERVER_URL:-}" ]]; then
        server_url="$OBSERVABILITY_SERVER_URL"
    # Check if running in WSL
    elif [[ -n "${WSL_DISTRO_NAME:-}" ]] || [[ -f "/proc/version" && $(grep -q "microsoft\|WSL" /proc/version 2>/dev/null) ]]; then
        # In WSL, try Windows host first, then localhost
        if curl -s --connect-timeout 1 "http://host.docker.internal:4000/health" >/dev/null 2>&1; then
            server_url="http://host.docker.internal:4000"
        elif curl -s --connect-timeout 1 "http://172.17.0.1:4000/health" >/dev/null 2>&1; then
            server_url="http://172.17.0.1:4000"
        fi
    # Check if running in Docker
    elif [[ -f "/.dockerenv" ]] || [[ -n "${DOCKER_CONTAINER:-}" ]]; then
        server_url="http://host.docker.internal:4000"
    fi
    
    echo "$server_url"
}

# Convert Windows paths to WSL paths if necessary
convert_path() {
    local path="$1"
    
    # Check if path looks like Windows path (C:\... or C:/...)
    if [[ "$path" =~ ^[A-Za-z]: ]]; then
        # Convert C:\path to /mnt/c/path format
        local drive=$(echo "$path" | cut -c1 | tr '[:upper:]' '[:lower:]')
        local rest=$(echo "$path" | sed 's|^[A-Za-z]:[/\\]*||' | tr '\\' '/')
        echo "/mnt/$drive/$rest"
    else
        echo "$path"
    fi
}

# Escape JSON strings properly with better handling for special characters
escape_json_string() {
    local str="$1"
    # Handle null/empty strings
    [[ -z "$str" ]] && { echo ""; return; }
    # Escape backslashes first, then quotes, then control characters
    echo "$str" | sed 's/\\/\\\\/g; s/"/\\"/g; s/\t/\\t/g; s/\r/\\r/g; s/\n/\\n/g'
}

# Send event to observability server with improved error handling and retry
send_event() {
    local url="$1"
    local data="$2"
    local attempt=1
    local max_attempts=3
    
    while [[ $attempt -le $max_attempts ]]; do
        if curl -s --connect-timeout 2 --max-time 3 \
            -H "Content-Type: application/json" \
            -H "User-Agent: Claude-Hooks-Bash/2.0" \
            -X POST -d "$data" \
            "$url/events" >/dev/null 2>&1; then
            return 0
        fi
        ((attempt++))
        [[ $attempt -le $max_attempts ]] && sleep 0.5
    done
    return 1
}

# Send event with summarization flag
send_event_with_summarization() {
    local url="$1"
    local data="$2"
    local attempt=1
    local max_attempts=3
    
    while [[ $attempt -le $max_attempts ]]; do
        if curl -s --connect-timeout 2 --max-time 3 \
            -H "Content-Type: application/json" \
            -H "User-Agent: Claude-Hooks-Bash/2.0" \
            -X POST -d "$data" \
            "$url/events?summarize=true" >/dev/null 2>&1; then
            return 0
        fi
        ((attempt++))
        [[ $attempt -le $max_attempts ]] && sleep 0.5
    done
    return 1
}
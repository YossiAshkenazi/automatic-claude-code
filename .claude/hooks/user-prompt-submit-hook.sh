#!/usr/bin/env bash
# User Prompt Submit Hook for Agents Observability
# Reads JSON from stdin and sends to observability server
# Requires: Bash 3.0+, curl for HTTP requests

# Fallback mechanisms for uncertain environments
setup_fallbacks() {
    # Ensure required commands are available or create fallbacks
    
    # If curl is not available, try wget as fallback
    if ! command -v curl >/dev/null 2>&1; then
        if command -v wget >/dev/null 2>&1; then
            curl() {
                # Basic curl to wget translation for our use case
                local url=""
                local data=""
                local headers=""
                local method="GET"
                local silent=false
                local timeout=""
                
                while [[ $# -gt 0 ]]; do
                    case $1 in
                        -s) silent=true; shift ;;
                        -X) method="$2"; shift 2 ;;
                        -d) data="$2"; shift 2 ;;
                        -H) headers="$headers --header=$2"; shift 2 ;;
                        -m) timeout="--timeout=$2"; shift 2 ;;
                        --connect-timeout) timeout="--timeout=$2"; shift 2 ;;
                        --max-time) timeout="--timeout=$2"; shift 2 ;;
                        http*) url="$1"; shift ;;
                        *) shift ;;
                    esac
                done
                
                if [ -n "$data" ] && [ "$method" = "POST" ]; then
                    wget $timeout --post-data="$data" $headers -O - "$url" 2>/dev/null
                else
                    wget $timeout $headers -O - "$url" 2>/dev/null
                fi
            }
        else
            # No HTTP client available - create minimal fallback
            curl() {
                return 1  # Always fail gracefully
            }
        fi
    fi
    
    # Ensure basename works
    if ! command -v basename >/dev/null 2>&1; then
        basename() {
            local path="$1"
            echo "${path##*/}"
        }
    fi
    
    # Ensure date command has basic functionality
    if ! date -u +"%Y-%m-%d" >/dev/null 2>&1; then
        # Very basic date fallback
        date() {
            if [ "$1" = "-u" ]; then
                shift
            fi
            printf "%s\n" "$(LC_ALL=C /bin/date "$@" 2>/dev/null || echo '2024-01-01T00:00:00Z')"
        }
    fi
}

# Setup fallback mechanisms for compatibility
setup_fallbacks

# Read JSON input from stdin
input=$(cat)

# Exit if no input
if [ -z "$input" ]; then
    exit 0
fi

# Extract values using jq if available, otherwise use grep/sed
if command -v jq >/dev/null 2>&1; then
    session_id=$(echo "$input" | jq -r '.session_id // empty')
    prompt=$(echo "$input" | jq -r '.prompt // empty')
    cwd=$(echo "$input" | jq -r '.cwd // empty')
    transcript_path=$(echo "$input" | jq -r '.transcript_path // empty')
else
    # Fallback using grep/sed for basic extraction
    session_id=$(echo "$input" | grep -o '"session_id":"[^"]*"' | sed 's/"session_id":"\([^"]*\)"/\1/')
    prompt=$(echo "$input" | grep -o '"prompt":"[^"]*"' | sed 's/"prompt":"\([^"]*\)"/\1/')
    cwd=$(echo "$input" | grep -o '"cwd":"[^"]*"' | sed 's/"cwd":"\([^"]*\)"/\1/')
    transcript_path=$(echo "$input" | grep -o '"transcript_path":"[^"]*"' | sed 's/"transcript_path":"\([^"]*\)"/\1/')
fi

# Extract project name from cwd or use default
if [ -n "$cwd" ]; then
    project_name=$(basename "$cwd")
else
    project_name="unknown-project"
fi

# Create timestamp
# Create timestamp with better Linux distribution compatibility
if command -v date >/dev/null 2>&1; then
    # Try GNU date with nanoseconds first (Linux)
    if timestamp=$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ" 2>/dev/null); then
        : # Success, timestamp is set
    elif timestamp=$(date -u -d "now" +"%Y-%m-%dT%H:%M:%S.%3NZ" 2>/dev/null); then
        : # Alternative GNU date format
    else
        # Fallback for systems without nanosecond support (BusyBox, etc.)
        timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date +"%Y-%m-%dT%H:%M:%SZ")
    fi
else
    # Ultimate fallback if date command unavailable
    timestamp=$(printf "%s" "$(date)")
fi

# Escape JSON strings properly
escaped_prompt=$(echo "$prompt" | sed 's/\\/\\\\/g; s/"/\\"/g; s/\n/\\n/g; s/\r/\\r/g; s/\t/\\t/g')
escaped_cwd=$(echo "$cwd" | sed 's/\\/\\\\/g; s/"/\\"/g')
escaped_transcript_path=$(echo "$transcript_path" | sed 's/\\/\\\\/g; s/"/\\"/g')

# Create JSON payload
payload=$(cat <<EOF
{
    "source_app": "$project_name",
    "session_id": "$session_id",
    "hook_event_type": "UserPromptSubmit",
    "payload": {
        "message": "$escaped_prompt",
        "timestamp": "$timestamp",
        "cwd": "$escaped_cwd",
        "transcript_path": "$escaped_transcript_path"
    }
}
EOF
)

# Send to observability server (non-blocking with timeout)
(
    curl -s -m 2 -X POST \
        -H "Content-Type: application/json" \
        -d "$payload" \
        "http://localhost:4000/events" >/dev/null 2>&1 &
    
    # Wait for background process with timeout
    sleep 2
    # Portable job cleanup - check if jobs exist before killing
    local job_pids
    job_pids=$(jobs -p 2>/dev/null || true)
    if [ -n "$job_pids" ]; then
        # Use portable xargs without -r flag (not available on all systems)
        echo "$job_pids" | xargs kill 2>/dev/null || true
    fi
) 2>/dev/null &

exit 0
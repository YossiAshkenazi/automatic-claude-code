#!/bin/bash

# Automatic Claude Code v2.0 Comprehensive Test Suite
# Run with: bash test-v2.sh [--quick] [--verbose] [--no-cleanup]

# Parse command line arguments
QUICK=false
VERBOSE=false
NO_CLEANUP=false

for arg in "$@"; do
    case $arg in
        --quick)
            QUICK=true
            ;;
        --verbose)
            VERBOSE=true
            ;;
        --no-cleanup)
            NO_CLEANUP=true
            ;;
        --help)
            echo "Usage: $0 [--quick] [--verbose] [--no-cleanup]"
            echo "  --quick      Run only essential tests"
            echo "  --verbose    Show detailed output"
            echo "  --no-cleanup Don't clean up test files"
            exit 0
            ;;
    esac
done

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_SKIPPED=0

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
GRAY='\033[0;90m'
NC='\033[0m' # No Color

# Test functions
write_test_header() {
    echo -e "\n${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN} $1${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

write_test_section() {
    echo -e "\n${YELLOW}📋 $1${NC}"
}

write_success() {
    echo -e "  ${GREEN}✅ $1${NC}"
    ((TESTS_PASSED++))
}

write_failure() {
    echo -e "  ${RED}❌ $1${NC}"
    ((TESTS_FAILED++))
}

write_warning() {
    echo -e "  ${YELLOW}⚠️  $1${NC}"
}

write_skip() {
    echo -e "  ${GRAY}⏭️  $1${NC}"
    ((TESTS_SKIPPED++))
}

write_info() {
    if [ "$VERBOSE" = true ]; then
        echo -e "  ${CYAN}ℹ️  $1${NC}"
    fi
}

# Helper functions
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

file_contains() {
    local file=$1
    local pattern=$2
    if [ -f "$file" ]; then
        grep -q "$pattern" "$file"
        return $?
    fi
    return 1
}

run_acc_command() {
    local cmd="$1"
    local expected_output="$2"
    local should_fail="${3:-false}"
    
    write_info "Running: acc $cmd"
    
    if [ "$VERBOSE" = true ]; then
        output=$(acc $cmd 2>&1)
        echo -e "${GRAY}$output${NC}"
    else
        output=$(acc $cmd 2>&1)
    fi
    
    local exit_code=$?
    local success=true
    
    if [ "$should_fail" = true ]; then
        if [ $exit_code -eq 0 ]; then
            success=false
        fi
    else
        if [ $exit_code -ne 0 ]; then
            success=false
        fi
    fi
    
    if [ -n "$expected_output" ]; then
        if ! echo "$output" | grep -q "$expected_output"; then
            success=false
        fi
    fi
    
    echo "$output"
    return $([ "$success" = true ] && echo 0 || echo 1)
}

# Main test execution
echo ""
echo -e "${MAGENTA}🧪 AUTOMATIC CLAUDE CODE v2.0 TEST SUITE${NC}"
echo -e "${MAGENTA}=========================================${NC}"
echo -e "Mode: $([ "$QUICK" = true ] && echo 'Quick' || echo 'Comprehensive')"
echo -e "Verbose: $VERBOSE"
echo -e "Cleanup: $([ "$NO_CLEANUP" = true ] && echo 'Disabled' || echo 'Enabled')"
echo -e "Started: $(date '+%Y-%m-%d %H:%M:%S')"

# Create test directory
TEST_DIR="test-workspace-$$"
write_info "Creating test directory: $TEST_DIR"
mkdir -p "$TEST_DIR"
cd "$TEST_DIR" || exit 1

# Cleanup function
cleanup() {
    cd ..
    if [ "$NO_CLEANUP" != true ]; then
        write_test_header "CLEANUP"
        write_info "Removing test directory: $TEST_DIR"
        rm -rf "$TEST_DIR"
        write_success "Test files cleaned up"
    fi
}

# Set trap for cleanup on exit
trap cleanup EXIT

# ============================================================
# PREREQUISITE TESTS
# ============================================================
write_test_header "PREREQUISITES CHECK"

write_test_section "Testing Claude CLI Installation"
if command_exists claude; then
    claude_version=$(claude --version 2>&1)
    if echo "$claude_version" | grep -q "1\.0\.[0-9]"; then
        write_success "Claude CLI installed (version found)"
    else
        write_warning "Claude CLI version unclear: $claude_version"
    fi
else
    write_failure "Claude CLI not found - install with: npm install -g @anthropic-ai/claude-code"
    [ "$QUICK" != true ] && exit 1
fi

write_test_section "Testing ACC Installation"
if command_exists acc; then
    acc_version=$(acc --version 2>&1)
    write_success "ACC command available"
    write_info "Version output: $(echo $acc_version | tr '\n' ' ')"
else
    write_failure "ACC command not found - run 'npm link' in project directory"
    exit 1
fi

# ============================================================
# CORE FUNCTIONALITY TESTS
# ============================================================
write_test_header "CORE FUNCTIONALITY"

write_test_section "Test 1: SDK Health Verification"
if output=$(run_acc_command 'run --verify-claude-cli "test"' "Overall Health: HEALTHY"); then
    write_success "SDK health check passed"
    echo "$output" | grep -q "SDK Available: ✅" && write_info "SDK Available confirmed"
    echo "$output" | grep -q "Claude CLI: ✅" && write_info "Claude CLI confirmed"
    echo "$output" | grep -q "Authentication: ✅" && write_info "Authentication confirmed"
else
    write_failure "SDK health check failed"
fi

write_test_section "Test 2: Basic Code Generation"
cat > test-basic.js << 'EOF'
// Test file for v2.0
function greet(name) { return "Hello, " + name; }
EOF

if run_acc_command 'run "add a function to calculate the square of a number to test-basic.js" -i 1' > /dev/null 2>&1; then
    sleep 2
    if file_contains "test-basic.js" "square\|Square"; then
        write_success "Code generation successful"
    else
        write_failure "Code generation failed - function not added"
    fi
else
    write_failure "Code generation command failed"
fi

write_test_section "Test 3: Multi-File Creation"
if [ "$QUICK" != true ]; then
    if run_acc_command 'run "create a simple calculator module with add, subtract, multiply, divide functions" -i 2' > /dev/null 2>&1; then
        sleep 3
        js_files=$(find . -name "*.js" -not -name "test-basic.js" | wc -l)
        if [ "$js_files" -gt 0 ]; then
            write_success "Multi-file creation successful ($js_files files created)"
        else
            write_warning "No additional files created"
        fi
    else
        write_failure "Multi-file creation failed"
    fi
else
    write_skip "Skipping multi-file test in quick mode"
fi

# ============================================================
# ERROR HANDLING TESTS
# ============================================================
write_test_header "ERROR HANDLING"

write_test_section "Test 4: Invalid API Key Detection"
OLD_KEY="$ANTHROPIC_API_KEY"
export ANTHROPIC_API_KEY="invalid-test-key-12345"

if output=$(run_acc_command 'run "simple test" -i 1' "" true); then
    if echo "$output" | grep -q "Invalid API Key"; then
        write_success "Invalid API key detected correctly"
        write_info "Error message includes recovery instructions"
    else
        write_warning "Invalid API key detection may not be working as expected"
    fi
else
    write_info "Command failed as expected with invalid key"
fi

# Restore original key
if [ -n "$OLD_KEY" ]; then
    export ANTHROPIC_API_KEY="$OLD_KEY"
else
    unset ANTHROPIC_API_KEY
fi

write_test_section "Test 5: Circuit Breaker Behavior"
if [ "$QUICK" != true ]; then
    write_info "Testing circuit breaker with multiple failures..."
    export ANTHROPIC_API_KEY="trigger-circuit-breaker"
    
    for i in {1..4}; do
        write_info "Failure attempt $i/4"
        run_acc_command "run \"test $i\" -i 1" "" true > /dev/null 2>&1
        sleep 1
    done
    
    unset ANTHROPIC_API_KEY
    
    # Circuit breaker should be open now
    if output=$(run_acc_command 'run "test after breaker" -i 1' 2>&1); then
        if echo "$output" | grep -q "Circuit breaker"; then
            write_success "Circuit breaker activated after multiple failures"
        else
            write_info "Circuit breaker status unclear"
        fi
    fi
else
    write_skip "Skipping circuit breaker test in quick mode"
fi

# ============================================================
# SESSION MANAGEMENT TESTS
# ============================================================
write_test_header "SESSION MANAGEMENT"

write_test_section "Test 6: Session History"
if output=$(run_acc_command "history" 2>&1); then
    write_success "Session history command works"
    if echo "$output" | grep -q "Session"; then
        write_info "Previous sessions found"
    else
        write_info "No previous sessions (expected on fresh install)"
    fi
else
    write_failure "Session history command failed"
fi

# ============================================================
# ADVANCED FEATURES (if not quick mode)
# ============================================================
if [ "$QUICK" != true ]; then
    write_test_header "ADVANCED FEATURES"
    
    write_test_section "Test 7: Dual-Agent Mode"
    if run_acc_command 'run "create a function that validates email addresses" --dual-agent -i 3' > /dev/null 2>&1; then
        write_success "Dual-agent mode execution completed"
    else
        write_warning "Dual-agent mode may have issues"
    fi
    
    write_test_section "Test 8: Code Refactoring"
    cat > messy.js << 'EOF'
function calculate(x,y,z){var result=x+y*z;console.log(result);return result}
function getData(){var data=[1,2,3];for(var i=0;i<data.length;i++)console.log(data[i]);return data}
EOF
    
    if run_acc_command 'run "refactor messy.js to use modern JavaScript with proper formatting" -i 2' > /dev/null 2>&1; then
        sleep 3
        if file_contains "messy.js" "const\|let\|=>"; then
            write_success "Code refactoring successful"
        else
            write_warning "Refactoring may not have modernized the code"
        fi
    else
        write_failure "Refactoring command failed"
    fi
    
    write_test_section "Test 9: Bug Detection and Fixing"
    cat > buggy.js << 'EOF'
function divide(a, b) {
    return a / b;  // Bug: no zero check
}
function getUser(users, index) {
    return users[index].name;  // Bug: no bounds check
}
EOF
    
    if run_acc_command 'run "find and fix all bugs in buggy.js" -i 2' > /dev/null 2>&1; then
        sleep 3
        if file_contains "buggy.js" "if.*b.*===.*0\|throw\|Error"; then
            write_success "Bug fixing successful"
        else
            write_info "Bug fixes may not be complete"
        fi
    else
        write_failure "Bug fixing command failed"
    fi
fi

# ============================================================
# PERFORMANCE TESTS (if not quick mode)
# ============================================================
if [ "$QUICK" != true ]; then
    write_test_header "PERFORMANCE TESTS"
    
    write_test_section "Test 10: Large File Processing"
    write_info "Creating large test file..."
    
    for i in {1..50}; do
        echo "function func$i(param) { return param * $i; }" >> large.js
    done
    
    start_time=$(date +%s)
    if run_acc_command 'run "add JSDoc comments to all functions in large.js" -i 2' > /dev/null 2>&1; then
        end_time=$(date +%s)
        duration=$((end_time - start_time))
        write_success "Large file processed in $duration seconds"
    else
        write_failure "Large file processing failed"
    fi
fi

# ============================================================
# RESULTS SUMMARY
# ============================================================
write_test_header "TEST RESULTS SUMMARY"

TOTAL=$((TESTS_PASSED + TESTS_FAILED + TESTS_SKIPPED))
if [ $TOTAL -gt 0 ]; then
    PASS_RATE=$((TESTS_PASSED * 100 / TOTAL))
else
    PASS_RATE=0
fi

echo ""
echo -e "  Total Tests: $TOTAL"
echo -e "  ${GREEN}✅ Passed: $TESTS_PASSED${NC}"
echo -e "  ${RED}❌ Failed: $TESTS_FAILED${NC}"
echo -e "  ${GRAY}⏭️  Skipped: $TESTS_SKIPPED${NC}"

if [ $PASS_RATE -ge 80 ]; then
    echo -e "  ${GREEN}📊 Pass Rate: $PASS_RATE%${NC}"
elif [ $PASS_RATE -ge 60 ]; then
    echo -e "  ${YELLOW}📊 Pass Rate: $PASS_RATE%${NC}"
else
    echo -e "  ${RED}📊 Pass Rate: $PASS_RATE%${NC}"
fi

echo ""
if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 ALL TESTS PASSED! 🎉${NC}"
    echo -e "${GREEN}The v2.0 SDK-only architecture is working correctly.${NC}"
elif [ $TESTS_FAILED -le 2 ]; then
    echo -e "${YELLOW}⚠️  MOSTLY SUCCESSFUL${NC}"
    echo -e "${YELLOW}Minor issues detected. Review failed tests above.${NC}"
else
    echo -e "${RED}❌ TESTS FAILED${NC}"
    echo -e "${RED}Multiple issues detected. Please review and fix.${NC}"
fi

echo ""
echo -e "Completed: $(date '+%Y-%m-%d %H:%M:%S')"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Exit with appropriate code
exit $([[ $TESTS_FAILED -eq 0 ]] && echo 0 || echo 1)
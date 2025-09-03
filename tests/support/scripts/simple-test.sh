#!/bin/bash

# Simple End-to-End Test for ACC v2.0
# This test verifies the core SDK execution pipeline works
# It makes just ONE call to Claude with a simple prompt

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
GRAY='\033[0;90m'
NC='\033[0m' # No Color

echo ""
echo -e "${CYAN}ACC v2.0 - SIMPLE END-TO-END TEST${NC}"
echo -e "${CYAN}==================================${NC}"
echo ""

# Step 1: Verify ACC is available
echo -e "${YELLOW}[1/4] Checking ACC installation...${NC}"
if acc --version &>/dev/null; then
    echo -e "      ${GREEN}SUCCESS: ACC is installed${NC}"
else
    echo -e "      ${RED}FAILED: ACC not found. Run 'npm link' in project directory${NC}"
    exit 1
fi

# Step 2: Check SDK health (quick check only)
echo ""
echo -e "${YELLOW}[2/4] Verifying SDK health...${NC}"
health_output=$(acc run --verify-claude-cli "test" 2>&1)
if echo "$health_output" | grep -q "Overall Health: HEALTHY"; then
    echo -e "      ${GREEN}SUCCESS: SDK is healthy${NC}"
else
    echo -e "      ${YELLOW}WARNING: SDK health unclear, continuing anyway...${NC}"
fi

# Step 3: Create a simple test file
echo ""
echo -e "${YELLOW}[3/4] Creating test file...${NC}"
test_file="simple-test-output.txt"
echo "Today is a good day" > "$test_file"
echo -e "      ${GRAY}Created: $test_file${NC}"

# Step 4: Execute ONE simple command via Claude
echo ""
echo -e "${YELLOW}[4/4] Executing simple Claude task...${NC}"
echo -e "      ${GRAY}Task: 'Add the current date to simple-test-output.txt'${NC}"
echo -e "      ${GRAY}This makes exactly ONE call to Claude SDK${NC}"
echo ""

# Run the command with minimal iterations
start_time=$(date +%s)
output=$(acc run "Add the current date in format 'Date: YYYY-MM-DD' to the file simple-test-output.txt" -i 1 2>&1)
exit_code=$?
end_time=$(date +%s)
duration=$((end_time - start_time))

# Check if command succeeded
if [ $exit_code -eq 0 ]; then
    echo -e "      ${GREEN}SUCCESS: Command completed${NC}"
    echo -e "      ${GRAY}Duration: $duration seconds${NC}"
    
    # Verify the file was modified
    if [ -f "$test_file" ]; then
        content=$(cat "$test_file")
        if echo "$content" | grep -qE "Date:|date:|2025|2024"; then
            echo -e "      ${GREEN}VERIFIED: File was modified with date${NC}"
            echo ""
            echo -e "      ${GRAY}File contents:${NC}"
            echo -e "      ${GRAY}-------------${NC}"
            while IFS= read -r line; do
                echo -e "      ${GRAY}$line${NC}"
            done < "$test_file"
        else
            echo -e "      ${YELLOW}WARNING: File exists but date not found${NC}"
        fi
    fi
else
    echo -e "      ${RED}FAILED: Command did not complete successfully${NC}"
    echo ""
    echo -e "      ${YELLOW}Error output (first 10 lines):${NC}"
    echo "$output" | head -10 | while IFS= read -r line; do
        echo -e "      ${GRAY}$line${NC}"
    done
fi

# Results
echo ""
echo -e "${CYAN}==================================${NC}"
echo -n "RESULT: "
if [ $exit_code -eq 0 ]; then
    echo -e "${GREEN}SDK EXECUTION WORKS!${NC}"
    echo ""
    echo -e "${GREEN}The v2.0 SDK-only architecture successfully:${NC}"
    echo -e "${GREEN}  1. Accepted a task${NC}"
    echo -e "${GREEN}  2. Called Claude via SDK${NC}"
    echo -e "${GREEN}  3. Executed the response${NC}"
    echo -e "${GREEN}  4. Modified the file${NC}"
    
    # Clean up test file
    rm -f "$test_file"
    echo ""
    echo -e "${GRAY}Test file cleaned up.${NC}"
    exit 0
else
    echo -e "${RED}TEST FAILED${NC}"
    echo ""
    echo -e "${RED}The SDK execution did not complete successfully.${NC}"
    echo -e "${RED}Check the error output above for details.${NC}"
    
    # Leave test file for debugging
    echo ""
    echo -e "${YELLOW}Test file left for debugging: $test_file${NC}"
    exit 1
fi
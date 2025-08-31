#!/bin/bash

# Test script for Automatic Claude Code in WSL
# Run this after installing dependencies

echo "========================================="
echo "Automatic Claude Code - WSL Test Script"
echo "========================================="
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Not in the automatic-claude-code directory"
    echo "   Please cd to /mnt/c/Users/Dev/automatic-claude-code"
    exit 1
fi

# Check Node.js
echo "1. Checking Node.js..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo "   ✅ Node.js installed: $NODE_VERSION"
else
    echo "   ❌ Node.js not found. Please install Node.js first."
    exit 1
fi

# Check pnpm
echo ""
echo "2. Checking pnpm..."
if command -v pnpm &> /dev/null; then
    PNPM_VERSION=$(pnpm --version)
    echo "   ✅ pnpm installed: $PNPM_VERSION"
else
    echo "   ❌ pnpm not found. Installing..."
    curl -fsSL https://get.pnpm.io/install.sh | sh -
    source ~/.bashrc
fi

# Check Claude CLI
echo ""
echo "3. Checking Claude CLI..."
if command -v claude &> /dev/null; then
    echo "   ✅ Claude CLI is installed"
else
    echo "   ⚠️  Claude CLI not found. You'll need to install it:"
    echo "   Run: npm install -g @anthropic-ai/claude-cli"
fi

# Check if dist folder exists
echo ""
echo "4. Checking build..."
if [ -d "dist" ]; then
    echo "   ✅ Build directory exists"
else
    echo "   ⚠️  No dist directory. Building project..."
    pnpm run build
fi

# Install dependencies if needed
echo ""
echo "5. Checking dependencies..."
if [ -d "node_modules" ]; then
    echo "   ✅ Dependencies installed"
else
    echo "   📦 Installing dependencies..."
    pnpm install
fi

# Run basic tests
echo ""
echo "========================================="
echo "Running Basic Tests"
echo "========================================="
echo ""

# Test 1: Help command
echo "Test 1: Help command"
echo "-------------------"
node dist/index.js --help
echo ""

# Test 2: Simple task (non-interactive)
echo "Test 2: Running simple task (1 iteration)"
echo "-----------------------------------------"
TEST_DIR=$(mktemp -d)
echo "Working directory: $TEST_DIR"
node dist/index.js run "create a file called hello.txt with 'Hello from WSL' content" \
    -i 1 \
    -d "$TEST_DIR" \
    --model sonnet

# Check if file was created
if [ -f "$TEST_DIR/hello.txt" ]; then
    echo "✅ Test file created successfully"
    echo "Content: $(cat $TEST_DIR/hello.txt)"
else
    echo "⚠️  Test file was not created"
fi

# Test 3: History command
echo ""
echo "Test 3: Viewing history"
echo "----------------------"
node dist/index.js history

echo ""
echo "========================================="
echo "Test Complete!"
echo "========================================="
echo ""
echo "You can now run Automatic Claude Code with:"
echo "  node dist/index.js run \"your task\" -i 5 -v"
echo ""
echo "Or create an alias in your ~/.bashrc:"
echo "  alias acc='node /mnt/c/Users/Dev/automatic-claude-code/dist/index.js'"
echo ""
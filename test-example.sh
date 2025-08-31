#!/bin/bash

# Example test script for Automatic Claude Code

echo "Testing Automatic Claude Code..."
echo "================================"

# Simple test with a basic prompt
node dist/index.js run "Create a simple hello world function in test.js" \
  --iterations 2 \
  --verbose \
  --dir . \
  --continue-on-error

echo "Test completed!"
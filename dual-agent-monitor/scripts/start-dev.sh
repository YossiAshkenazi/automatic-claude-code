#!/bin/bash

# Development startup script for Dual-Agent Monitor

echo "🚀 Starting Dual-Agent Monitor Development Environment"
echo "=================================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ is required. Current version: $(node --version)"
    exit 1
fi

echo "✅ Node.js version: $(node --version)"
echo "✅ npm version: $(npm --version)"

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ Failed to install dependencies"
        exit 1
    fi
fi

# Create session directory if it doesn't exist
if [ ! -d ".dual-agent-sessions" ]; then
    echo "📁 Creating session storage directory..."
    mkdir -p .dual-agent-sessions
fi

# Start development servers
echo "🎯 Starting development servers..."
echo "   Frontend: http://localhost:6002"
echo "   Backend API: http://localhost:6003"
echo "   WebSocket: ws://localhost:6003"
echo ""
echo "Press Ctrl+C to stop all servers"
echo ""

npm run dev
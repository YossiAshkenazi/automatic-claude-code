#!/bin/bash

# Setup script for Dual-Agent Monitor

echo "🔧 Setting up Dual-Agent Monitor"
echo "================================"

# Make scripts executable
echo "📝 Making scripts executable..."
chmod +x scripts/*.sh

# Create directories
echo "📁 Creating directories..."
mkdir -p .dual-agent-sessions
mkdir -p logs

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build the application
echo "🔨 Building application..."
npm run build

# Create systemd service file (optional)
if command -v systemctl &> /dev/null; then
    echo "🖥️  Creating systemd service file..."
    sudo tee /etc/systemd/system/dual-agent-monitor.service > /dev/null << EOF
[Unit]
Description=Dual-Agent Claude Code Monitor
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=$(pwd)
ExecStart=/usr/bin/node dist/server/index.js
Restart=on-failure
Environment=NODE_ENV=production
Environment=PORT=6003

[Install]
WantedBy=multi-user.target
EOF
    
    echo "   Service file created at /etc/systemd/system/dual-agent-monitor.service"
    echo "   To start the service:"
    echo "     sudo systemctl daemon-reload"
    echo "     sudo systemctl enable dual-agent-monitor"
    echo "     sudo systemctl start dual-agent-monitor"
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Start development: ./scripts/start-dev.sh"
echo "  2. Or start production: npm start"
echo "  3. Or use Docker: docker-compose up -d"
echo ""
echo "The monitor will be available at:"
echo "  - Frontend: http://localhost:6002"
echo "  - Backend API: http://localhost:6003"
echo "  - Health check: http://localhost:6003/health"
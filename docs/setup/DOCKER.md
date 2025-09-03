# Docker Deployment Guide

## Table of Contents
1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Docker Images](#docker-images)
4. [Development Environment](#development-environment)
5. [Production Deployment](#production-deployment)
6. [Docker Compose Services](#docker-compose-services)
7. [Environment Configuration](#environment-configuration)
8. [Monitoring with Docker](#monitoring-with-docker)
9. [Data Persistence](#data-persistence)
10. [Backup and Recovery](#backup-and-recovery)
11. [Troubleshooting](#troubleshooting)

## Overview

The Automatic Claude Code project provides comprehensive Docker support for both development and production environments. The containerized deployment includes:

- **Main Application Container**: ACC CLI with all dependencies
- **Monitoring Backend**: Express + WebSocket server
- **Monitoring Frontend**: React-based dashboard
- **Database Services**: PostgreSQL for data persistence
- **Cache Services**: Redis for session and real-time data
- **Reverse Proxy**: Nginx for production load balancing
- **Backup Services**: Automated database backups

## Quick Start

### Option 1: Single Container (ACC CLI Only)
```bash
# Build the ACC container
pnpm run docker:build

# Run a task with Docker
docker run -it --rm \
  -v "$(pwd):/workspace:ro" \
  -v "$HOME/.claude:/home/nodejs/.claude:ro" \
  automatic-claude-code run "create a hello world function" -i 3 -v
```

### Option 2: Development Environment (Full Stack)
```bash
# Start all development services
pnpm run docker:dev

# This starts:
# - ACC app container (interactive)
# - PostgreSQL database
# - Redis cache
# - Monitoring backend (port 4001)
# - Monitoring frontend (port 6011)
```

### Option 3: Production Deployment (Complete)
```bash
# Copy environment template
cp .env.example .env

# Edit production settings
vim .env

# Start production services
pnpm run docker:prod

# Optional: Include Nginx proxy
pnpm run docker:prod-full
```

## Docker Images

### Main Application Image
The `Dockerfile` creates a multi-stage build:

1. **Base Stage**: Node.js 20 Alpine with pnpm
2. **Dependencies Stage**: Install all dependencies
3. **Build Stage**: Compile TypeScript to JavaScript
4. **Production Stage**: Minimal runtime image with built app

```dockerfile
# Production image characteristics:
# - Node.js 20 Alpine (minimal size)
# - Non-root user (nodejs:nodejs)
# - Built application in /app/dist
# - Health checks included
# - Exposed port 3000 for integrations
```

### Build Targets
```bash
# Development image (includes dev dependencies and source)
pnpm run docker:build-dev

# Production image (optimized, production dependencies only)
pnpm run docker:build
```

### Image Usage Patterns
```bash
# Interactive development
docker run -it --rm automatic-claude-code:dev /bin/sh

# One-shot task execution
docker run --rm automatic-claude-code run "task" -i 3

# Persistent container for multiple tasks
docker run -d --name acc-worker automatic-claude-code sleep infinity
docker exec acc-worker node dist/index.js run "task" --dual-agent -i 5
```

## Development Environment

### Docker Compose Development
The `docker-compose.yml` provides a complete development environment:

```yaml
services:
  acc-app:           # Main application (interactive)
  postgres:          # PostgreSQL 15 database
  redis:             # Redis 7 cache
  monitoring-backend: # Node.js API server
  monitoring-frontend: # React development server
```

### Starting Development Environment
```bash
# Full development stack
pnpm run docker:dev

# Only specific services
pnpm run docker:dev-app          # Just the ACC app
pnpm run docker:dev-monitoring   # Just monitoring services

# With specific profiles
docker-compose --profile app --profile monitoring up
```

### Development Workflow
```bash
# Start services in background
pnpm run docker:dev &

# Use the running ACC container
docker exec -it automatic-claude-code-app node dist/index.js run "implement user auth" --dual-agent -i 5

# View real-time logs
pnpm run docker:logs

# View specific service logs
pnpm run docker:logs-app
```

### Development Features
- **Hot Reload**: Source code mounted as volumes
- **Interactive Mode**: TTY enabled for debugging
- **Network Isolation**: All services on `acc-network`
- **Health Checks**: Automatic service health monitoring
- **Port Mapping**: All services accessible from host

## Production Deployment

### Docker Compose Production
The `docker-compose.prod.yml` provides a production-ready environment:

```yaml
services:
  acc-app:              # Application (restart policies)
  postgres:             # PostgreSQL with backups
  redis:                # Redis with persistence
  monitoring-backend:   # Production API server
  monitoring-frontend:  # Built React app with nginx
  nginx:                # Reverse proxy (optional)
  backup:               # Database backup service
```

### Production Configuration
```bash
# Create environment file
cp .env.example .env

# Essential production settings:
POSTGRES_PASSWORD=your-secure-password-here
JWT_SECRET=your-32-character-jwt-secret-here
SESSION_SECRET=your-32-character-session-secret-here
REDIS_PASSWORD=your-redis-password-here
NODE_ENV=production
```

### Production Deployment Commands
```bash
# Standard production deployment
pnpm run docker:prod

# Full production with nginx proxy
pnpm run docker:prod-full

# Stop production services
pnpm run docker:stop-prod

# View production logs
docker-compose -f docker-compose.prod.yml logs -f
```

### Production Features
- **Restart Policies**: `unless-stopped` for all services
- **Resource Limits**: Memory and CPU constraints
- **Health Checks**: Comprehensive service monitoring
- **Log Rotation**: Prevents log files from growing too large
- **Security**: Non-root users, read-only mounts
- **Backup Integration**: Automated database backups

## Docker Compose Services

### Main Application (acc-app)
```yaml
acc-app:
  # Built from local Dockerfile
  # Mounts workspace and Claude config
  # Environment variables for database/redis
  # Restart policy for reliability
```

**Volumes:**
- `./workspace:/workspace:ro` - Project workspace (read-only)
- `~/.claude:/home/nodejs/.claude:ro` - Claude CLI config
- `acc_config:/home/nodejs/.automatic-claude-code` - ACC config

**Environment:**
- `NODE_ENV` - Runtime environment
- `DATABASE_URL` - PostgreSQL connection
- `REDIS_URL` - Redis connection

### PostgreSQL Database (postgres)
```yaml
postgres:
  # PostgreSQL 15 Alpine
  # Initialized with monitoring schema
  # Health checks and backups
  # Persistent data volume
```

**Features:**
- **Schema Initialization**: Automatic dual-agent monitoring schema setup
- **Health Checks**: `pg_isready` monitoring
- **Backup Volume**: `/backups` mounted for automated backups
- **Connection Pooling**: Configured for production loads

### Redis Cache (redis)
```yaml
redis:
  # Redis 7 Alpine
  # Append-only persistence
  # Memory limits and eviction policy
  # Health monitoring
```

**Configuration:**
- **Persistence**: `--appendonly yes` for data durability
- **Memory Management**: `--maxmemory 256mb --maxmemory-policy allkeys-lru`
- **Health Checks**: `redis-cli ping`

### Monitoring Backend (monitoring-backend)
```yaml
monitoring-backend:
  # Built from dual-agent-monitor/Dockerfile
  # Express + WebSocket server
  # Database and Redis integration
  # Health checks on /health endpoint
```

**Features:**
- **Real-time Communication**: WebSocket server for live updates
- **REST API**: Full API for session management
- **Database Integration**: PostgreSQL for session persistence
- **Cache Integration**: Redis for real-time data

### Monitoring Frontend (monitoring-frontend)
```yaml
monitoring-frontend:
  # React application with Vite
  # Development: Live reload server
  # Production: Static files with nginx
  # Proxy configuration to backend
```

**Development Mode:**
- **Vite Dev Server**: Hot reload and development tools
- **Port 6011**: Direct access to development server
- **API Proxy**: Automatic proxy to backend services

**Production Mode:**
- **Static Build**: Optimized React build
- **Nginx Server**: Efficient static file serving
- **Port 80**: Standard web server port inside container

### Nginx Reverse Proxy (nginx) [Optional]
```yaml
nginx:
  # Alpine-based nginx
  # SSL termination
  # Load balancing
  # Rate limiting and security headers
```

**Features:**
- **SSL/TLS Termination**: Automatic HTTPS handling
- **Load Balancing**: Multiple backend instances
- **Security Headers**: XSS protection, HSTS, etc.
- **Rate Limiting**: DDoS protection

### Backup Service (backup)
```yaml
backup:
  # PostgreSQL client for backups
  # Scheduled or manual execution
  # Compressed backup files
  # Retention policies
```

**Usage:**
```bash
# Manual backup
pnpm run docker:backup

# Scheduled backups (in production)
# Configured via cron in the container
```

## Environment Configuration

### Environment Variables
All Docker deployments support comprehensive environment configuration:

#### Database Configuration
```env
POSTGRES_DB=dual_agent_monitor
POSTGRES_USER=acc_user
POSTGRES_PASSWORD=your-secure-password
POSTGRES_INITDB_ARGS=--auth-local=trust --auth-host=md5
DATABASE_URL=postgresql://acc_user:password@postgres:5432/dual_agent_monitor
```

#### Redis Configuration
```env
REDIS_URL=redis://redis:6379
REDIS_PASSWORD=your-redis-password  # Optional
```

#### Application Configuration
```env
NODE_ENV=production
JWT_SECRET=your-32-character-jwt-secret-here
SESSION_SECRET=your-32-character-session-secret-here
WEBHOOK_SECRET=your-webhook-secret-here
```

#### Monitoring Configuration
```env
PORT=4001                    # Backend API port
VITE_API_URL=http://localhost:4001
VITE_WS_URL=ws://localhost:4001
```

### Configuration Files
```bash
# Main environment file
.env                    # Production environment variables

# Docker Compose overrides
docker-compose.override.yml  # Local development overrides

# Application configuration
~/.automatic-claude-code/config.json  # ACC configuration
```

### Environment Templates
```bash
# Copy and customize environment template
cp .env.example .env

# Example .env content:
NODE_ENV=production
POSTGRES_PASSWORD=change-me-in-production
JWT_SECRET=generate-32-character-secret-here
SESSION_SECRET=generate-another-32-character-secret
REDIS_PASSWORD=optional-redis-password
```

## Monitoring with Docker

### Service Health Monitoring
All services include comprehensive health checks:

```bash
# Check all service health
docker-compose ps

# Check specific service health
docker-compose exec postgres pg_isready
docker-compose exec redis redis-cli ping
docker-compose exec monitoring-backend curl -f http://localhost:4001/health
```

### Container Resource Monitoring
```bash
# Real-time resource usage
docker stats

# Service-specific stats
docker stats automatic-claude-code-app acc-postgres acc-redis

# Container logs
pnpm run docker:logs
docker-compose logs -f --tail=100 acc-app
```

### Application Monitoring
The monitoring services provide comprehensive application monitoring:

- **Real-time Dashboard**: http://localhost:6011
- **API Health**: http://localhost:4001/health
- **Database Status**: Integrated PostgreSQL monitoring
- **Cache Status**: Redis performance metrics
- **Application Metrics**: ACC session and agent coordination data

### Log Management
```bash
# View all logs
pnpm run docker:logs

# Follow logs in real-time
docker-compose logs -f

# Service-specific logs
docker-compose logs -f postgres
docker-compose logs -f monitoring-backend

# Log rotation configured in docker-compose.prod.yml:
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
```

## Data Persistence

### Persistent Volumes
Docker Compose creates named volumes for data persistence:

```yaml
volumes:
  postgres_data:    # PostgreSQL data directory
  redis_data:       # Redis persistence files
  acc_config:       # ACC configuration data
```

### Backup Strategies
```bash
# Manual database backup
docker-compose exec postgres pg_dump -U acc_user dual_agent_monitor > backup.sql

# Automatic backup service
pnpm run docker:backup

# Volume backup (entire database)
docker run --rm -v acc_postgres_data:/data -v $(pwd):/backup alpine tar czf /backup/postgres_backup.tar.gz -C /data .

# Configuration backup
docker run --rm -v acc_config:/data -v $(pwd):/backup alpine tar czf /backup/config_backup.tar.gz -C /data .
```

### Data Migration
```bash
# Export data from running container
docker-compose exec postgres pg_dump -U acc_user dual_agent_monitor > export.sql

# Import data to new environment
docker-compose exec -T postgres psql -U acc_user dual_agent_monitor < export.sql

# Volume migration
docker run --rm -v old_postgres_data:/old -v new_postgres_data:/new alpine cp -a /old/. /new/
```

## Backup and Recovery

### Automated Backup Service
The production Docker Compose includes an automated backup service:

```yaml
backup:
  image: postgres:15-alpine
  environment:
    - PGUSER=acc_user
    - PGPASSWORD=${POSTGRES_PASSWORD}
    - PGDATABASE=dual_agent_monitor
    - PGHOST=postgres
  volumes:
    - ./backups:/backups
    - ./scripts/backup.sh:/backup.sh:ro
  command: /backup.sh
```

### Backup Commands
```bash
# Manual backup execution
pnpm run docker:backup

# Schedule backups with cron
# Add to crontab: 0 2 * * * cd /path/to/project && pnpm run docker:backup

# Backup with timestamp
docker-compose -f docker-compose.prod.yml run --rm backup pg_dump -U acc_user dual_agent_monitor > "backup_$(date +%Y%m%d_%H%M%S).sql"
```

### Recovery Procedures
```bash
# Stop application during recovery
docker-compose stop acc-app monitoring-backend monitoring-frontend

# Restore database from backup
docker-compose exec -T postgres psql -U acc_user dual_agent_monitor < backup_20241201_020000.sql

# Restart services
docker-compose start acc-app monitoring-backend monitoring-frontend

# Verify recovery
docker-compose exec postgres psql -U acc_user dual_agent_monitor -c "SELECT COUNT(*) FROM sessions;"
```

### Disaster Recovery
```bash
# Complete environment recreation
docker-compose down -v  # WARNING: Removes all data
cp .env.backup .env
pnpm run docker:prod

# Restore from backup
docker-compose exec -T postgres psql -U acc_user dual_agent_monitor < full_backup.sql

# Verify system health
docker-compose ps
curl -f http://localhost:4001/health
```

## Troubleshooting

### Common Issues

#### Container Won't Start
```bash
# Check container logs
docker-compose logs acc-app

# Common causes:
# - Missing environment variables
# - Port conflicts
# - Volume mount permissions
# - Database connection issues

# Debug with interactive shell
docker-compose run --rm acc-app /bin/sh
```

#### Database Connection Errors
```bash
# Check database status
docker-compose ps postgres
docker-compose logs postgres

# Test database connection
docker-compose exec postgres pg_isready -U acc_user

# Check environment variables
docker-compose exec acc-app printenv | grep DATABASE_URL
```

#### Port Conflicts
```bash
# Check which process is using a port
lsof -i :6011  # macOS/Linux
netstat -ano | findstr :6011  # Windows

# Change ports in docker-compose.yml or .env file
# Or stop conflicting services
```

#### Volume Mount Issues
```bash
# Check volume permissions
ls -la ~/.claude
ls -la ~/.automatic-claude-code

# Fix permissions if needed
sudo chown -R $USER:$USER ~/.claude
sudo chown -R $USER:$USER ~/.automatic-claude-code

# Check Docker volume mounts
docker inspect automatic-claude-code-app | grep -A 10 Mounts
```

### Performance Issues

#### Resource Constraints
```bash
# Check container resource usage
docker stats

# Increase Docker memory limit in Docker Desktop settings
# Or add resource limits to docker-compose.yml:
deploy:
  resources:
    limits:
      cpus: '2'
      memory: 4G
```

#### Database Performance
```bash
# Check database connections
docker-compose exec postgres psql -U acc_user dual_agent_monitor -c "SELECT * FROM pg_stat_activity;"

# Monitor query performance
docker-compose logs postgres | grep "slow query"

# Optimize PostgreSQL settings in docker-compose.yml
```

### Networking Issues

#### Service Communication
```bash
# Test service connectivity
docker-compose exec acc-app ping postgres
docker-compose exec acc-app ping redis

# Check Docker network
docker network ls
docker network inspect automatic-claude-code-network
```

#### External Access
```bash
# Test external access to services
curl -f http://localhost:4001/health
curl -f http://localhost:6011
curl -f http://localhost:6007  # If using persistent monitor

# Check port mappings
docker-compose ps
docker port automatic-claude-code-app
```

### Debugging Commands

#### Container Inspection
```bash
# Enter running container
docker-compose exec acc-app /bin/sh
docker-compose exec postgres /bin/sh

# Inspect container configuration
docker inspect automatic-claude-code-app

# Check container logs
docker logs automatic-claude-code-app --tail=100 -f
```

#### Service Health Checks
```bash
# Manual health check script
#!/bin/bash
echo "Checking ACC services..."

# Application health
if curl -f http://localhost:4001/health > /dev/null 2>&1; then
    echo "✅ Monitoring backend: OK"
else
    echo "❌ Monitoring backend: FAILED"
fi

# Database health
if docker-compose exec -T postgres pg_isready -U acc_user > /dev/null 2>&1; then
    echo "✅ PostgreSQL: OK"
else
    echo "❌ PostgreSQL: FAILED"
fi

# Redis health
if docker-compose exec -T redis redis-cli ping > /dev/null 2>&1; then
    echo "✅ Redis: OK"
else
    echo "❌ Redis: FAILED"
fi
```

#### Reset Everything
```bash
# Complete cleanup and restart
pnpm run docker:stop
pnpm run docker:clean
docker system prune -a --volumes  # WARNING: Removes all Docker data

# Rebuild and restart
pnpm run docker:build
pnpm run docker:prod
```

### Getting Help

#### Log Analysis
```bash
# Comprehensive log collection
mkdir -p debug-logs
docker-compose logs > debug-logs/compose-logs.txt
docker logs automatic-claude-code-app > debug-logs/app-logs.txt
docker system df > debug-logs/docker-system.txt
docker-compose ps > debug-logs/services-status.txt
```

#### Configuration Verification
```bash
# Verify Docker Compose configuration
docker-compose config

# Check environment variables
docker-compose exec acc-app printenv | sort > debug-logs/env-vars.txt

# Export system information
docker version > debug-logs/docker-version.txt
docker-compose version >> debug-logs/docker-version.txt
```

This comprehensive Docker guide provides everything needed to successfully deploy and manage the Automatic Claude Code system in containerized environments, from simple development setups to production deployments with full monitoring and backup capabilities.
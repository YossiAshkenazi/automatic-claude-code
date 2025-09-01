# Full Stack Deployment Guide
## Complete Dual-Agent Monitoring Stack

This guide covers deploying the complete dual-agent monitoring stack with proper networking, service discovery, and end-to-end integration testing.

## 🏗️ Architecture Overview

The full stack includes:

- **Frontend** (React + Nginx): Dashboard UI on port 6011
- **API Server** (Node.js + Express + WebSocket): Backend API on port 4005
- **Database** (PostgreSQL): Data persistence on port 5434
- **Cache** (Redis): Session storage and caching on port 6379
- **Reverse Proxy** (Nginx): Load balancing and routing
- **Admin Tools** (pgAdmin): Database management on port 8082

## 🚀 Quick Start

### Option 1: Automated Deployment (Recommended)

#### Linux/macOS:
```bash
# Deploy complete stack
npm run fullstack:deploy

# Or directly run the script
bash scripts/deploy-full-stack.sh
```

#### Windows:
```powershell
# Deploy complete stack
npm run fullstack:deploy:win

# Or directly run the script
powershell -ExecutionPolicy Bypass -File scripts/deploy-full-stack.ps1
```

### Option 2: Manual Docker Compose

```bash
# Copy environment file
cp .env.full-stack .env

# Deploy the stack
docker-compose -f docker-compose.full-stack.yml up -d

# Check status
docker-compose -f docker-compose.full-stack.yml ps
```

## 🔧 Configuration

### Environment Variables

The stack uses `.env.full-stack` with these key configurations:

```bash
# Database Configuration
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=dual_agent_monitor
POSTGRES_USER=postgres
POSTGRES_PASSWORD=dual_agent_secure_pass_2025

# API Configuration
WEBSOCKET_SERVER_PORT=4005
VITE_WS_URL=ws://localhost:6011/ws
VITE_API_BASE_URL=http://localhost:6011/api

# Frontend Configuration
FRONTEND_PORT=6011

# Network Configuration
NETWORK_NAME=dual-agent-network
```

### Service URLs

After deployment, access services at:

- **Frontend Dashboard**: http://localhost:6011
- **API Health Check**: http://localhost:6011/api/health
- **Direct API Access**: http://localhost:4005/api/health
- **Database**: localhost:5434 (external access)
- **pgAdmin** (optional): http://localhost:8082

## 🔍 Service Discovery & Networking

### Container Communication

The stack uses a custom Docker network (`dual-agent-network`) with these internal hostnames:

- `postgres` → Database server
- `redis` → Cache server
- `api-server` → Backend API
- `frontend` → React frontend
- `nginx` → Reverse proxy

### Network Flow

```
External → Nginx (port 6011) → Frontend (port 80)
                            ↘ API Server (port 4005)
                                      ↘ PostgreSQL (port 5432)
                                      ↘ Redis (port 6379)
```

## 🧪 Testing & Validation

### Automated Testing

```bash
# Run comprehensive networking tests
npm run fullstack:test

# Or directly
bash scripts/test-networking.sh

# Test specific components
bash scripts/test-networking.sh connectivity
bash scripts/test-networking.sh external
```

### Manual Testing

1. **Frontend Access**:
   ```bash
   curl -f http://localhost:6011/
   ```

2. **API Health**:
   ```bash
   curl -f http://localhost:6011/api/health
   ```

3. **Database Connectivity**:
   ```bash
   docker-compose -f docker-compose.full-stack.yml exec postgres pg_isready -U postgres
   ```

4. **WebSocket Connection**:
   - Open browser console at http://localhost:6011
   - Check for WebSocket connection in Network tab

## 📊 Monitoring & Management

### Service Status

```bash
# Check all services
npm run fullstack:status

# View logs
npm run fullstack:logs

# Follow logs for specific service
docker-compose -f docker-compose.full-stack.yml logs -f api-server
```

### Health Checks

The stack includes comprehensive health checks:

- **PostgreSQL**: `pg_isready` checks
- **Redis**: Redis ping
- **API Server**: HTTP health endpoint
- **Frontend**: HTTP response check
- **Nginx**: Proxy health validation

### Resource Monitoring

Each service has resource limits defined:

```yaml
deploy:
  resources:
    limits:
      cpus: '1.0'
      memory: 512M
    reservations:
      cpus: '0.25'
      memory: 128M
```

## 🛠️ Management Commands

### Deployment Management

```bash
# Deploy stack
npm run fullstack:deploy

# Stop all services
npm run fullstack:stop

# Restart services
npm run fullstack:restart

# View status
npm run fullstack:status

# Clean up everything
npm run fullstack:clean
```

### Database Management

```bash
# Access database directly
docker-compose -f docker-compose.full-stack.yml exec postgres psql -U postgres -d dual_agent_monitor

# Start pgAdmin (optional)
docker-compose -f docker-compose.full-stack.yml --profile admin up pgadmin

# Backup database
docker-compose -f docker-compose.full-stack.yml exec postgres pg_dump -U postgres dual_agent_monitor > backup.sql
```

## 🔧 Troubleshooting

### Common Issues

1. **Port Conflicts**:
   ```bash
   # Check port usage
   netstat -an | grep 6011
   netstat -an | grep 4005
   netstat -an | grep 5434
   ```

2. **Container Communication Issues**:
   ```bash
   # Test networking
   npm run fullstack:test
   
   # Check network
   docker network ls
   docker network inspect dual-agent-network
   ```

3. **Service Not Starting**:
   ```bash
   # Check logs
   docker-compose -f docker-compose.full-stack.yml logs service-name
   
   # Check health
   docker-compose -f docker-compose.full-stack.yml ps
   ```

### Network Debugging

```bash
# Test DNS resolution
docker-compose -f docker-compose.full-stack.yml exec nginx nslookup api-server

# Test connectivity
docker-compose -f docker-compose.full-stack.yml exec api-server nc -z postgres 5432

# Test external access
curl -v http://localhost:6011/api/health
```

## 🏭 Production Considerations

### Security

- All services run as non-root users
- Security headers configured in Nginx
- Rate limiting enabled
- CORS properly configured

### Performance

- Connection pooling for database
- Redis caching layer
- Gzip compression in Nginx
- Resource limits prevent resource exhaustion

### Scalability

- Horizontal scaling ready with load balancer
- Stateless API server design
- Database connection pooling
- Redis for distributed sessions

## 📚 Additional Resources

- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [PostgreSQL Docker Documentation](https://hub.docker.com/_/postgres)
- [Nginx Configuration Guide](https://nginx.org/en/docs/)
- [React Production Build](https://create-react-app.dev/docs/production-build/)

## 🆘 Support

For issues with the full-stack deployment:

1. Run networking tests: `npm run fullstack:test`
2. Check service logs: `npm run fullstack:logs`
3. Verify configurations in `.env.full-stack`
4. Review container status: `npm run fullstack:status`

---

**Note**: This deployment creates a complete production-ready monitoring stack with proper networking, security, and observability features.
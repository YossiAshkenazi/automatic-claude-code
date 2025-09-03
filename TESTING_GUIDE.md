# 🧪 Complete Testing Guide - Enhanced Automatic Claude Code

## Quick Start Testing

### 1. Basic CLI Functionality Test
```bash
# Test global 'acc' command
acc --version
acc examples
acc --help

# Test basic task execution
acc run "list files in current directory" -i 1 -v

# Test dual-agent mode
acc run "analyze package.json structure" --dual-agent -i 3 -v
```

### 2. Infrastructure Port Validation
```bash
# Check port availability (should be clear now)
netstat -an | findstr "4005 6011 6007 3001"

# Test monitoring stack startup
cd dual-agent-monitor
pnpm run dev &  # Start frontend (port 6011)

# In new terminal
pnpm run start:server &  # Start backend (port 4005)
```

### 3. Docker Stack Testing
```bash
# Test Docker composition
docker-compose up --build

# Verify services
curl http://localhost:4005/api/health
curl http://localhost:6011  # Frontend should load

# Test with HA configuration
cd dual-agent-monitor/deploy
docker-compose -f docker-compose.ha.yml up --build
```

## 🧪 Feature-Specific Testing

### A. Session Recording System Testing

#### Database Schema Test
```sql
-- Connect to PostgreSQL container
docker exec -it <postgres_container_id> psql -U postgres -d monitoring

-- Verify schema exists
\dt session*
\d session_recordings
\d recording_interactions
```

#### API Testing
```bash
# Test session recording endpoints
curl -X POST http://localhost:4005/api/recordings \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "test-123", "projectName": "test-project"}'

# List recordings
curl http://localhost:4005/api/recordings

# Get specific recording
curl http://localhost:4005/api/recordings/test-123

# Export recording
curl -X POST http://localhost:4005/api/recordings/test-123/export \
  -H "Content-Type: application/json" \
  -d '{"format": "json"}'
```

#### Frontend UI Testing
1. Open http://localhost:6011
2. Navigate to "Session Recording" section
3. Test timeline player controls
4. Try creating annotations and bookmarks
5. Test export functionality with different formats

### B. Test Organization Validation

#### Check Test Structure
```bash
# Verify clean root directory (only 2 test files should remain)
ls -la *.js *.ps1 test* verify* 2>/dev/null || echo "✅ Root is clean!"

# Check organized test structure
ls tests/
ls tests/support/scripts/
ls tests/fixtures/

# Run tests with new structure
pnpm test
pnpm run test:unit
```

#### Verify Test Discovery
```bash
# Test Jest configuration
npx jest --listTests

# Run specific test categories
npx jest tests/unit/
npx jest tests/integration/
```

### C. Configuration Management Testing

#### Verify Config Organization
```bash
# Check config directory structure
ls config/
ls config/production/
ls config/base/

# Verify ecosystem.config.js moved correctly
ls config/production/ecosystem.config.js

# Test PM2 with new location
pm2 start config/production/ecosystem.config.js
pm2 status
pm2 stop all
```

#### Test Environment Loading
```bash
# Verify .env.example has correct ports
cat .env.example | grep PORT

# Test Docker with new config paths
docker-compose config  # Should validate without errors
```

## 🚀 Integration Testing Scenarios

### Scenario 1: Full Dual-Agent Workflow
```bash
# Start monitoring stack
cd dual-agent-monitor && pnpm run dev &
pnpm run start:server &

# Run complex dual-agent task
acc run "implement a simple REST API endpoint" --dual-agent -i 10 -v

# Monitor in real-time at http://localhost:6011
# Check session recording captures everything
```

### Scenario 2: Port Conflict Resolution
```bash
# Try to start services on old conflicting ports (should fail gracefully)
node -e "require('http').createServer().listen(4000, () => console.log('Old port 4000 occupied'))" &

# Start monitoring (should use 4005, no conflict)
cd dual-agent-monitor && pnpm run start:server

# Verify no conflicts
curl http://localhost:4005/api/health
```

### Scenario 3: High Availability Deployment
```bash
# Test HA Docker setup
cd dual-agent-monitor/deploy
docker-compose -f docker-compose.ha.yml up --build

# Test load balancer
curl http://localhost:4005/api/health  # Should route through HAProxy
curl http://localhost:6011  # Frontend should load

# Check HAProxy stats (if configured)
curl http://localhost:8404/stats
```

## 🔍 Validation Checklist

### ✅ Core Functionality
- [ ] `acc --version` shows correct version
- [ ] `acc run` executes basic tasks successfully  
- [ ] `--dual-agent` mode works without errors
- [ ] Build process completes: `pnpm run build`
- [ ] No TypeScript errors or warnings

### ✅ Infrastructure  
- [ ] Ports standardized: 4005 (API), 6011 (Dashboard), 6007 (Monitoring)
- [ ] No port conflicts when starting services
- [ ] Docker Compose starts all services successfully
- [ ] Health checks pass: `curl http://localhost:4005/api/health`

### ✅ Session Recording
- [ ] Database schema created and accessible
- [ ] API endpoints respond correctly
- [ ] Timeline UI loads and functions
- [ ] Recording/playback controls work
- [ ] Export functionality generates files
- [ ] Annotations and bookmarks save properly

### ✅ Test Organization
- [ ] Root directory is clean (no scattered test files)  
- [ ] Tests directory has proper structure
- [ ] Test discovery works: `npx jest --listTests`
- [ ] Test scripts run: `pnpm test`
- [ ] All moved files maintain functionality

### ✅ Configuration Management
- [ ] Config files moved to organized structure
- [ ] All references updated (no broken imports)
- [ ] PM2 works with new ecosystem.config.js location
- [ ] Docker volumes mount correct config paths
- [ ] Environment variables load properly

## 🐛 Troubleshooting Common Issues

### Issue: "acc command not found"
```bash
# Solution: Re-link the CLI
cd /path/to/automatic-claude-code
npm link
```

### Issue: Port conflicts still occurring
```bash
# Check what's using ports
netstat -ano | findstr "4005\|6011\|6007"

# Kill conflicting processes
taskkill /F /PID <process_id>
```

### Issue: Docker services won't start
```bash
# Check Docker logs
docker-compose logs

# Rebuild with no cache
docker-compose up --build --force-recreate
```

### Issue: Tests not finding files
```bash
# Clear Jest cache
npx jest --clearCache

# Verify test patterns in package.json
cat package.json | grep -A 5 '"test"'
```

### Issue: Session recording not working
```bash
# Check PostgreSQL connection
docker exec -it <postgres_container> psql -U postgres -d monitoring -c "\dt"

# Verify API server logs
cd dual-agent-monitor && pnpm run start:server
# Check console for database connection errors
```

## 📊 Performance Testing

### Load Testing Session Recording
```bash
# Use curl to create multiple sessions
for i in {1..10}; do
  curl -X POST http://localhost:4005/api/recordings \
    -H "Content-Type: application/json" \
    -d "{\"sessionId\": \"load-test-$i\", \"projectName\": \"load-test\"}"
done

# Test concurrent exports
for i in {1..5}; do
  curl -X POST http://localhost:4005/api/recordings/load-test-$i/export \
    -H "Content-Type: application/json" \
    -d '{"format": "json"}' &
done
```

### Agent Performance Testing
```bash
# Run multiple dual-agent tasks concurrently
acc run "analyze this project structure" --dual-agent -i 5 &
acc run "suggest code improvements" --dual-agent -i 5 &
acc run "create documentation outline" --dual-agent -i 5 &

# Monitor resource usage
cd dual-agent-monitor && open http://localhost:6011
# Watch real-time metrics and coordination
```

## 🎯 Success Criteria

Your system is fully operational when:

1. **✅ All validation checks pass**
2. **✅ No port conflicts exist**  
3. **✅ Docker stack runs cleanly**
4. **✅ Session recording captures and plays back**
5. **✅ Tests are organized and executable**
6. **✅ Configuration is properly structured**
7. **✅ Dual-agent mode works with monitoring**
8. **✅ Export functionality generates valid files**

---

**Quick Validation Command:**
```bash
# One-liner to test everything
pnpm run build && acc --version && curl -s http://localhost:4005/api/health && echo "🎉 System is ready!"
```
# Dual-Agent Monitoring Test Scripts

This directory contains comprehensive test scripts for verifying the dual-agent monitoring dashboard functionality.

## 🚀 Quick Start

### Run Complete Test Suite
```bash
node run-full-test.js                    # Complete test suite
node run-full-test.js --fast             # Quick test with reduced delays  
node run-full-test.js --verbose          # Detailed logging
```

### Individual Test Scripts

#### Prerequisites & Setup
```bash
node verify-monitoring-setup.js          # Check if services are running
```

#### Main Test
```bash
node test-dual-agent-session.js          # Complete dual-agent simulation
node test-dual-agent-session.js --fast   # Quick test mode
node test-dual-agent-session.js --debug  # Verbose logging
```

#### Data Verification  
```bash
node check-dashboard-data.js             # Check API data availability
node get-session-details.js              # Detailed session information
node check-api-endpoints.js              # Test all API endpoints
```

## 📋 Test Scripts Overview

### `run-full-test.js` - Complete Test Suite
- ✅ Runs all tests in sequence
- ✅ Verifies prerequisites and setup
- ✅ Executes dual-agent simulation
- ✅ Validates dashboard data
- ✅ Generates comprehensive report

### `test-dual-agent-session.js` - Main Simulation
- 🧠 **Manager Planning**: Task analysis, work item decomposition
- ⚡ **Worker Execution**: Implementation progress tracking
- ⚠️  **Error Recovery**: Dependency conflict resolution  
- 🔍 **Quality Gates**: Validation and scoring
- 🎉 **Completion**: Final summary and metrics

**Events Generated**: 19 monitoring events across 6 workflow phases  
**Duration**: ~30 seconds (standard) / ~10 seconds (fast mode)  
**WebSocket**: Real-time updates to dashboard

### `verify-monitoring-setup.js` - Prerequisites Checker
- 📁 Directory structure validation
- 📦 Node modules and dependencies  
- 🌐 Service availability (ports 4001, 6011)
- 💾 Database connectivity check
- 🔧 Setup instructions for missing components

### Data Verification Scripts
- **`get-session-details.js`**: Detailed session analysis with event breakdown
- **`check-dashboard-data.js`**: API health and data availability  
- **`check-api-endpoints.js`**: All endpoint functionality testing

## 🎯 What Gets Tested

### Dual-Agent Workflow
- ✅ Manager strategic planning and oversight
- ✅ Worker task execution and progress reporting
- ✅ Inter-agent coordination and handoffs (3 handoffs tested)
- ✅ Error detection and recovery mechanisms
- ✅ Quality validation and scoring
- ✅ Session completion and summary generation

### Event Types Coverage
- ✅ `MANAGER_TASK_ASSIGNMENT` - Work item delegation
- ✅ `WORKER_PROGRESS_UPDATE` - Implementation updates  
- ✅ `MANAGER_WORKER_HANDOFF` - Coordination events
- ✅ `MANAGER_QUALITY_CHECK` - Validation and scoring
- ✅ `WORKFLOW_TRANSITION` - Phase changes
- ✅ `AGENT_COORDINATION` - Strategic coordination

### Technical Infrastructure  
- ✅ WebSocket real-time communication
- ✅ REST API endpoints and data storage
- ✅ In-memory database functionality
- ✅ Dashboard UI data display
- ✅ Session persistence and retrieval

## 📊 Expected Results

### Successful Test Output
```
✅ Total events sent: 19
✅ Test duration: 0.5 minutes  
✅ Errors encountered: 0
✅ WebSocket messages received: 39
✅ Session completion: 100%
```

### Dashboard Verification
- **Session List**: Test session visible with 19 messages
- **Progress Tracking**: 0% → 100% completion shown
- **Event Timeline**: All workflow phases displayed
- **Quality Metrics**: Performance scores and analytics
- **Error Recovery**: Resolved conflict status

## 🌐 Dashboard Access

After running tests, access the dashboard at:

- **Main Dashboard**: http://localhost:6011
- **Session List**: http://localhost:6011/sessions  
- **Analytics**: http://localhost:6011/analytics
- **API Base**: http://localhost:4001/api

## 🔧 Troubleshooting

### Services Not Running
```bash
# Start monitoring services
cd dual-agent-monitor && pnpm install
cd dual-agent-monitor && pnpm run dev        # Both API + Frontend
# OR separately:
cd dual-agent-monitor && pnpm run server:dev # API only
cd dual-agent-monitor && pnpm run client:dev # Frontend only
```

### Port Conflicts
- API Server should run on port 4001
- Frontend should run on port 6011  
- Check with: `netstat -an | findstr ":4001\|:6011"`

### Database Issues
Tests use in-memory database by default. For production:
- Set up PostgreSQL on port 5434
- Configure connection in `.env` file

## 📖 Documentation

- **`DUAL-AGENT-TEST-SUMMARY.md`** - Detailed test results and analysis
- **`CLAUDE.md`** - Complete project documentation  
- **Monitoring README** - `dual-agent-monitor/README.md`

## 🎉 Success Criteria

The test suite passes when:
- ✅ All 19 monitoring events successfully sent
- ✅ WebSocket connection established and receiving updates
- ✅ Session data visible in dashboard API endpoints  
- ✅ Complete workflow from planning to completion tracked
- ✅ Error recovery scenario successfully handled
- ✅ Quality validation scores recorded and displayed
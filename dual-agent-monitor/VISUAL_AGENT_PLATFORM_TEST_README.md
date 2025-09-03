# Visual Agent Platform Playwright Test Suite

## Overview
This test suite validates the complete user workflow for the Visual Agent Management Platform using Playwright.

## Test Coverage
- Dashboard Initial Load
- Agent Management UI 
- Agent Creation Process
- Real-time Status Updates
- WebSocket Connection Verification

## Running Tests
```bash
pnpm run test:visual-agent
```

## Test Artifacts
- Screenshots saved in `test-results/`
- HTML report generated in `test-results/report/`

## Requirements
- Playwright
- Running dashboard at http://localhost:6011
- Properly configured React dashboard with test attributes

## Validation Criteria
✅ Dashboard Loads Without Errors
✅ Agent Creation UI Functional
✅ Agent Creation Process Completes
✅ Real-time Status Updates Visible
✅ WebSocket Connection Stable

## Troubleshooting
- Ensure dashboard is running before test
- Check browser console for any JavaScript errors
- Verify test data attributes are present in components

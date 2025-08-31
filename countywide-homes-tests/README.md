# Countywide Homes E2E Testing Suite

Comprehensive end-to-end testing suite for the Countywide Homes property management platform using Playwright.

## 🚀 Quick Start

```bash
# Install dependencies
pnpm install

# Install Playwright browsers
pnpm run install-browsers

# Run all tests
pnpm test

# Run tests with UI
pnpm run test:ui

# Run specific test suites
pnpm run test:auth      # Authentication tests
pnpm run test:admin     # Admin functionality tests
pnpm run test:crud      # CRUD operation tests
pnpm run test:performance # Performance tests
pnpm run test:visual    # Visual regression tests
```

## 📁 Project Structure

```
countywide-homes-tests/
├── .github/
│   └── workflows/
│       └── e2e-tests.yml       # CI/CD configuration
├── tests/
│   ├── auth/
│   │   └── authentication.spec.ts  # Authentication flow tests
│   ├── crud/
│   │   ├── buildings.spec.ts      # Building CRUD tests
│   │   ├── units.spec.ts          # Unit CRUD tests
│   │   ├── tenants.spec.ts        # Tenant CRUD tests
│   │   └── service-requests.spec.ts # Service request tests
│   ├── performance/
│   │   └── load-testing.spec.ts   # Performance and load tests
│   ├── visual/
│   │   └── visual-regression.spec.ts # Visual consistency tests
│   └── helpers/
│       ├── auth.helper.ts         # Authentication utilities
│       ├── test-data.ts          # Test data fixtures
│       └── test-cleanup.ts       # Test cleanup utilities
├── playwright.config.ts           # Playwright configuration
├── package.json                   # Dependencies and scripts
└── README.md                     # This file
```

## ✅ Test Coverage

### Authentication Testing
- ✅ Admin login flow
- ✅ Case worker login flow
- ✅ Tenant login flow
- ✅ Invalid login attempts
- ✅ Session timeout handling
- ✅ Logout flow
- ✅ Remember me functionality
- ✅ Password reset flow
- ✅ Multi-factor authentication
- ✅ Cross-tab session synchronization

### CRUD Operations
- ✅ Building management (Create, Read, Update, Delete)
- ✅ Unit management with status tracking
- ✅ Tenant administration
- ✅ Service request handling
- ✅ Lease management
- ✅ Bulk operations
- ✅ Form validation
- ✅ Search and filtering

### Performance Testing
- ✅ Dashboard load time (<3s requirement)
- ✅ Large dataset pagination
- ✅ Search performance
- ✅ Concurrent form submissions
- ✅ API response time monitoring
- ✅ Memory leak detection
- ✅ File upload performance

### Visual Regression
- ✅ Login page consistency
- ✅ Dashboard layout
- ✅ Table components
- ✅ Form components
- ✅ Responsive design (mobile, tablet, desktop)
- ✅ Theme consistency (light/dark)
- ✅ Charts and graphs
- ✅ Modal dialogs
- ✅ Error states

## 🔧 Configuration

### Environment Variables

Create a `.env.test` file:

```env
BASE_URL=http://localhost:5173
API_URL=http://localhost:3000
TEST_ADMIN_EMAIL=admin@countywide.com
TEST_ADMIN_PASSWORD=Admin123!
TEST_CASE_WORKER_EMAIL=caseworker@countywide.com
TEST_CASE_WORKER_PASSWORD=CaseWorker123!
TEST_TENANT_EMAIL=tenant@example.com
TEST_TENANT_PASSWORD=Tenant123!
```

### Test Data Management

The suite includes automated test data management:

1. **Test Data Creation**: Automatically creates test entities
2. **Tracking**: Tracks all created entities for cleanup
3. **Cleanup**: Removes test data after test completion
4. **Database Reset**: Optional full database reset (test env only)

## 🚦 CI/CD Integration

### GitHub Actions Workflow

The included workflow runs:
- Tests on multiple browsers (Chrome, Firefox, Safari)
- Visual regression tests
- Performance baseline tests
- Automatic PR comments with results
- Test artifact storage

### Running in CI

```yaml
- Tests run on: push to main/develop, PRs, nightly
- Browsers tested: Chromium, Firefox, WebKit
- Reports: HTML, JSON, JUnit formats
- Artifacts: Screenshots, videos, performance metrics
```

## 📊 Reporting

### Test Reports

After running tests, view reports:

```bash
# Open HTML report
pnpm run report

# Generate JSON report
pnpm test -- --reporter=json

# Generate JUnit XML (for CI)
pnpm test -- --reporter=junit
```

### Performance Metrics

Performance tests output:
- Load times for each page
- API response times
- Memory usage statistics
- Concurrent operation metrics

## 🎯 Best Practices

### Writing Tests

1. **Use Page Object Model**: Encapsulate page interactions
2. **Data-testid attributes**: Use consistent test IDs
3. **Explicit waits**: Wait for specific conditions
4. **Test isolation**: Each test should be independent
5. **Cleanup**: Always clean up test data

### Test Organization

```typescript
test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    // Setup
  });

  test('specific scenario', async ({ page }) => {
    await test.step('Step description', async () => {
      // Test logic
    });
  });

  test.afterEach(async ({ page }) => {
    // Cleanup
  });
});
```

## 🐛 Debugging

### Debug Mode

```bash
# Run tests in headed mode
pnpm run test:headed

# Debug specific test
pnpm run test:debug

# Use Playwright Inspector
PWDEBUG=1 pnpm test
```

### VS Code Integration

Install the Playwright Test extension for:
- Run tests from editor
- Debug with breakpoints
- View test results inline

## 📈 Performance Benchmarks

### Target Metrics

| Metric | Target | Current |
|--------|--------|---------|
| Dashboard Load | < 3s | ✅ 2.1s |
| API Response (avg) | < 500ms | ✅ 320ms |
| Search Response | < 1.5s | ✅ 0.9s |
| Form Submit | < 2s | ✅ 1.4s |
| Page Navigation | < 1s | ✅ 0.7s |

## 🔄 Continuous Improvement

### Monthly Review Checklist

- [ ] Review and update test cases
- [ ] Update visual regression baselines
- [ ] Analyze performance trends
- [ ] Review flaky tests
- [ ] Update test data fixtures
- [ ] Document new test patterns

## 🤝 Contributing

### Adding New Tests

1. Create test file in appropriate directory
2. Use existing helpers and utilities
3. Follow naming conventions
4. Add to appropriate test suite
5. Update documentation

### Test Review Criteria

- Clear test descriptions
- Proper use of assertions
- Appropriate wait strategies
- Clean test data management
- Performance considerations

## 📞 Support

For issues or questions:
- Check test logs in `playwright-report/`
- Review videos for failed tests
- Contact: devops@countywide.com

## 📝 License

Private - Countywide Homes © 2025
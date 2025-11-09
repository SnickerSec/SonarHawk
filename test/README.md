# SonarHawk Test Suite

This directory contains comprehensive tests for the SonarHawk project.

## Test Structure

```
test/
├── client.test.js       # SonarClient class unit tests
├── collectors.test.js   # Data collector tests
├── integration.test.js  # End-to-end integration tests
└── README.md           # This file
```

## Running Tests

### Run all tests
```bash
npm test
```

### Run tests with coverage
```bash
npm run test:coverage
```

### Run tests in watch mode (for development)
```bash
npm run test:watch
```

### Generate LCOV coverage report
```bash
npm run test:lcov
```

## Test Categories

### Unit Tests

**client.test.js** - Tests for the SonarClient class:
- Constructor and initialization
- Authentication (Bearer token and username/password)
- HTTP request handling (GET, POST)
- Error handling and retries
- Caching mechanism
- Proxy support
- Version detection

**collectors.test.js** - Tests for data collectors:
- Rules collector (pagination, filtering)
- Issues collector (branch/PR filtering, statuses)
- Hotspots collector (severity levels)
- Quality gate collector
- Coverage metrics collector
- New code period collector
- Error handling for all collectors

### Integration Tests

**integration.test.js** - End-to-end tests:
- Full report generation workflow
- Branch and PR analysis
- Theme customization
- Error recovery
- Version compatibility (7.9, 8.x, 10.x)

## Test Dependencies

- **Mocha**: Test framework
- **Chai**: Assertion library
- **Sinon**: Spies, stubs, and mocks
- **Nock**: HTTP mocking for API calls
- **NYC**: Code coverage tool

## Writing New Tests

### Example Unit Test

```javascript
import { describe, it } from 'mocha';
import { expect } from 'chai';

describe('MyFeature', () => {
  it('should do something', () => {
    const result = myFunction();
    expect(result).to.equal(expectedValue);
  });
});
```

### Example API Mock

```javascript
import nock from 'nock';

nock('https://sonar.example.com')
  .get('/api/system/status')
  .reply(200, { version: '10.0.0' });
```

## Coverage Goals

Current coverage thresholds (configured in `.nycrc`):
- Lines: 60%
- Statements: 60%
- Functions: 60%
- Branches: 50%

Target coverage for future:
- Lines: 80%
- Statements: 80%
- Functions: 80%
- Branches: 75%

## Continuous Integration

Tests are automatically run on:
- Every pull request
- Every push to main/master branch
- Before release builds

## Debugging Tests

### Run a specific test file
```bash
npx mocha test/client.test.js
```

### Run a specific test
```bash
npx mocha test/client.test.js --grep "should authenticate with bearer token"
```

### Enable debug output
```bash
DEBUG=* npm test
```

## Known Limitations

1. Some tests mock HTTP responses and may not catch all real-world scenarios
2. Integration tests require full API endpoint mocking
3. File system tests use /tmp directory (may need adjustment for Windows)

## Contributing

When adding new features:
1. Write tests first (TDD approach)
2. Ensure all tests pass: `npm test`
3. Check coverage: `npm run test:coverage`
4. Add new test files for new modules
5. Update this README if test structure changes

## Troubleshooting

### Tests fail with "ECONNREFUSED"
- Ensure nock mocks are properly set up
- Check that no real HTTP requests are being made

### Coverage reports not generated
- Run `npm run test:coverage` instead of `npm test`
- Check that .nycrc configuration is valid

### Timeout errors
- Increase timeout with `this.timeout(5000)` in test
- Default is 2000ms for mocha

## Future Improvements

- [ ] Add web UI component tests (React Testing Library)
- [ ] Add E2E tests with real SonarQube instance (optional)
- [ ] Add performance benchmarks
- [ ] Add mutation testing
- [ ] Increase coverage to 80%+

# Testing Guide for CodeGuard

This document provides a comprehensive guide to testing CodeGuard.

## Table of Contents

- [Quick Start](#quick-start)
- [Test Structure](#test-structure)
- [Running Tests](#running-tests)
- [Writing Tests](#writing-tests)
- [Continuous Integration](#continuous-integration)
- [Coverage Goals](#coverage-goals)

## Quick Start

```bash
# Install dependencies (includes test dependencies)
npm install

# Run all tests
npm test

# Run tests with coverage report
npm run test:coverage

# Run tests in watch mode (useful during development)
npm run test:watch
```

## Test Structure

The test suite is organized into three main categories:

### 1. Unit Tests

Located in `test/client.test.js` - Tests individual components in isolation:

- **SonarClient class**
  - Constructor validation
  - Authentication mechanisms (Bearer token, username/password)
  - HTTP request handling
  - Error handling and retries
  - Response caching
  - Proxy configuration
  - Version detection

### 2. Collector Tests

Located in `test/collectors.test.js` - Tests data collection from SonarQube API:

- **Rules Collector**: Fetching and paginating rules
- **Issues Collector**: Fetching vulnerabilities with filters
- **Hotspots Collector**: Security hotspot detection
- **Quality Gate Collector**: QG status retrieval
- **Coverage Collector**: Code coverage metrics
- **New Code Period Collector**: Delta analysis setup

### 3. Integration Tests

Located in `test/integration.test.js` - Tests complete workflows:

- Full report generation
- Branch-specific analysis
- Pull request analysis
- Theme customization
- Error recovery
- Version compatibility (SonarQube 7.9, 8.x, 10.x)

## Running Tests

### Basic Commands

```bash
# Run all tests with standard output
npm test

# Run tests with detailed coverage report
npm run test:coverage

# Run tests in watch mode (re-runs on file changes)
npm run test:watch

# Generate LCOV coverage for CI/CD
npm run test:lcov
```

### Running Specific Tests

```bash
# Run a specific test file
npx mocha test/client.test.js

# Run tests matching a pattern
npx mocha test/*.test.js --grep "authentication"

# Run a single test suite
npx mocha test/client.test.js --grep "Constructor"
```

### Debug Mode

```bash
# Enable verbose output
DEBUG=* npm test

# Run mocha with inspector (for debugging)
npx mocha --inspect-brk test/client.test.js
```

## Writing Tests

### Test Template

```javascript
import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';
import nock from 'nock';

describe('Feature Name', () => {
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    nock.cleanAll();
  });

  afterEach(() => {
    sandbox.restore();
    nock.cleanAll();
  });

  describe('Specific Functionality', () => {
    it('should do something specific', () => {
      // Arrange
      const input = 'test';

      // Act
      const result = myFunction(input);

      // Assert
      expect(result).to.equal('expected output');
    });
  });
});
```

### Mocking HTTP Requests

CodeGuard tests use [nock](https://github.com/nock/nock) to mock HTTP requests:

```javascript
import nock from 'nock';

// Mock a successful API call
nock('https://sonar.example.com')
  .get('/api/system/status')
  .reply(200, { version: '10.0.0' });

// Mock an error
nock('https://sonar.example.com')
  .get('/api/issues/search')
  .reply(500, { error: 'Internal server error' });

// Mock with query parameters
nock('https://sonar.example.com')
  .get('/api/issues/search')
  .query({ componentKeys: 'test:project' })
  .reply(200, { issues: [] });

// Mock with headers
nock('https://sonar.example.com')
  .get('/api/authentication/validate')
  .matchHeader('Authorization', /^Bearer /)
  .reply(200, { valid: true });
```

### Assertion Examples

```javascript
import { expect } from 'chai';

// Equality
expect(result).to.equal('expected');
expect(result).to.deep.equal({ key: 'value' });

// Type checks
expect(result).to.be.a('string');
expect(result).to.be.an('object');

// Existence
expect(result).to.exist;
expect(result).to.not.be.null;
expect(result).to.not.be.undefined;

// Collections
expect(array).to.have.length(5);
expect(array).to.include('item');
expect(array).to.have.members(['a', 'b', 'c']);

// Properties
expect(obj).to.have.property('key');
expect(obj).to.have.property('key', 'value');

// Errors
expect(() => myFunction()).to.throw();
expect(() => myFunction()).to.throw(Error, 'message');

// Async
await expect(promise).to.eventually.equal('result');
await expect(promise).to.be.rejected;
```

## Test Best Practices

### 1. Follow AAA Pattern

```javascript
it('should calculate sum correctly', () => {
  // Arrange - Set up test data
  const a = 5;
  const b = 3;

  // Act - Execute the function
  const result = add(a, b);

  // Assert - Verify the result
  expect(result).to.equal(8);
});
```

### 2. Use Descriptive Test Names

```javascript
// ✅ Good
it('should throw error when URL is missing', () => {});
it('should cache API responses for 5 minutes', () => {});

// ❌ Bad
it('test1', () => {});
it('works', () => {});
```

### 3. One Assertion Per Test (when possible)

```javascript
// ✅ Good
it('should return user name', () => {
  expect(user.name).to.equal('John');
});

it('should return user email', () => {
  expect(user.email).to.equal('john@example.com');
});

// ⚠️ Acceptable for related assertions
it('should create user with correct properties', () => {
  expect(user).to.have.property('name');
  expect(user).to.have.property('email');
  expect(user).to.have.property('id');
});
```

### 4. Clean Up After Tests

```javascript
afterEach(() => {
  // Restore stubs and spies
  sinon.restore();

  // Clean nock interceptors
  nock.cleanAll();

  // Delete test files
  if (fs.existsSync(testFile)) {
    fs.unlinkSync(testFile);
  }
});
```

## Coverage Goals

Current coverage thresholds (defined in `.nycrc`):

| Metric     | Minimum | Target |
|------------|---------|--------|
| Lines      | 60%     | 80%    |
| Statements | 60%     | 80%    |
| Functions  | 60%     | 80%    |
| Branches   | 50%     | 75%    |

### Viewing Coverage

```bash
# Generate HTML coverage report
npm run test:coverage

# Open coverage report in browser
open coverage/index.html
```

### Coverage Report Locations

- **HTML Report**: `coverage/index.html`
- **LCOV Report**: `coverage/lcov.info`
- **Text Summary**: Displayed in terminal after running `npm run test:coverage`

## Continuous Integration

Tests run automatically on GitHub Actions for:

- Every push to `master`, `main`, or `develop`
- Every pull request to `master` or `main`

### CI Workflow

The CI pipeline (`github/workflows/test.yml`) does the following:

1. **Test on Multiple Node Versions**: 18.x and 20.x
2. **Run Full Test Suite**: All unit, collector, and integration tests
3. **Generate Coverage**: Creates coverage reports
4. **Upload to Codecov**: Shares coverage metrics (optional)
5. **Archive Reports**: Saves coverage as artifacts

### Local CI Simulation

```bash
# Simulate CI environment locally
npm ci  # Clean install
npm test
npm run test:coverage
```

## Troubleshooting

### Common Issues

#### Tests Hang or Timeout

```bash
# Increase timeout in specific test
it('slow test', function() {
  this.timeout(10000); // 10 seconds
  // ... test code
});
```

#### Network Request Errors

```bash
# Ensure nock mocks are set up before the request
nock('https://sonar.example.com')
  .get('/api/endpoint')
  .reply(200, { data: 'value' });

# Check if nock interceptor was called
expect(nock.isDone()).to.be.true;
```

#### Coverage Not Generated

```bash
# Ensure .nycrc exists and is valid JSON
cat .nycrc

# Run with explicit config
npx nyc --reporter=html --reporter=text mocha test/**/*.test.js
```

#### Module Import Errors

```bash
# Ensure "type": "module" is in package.json
# Use .js extension in imports
import { myFunction } from './myModule.js';
```

## Future Improvements

- [ ] Add React component tests for web UI
- [ ] Add E2E tests with Playwright
- [ ] Add performance benchmarks
- [ ] Add mutation testing
- [ ] Increase coverage to 80%+
- [ ] Add visual regression tests

## Resources

- [Mocha Documentation](https://mochajs.org/)
- [Chai Assertion Library](https://www.chaijs.com/)
- [Sinon Spies/Stubs/Mocks](https://sinonjs.org/)
- [Nock HTTP Mocking](https://github.com/nock/nock)
- [NYC Coverage](https://istanbul.js.org/)

## Contributing

When contributing:

1. Write tests for new features
2. Ensure all tests pass: `npm test`
3. Maintain or improve coverage: `npm run test:coverage`
4. Follow existing test patterns
5. Update this guide if test patterns change

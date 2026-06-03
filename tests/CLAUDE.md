# Testing (tests/)

This file contains patterns specific to testing in the `tests/` directory.

## PHP Unit Tests (PHPUnit)

- **Location**: `tests/phpunit/`
- **Key Files**: `ABCalcTest.php`, `GlobalBlockTest.php`, `bootstrap.php`
- **Framework**: WordPress unit test integration with mock functions

## Running Tests

```bash
# Run all tests
vendor/bin/phpunit tests/phpunit/

# Run A/B tests only
./run-ab-tests.sh

# Specific test
vendor/bin/phpunit tests/phpunit/ABCalcTest.php::test_clear_winner_gets_high_confidence
```

## E2E Tests (Playwright)

- Block editor integration testing
- Analytics dashboard functionality
- Configuration: `tests/e2e/playwright.config.ts`

## Configuration

- `phpcs.xml.dist` - PHP CodeSniffer rules (WordPress-VIP-Go)
- `phpunit.xml.dist` - PHPUnit configuration

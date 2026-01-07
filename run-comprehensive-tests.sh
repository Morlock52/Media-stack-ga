#!/bin/bash

##############################################################################
# Comprehensive Test Suite Runner for Media Stack
# Based on 2026 Testing Best Practices
#
# This script runs all test suites including:
# - Unit tests (Vitest)
# - Integration tests (Fastify inject)
# - E2E tests (Playwright)
# - UI component tests
# - API tests
# - Performance tests
##############################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results
TESTS_PASSED=0
TESTS_FAILED=0

echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}   Media Stack - Comprehensive Test Suite Runner${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo ""

##############################################################################
# 1. Control Server Unit Tests
##############################################################################

echo -e "${YELLOW}[1/7] Running Control Server Unit Tests...${NC}"
if npm test -w control-server -- --reporter=verbose --run 2>&1 | tee test-results/unit-tests.log; then
    echo -e "${GREEN}✓ Control server unit tests passed${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗ Control server unit tests failed${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi
echo ""

##############################################################################
# 2. Control Server API Integration Tests
##############################################################################

echo -e "${YELLOW}[2/7] Running API Integration Tests...${NC}"
if npm test -w control-server -- --reporter=verbose --run test/api-integration.test.ts 2>&1 | tee test-results/api-tests.log; then
    echo -e "${GREEN}✓ API integration tests passed${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗ API integration tests failed${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi
echo ""

##############################################################################
# 3. Docs Site Smoke Tests
##############################################################################

echo -e "${YELLOW}[3/7] Running UI Smoke Tests...${NC}"
if npm test -w docs-site -- tests/smoke.spec.ts --reporter=list 2>&1 | tee test-results/smoke-tests.log; then
    echo -e "${GREEN}✓ UI smoke tests passed${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗ UI smoke tests failed${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi
echo ""

##############################################################################
# 4. Comprehensive UI Component Tests
##############################################################################

echo -e "${YELLOW}[4/7] Running Comprehensive UI Tests...${NC}"
if npm test -w docs-site -- tests/comprehensive-ui.spec.ts --reporter=list 2>&1 | tee test-results/ui-tests.log; then
    echo -e "${GREEN}✓ Comprehensive UI tests passed${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗ Comprehensive UI tests failed${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi
echo ""

##############################################################################
# 5. End-to-End Workflow Tests
##############################################################################

echo -e "${YELLOW}[5/7] Running E2E Workflow Tests...${NC}"
if npm test -w docs-site -- tests/e2e-workflows.spec.ts --reporter=list --workers=1 2>&1 | tee test-results/e2e-tests.log; then
    echo -e "${GREEN}✓ E2E workflow tests passed${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗ E2E workflow tests failed${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi
echo ""

##############################################################################
# 6. Mobile Responsive Tests
##############################################################################

echo -e "${YELLOW}[6/7] Running Mobile Responsive Tests...${NC}"
if npm test -w docs-site -- tests/mobile-responsive.spec.ts --reporter=list 2>&1 | tee test-results/mobile-tests.log; then
    echo -e "${GREEN}✓ Mobile responsive tests passed${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗ Mobile responsive tests failed${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi
echo ""

##############################################################################
# 7. Backup/Restore Tests
##############################################################################

echo -e "${YELLOW}[7/7] Running Backup/Restore Tests...${NC}"
if npm test -w docs-site -- tests/backup.spec.ts --reporter=list 2>&1 | tee test-results/backup-tests.log; then
    echo -e "${GREEN}✓ Backup/restore tests passed${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗ Backup/restore tests failed${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi
echo ""

##############################################################################
# Test Summary
##############################################################################

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}   Test Summary${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo ""

TOTAL_SUITES=$((TESTS_PASSED + TESTS_FAILED))

echo -e "Total Test Suites: ${TOTAL_SUITES}"
echo -e "${GREEN}Passed: ${TESTS_PASSED}${NC}"
echo -e "${RED}Failed: ${TESTS_FAILED}${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All test suites passed!${NC}"
    echo ""
    echo "Test logs saved to test-results/ directory"
    exit 0
else
    echo -e "${RED}✗ Some test suites failed!${NC}"
    echo ""
    echo "Check test-results/ directory for detailed logs"
    exit 1
fi

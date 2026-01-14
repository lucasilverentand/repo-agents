#!/bin/bash

# Comprehensive test suite for repo-agents
set -e

echo "==========================================="
echo "  repo-agents Test Suite"
echo "==========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

success() {
    echo -e "${GREEN}✓${NC} $1"
}

error() {
    echo -e "${RED}✗${NC} $1"
}

info() {
    echo -e "${YELLOW}ℹ${NC} $1"
}

# Test counter
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

run_test() {
    TESTS_RUN=$((TESTS_RUN + 1))
    echo ""
    info "Test $TESTS_RUN: $1"

    if eval "$2"; then
        success "$1"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        error "$1"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

echo "1. Building Project"
echo "-------------------------------------------"
if bun run build > /dev/null 2>&1; then
    success "Build successful"
else
    error "Build failed"
    exit 1
fi

echo ""
echo "2. CLI Tests"
echo "-------------------------------------------"

run_test "CLI help command" "bun dist/index.js --help > /dev/null"
run_test "CLI version command" "bun dist/index.js --version > /dev/null"

echo ""
echo "3. Validation Tests"
echo "-------------------------------------------"

run_test "Validate issue-triage example" \
    "bun dist/index.js validate examples/issue-triage.md > /dev/null 2>&1"

run_test "Validate pr-review example" \
    "bun dist/index.js validate examples/pr-review.md > /dev/null 2>&1"

run_test "Validate daily-summary example" \
    "bun dist/index.js validate examples/daily-summary.md > /dev/null 2>&1"

run_test "Validate stale-issues example" \
    "bun dist/index.js validate examples/stale-issues.md > /dev/null 2>&1"

echo ""
echo "4. Compilation Tests"
echo "-------------------------------------------"

# Create temp directory for compilation tests
TEMP_DIR=$(mktemp -d)
mkdir -p "$TEMP_DIR/.github/agents"
cp examples/issue-triage.md "$TEMP_DIR/.github/agents/"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

run_test "Compile with dry-run" \
    "cd $TEMP_DIR && bun '$SCRIPT_DIR/dist/index.js' compile --dry-run .github/agents/issue-triage.md > /dev/null 2>&1 && cd '$SCRIPT_DIR'"

run_test "Compile to workflows directory" \
    "cd $TEMP_DIR && bun '$SCRIPT_DIR/dist/index.js' compile --all > /dev/null 2>&1 && cd '$SCRIPT_DIR'"

run_test "Check workflow file was created" \
    "test -f $TEMP_DIR/.github/workflows/claude-issue-triage.yml"

# Cleanup - but return to script dir first
cd "$SCRIPT_DIR"
rm -rf "$TEMP_DIR"

echo ""
echo "5. Test Repository Setup"
echo "-------------------------------------------"

if [ -d "../test-repo" ]; then
    info "Test repository already exists at ../test-repo"
    success "Test repository available"
else
    info "Creating test repository..."
    (cd .. && mkdir -p test-repo)
    (cd ../test-repo && git init > /dev/null 2>&1)
    (cd ../test-repo && git remote add origin https://github.com/test/test-repo.git 2> /dev/null || true)
    success "Test repository created"
fi

# Skip if no agents in test-repo yet
if [ -d "../test-repo/.github/agents" ]; then
    run_test "List agents in test repo" \
        "cd ../test-repo && bun ../repo-agents/dist/index.js list > /dev/null 2>&1"
else
    info "Test repository has no agents yet (run init first)"
fi

echo ""
echo "==========================================="
echo "  Test Summary"
echo "==========================================="
echo ""
echo "Total Tests:  $TESTS_RUN"
echo -e "Passed:       ${GREEN}$TESTS_PASSED${NC}"
echo -e "Failed:       ${RED}$TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Test with real API: export ANTHROPIC_API_KEY=..."
    echo "  2. Deploy to GitHub repository"
    echo "  3. Test with real issues/PRs"
    echo ""
    exit 0
else
    echo -e "${RED}✗ Some tests failed${NC}"
    echo ""
    echo "Check the output above for details"
    echo ""
    exit 1
fi

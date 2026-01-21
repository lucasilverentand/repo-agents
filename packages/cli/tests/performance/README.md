# Performance Regression Tests

This directory contains performance benchmark tests for the repo-agents compilation pipeline.

## Overview

The tests measure the performance of key operations and fail if performance regresses by more than 20% from established baselines.

## Test Cases

### Parsing Performance

- **Parse 10 agents**: Should complete in < 500ms
- **Parse 100 agents**: Should complete in < 3000ms
- **Linear scaling**: Verify parsing scales roughly linearly with agent count

### Generation Performance

- **Generate workflow from 10 agents**: Should complete in < 1000ms
- **Generate workflow from 50 agents**: Should complete in < 3000ms

### End-to-End Performance

- **Parse and generate 10 agents**: Combined operation should complete in < 1500ms (500ms + 1000ms)

## Performance Thresholds

All thresholds include a 20% regression tolerance. Tests will fail if operations take longer than:

```typescript
const THRESHOLDS = {
  PARSE_10_AGENTS: 500,      // Max: 600ms (500 * 1.2)
  PARSE_100_AGENTS: 3000,    // Max: 3600ms (3000 * 1.2)
  GENERATE_10_AGENTS: 1000,  // Max: 1200ms (1000 * 1.2)
  GENERATE_50_AGENTS: 3000,  // Max: 3600ms (3000 * 1.2)
};
```

## Running the Tests

```bash
# Run all performance tests
bun test packages/cli/tests/performance/

# Run specific benchmark
bun test packages/cli/tests/performance/compile-benchmark.test.ts

# Run with verbose output
bun test packages/cli/tests/performance/ --verbose
```

## Test Output

Successful tests show performance relative to threshold:

```
✓ Parsing 10 agents: 8.30ms (threshold: 500ms, 1.7% of limit)
✓ Generating workflow from 10 agents: 4.93ms (threshold: 1000ms, 0.5% of limit)
```

Failed tests show regression details:

```
✗ Performance regression detected: Parsing 10 agents took 650ms
  (threshold: 500ms, max allowed with 20% tolerance: 600ms)
```

## Test Fixtures

Test agents are generated dynamically from a template in `tests/fixtures/performance/agent-template.md`. This ensures:

- Consistent test data across runs
- Easy creation of large agent sets (10, 50, 100)
- No dependency on external fixture files

## Methodology

### Timing Measurement

- Uses `performance.now()` for high-resolution timing
- Measures wall-clock time (includes I/O, parsing, generation)
- Each test runs in isolated temporary directory

### Threshold Selection

Thresholds are set conservatively based on:

- Typical development machine performance (M-series Mac, modern Linux/Windows)
- CI/CD environment overhead (GitHub Actions runners)
- Growth headroom for additional features

### Regression Tolerance

The 20% tolerance accounts for:

- Normal variance between test runs
- Different hardware configurations
- CI environment fluctuations

This ensures tests are stable while catching significant regressions.

## Maintenance

### Updating Thresholds

If legitimate performance improvements make thresholds too loose:

1. Run tests multiple times to establish new baseline
2. Update `THRESHOLDS` in `compile-benchmark.test.ts`
3. Document reason for change in commit message

### Adding New Benchmarks

When adding new operations to benchmark:

1. Add threshold constant to `THRESHOLDS`
2. Create test case using `measureTime()` helper
3. Use `assertPerformance()` to enforce threshold
4. Update this README with new test case

## Continuous Integration

These tests run as part of the standard test suite:

```bash
bun test
```

CI failures indicate performance regression and should be investigated before merging.

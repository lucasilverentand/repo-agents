# Performance Analyzer Agent

Identifies performance bottlenecks and suggests optimizations for improved application speed.

## Overview

| Property | Value |
|----------|-------|
| **Trigger** | Schedule (weekly), PR with performance label |
| **Schedule** | Thursday 6am UTC |
| **Permissions** | `contents: read`, `issues: write`, `pull_requests: write` |
| **Rate Limit** | 30 minutes |
| **Model** | claude-sonnet-4-20250514 |

## Purpose

The Performance Analyzer improves application speed by:

- **Identifying** slow code patterns and bottlenecks
- **Analyzing** algorithmic complexity
- **Detecting** memory leaks and inefficient allocations
- **Suggesting** caching opportunities
- **Recommending** specific optimizations

## Trigger Configuration

```yaml
on:
  pull_request:
    types: [opened, synchronize]
    paths:
      - "src/**"
  schedule:
    - cron: '0 6 * * 4'  # Thursday 6am UTC
  workflow_dispatch: {}
```

Triggers on:
- **PR**: When code changes in src/
- **Weekly**: Full codebase analysis
- **Manual**: On-demand analysis

## Outputs

| Output | Max | Purpose |
|--------|-----|---------|
| `add-comment` | 1 | Performance analysis report |
| `create-issue` | 3 | Major optimization opportunities |
| `add-label` | unlimited | Performance labels |

## Context Collection

```yaml
context:
  pull_requests:
    states: [open]
    limit: 1
  commits:
    branches: [main]
    limit: 50
  since: "7d"
```

Analyzes current PR or recent code changes.

## Performance Patterns

### 1. Algorithmic Issues

| Pattern | Issue | Impact |
|---------|-------|--------|
| Nested loops over large data | O(n²) or worse | High |
| Repeated array searches | O(n) per search | Medium |
| Unnecessary sorting | O(n log n) overhead | Medium |
| String concatenation in loops | O(n²) memory | Medium |

### 2. Database Issues

| Pattern | Issue | Impact |
|---------|-------|--------|
| N+1 queries | Excessive round trips | Critical |
| Missing indexes | Full table scans | High |
| SELECT * | Unnecessary data transfer | Medium |
| No pagination | Memory bloat | High |

### 3. Memory Issues

| Pattern | Issue | Impact |
|---------|-------|--------|
| Unbounded caches | Memory leak | High |
| Large object cloning | Excessive allocation | Medium |
| Closure memory capture | Hidden retention | Medium |
| Missing cleanup | Resource leak | High |

### 4. I/O Issues

| Pattern | Issue | Impact |
|---------|-------|--------|
| Sequential API calls | Blocking | High |
| Missing caching | Redundant fetches | High |
| No connection pooling | Connection overhead | Medium |
| Large payload transfers | Bandwidth waste | Medium |

### 5. Frontend Issues

| Pattern | Issue | Impact |
|---------|-------|--------|
| Unnecessary re-renders | CPU waste | High |
| Large bundle imports | Load time | High |
| No lazy loading | Initial load | Medium |
| Unoptimized images | Bandwidth | Medium |

## Analysis Process

```
┌─────────────────────────────────────┐
│   Trigger (PR/schedule)             │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  1. Static Analysis                 │
│  - Scan for known anti-patterns     │
│  - Calculate complexity metrics     │
│  - Check loop nesting depth         │
│  - Analyze data structure usage     │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  2. Data Flow Analysis              │
│  - Track data through functions     │
│  - Identify hot paths               │
│  - Find repeated computations       │
│  - Check caching opportunities      │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  3. Resource Analysis               │
│  - Database query patterns          │
│  - API call patterns                │
│  - Memory allocation patterns       │
│  - File I/O patterns                │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  4. Impact Assessment               │
│  - Estimate performance impact      │
│  - Consider usage frequency         │
│  - Calculate improvement potential  │
│  - Prioritize by ROI                │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  5. Generate Recommendations        │
│  - Specific code changes            │
│  - Alternative approaches           │
│  - Expected improvement             │
│  - Implementation difficulty        │
└─────────────────────────────────────┘
```

## Severity Levels

| Level | Criteria | Action |
|-------|----------|--------|
| **Critical** | >10x slowdown, production impact | Immediate fix |
| **High** | 2-10x slowdown, user-visible | Fix soon |
| **Medium** | Minor slowdown, scalability concern | Plan fix |
| **Low** | Micro-optimization, code quality | Consider |

## Comment Templates

### PR Performance Review

```markdown
## ⚡ Performance Analysis

Analyzed changes in this PR for performance implications.

### Issues Found

#### 🔴 Critical: N+1 Query Pattern

**File**: `src/api/orders.ts:45`

```typescript
// Current (N+1 queries)
const orders = await db.orders.findMany();
for (const order of orders) {
  order.items = await db.orderItems.findMany({ orderId: order.id });
}
```

**Impact**: For 100 orders, this makes 101 database queries.

**Suggested Fix**:
```typescript
// Optimized (2 queries)
const orders = await db.orders.findMany({
  include: { items: true }
});
```

**Expected Improvement**: ~50x faster for typical order lists.

---

#### 🟡 Medium: Repeated Array Search

**File**: `src/utils/matcher.ts:23`

```typescript
// Current O(n²)
items.forEach(item => {
  const match = allItems.find(i => i.id === item.id);
});
```

**Suggested Fix**:
```typescript
// Optimized O(n)
const itemMap = new Map(allItems.map(i => [i.id, i]));
items.forEach(item => {
  const match = itemMap.get(item.id);
});
```

**Expected Improvement**: ~10x faster for 1000+ items.

---

### Summary

| Severity | Count |
|----------|-------|
| 🔴 Critical | 1 |
| 🟡 Medium | 1 |
| 🟢 Low | 0 |

**Recommendation**: Please address the critical N+1 issue before merging.
```

### Weekly Analysis Report

```markdown
## 📊 Weekly Performance Report

Analysis of the codebase for performance opportunities.

### Top Optimization Opportunities

#### 1. Database Query Optimization

**Location**: `src/services/UserService.ts`
**Potential Impact**: High
**Effort**: Medium

Multiple queries could be combined using joins or includes.

```typescript
// Current: 3 separate queries
const user = await getUser(id);
const profile = await getProfile(id);
const settings = await getSettings(id);

// Suggested: 1 query
const user = await getUser(id, {
  include: { profile: true, settings: true }
});
```

---

#### 2. Frontend Bundle Size

**Location**: `src/components/Dashboard.tsx`
**Potential Impact**: Medium
**Effort**: Low

Lodash is imported entirely but only `debounce` is used.

```typescript
// Current (70KB)
import _ from 'lodash';
_.debounce(fn, 300);

// Suggested (2KB)
import debounce from 'lodash/debounce';
debounce(fn, 300);
```

---

#### 3. Caching Opportunity

**Location**: `src/api/products.ts`
**Potential Impact**: High
**Effort**: Medium

Product list fetched on every request but rarely changes.

```typescript
// Suggested: Add caching
const getProducts = cache(
  async () => db.products.findMany(),
  { ttl: '5m' }
);
```

---

### Metrics Summary

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| Avg API response | 245ms | <200ms | ⚠️ |
| Bundle size | 1.2MB | <1MB | ⚠️ |
| DB queries/request | 8.3 | <5 | ❌ |
| Cache hit rate | 65% | >80% | ⚠️ |

### Created Issues

- #301: Optimize UserService database queries
- #302: Reduce bundle size with tree shaking
- #303: Implement product caching strategy
```

## Issue Template

```markdown
## Performance Optimization: [Area]

### Summary

Identified performance opportunity in [component/area].

### Current Behavior

```typescript
// Current implementation
[code showing the issue]
```

**Performance**: [current metrics]

### Proposed Optimization

```typescript
// Optimized implementation
[suggested code]
```

**Expected Improvement**: [metrics improvement]

### Analysis

- **Root Cause**: [why it's slow]
- **Impact**: [who/what is affected]
- **Frequency**: [how often this code runs]
- **Risk**: [potential issues with change]

### Implementation Notes

- [step 1]
- [step 2]
- [testing considerations]

### Benchmarks

Before: [metric]
Expected After: [metric]
Improvement: [percentage]

---
Labels: `performance`, `optimization`, `[priority]`
```

## Optimization Patterns

### Database

```typescript
// ❌ N+1 Query
for (const user of users) {
  user.posts = await db.posts.find({ userId: user.id });
}

// ✅ Batch Query
const posts = await db.posts.find({ userId: { $in: userIds } });
const postsByUser = groupBy(posts, 'userId');
```

### Memory

```typescript
// ❌ Unbounded Cache
const cache = {};
function getData(key) {
  if (!cache[key]) cache[key] = fetchData(key);
  return cache[key];
}

// ✅ LRU Cache
const cache = new LRU({ max: 1000 });
function getData(key) {
  if (!cache.has(key)) cache.set(key, fetchData(key));
  return cache.get(key);
}
```

### Computation

```typescript
// ❌ Repeated Calculation
function render(items) {
  return items.map(item => ({
    ...item,
    tax: calculateTax(item.price), // Complex calculation
  }));
}

// ✅ Memoized Calculation
const memoizedTax = memoize(calculateTax);
function render(items) {
  return items.map(item => ({
    ...item,
    tax: memoizedTax(item.price),
  }));
}
```

### I/O

```typescript
// ❌ Sequential Requests
const user = await fetchUser(id);
const orders = await fetchOrders(id);
const recommendations = await fetchRecommendations(id);

// ✅ Parallel Requests
const [user, orders, recommendations] = await Promise.all([
  fetchUser(id),
  fetchOrders(id),
  fetchRecommendations(id),
]);
```

## Agent Instructions

The full instructions for Claude should cover:

### Analysis Strategy

1. **Identify hot paths** - What code runs frequently?
2. **Check complexity** - What's the Big O?
3. **Look for patterns** - Known anti-patterns?
4. **Consider scale** - Will it work with 10x data?

### Recommendation Guidelines

1. **Be specific** - Point to exact code
2. **Show the fix** - Provide working code
3. **Estimate impact** - Quantify improvement
4. **Consider tradeoffs** - Readability vs speed

### Priority Guidelines

1. **User-facing first** - Visible performance
2. **Frequent code** - Hot paths matter most
3. **Easy wins** - Low effort, high impact
4. **Future-proofing** - Scalability concerns

### Key Behaviors

- **Don't micro-optimize** - Focus on real bottlenecks
- **Measure first** - Suggest profiling when uncertain
- **Consider readability** - Don't sacrifice clarity
- **Think scale** - Will it work at 100x?

## Inter-Agent Relationships

### Triggers Other Agents

| Action | Triggers |
|--------|----------|
| Creates issue | May be picked up by [Issue Implementer](./issue-implementer.md) |

### Triggered By

| Source | Via |
|--------|-----|
| PRs | `pull_request: opened/synchronize` |
| Schedule | Cron (Thursday 6am UTC) |
| Human | `workflow_dispatch` |

### Coordination Notes

- Works with [Code Quality Agent](./code-quality.md) on complexity
- Performance issues may involve [Refactoring Agent](./refactoring.md)
- Critical issues should be prioritized by [Sprint Planner](./sprint-planner.md)

## Example Scenarios

### Scenario 1: PR with N+1 Query

**Detection:**
```typescript
const orders = await Order.findAll();
for (const order of orders) {
  order.customer = await Customer.findById(order.customerId);
}
```

**Action:**
1. Identify N+1 pattern
2. Calculate impact (100 orders = 101 queries)
3. Suggest eager loading fix
4. Mark as critical, request fix before merge

### Scenario 2: Large Bundle Import

**Detection:**
```typescript
import moment from 'moment';
// Only using moment().format()
```

**Action:**
1. Detect full library import
2. Check actual usage
3. Suggest date-fns or native Date
4. Note bundle size reduction

### Scenario 3: Missing Pagination

**Detection:**
```typescript
app.get('/users', async (req, res) => {
  const users = await User.findAll(); // No limit!
  res.json(users);
});
```

**Action:**
1. Identify unbounded query
2. Calculate risk (10K users = memory issue)
3. Suggest pagination
4. Create issue for fix

## Frontmatter Reference

```yaml
---
name: Performance Analyzer
on:
  pull_request:
    types: [opened, synchronize]
    paths:
      - "src/**"
  schedule:
    - cron: '0 6 * * 4'
  workflow_dispatch: {}
permissions:
  contents: read
  issues: write
  pull_requests: write
outputs:
  add-comment: { max: 1 }
  create-issue: { max: 3 }
  add-label: true
context:
  pull_requests:
    states: [open]
    limit: 1
  commits:
    branches: [main]
    limit: 50
  since: "7d"
rate_limit_minutes: 30
claude:
  model: claude-sonnet-4-20250514
  maxTokens: 8192
  temperature: 0.4
---
```

## Customization Options

### Analysis Scope

Configure which paths to analyze.

### Threshold Configuration

Set thresholds for different severity levels.

### Pattern Library

Add custom anti-patterns to detect.

## Metrics to Track

- Performance issues found per week
- Issues fixed vs created
- Average improvement from optimizations
- False positive rate
- User-reported performance issues (misses)

---
title: Cost Estimation
description: Estimate Claude API costs for your agents
---

Understanding API costs helps you budget for your Claude-powered agents.

## Pricing Model

Claude charges per token processed:

| Model | Input | Output |
|-------|-------|--------|
| Claude 3.5 Sonnet | $3 / 1M tokens | $15 / 1M tokens |
| Claude 3 Haiku | $0.25 / 1M tokens | $1.25 / 1M tokens |

## Estimation Formula

```
cost = (input_tokens × input_rate) + (output_tokens × output_rate)
```

## Typical Costs by Agent Type

| Agent Type | Typical Cost/Run | Monthly (50 runs) |
|------------|-----------------|-------------------|
| Issue triage | ~$0.005-0.015 | ~$0.25-0.75 |
| PR review | ~$0.01-0.03 | ~$0.50-1.50 |
| Daily summary | ~$0.015-0.03 | ~$0.45-0.90 |

These estimates assume Claude 3.5 Sonnet with typical issue/PR sizes.

## Factors Affecting Cost

### Input Size

- **Issue/PR length**: Longer content = more input tokens
- **Number of files**: PR reviews with many files cost more
- **Collected data**: Inputs system adds context tokens

### Output Size

- **Response length**: Detailed comments cost more than labels
- **Number of actions**: Multiple outputs = more tokens

### Model Choice

Using Claude 3 Haiku instead of Sonnet reduces costs by ~90%:

```yaml
claude:
  model: claude-3-haiku-20240307
```

Trade-off: Haiku is faster and cheaper but less capable for complex analysis.

## Cost Control Strategies

### 1. Use Appropriate Models

```yaml
# Simple triage - Haiku is sufficient
claude:
  model: claude-3-haiku-20240307

# Complex review - Sonnet needed
claude:
  model: claude-3-5-sonnet-20241022
```

### 2. Limit Agent Runs

```yaml
# Only run when labeled
trigger_labels:
  - needs-review

# Rate limit runs
rate_limit_minutes: 30
```

### 3. Filter Inputs

```yaml
inputs:
  issues:
    states: [open]
    labels: [bug]  # Only bug issues
    limit: 20      # Cap at 20
  min_items: 5     # Skip if < 5 items
```

### 4. Limit Outputs

```yaml
outputs:
  add-comment: { max: 1 }  # One comment max
```

## Monitoring Costs

### Workflow Logs

Each agent run logs token usage and cost:

```
Execution Metrics:
- Input tokens: 1,234
- Output tokens: 567
- Estimated cost: $0.012
```

### Anthropic Console

Monitor total API usage at [console.anthropic.com](https://console.anthropic.com).

## Budget Planning

### Small Repository (< 50 issues/month)
- Issue triage: ~$0.50/month
- PR review: ~$1.00/month
- Total: ~$1.50/month

### Medium Repository (50-200 issues/month)
- Issue triage: ~$2.00/month
- PR review: ~$4.00/month
- Daily summaries: ~$1.50/month
- Total: ~$7.50/month

### Large Repository (200+ issues/month)
- Consider Haiku for routine tasks
- Use trigger labels to limit runs
- Set appropriate rate limits

## See Also

- [Claude Pricing](https://anthropic.com/pricing) - Current pricing
- [Agent Definition](/gh-claude/guide/agent-definition/) - Configure models
- [Security Best Practices](/gh-claude/guide/security-best-practices/) - Rate limiting

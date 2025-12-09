#!/bin/bash

# Local testing script for gh-claude runtime
# This simulates what happens in GitHub Actions

set -e

echo "==========================================="
echo "  gh-claude Local Runtime Test"
echo "==========================================="
echo ""

# Check for API key
if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo "⚠️  ANTHROPIC_API_KEY not set"
    echo ""
    echo "To test with real Claude API, set your API key:"
    echo "  export ANTHROPIC_API_KEY='your-key-here'"
    echo ""
    echo "Or use mock mode (simulate only, no API calls)"
    read -p "Continue in mock mode? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
    MOCK_MODE=true
else
    echo "✓ ANTHROPIC_API_KEY found"
    MOCK_MODE=false
fi

echo ""
echo "Test Configuration:"
echo "  Mock Mode: $MOCK_MODE"
echo "  Context: test-runtime/mock-context.json"
echo ""

# Load mock context
GITHUB_CONTEXT=$(cat test-runtime/mock-context.json | jq -c .)

# Agent instructions (from issue-triage example)
AGENT_INSTRUCTIONS="# Issue Triage Agent

You are an intelligent issue triage assistant for this GitHub repository.

## Your Task

When a new issue is opened, analyze it and:

1. **Categorize** the issue by adding appropriate labels
2. **Assess Priority** based on the description
3. **Welcome** the contributor with a friendly comment

## Output Format

For adding a comment:
\`\`\`
ADD_COMMENT:
\`\`\`json
{
  \"body\": \"Your comment text here\"
}
\`\`\`
\`\`\`

For adding labels:
\`\`\`
ADD_LABEL:
\`\`\`json
{
  \"labels\": [\"label1\", \"label2\"]
}
\`\`\`
\`\`\`"

if [ "$MOCK_MODE" = true ]; then
    echo "==========================================="
    echo "  MOCK MODE - Simulating Runtime"
    echo "==========================================="
    echo ""
    echo "GitHub Context:"
    echo "$GITHUB_CONTEXT" | jq .
    echo ""
    echo "Agent Instructions:"
    echo "$AGENT_INSTRUCTIONS"
    echo ""
    echo "==========================================="
    echo "  In real mode, Claude would:"
    echo "==========================================="
    echo "1. Receive the context above"
    echo "2. Analyze the issue"
    echo "3. Generate labels and comment"
    echo "4. Execute via GitHub API"
    echo ""
    echo "✓ Mock test complete"
else
    echo "==========================================="
    echo "  Running Real Runtime Test"
    echo "==========================================="
    echo ""

    # Set environment variables
    export GITHUB_CONTEXT="$GITHUB_CONTEXT"
    export AGENT_INSTRUCTIONS="$AGENT_INSTRUCTIONS"
    export CLAUDE_MODEL="claude-3-5-sonnet-20241022"
    export CLAUDE_MAX_TOKENS="4096"
    export CLAUDE_TEMPERATURE="0.7"
    export SAFE_OUTPUTS="add-comment,add-label"
    export ALLOWED_PATHS=""
    export GITHUB_TOKEN="mock-token-for-testing"

    # Run the runtime
    echo "Calling Claude API..."
    node dist/runtime/index.js

    echo ""
    echo "✓ Runtime test complete"
fi

echo ""
echo "==========================================="
echo "  Test Summary"
echo "==========================================="
echo "✓ Environment setup successful"
echo "✓ Context loaded and parsed"
echo "✓ Agent instructions formatted"
if [ "$MOCK_MODE" = false ]; then
    echo "✓ Runtime executed"
fi
echo ""
echo "Next steps:"
echo "  1. Review the output above"
echo "  2. Check for any errors"
echo "  3. Test with different contexts"
echo ""

import { writeFile } from 'fs/promises';
import yaml from 'js-yaml';
import type { AgentDefinition, WorkflowStep, Output, TriggerConfig } from '../types';
import { agentNameToWorkflowName } from '../cli/utils/files';
import { getOutputHandler } from './outputs';
import { getProviderAdapter } from './providers';
import type { RuntimeContext } from './outputs/base';
import { inputCollector } from './input-collector';
import { logger } from '../cli/utils/logger';

// Types for generated GitHub Actions workflow structures
interface GitHubWorkflowJob {
  'runs-on': string;
  needs?: string | string[];
  if?: string;
  outputs?: Record<string, string>;
  strategy?: Record<string, unknown>;
  steps: WorkflowStep[];
}

interface GitHubWorkflow {
  name: string;
  on: TriggerConfig;
  permissions?: Record<string, string>;
  jobs: Record<string, GitHubWorkflowJob>;
}

export class WorkflowGenerator {
  generate(agent: AgentDefinition): string {
    const workflow: Partial<GitHubWorkflow> & { name: string; on: TriggerConfig } = {
      name: agent.name,
      on: this.generateTriggers(agent),
    };

    if (agent.permissions) {
      // Transform permission keys from snake_case to kebab-case for GitHub Actions
      workflow.permissions = Object.entries(agent.permissions).reduce(
        (acc, [key, value]) => {
          const kebabKey = key.replace(/_/g, '-');
          acc[kebabKey] = value;
          return acc;
        },
        {} as Record<string, string>
      );
    }

    const preFlightOutputs: Record<string, string> = {
      'should-run':
        '$' +
        '{{ steps.set-output.outputs.should-run || steps.check-rate-limit.outputs.should-run }}',
      'rate-limited': '$' + '{{ steps.check-rate-limit.outputs.rate-limited }}',
    };

    workflow.jobs = {
      'pre-flight': {
        'runs-on': 'ubuntu-latest',
        outputs: preFlightOutputs,
        steps: this.generateValidationSteps(agent),
      },
    };

    // Add collect-inputs job if inputs are configured
    if (agent.inputs) {
      workflow.jobs['collect-inputs'] = this.generateCollectInputsJob(agent);
      workflow.jobs['claude-agent'] = {
        'runs-on': 'ubuntu-latest',
        needs: ['pre-flight', 'collect-inputs'],
        if: "needs.pre-flight.outputs.should-run == 'true' && needs.collect-inputs.outputs.has-inputs == 'true'",
        steps: this.generateClaudeAgentSteps(agent),
      };
    } else {
      workflow.jobs['claude-agent'] = {
        'runs-on': 'ubuntu-latest',
        needs: 'pre-flight',
        if: "needs.pre-flight.outputs.should-run == 'true'",
        steps: this.generateClaudeAgentSteps(agent),
      };
    }

    // Add execute-outputs job if outputs are configured
    if (agent.outputs && Object.keys(agent.outputs).length > 0) {
      workflow.jobs['execute-outputs'] = this.generateExecuteOutputsJob(agent);
      workflow.jobs['report-results'] = this.generateReportResultsJob(agent);
    }

    // Always add audit report job
    workflow.jobs['audit-report'] = this.generateAuditReportJob(agent);

    const yamlContent = yaml.dump(workflow, {
      lineWidth: -1,
      noRefs: true,
    });

    return this.formatYaml(yamlContent);
  }

  private formatYaml(yamlContent: string): string {
    const lines = yamlContent.split('\n');
    const formatted: string[] = [];
    let previousLineWasStep = false;
    let inJobs = false;
    let inSteps = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Track when we enter jobs section
      if (line === 'jobs:') {
        inJobs = true;
        formatted.push(line);
        continue;
      }

      // Check if this is a job key (2 spaces indentation, ends with colon, alphanumeric+hyphens)
      const isJobKey = inJobs && /^\s{2}[a-z-]+:$/.test(line);

      // Check if entering steps section
      if (trimmed === 'steps:') {
        inSteps = true;
        formatted.push(line);
        previousLineWasStep = false;
        continue;
      }

      // Check if exiting steps section
      if (inSteps && /^\s{2}[a-z-]+:$/.test(line)) {
        inSteps = false;
      }

      // Add blank line before job keys (except the very first one after "jobs:")
      if (isJobKey) {
        const lastNonEmptyLine = formatted.filter((l) => l.trim() !== '').pop();
        if (lastNonEmptyLine && lastNonEmptyLine !== 'jobs:') {
          formatted.push('');
        }
        formatted.push(line);
        previousLineWasStep = false;
        continue;
      }

      // Add blank line before each step (except the first one)
      const isStepStart = inSteps && /^\s{4}-\s/.test(line);
      if (isStepStart && previousLineWasStep) {
        formatted.push('');
      }

      formatted.push(line);
      previousLineWasStep = isStepStart;
    }

    return formatted.join('\n');
  }

  private generateTriggers(agent: AgentDefinition): TriggerConfig {
    const triggers: TriggerConfig = {};

    if (agent.on.issues) triggers.issues = agent.on.issues;
    if (agent.on.pull_request) triggers.pull_request = agent.on.pull_request;
    if (agent.on.discussion) triggers.discussion = agent.on.discussion;
    if (agent.on.schedule) triggers.schedule = agent.on.schedule;
    if (agent.on.workflow_dispatch) triggers.workflow_dispatch = agent.on.workflow_dispatch;
    if (agent.on.repository_dispatch) triggers.repository_dispatch = agent.on.repository_dispatch;

    return triggers;
  }

  private generateValidationSteps(agent: AgentDefinition): WorkflowStep[] {
    const allowedUsers = [...(agent.allowed_users || []), ...(agent.allowed_actors || [])];
    const allowedLabels = agent.trigger_labels || [];
    const rateLimitMinutes = agent.rate_limit_minutes ?? 5;

    const steps: WorkflowStep[] = [
      {
        name: 'Initialize audit tracking',
        id: 'init-audit',
        run: `mkdir -p /tmp/audit
echo '{
  "secrets_check": false,
  "user_authorization": false,
  "labels_check": false,
  "rate_limit_check": false
}' > /tmp/audit/validation-status.json
echo '[]' > /tmp/audit/permission-issues.json`,
      },
      this.generateTokenGenerationStep(),
      {
        name: 'Check secrets',
        id: 'check-secrets',
        env: {
          ANTHROPIC_API_KEY: '${{ secrets.ANTHROPIC_API_KEY }}',
          CLAUDE_CODE_OAUTH_TOKEN: '${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}',
        },
        run: `if [ -z "\${ANTHROPIC_API_KEY}" ] && [ -z "\${CLAUDE_CODE_OAUTH_TOKEN}" ]; then
  echo "::error::No Claude authentication found. Please set either ANTHROPIC_API_KEY or CLAUDE_CODE_OAUTH_TOKEN in your repository secrets."
  # Track permission issue
  jq '. += [{
    "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
    "issue_type": "missing_permission",
    "severity": "error",
    "message": "No Claude authentication configured",
    "context": {"required": ["ANTHROPIC_API_KEY", "CLAUDE_CODE_OAUTH_TOKEN"]}
  }]' /tmp/audit/permission-issues.json > /tmp/audit/permission-issues.tmp
  mv /tmp/audit/permission-issues.tmp /tmp/audit/permission-issues.json
  echo "validation-failed=true" >> $GITHUB_OUTPUT
  exit 1
fi

if [ -n "\${ANTHROPIC_API_KEY}" ]; then
  echo "✓ ANTHROPIC_API_KEY is configured"
fi
if [ -n "\${CLAUDE_CODE_OAUTH_TOKEN}" ]; then
  echo "✓ CLAUDE_CODE_OAUTH_TOKEN is configured"
fi

# Mark secrets check as passed
jq '.secrets_check = true' /tmp/audit/validation-status.json > /tmp/audit/validation-status.tmp
mv /tmp/audit/validation-status.tmp /tmp/audit/validation-status.json`,
      },
      {
        name: 'Check user authorization',
        id: 'check-user',
        env: {
          GITHUB_TOKEN: '${{ steps.app-token.outputs.token }}',
        },
        run: `ACTOR="\${{ github.actor }}"

# Get user's association with the repository
USER_ASSOCIATION=$(gh api "repos/\${{ github.repository }}/collaborators/\${ACTOR}/permission" --jq '.permission' 2>/dev/null || echo "none")

# Check if user is org member (for org repos)
IS_ORG_MEMBER="false"
ORG_NAME=$(echo "\${{ github.repository }}" | cut -d'/' -f1)
if gh api "orgs/\${ORG_NAME}/members/\${ACTOR}" >/dev/null 2>&1; then
  IS_ORG_MEMBER="true"
fi

# Allowed if: admin, write access, org member, or in explicit allow list
ALLOWED_USERS="${allowedUsers.join(' ')}"
IS_ALLOWED="false"

if [ "\${USER_ASSOCIATION}" = "admin" ] || [ "\${USER_ASSOCIATION}" = "write" ]; then
  IS_ALLOWED="true"
  echo "✓ User has \${USER_ASSOCIATION} permission"
elif [ "\${IS_ORG_MEMBER}" = "true" ]; then
  IS_ALLOWED="true"
  echo "✓ User is organization member"
elif [ -n "\${ALLOWED_USERS}" ]; then
  for allowed in \${ALLOWED_USERS}; do
    if [ "\${ACTOR}" = "\${allowed}" ]; then
      IS_ALLOWED="true"
      echo "✓ User is in allowed users list"
      break
    fi
  done
fi

if [ "\${IS_ALLOWED}" = "false" ]; then
  echo "::warning::User @\${ACTOR} is not authorized to trigger this agent"
  # Track permission issue
  jq '. += [{
    "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
    "issue_type": "missing_permission",
    "severity": "error",
    "message": "User not authorized to trigger agent",
    "context": {"user": "'\${ACTOR}'", "permission": "'\${USER_ASSOCIATION}'"}
  }]' /tmp/audit/permission-issues.json > /tmp/audit/permission-issues.tmp
  mv /tmp/audit/permission-issues.tmp /tmp/audit/permission-issues.json
  echo "validation-failed=true" >> $GITHUB_OUTPUT
  exit 1
fi

# Mark user authorization check as passed
jq '.user_authorization = true' /tmp/audit/validation-status.json > /tmp/audit/validation-status.tmp
mv /tmp/audit/validation-status.tmp /tmp/audit/validation-status.json`,
      },
    ];

    // Only add label check step if labels are configured
    if (allowedLabels.length > 0) {
      steps.push({
        name: 'Check required labels',
        id: 'check-labels',
        env: {
          GITHUB_TOKEN: '${{ steps.app-token.outputs.token }}',
        },
        run: `REQUIRED_LABELS="${allowedLabels.join(' ')}"
ISSUE_NUMBER="\${{ github.event.issue.number }}\${{ github.event.pull_request.number }}"

if [ -n "\${ISSUE_NUMBER}" ]; then
  CURRENT_LABELS=$(gh api "repos/\${{ github.repository }}/issues/\${ISSUE_NUMBER}" --jq '.labels[].name' 2>/dev/null | tr '\\n' ' ' || echo "")

  LABEL_FOUND="false"
  for required in \${REQUIRED_LABELS}; do
    if echo "\${CURRENT_LABELS}" | grep -qw "\${required}"; then
      LABEL_FOUND="true"
      echo "✓ Found required label: \${required}"
      break
    fi
  done

  if [ "\${LABEL_FOUND}" = "false" ]; then
    echo "::notice::Required label not found. Need one of: \${REQUIRED_LABELS}"
    # Track permission issue
    jq '. += [{
      "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
      "issue_type": "validation_error",
      "severity": "error",
      "message": "Required label not found",
      "context": {"required_labels": "'\${REQUIRED_LABELS}'", "current_labels": "'\${CURRENT_LABELS}'"}
    }]' /tmp/audit/permission-issues.json > /tmp/audit/permission-issues.tmp
    mv /tmp/audit/permission-issues.tmp /tmp/audit/permission-issues.json
    echo "validation-failed=true" >> $GITHUB_OUTPUT
    exit 1
  fi
else
  echo "::warning::No issue or PR number found, skipping label check"
fi

# Mark labels check as passed
jq '.labels_check = true' /tmp/audit/validation-status.json > /tmp/audit/validation-status.tmp
mv /tmp/audit/validation-status.tmp /tmp/audit/validation-status.json`,
      });
    }

    steps.push({
      name: 'Check rate limit',
      id: 'check-rate-limit',
      env: {
        GITHUB_TOKEN: '${{ steps.app-token.outputs.token }}',
      },
      run: `RATE_LIMIT_MINUTES=${rateLimitMinutes}

# Bypass rate limit for manual workflow_dispatch runs
if [ "\${{ github.event_name }}" = "workflow_dispatch" ]; then
  echo "✓ Manual run - bypassing rate limit check"
  jq '.rate_limit_check = true' /tmp/audit/validation-status.json > /tmp/audit/validation-status.tmp
  mv /tmp/audit/validation-status.tmp /tmp/audit/validation-status.json
  exit 0
fi

# Get recent workflow runs for this workflow
# Note: Using repo-level runs endpoint and filtering by workflow name to avoid URL encoding issues
RECENT_RUNS=$(gh api "repos/\${{ github.repository }}/actions/runs" \\
  --jq "[.workflow_runs[] | select(.name == \\"\${{ github.workflow }}\\" and .status == \\"completed\\" and .conclusion == \\"success\\")] | .[0:5] | .[].created_at" 2>/dev/null || echo "")

if [ -n "\${RECENT_RUNS}" ]; then
  CURRENT_TIME=$(date +%s)

  for run_time in \${RECENT_RUNS}; do
    RUN_TIMESTAMP=$(date -d "\${run_time}" +%s 2>/dev/null || date -j -f "%Y-%m-%dT%H:%M:%SZ" "\${run_time}" +%s 2>/dev/null || echo "0")
    TIME_DIFF=$(( (CURRENT_TIME - RUN_TIMESTAMP) / 60 ))

    if [ "\${TIME_DIFF}" -lt "\${RATE_LIMIT_MINUTES}" ]; then
      echo "::notice::Rate limit: Agent ran \${TIME_DIFF} minutes ago. Minimum interval is \${RATE_LIMIT_MINUTES} minutes. Skipping execution."
      echo "should-run=false" >> $GITHUB_OUTPUT
      echo "rate-limited=true" >> $GITHUB_OUTPUT
      exit 0
    fi
  done
fi
echo "✓ Rate limit check passed"

# Mark rate limit check as passed
jq '.rate_limit_check = true' /tmp/audit/validation-status.json > /tmp/audit/validation-status.tmp
mv /tmp/audit/validation-status.tmp /tmp/audit/validation-status.json`,
    });

    steps.push({
      name: 'Set output',
      id: 'set-output',
      run: `echo "should-run=true" >> $GITHUB_OUTPUT
echo "✓ All validation checks passed"`,
    });

    steps.push({
      name: 'Upload validation audit data',
      if: 'always()',
      uses: 'actions/upload-artifact@v4',
      with: {
        name: 'validation-audit',
        path: '/tmp/audit/',
        'if-no-files-found': 'ignore',
      },
    });

    return steps;
  }

  private generateClaudeAgentSteps(agent: AgentDefinition): WorkflowStep[] {
    const instructions = agent.markdown.replace(/`/g, '\\`').replace(/\$/g, '\\$');

    const steps: WorkflowStep[] = [
      {
        name: 'Checkout repository',
        uses: 'actions/checkout@v4',
      },
      this.generateTokenGenerationStep(),
      {
        name: 'Setup Bun',
        uses: 'oven-sh/setup-bun@v2',
        with: {
          'bun-version': 'latest',
        },
      },
    ];

    // Create outputs directory if outputs are configured
    if (agent.outputs && Object.keys(agent.outputs).length > 0) {
      steps.push({
        name: 'Create outputs directory',
        run: 'mkdir -p /tmp/outputs /tmp/validation-errors',
      });
    }

    // Prepare initial context file
    steps.push({
      name: 'Prepare context file',
      id: 'prepare',
      run:
        "cat > /tmp/context.txt << 'CONTEXT_EOF'\n" +
        'GitHub Event: $' +
        '{{ github.event_name }}\n' +
        'Repository: $' +
        '{{ github.repository }}\n' +
        'CONTEXT_EOF',
    });

    // Add collected inputs to context if available
    if (agent.inputs) {
      steps.push({
        name: 'Add collected inputs to context',
        if: "needs.collect-inputs.outputs.has-inputs == 'true'",
        run:
          "cat >> /tmp/context.txt << 'INPUTS_EOF'\n" +
          '\n' +
          '## Collected Inputs\n' +
          '\n' +
          'The following data has been collected from the repository:\n' +
          '\n' +
          '$' +
          '{{ needs.collect-inputs.outputs.inputs-data }}\n' +
          'INPUTS_EOF',
      });
    }

    // Add issue context if applicable
    steps.push({
      name: 'Add issue context',
      if: 'github.event.issue.number',
      run:
        "cat >> /tmp/context.txt << 'ISSUE_EOF'\n" +
        'Issue #${{ github.event.issue.number }}: ${{ github.event.issue.title }}\n' +
        'Author: @${{ github.event.issue.user.login }}\n' +
        'Body:\n' +
        '${{ github.event.issue.body }}\n' +
        'ISSUE_EOF',
    });

    // Add PR context if applicable
    steps.push({
      name: 'Add PR context',
      if: 'github.event.pull_request.number',
      run:
        "cat >> /tmp/context.txt << 'PR_EOF'\n" +
        'PR #${{ github.event.pull_request.number }}: ${{ github.event.pull_request.title }}\n' +
        'Author: @${{ github.event.pull_request.user.login }}\n' +
        'Body:\n' +
        '${{ github.event.pull_request.body }}\n' +
        'PR_EOF',
    });

    // Add dynamic context for outputs if configured
    if (agent.outputs && Object.keys(agent.outputs).length > 0) {
      const runtime = this.createRuntimeContext(agent);

      for (const [outputType] of Object.entries(agent.outputs)) {
        try {
          const handler = getOutputHandler(outputType as Output);
          const contextScript = handler.getContextScript(runtime);

          if (contextScript) {
            steps.push({
              name: `Fetch ${outputType} context`,
              env: {
                GITHUB_TOKEN: '${{ steps.app-token.outputs.token }}',
              },
              run: contextScript.trim(),
            });
          }
        } catch {
          // Handler not found - skip
          logger.warn(`No handler found for output type: ${outputType}`);
        }
      }
    }

    // Create Claude skills file if outputs are configured
    // Note: We create this in .claude/ in the repo so Claude can access both the skills AND the actual codebase
    if (agent.outputs && Object.keys(agent.outputs).length > 0) {
      const skillsContent = this.generateSkillsFile(agent);
      const escapedSkills = skillsContent.replace(/`/g, '\\`').replace(/\$/g, '\\$');

      steps.push({
        name: 'Create Claude skills file',
        run:
          "mkdir -p .claude && cat > .claude/CLAUDE.md << 'SKILLS_EOF'\n" +
          escapedSkills +
          '\n' +
          'SKILLS_EOF',
      });
    }

    // Add instructions to context file
    steps.push({
      name: 'Add agent instructions',
      run:
        "cat >> /tmp/context.txt << 'INSTRUCTIONS_EOF'\n" +
        '\n' +
        '---\n' +
        '\n' +
        instructions +
        '\n' +
        'INSTRUCTIONS_EOF',
    });

    // Run agent with the prepared context
    const hasOutputs = !!agent.outputs && Object.keys(agent.outputs).length > 0;
    const allowedTools = hasOutputs ? 'Write(/tmp/outputs/*),Read,Glob,Grep' : 'Read,Glob,Grep';

    const provider = getProviderAdapter(agent.provider);
    steps.push(...provider.generateInstallSteps());
    steps.push(
      provider.generateRunStep(agent, {
        allowedTools,
        hasOutputs,
        environment: {
          ANTHROPIC_API_KEY: '${{ secrets.ANTHROPIC_API_KEY }}',
          CLAUDE_CODE_OAUTH_TOKEN: '${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}',
          GITHUB_TOKEN: '${{ steps.app-token.outputs.token }}',
          GH_TOKEN: '${{ steps.app-token.outputs.token }}',
        },
      })
    );

    // Extract and display Claude execution summary
    steps.push({
      name: 'Extract execution metrics',
      id: 'extract-metrics',
      if: 'always()',
      run: `
if [ -f /tmp/claude-output.json ]; then
  echo "=== Claude Execution Summary ==="

  # Extract metrics using jq
  COST=$(jq -r '.total_cost_usd // "N/A"' /tmp/claude-output.json)
  TURNS=$(jq -r '.num_turns // "N/A"' /tmp/claude-output.json)
  DURATION=$(jq -r '.duration_ms // "N/A"' /tmp/claude-output.json)
  API_DURATION=$(jq -r '.duration_api_ms // "N/A"' /tmp/claude-output.json)
  IS_ERROR=$(jq -r '.is_error // false' /tmp/claude-output.json)
  SESSION_ID=$(jq -r '.session_id // "N/A"' /tmp/claude-output.json)

  echo "💰 Cost: \\$\${COST}"
  echo "🔄 Turns: \${TURNS}"
  echo "⏱️  Duration: \${DURATION}ms (API: \${API_DURATION}ms)"
  echo "🆔 Session: \${SESSION_ID}"
  echo "❌ Error: \${IS_ERROR}"

  # Save metrics for audit report
  mkdir -p /tmp/audit
  jq '{
    total_cost_usd: .total_cost_usd,
    num_turns: .num_turns,
    duration_ms: .duration_ms,
    duration_api_ms: .duration_api_ms,
    is_error: .is_error,
    session_id: .session_id
  }' /tmp/claude-output.json > /tmp/audit/metrics.json

  # Display result for debugging
  echo ""
  echo "=== Claude Response ==="
  jq -r '.result' /tmp/claude-output.json || echo "No result available"
else
  echo "::error::Claude output file not found"
  echo '{"is_error": true}' > /tmp/audit/metrics.json
fi
`,
    });

    // Upload audit metrics artifact
    steps.push({
      name: 'Upload audit metrics',
      if: 'always()',
      uses: 'actions/upload-artifact@v4',
      with: {
        name: 'audit-metrics',
        path: '/tmp/audit/',
        'if-no-files-found': 'ignore',
      },
    });

    // Upload outputs artifact if outputs are configured
    if (agent.outputs && Object.keys(agent.outputs).length > 0) {
      steps.push({
        name: 'Upload outputs artifact',
        if: 'always()',
        uses: 'actions/upload-artifact@v4',
        with: {
          name: 'agent-outputs',
          path: '/tmp/outputs/',
          'if-no-files-found': 'ignore',
        },
      });
    }

    return steps;
  }

  private createRuntimeContext(agent: AgentDefinition): RuntimeContext {
    return {
      repository: '${{ github.repository }}',
      issueNumber: '${{ github.event.issue.number }}',
      prNumber: '${{ github.event.pull_request.number }}',
      // Concatenate both template strings - at workflow runtime, only one will be non-empty
      // This allows the same workflow to work for both issue and PR events
      issueOrPrNumber: '${{ github.event.issue.number }}${{ github.event.pull_request.number }}',
      allowedPaths: agent.allowed_paths,
    };
  }

  private generateSkillsFile(agent: AgentDefinition): string {
    if (!agent.outputs || Object.keys(agent.outputs).length === 0) {
      return '';
    }

    const skills: string[] = [
      '# Agent Output Skills',
      '',
      'This file documents how to create outputs for this agent.',
      '',
    ];

    for (const [outputType, config] of Object.entries(agent.outputs)) {
      try {
        const handler = getOutputHandler(outputType as Output);
        const outputConfig = typeof config === 'boolean' ? {} : config;
        const skillMarkdown = handler.generateSkill(outputConfig);
        skills.push(skillMarkdown);
        skills.push('');
      } catch {
        // Handler not found - skip
        logger.warn(`No handler found for output type: ${outputType}`);
      }
    }

    return skills.join('\n');
  }

  private generateCollectInputsJob(agent: AgentDefinition): GitHubWorkflowJob {
    if (!agent.inputs) {
      throw new Error('generateCollectInputsJob called without inputs configuration');
    }

    const collectionScript = inputCollector.generateCollectionScript(agent.inputs);

    return {
      'runs-on': 'ubuntu-latest',
      needs: 'pre-flight',
      if: "needs.pre-flight.outputs.should-run == 'true'",
      outputs: {
        'has-inputs': '$' + '{{ steps.collect.outputs.has-inputs }}',
        'inputs-data': '$' + '{{ steps.collect.outputs.inputs-data }}',
      },
      steps: [
        this.generateTokenGenerationStep(),
        {
          name: 'Collect repository data',
          id: 'collect',
          env: {
            GITHUB_TOKEN: '$' + '{{ steps.app-token.outputs.token }}',
          },
          run: collectionScript,
        },
      ],
    };
  }

  private generateExecuteOutputsJob(agent: AgentDefinition): GitHubWorkflowJob {
    const outputTypes = Object.keys(agent.outputs || {});

    return {
      'runs-on': 'ubuntu-latest',
      needs: 'claude-agent',
      if: "success() && needs.claude-agent.result == 'success'",
      strategy: {
        matrix: {
          'output-type': outputTypes,
        },
        'fail-fast': false,
      },
      steps: [
        {
          name: 'Checkout repository',
          uses: 'actions/checkout@v4',
        },
        this.generateTokenGenerationStep(),
        {
          name: 'Download outputs artifact',
          uses: 'actions/download-artifact@v4',
          with: {
            name: 'agent-outputs',
            path: '/tmp/outputs',
          },
          'continue-on-error': true,
        },
        {
          name: 'Create validation errors directory',
          run: 'mkdir -p /tmp/validation-errors',
        },
        {
          name: 'Validate and execute ${{ matrix.output-type }}',
          env: {
            GITHUB_TOKEN: '${{ steps.app-token.outputs.token }}',
            GIT_USER: '${{ steps.app-token.outputs.git-user }}',
            GIT_EMAIL: '${{ steps.app-token.outputs.git-email }}',
          },
          run: this.generateMatrixValidationScript(agent),
        },
        {
          name: 'Upload validation results',
          if: 'always()',
          uses: 'actions/upload-artifact@v4',
          with: {
            name: 'validation-results-${{ matrix.output-type }}',
            path: '/tmp/validation-errors/',
            'if-no-files-found': 'ignore',
          },
        },
      ],
    };
  }

  private generateMatrixValidationScript(agent: AgentDefinition): string {
    const runtime = this.createRuntimeContext(agent);
    const scripts: string[] = [];

    // Add validation script for each output type
    for (const [outputType, config] of Object.entries(agent.outputs || {})) {
      try {
        const handler = getOutputHandler(outputType as Output);
        const outputConfig = typeof config === 'boolean' ? {} : config;
        const validationScript = handler.generateValidationScript(outputConfig, runtime);

        // Wrap each validation script in a conditional that checks the matrix variable
        scripts.push(`
if [ "\${{ matrix.output-type }}" = "${outputType}" ]; then
${validationScript}
fi
`);
      } catch {
        // Handler not found - skip
        logger.warn(`No handler found for output type: ${outputType}`);
      }
    }

    return scripts.join('\n');
  }

  private generateReportResultsJob(agent: AgentDefinition): GitHubWorkflowJob {
    const runtime = this.createRuntimeContext(agent);

    return {
      'runs-on': 'ubuntu-latest',
      needs: 'execute-outputs',
      if: 'always()',
      steps: [
        {
          name: 'Download all validation results',
          uses: 'actions/download-artifact@v4',
          with: {
            pattern: 'validation-results-*',
            path: '/tmp/all-validation-errors',
            'merge-multiple': true,
          },
          'continue-on-error': true,
        },
        this.generateTokenGenerationStep(),
        {
          name: 'Report validation errors',
          env: {
            GITHUB_TOKEN: '${{ steps.app-token.outputs.token }}',
          },
          run: `
# Check if there are any validation errors
if [ -d "/tmp/all-validation-errors" ] && [ "$(ls -A /tmp/all-validation-errors 2>/dev/null)" ]; then
  echo "⚠️  Some output validations failed"

  # Build error message
  ERROR_MSG="## ⚠️ Agent Output Validation Errors\\n\\nThe following outputs failed validation:\\n\\n"

  for error_file in /tmp/all-validation-errors/*; do
    if [ -f "$error_file" ]; then
      ERROR_CONTENT=$(cat "$error_file")
      ERROR_MSG="\${ERROR_MSG}\${ERROR_CONTENT}\\n"
    fi
  done

  # Post comment if we have issue/PR number
  ISSUE_OR_PR_NUMBER="${runtime.issueOrPrNumber}"
  if [ -n "$ISSUE_OR_PR_NUMBER" ]; then
    echo -e "$ERROR_MSG" | gh api "repos/${runtime.repository}/issues/$ISSUE_OR_PR_NUMBER/comments" \\
      -X POST \\
      -f body=@- || echo "Failed to post validation error comment"
  else
    echo "No issue or PR number available to post validation errors"
    echo -e "$ERROR_MSG"
  fi

  exit 1
else
  echo "✓ All output validations passed"
fi
`,
        },
      ],
    };
  }

  private generateAuditReportJob(agent: AgentDefinition): GitHubWorkflowJob {
    const hasOutputs = agent.outputs && Object.keys(agent.outputs).length > 0;
    const auditConfig = agent.audit || {};
    const createIssues = auditConfig.create_issues !== false; // Default true
    const auditLabels = auditConfig.labels || ['agent-failure'];
    const auditAssignees = auditConfig.assignees || [];

    const needs = hasOutputs
      ? ['pre-flight', 'claude-agent', 'execute-outputs']
      : ['pre-flight', 'claude-agent'];

    const steps: WorkflowStep[] = [
      {
        name: 'Download validation audit',
        uses: 'actions/download-artifact@v4',
        with: {
          name: 'validation-audit',
          path: '/tmp/audit-data/validation',
        },
        'continue-on-error': true,
      },
      {
        name: 'Download execution metrics',
        uses: 'actions/download-artifact@v4',
        with: {
          name: 'audit-metrics',
          path: '/tmp/audit-data/metrics',
        },
        'continue-on-error': true,
      },
    ];

    if (hasOutputs) {
      steps.push({
        name: 'Download output validation results',
        uses: 'actions/download-artifact@v4',
        with: {
          pattern: 'validation-results-*',
          path: '/tmp/audit-data/outputs',
          'merge-multiple': true,
        },
        'continue-on-error': true,
      });
    }

    // Generate the audit report and check for failures
    steps.push({
      name: 'Generate audit report and check status',
      id: 'audit-check',
      run: `
# Check if run was rate-limited (not a failure, just skipped)
RATE_LIMITED="\${{ needs.pre-flight.outputs.rate-limited }}"
if [ "\$RATE_LIMITED" = "true" ]; then
  echo "⏭️ Agent run was rate-limited. This is expected behavior, not a failure."
  echo "has-failures=false" >> \$GITHUB_OUTPUT
  exit 0
fi

# Initialize failure tracking
HAS_FAILURES="false"
FAILURE_REASONS=""

# Check job results
PRE_FLIGHT_RESULT="\${{ needs.pre-flight.result }}"
CLAUDE_AGENT_RESULT="\${{ needs.claude-agent.result }}"
${hasOutputs ? 'EXECUTE_OUTPUTS_RESULT="${{ needs.execute-outputs.result }}"' : ''}

if [ "\$PRE_FLIGHT_RESULT" != "success" ]; then
  HAS_FAILURES="true"
  FAILURE_REASONS="\${FAILURE_REASONS}Pre-flight validation failed (\$PRE_FLIGHT_RESULT)\\n"
fi

if [ "\$CLAUDE_AGENT_RESULT" != "success" ] && [ "\$CLAUDE_AGENT_RESULT" != "skipped" ]; then
  HAS_FAILURES="true"
  FAILURE_REASONS="\${FAILURE_REASONS}Claude agent execution failed (\$CLAUDE_AGENT_RESULT)\\n"
fi

${
  hasOutputs
    ? `
if [ "\$EXECUTE_OUTPUTS_RESULT" != "success" ] && [ "\$EXECUTE_OUTPUTS_RESULT" != "skipped" ]; then
  HAS_FAILURES="true"
  FAILURE_REASONS="\${FAILURE_REASONS}Output execution failed (\$EXECUTE_OUTPUTS_RESULT)\\n"
fi
`
    : ''
}

# Check for permission issues
PERMISSION_ISSUE_COUNT=0
if [ -f /tmp/audit-data/validation/permission-issues.json ]; then
  PERMISSION_ISSUE_COUNT=$(jq 'length' /tmp/audit-data/validation/permission-issues.json)
  if [ "\$PERMISSION_ISSUE_COUNT" -gt 0 ]; then
    HAS_FAILURES="true"
    FAILURE_REASONS="\${FAILURE_REASONS}Permission/validation issues detected (\$PERMISSION_ISSUE_COUNT)\\n"
  fi
fi

# Check if Claude had an error
if [ -f /tmp/audit-data/metrics/metrics.json ]; then
  IS_ERROR=$(jq -r '.is_error // false' /tmp/audit-data/metrics/metrics.json)
  if [ "\$IS_ERROR" = "true" ]; then
    HAS_FAILURES="true"
    FAILURE_REASONS="\${FAILURE_REASONS}Claude execution returned an error\\n"
  fi
fi

# Generate the audit report
mkdir -p /tmp/audit
cat > /tmp/audit/report.md << 'REPORT_EOF'
# Agent Execution Audit Report

**Agent:** ${agent.name}
**Workflow Run:** [\${{ github.run_id }}](\${{ github.server_url }}/\${{ github.repository }}/actions/runs/\${{ github.run_id }})
**Triggered by:** @\${{ github.actor }}
**Event:** \${{ github.event_name }}
**Timestamp:** $(date -u +%Y-%m-%dT%H:%M:%SZ)

REPORT_EOF

# Add job results
echo "## Job Results" >> /tmp/audit/report.md
echo "" >> /tmp/audit/report.md
echo "| Job | Result |" >> /tmp/audit/report.md
echo "|-----|--------|" >> /tmp/audit/report.md
echo "| pre-flight | \$([ \\"\$PRE_FLIGHT_RESULT\\" = \\"success\\" ] && echo '✅' || echo '❌') \$PRE_FLIGHT_RESULT |" >> /tmp/audit/report.md
echo "| claude-agent | \$([ \\"\$CLAUDE_AGENT_RESULT\\" = \\"success\\" ] && echo '✅' || [ \\"\$CLAUDE_AGENT_RESULT\\" = \\"skipped\\" ] && echo '⏭️' || echo '❌') \$CLAUDE_AGENT_RESULT |" >> /tmp/audit/report.md
${
  hasOutputs
    ? `echo "| execute-outputs | \$([ \\"\$EXECUTE_OUTPUTS_RESULT\\" = \\"success\\" ] && echo '✅' || [ \\"\$EXECUTE_OUTPUTS_RESULT\\" = \\"skipped\\" ] && echo '⏭️' || echo '❌') \$EXECUTE_OUTPUTS_RESULT |" >> /tmp/audit/report.md`
    : ''
}
echo "" >> /tmp/audit/report.md

# Add execution metrics if available
if [ -f /tmp/audit-data/metrics/metrics.json ]; then
  COST=$(jq -r '.total_cost_usd // "N/A"' /tmp/audit-data/metrics/metrics.json)
  TURNS=$(jq -r '.num_turns // "N/A"' /tmp/audit-data/metrics/metrics.json)
  DURATION=$(jq -r '.duration_ms // "N/A"' /tmp/audit-data/metrics/metrics.json)
  SESSION_ID=$(jq -r '.session_id // "N/A"' /tmp/audit-data/metrics/metrics.json)

  echo "## Execution Metrics" >> /tmp/audit/report.md
  echo "" >> /tmp/audit/report.md
  echo "| Metric | Value |" >> /tmp/audit/report.md
  echo "|--------|-------|" >> /tmp/audit/report.md
  echo "| Cost | \\$\${COST} |" >> /tmp/audit/report.md
  echo "| Turns | \${TURNS} |" >> /tmp/audit/report.md
  echo "| Duration | \${DURATION}ms |" >> /tmp/audit/report.md
  echo "| Session | \\\`\${SESSION_ID}\\\` |" >> /tmp/audit/report.md
  echo "" >> /tmp/audit/report.md
fi

# Add permission issues if any
if [ "\$PERMISSION_ISSUE_COUNT" -gt 0 ]; then
  echo "## Permission Issues" >> /tmp/audit/report.md
  echo "" >> /tmp/audit/report.md
  jq -r '.[] | "- **[\\(.severity | ascii_upcase)]** \\(.issue_type): \\(.message)"' /tmp/audit-data/validation/permission-issues.json >> /tmp/audit/report.md
  echo "" >> /tmp/audit/report.md
fi

# Output status for downstream steps
echo "has-failures=\$HAS_FAILURES" >> \$GITHUB_OUTPUT
echo "failure-reasons<<EOF" >> \$GITHUB_OUTPUT
echo -e "\$FAILURE_REASONS" >> \$GITHUB_OUTPUT
echo "EOF" >> \$GITHUB_OUTPUT

# Log summary (quiet mode for success)
if [ "\$HAS_FAILURES" = "true" ]; then
  echo "::error::Agent execution had failures"
  echo ""
  cat /tmp/audit/report.md
else
  echo "✅ Agent execution completed successfully"
  echo "📊 View full audit report in workflow artifacts"
fi
`,
    });

    // Add safe-mode diagnostic agent for failures (if create_issues is enabled)
    if (createIssues) {
      steps.push({
        name: 'Checkout repository for diagnosis',
        if: "steps.audit-check.outputs.has-failures == 'true'",
        uses: 'actions/checkout@v4',
      });

      steps.push({
        ...this.generateTokenGenerationStep(),
        if: "steps.audit-check.outputs.has-failures == 'true'",
      });

      steps.push({
        name: 'Setup Bun for diagnostic agent',
        if: "steps.audit-check.outputs.has-failures == 'true'",
        uses: 'oven-sh/setup-bun@v2',
        with: {
          'bun-version': 'latest',
        },
      });

      steps.push({
        name: 'Run safe-mode diagnostic agent',
        id: 'diagnostic',
        if: "steps.audit-check.outputs.has-failures == 'true'",
        env: {
          ANTHROPIC_API_KEY: '${{ secrets.ANTHROPIC_API_KEY }}',
          CLAUDE_CODE_OAUTH_TOKEN: '${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}',
        },
        run: `
# Prepare diagnostic context
cat > /tmp/diagnostic-prompt.md << 'DIAG_EOF'
You are a diagnostic agent analyzing a failed GitHub Actions workflow for the "${agent.name}" agent.

## Your Task
Analyze the failure data below and provide:
1. A clear summary of what went wrong
2. The root cause analysis
3. Specific remediation steps the user can take to fix the issue

## Failure Information
\${{ steps.audit-check.outputs.failure-reasons }}

## Audit Report
$(cat /tmp/audit/report.md)

## Validation Status
$(cat /tmp/audit-data/validation/validation-status.json 2>/dev/null || echo "Not available")

## Permission Issues
$(cat /tmp/audit-data/validation/permission-issues.json 2>/dev/null || echo "[]")

## Agent Configuration
- Agent name: ${agent.name}
- Triggers: ${JSON.stringify(agent.on)}
- Permissions: ${JSON.stringify(agent.permissions || {})}
- Outputs: ${JSON.stringify(Object.keys(agent.outputs || {}))}

## Instructions
Based on the above information:
1. Write a concise but complete diagnosis
2. Include specific file paths, configuration changes, or commands needed to fix the issue
3. If it's a permissions issue, explain exactly what permission is missing and where to add it
4. If it's a rate limit issue, explain when the user can retry
5. Format your response in clean markdown suitable for a GitHub issue

Do NOT use any tools that modify files. You are in read-only diagnostic mode.
DIAG_EOF

# Run diagnostic agent in safe mode (read-only tools)
bunx --bun @anthropic-ai/claude-code \\
  -p "$(cat /tmp/diagnostic-prompt.md)" \\
  --allowedTools "Read,Glob,Grep" \\
  --output-format json > /tmp/diagnostic-output.json 2>&1 || true

# Extract the diagnosis
if [ -f /tmp/diagnostic-output.json ]; then
  jq -r '.result // "Unable to generate diagnosis"' /tmp/diagnostic-output.json > /tmp/diagnosis.md
else
  echo "Diagnostic agent did not produce output. Manual investigation required." > /tmp/diagnosis.md
fi
`,
      });

      // Create GitHub issue with the diagnosis
      const labelsArg = auditLabels.length > 0 ? `--label "${auditLabels.join(',')}"` : '';
      const assigneesArg =
        auditAssignees.length > 0 ? `--assignee "${auditAssignees.join(',')}"` : '';

      steps.push({
        name: 'Create failure issue',
        if: "steps.audit-check.outputs.has-failures == 'true'",
        env: {
          GITHUB_TOKEN: '${{ steps.app-token.outputs.token }}',
        },
        run: `
# Build issue body
cat > /tmp/issue-body.md << 'ISSUE_EOF'
## 🚨 Agent Failure Report

The **${agent.name}** agent encountered failures during execution.

### Workflow Details
- **Run ID:** [\${{ github.run_id }}](\${{ github.server_url }}/\${{ github.repository }}/actions/runs/\${{ github.run_id }})
- **Triggered by:** @\${{ github.actor }}
- **Event:** \${{ github.event_name }}
- **Time:** $(date -u +%Y-%m-%dT%H:%M:%SZ)

### Failure Summary
\${{ steps.audit-check.outputs.failure-reasons }}

---

## 🔍 Diagnostic Analysis

$(cat /tmp/diagnosis.md)

---

## 📊 Full Audit Report

<details>
<summary>Click to expand audit report</summary>

$(cat /tmp/audit/report.md)

</details>

---

*This issue was automatically created by the Repo Agents audit system.*
ISSUE_EOF

# Check if a similar issue already exists (avoid duplicates)
EXISTING_ISSUE=$(gh issue list --state open --label "${auditLabels[0] || 'agent-failure'}" --search "${agent.name} failure" --json number --jq '.[0].number' 2>/dev/null || echo "")

if [ -n "\$EXISTING_ISSUE" ]; then
  echo "Adding comment to existing issue #\$EXISTING_ISSUE"
  gh issue comment "\$EXISTING_ISSUE" --body "$(cat /tmp/issue-body.md)"
else
  echo "Creating new failure issue"
  gh issue create \\
    --title "🚨 ${agent.name}: Agent Execution Failed" \\
    --body "$(cat /tmp/issue-body.md)" \\
    ${labelsArg} ${assigneesArg}
fi
`,
      });
    }

    // Always upload the audit report artifact
    steps.push({
      name: 'Upload audit report',
      if: 'always()',
      uses: 'actions/upload-artifact@v4',
      with: {
        name: 'audit-report',
        path: '/tmp/audit/',
        'if-no-files-found': 'ignore',
      },
    });

    return {
      'runs-on': 'ubuntu-latest',
      needs,
      if: 'always()',
      steps,
    };
  }

  // (intentionally removed)

  /**
   * Generates a step that creates a GitHub App token if GH_APP_ID and GH_APP_PRIVATE_KEY
   * secrets are configured. Falls back to GITHUB_TOKEN if not configured.
   *
   * Outputs:
   * - token: The GitHub token to use (app token or GITHUB_TOKEN)
   * - git-user: The git user.name to use (app name[bot] or github-actions[bot])
   * - git-email: The git user.email to use
   */
  private generateTokenGenerationStep(): WorkflowStep {
    return {
      name: 'Generate GitHub token',
      id: 'app-token',
      env: {
        GH_APP_ID: '${{ secrets.GH_APP_ID }}',
        GH_APP_PRIVATE_KEY: '${{ secrets.GH_APP_PRIVATE_KEY }}',
        FALLBACK_TOKEN: '${{ secrets.GITHUB_TOKEN }}',
      },
      run: `# Check if GitHub App is configured
if [ -z "$GH_APP_ID" ] || [ -z "$GH_APP_PRIVATE_KEY" ]; then
  echo "No GitHub App configured, using default GITHUB_TOKEN"
  echo "token=$FALLBACK_TOKEN" >> $GITHUB_OUTPUT
  echo "git-user=github-actions[bot]" >> $GITHUB_OUTPUT
  echo "git-email=github-actions[bot]@users.noreply.github.com" >> $GITHUB_OUTPUT
  exit 0
fi

echo "GitHub App configured, generating installation token..."

# Base64 URL-safe encoding function
base64url() {
  openssl base64 -A | tr '+/' '-_' | tr -d '='
}

# Generate JWT header
HEADER=$(echo -n '{"alg":"RS256","typ":"JWT"}' | base64url)

# Generate JWT payload (iat = now - 60s to account for clock drift, exp = now + 10 min)
NOW=$(date +%s)
IAT=$((NOW - 60))
EXP=$((NOW + 600))
PAYLOAD=$(echo -n "{\\"iat\\":$IAT,\\"exp\\":$EXP,\\"iss\\":\\"$GH_APP_ID\\"}" | base64url)

# Sign the JWT with the private key
UNSIGNED="$HEADER.$PAYLOAD"
SIGNATURE=$(echo -n "$UNSIGNED" | openssl dgst -sha256 -sign <(echo "$GH_APP_PRIVATE_KEY") | base64url)
JWT="$HEADER.$PAYLOAD.$SIGNATURE"

# Get installation ID for this repository
OWNER="\${{ github.repository_owner }}"
REPO_NAME="\${{ github.event.repository.name }}"
INSTALLATION_RESPONSE=$(curl -s -H "Authorization: Bearer $JWT" \\
  -H "Accept: application/vnd.github+json" \\
  -H "X-GitHub-Api-Version: 2022-11-28" \\
  "https://api.github.com/repos/$OWNER/$REPO_NAME/installation")

INSTALLATION_ID=$(echo "$INSTALLATION_RESPONSE" | jq -r '.id // empty')

if [ -z "$INSTALLATION_ID" ]; then
  echo "::warning::Failed to get installation ID. Is the GitHub App installed on this repository?"
  echo "::warning::Response: $INSTALLATION_RESPONSE"
  echo "Falling back to GITHUB_TOKEN"
  echo "token=$FALLBACK_TOKEN" >> $GITHUB_OUTPUT
  echo "git-user=github-actions[bot]" >> $GITHUB_OUTPUT
  echo "git-email=github-actions[bot]@users.noreply.github.com" >> $GITHUB_OUTPUT
  exit 0
fi

# Generate installation access token
TOKEN_RESPONSE=$(curl -s -X POST \\
  -H "Authorization: Bearer $JWT" \\
  -H "Accept: application/vnd.github+json" \\
  -H "X-GitHub-Api-Version: 2022-11-28" \\
  "https://api.github.com/app/installations/$INSTALLATION_ID/access_tokens")

TOKEN=$(echo "$TOKEN_RESPONSE" | jq -r '.token // empty')

if [ -z "$TOKEN" ]; then
  echo "::warning::Failed to generate installation token"
  echo "::warning::Response: $TOKEN_RESPONSE"
  echo "Falling back to GITHUB_TOKEN"
  echo "token=$FALLBACK_TOKEN" >> $GITHUB_OUTPUT
  echo "git-user=github-actions[bot]" >> $GITHUB_OUTPUT
  echo "git-email=github-actions[bot]@users.noreply.github.com" >> $GITHUB_OUTPUT
  exit 0
fi

# Mask the token in logs
echo "::add-mask::$TOKEN"

# Get app info for git identity
APP_RESPONSE=$(curl -s -H "Authorization: Bearer $JWT" \\
  -H "Accept: application/vnd.github+json" \\
  -H "X-GitHub-Api-Version: 2022-11-28" \\
  "https://api.github.com/app")

APP_SLUG=$(echo "$APP_RESPONSE" | jq -r '.slug // "github-app"')
APP_ID_NUM=$(echo "$APP_RESPONSE" | jq -r '.id // "0"')

echo "✓ Generated GitHub App token for $APP_SLUG"
echo "token=$TOKEN" >> $GITHUB_OUTPUT
echo "git-user=$APP_SLUG[bot]" >> $GITHUB_OUTPUT
echo "git-email=$APP_ID_NUM+$APP_SLUG[bot]@users.noreply.github.com" >> $GITHUB_OUTPUT`,
    };
  }

  /**
   * Generate a workflow that can be called by the dispatcher via workflow_call.
   * This is the primary generation mode - all agents are triggered through the dispatcher.
   */
  generateForDispatcher(agent: AgentDefinition): string {
    // Helper to escape GitHub expressions in template literals
    const ghExpr = (expr: string) => '$' + `{{ ${expr} }}`;

    interface WorkflowCallTrigger {
      workflow_call: {
        inputs: {
          'context-run-id': {
            description: string;
            required: boolean;
            type: string;
          };
        };
      };
    }

    const workflow: {
      name: string;
      on: WorkflowCallTrigger;
      permissions?: Record<string, string>;
      jobs: Record<string, GitHubWorkflowJob>;
    } = {
      name: agent.name,
      on: {
        workflow_call: {
          inputs: {
            'context-run-id': {
              description: 'Run ID of the dispatcher workflow (for artifact download)',
              required: true,
              type: 'string',
            },
          },
        },
      },
      jobs: {},
    };

    if (agent.permissions) {
      workflow.permissions = Object.entries(agent.permissions).reduce(
        (acc, [key, value]) => {
          const kebabKey = key.replace(/_/g, '-');
          acc[kebabKey] = value;
          return acc;
        },
        {} as Record<string, string>
      );
    }

    // Agent-specific validation (rate limit, labels, users) - secrets handled by dispatcher
    const validationSteps = this.generateAgentValidationSteps(agent);

    const preFlightOutputs: Record<string, string> = {
      'should-run':
        '$' +
        '{{ steps.set-output.outputs.should-run || steps.check-rate-limit.outputs.should-run }}',
      'rate-limited': '$' + '{{ steps.check-rate-limit.outputs.rate-limited }}',
      'app-token': '$' + '{{ steps.app-token.outputs.token }}',
      'git-user': '$' + '{{ steps.app-token.outputs.git-user }}',
      'git-email': '$' + '{{ steps.app-token.outputs.git-email }}',
    };

    workflow.jobs = {
      'pre-flight': {
        'runs-on': 'ubuntu-latest',
        outputs: preFlightOutputs,
        steps: [
          {
            name: 'Download dispatch context',
            uses: 'actions/download-artifact@v4',
            with: {
              name: `dispatch-context-${ghExpr('inputs.context-run-id')}`,
              path: '/tmp/dispatch-context/',
              'run-id': ghExpr('inputs.context-run-id'),
              'github-token': ghExpr('secrets.GITHUB_TOKEN'),
            },
          },
          {
            name: 'Load dispatch context',
            id: 'load-context',
            run: `if [ -f /tmp/dispatch-context/context.json ]; then
  echo "Dispatch context loaded:"
  cat /tmp/dispatch-context/context.json
  # Export context values as outputs
  echo "event-name=$(jq -r '.eventName' /tmp/dispatch-context/context.json)" >> $GITHUB_OUTPUT
  echo "event-action=$(jq -r '.eventAction' /tmp/dispatch-context/context.json)" >> $GITHUB_OUTPUT
else
  echo "::error::Dispatch context not found"
  exit 1
fi`,
          },
          ...validationSteps,
        ],
      },
    };

    // Add collect-inputs job if inputs are configured
    if (agent.inputs) {
      workflow.jobs['collect-inputs'] = this.generateCollectInputsJob(agent);
      workflow.jobs['claude-agent'] = {
        'runs-on': 'ubuntu-latest',
        needs: ['pre-flight', 'collect-inputs'],
        if: "needs.pre-flight.outputs.should-run == 'true' && needs.collect-inputs.outputs.has-inputs == 'true'",
        steps: this.generateClaudeAgentStepsForDispatcher(agent),
      };
    } else {
      workflow.jobs['claude-agent'] = {
        'runs-on': 'ubuntu-latest',
        needs: 'pre-flight',
        if: "needs.pre-flight.outputs.should-run == 'true'",
        steps: this.generateClaudeAgentStepsForDispatcher(agent),
      };
    }

    // Add execute-outputs job if outputs are configured
    if (agent.outputs && Object.keys(agent.outputs).length > 0) {
      workflow.jobs['execute-outputs'] = this.generateExecuteOutputsJob(agent);
      workflow.jobs['report-results'] = this.generateReportResultsJob(agent);
    }

    // Always add audit report job
    workflow.jobs['audit-report'] = this.generateAuditReportJob(agent);

    const yamlContent = yaml.dump(workflow, {
      lineWidth: -1,
      noRefs: true,
    });

    return this.formatYaml(yamlContent);
  }

  /**
   * Generate agent-specific validation steps (without shared validation handled by dispatcher).
   * Includes: token generation, rate limit check, label check, user authorization.
   */
  private generateAgentValidationSteps(agent: AgentDefinition): WorkflowStep[] {
    const allowedUsers = [...(agent.allowed_users || []), ...(agent.allowed_actors || [])];
    const allowedLabels = agent.trigger_labels || [];
    const rateLimitMinutes = agent.rate_limit_minutes ?? 5;

    const steps: WorkflowStep[] = [
      {
        name: 'Initialize audit tracking',
        id: 'init-audit',
        run: `mkdir -p /tmp/audit
echo '{
  "secrets_check": true,
  "user_authorization": false,
  "labels_check": false,
  "rate_limit_check": false
}' > /tmp/audit/validation-status.json
echo '[]' > /tmp/audit/permission-issues.json`,
      },
      this.generateTokenGenerationStep(),
    ];

    // User authorization check
    if (allowedUsers.length > 0 || (agent.allowed_teams && agent.allowed_teams.length > 0)) {
      const allowedUsersList = allowedUsers.length > 0 ? allowedUsers.join(' ') : '';
      const allowedTeamsList =
        agent.allowed_teams && agent.allowed_teams.length > 0 ? agent.allowed_teams.join(' ') : '';

      steps.push({
        name: 'Check user authorization',
        id: 'check-user',
        env: {
          GITHUB_TOKEN: '${{ steps.app-token.outputs.token }}',
        },
        run: `ACTOR="\${{ github.actor }}"
ALLOWED_USERS="${allowedUsersList}"
ALLOWED_TEAMS="${allowedTeamsList}"

USER_ALLOWED="false"

# Check explicit user list
if [ -n "\${ALLOWED_USERS}" ]; then
  for user in \${ALLOWED_USERS}; do
    if [ "\${ACTOR}" = "\${user}" ]; then
      USER_ALLOWED="true"
      echo "✓ User \${ACTOR} is in allowed users list"
      break
    fi
  done
fi

# Check team membership
if [ "\${USER_ALLOWED}" = "false" ] && [ -n "\${ALLOWED_TEAMS}" ]; then
  for team in \${ALLOWED_TEAMS}; do
    MEMBERSHIP=$(gh api "orgs/\${{ github.repository_owner }}/teams/\${team}/memberships/\${ACTOR}" --jq '.state' 2>/dev/null || echo "")
    if [ "\${MEMBERSHIP}" = "active" ]; then
      USER_ALLOWED="true"
      echo "✓ User \${ACTOR} is a member of team \${team}"
      break
    fi
  done
fi

if [ "\${USER_ALLOWED}" = "false" ]; then
  echo "::error::User \${ACTOR} is not authorized to trigger this agent"
  jq '. += [{
    "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
    "issue_type": "missing_permission",
    "severity": "error",
    "message": "User not authorized to trigger agent",
    "context": {"user": "'\${ACTOR}'"}
  }]' /tmp/audit/permission-issues.json > /tmp/audit/permission-issues.tmp
  mv /tmp/audit/permission-issues.tmp /tmp/audit/permission-issues.json
  echo "validation-failed=true" >> $GITHUB_OUTPUT
  exit 1
fi

jq '.user_authorization = true' /tmp/audit/validation-status.json > /tmp/audit/validation-status.tmp
mv /tmp/audit/validation-status.tmp /tmp/audit/validation-status.json`,
      });
    } else {
      // Default: check repository permission level
      steps.push({
        name: 'Check user authorization',
        id: 'check-user',
        env: {
          GITHUB_TOKEN: '${{ steps.app-token.outputs.token }}',
        },
        run: `ACTOR="\${{ github.actor }}"
USER_ASSOCIATION=$(gh api "repos/\${{ github.repository }}/collaborators/\${ACTOR}/permission" --jq '.permission' 2>/dev/null || echo "")

if [ "\${USER_ASSOCIATION}" = "admin" ] || [ "\${USER_ASSOCIATION}" = "write" ]; then
  echo "✓ User \${ACTOR} has \${USER_ASSOCIATION} permission"
else
  # Check if user is an org member
  ORG_MEMBER=$(gh api "orgs/\${{ github.repository_owner }}/members/\${ACTOR}" 2>/dev/null && echo "true" || echo "false")
  if [ "\${ORG_MEMBER}" = "true" ]; then
    echo "✓ User \${ACTOR} is an organization member"
  else
    echo "::error::User \${ACTOR} does not have sufficient permissions"
    jq '. += [{
      "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
      "issue_type": "missing_permission",
      "severity": "error",
      "message": "User not authorized",
      "context": {"user": "'\${ACTOR}'", "permission": "'\${USER_ASSOCIATION}'"}
    }]' /tmp/audit/permission-issues.json > /tmp/audit/permission-issues.tmp
    mv /tmp/audit/permission-issues.tmp /tmp/audit/permission-issues.json
    echo "validation-failed=true" >> $GITHUB_OUTPUT
    exit 1
  fi
fi

jq '.user_authorization = true' /tmp/audit/validation-status.json > /tmp/audit/validation-status.tmp
mv /tmp/audit/validation-status.tmp /tmp/audit/validation-status.json`,
      });
    }

    // Label check (if configured)
    if (allowedLabels.length > 0) {
      steps.push({
        name: 'Check required labels',
        id: 'check-labels',
        env: {
          GITHUB_TOKEN: '${{ steps.app-token.outputs.token }}',
        },
        run: `REQUIRED_LABELS="${allowedLabels.join(' ')}"

# Get issue/PR number from dispatch context
ISSUE_NUMBER=$(jq -r '.issue.number // .pullRequest.number // empty' /tmp/dispatch-context/context.json)

if [ -n "\${ISSUE_NUMBER}" ]; then
  CURRENT_LABELS=$(jq -r '.issue.labels // .pullRequest.labels | .[]' /tmp/dispatch-context/context.json 2>/dev/null | tr '\\n' ' ' || echo "")

  LABEL_FOUND="false"
  for required in \${REQUIRED_LABELS}; do
    if echo "\${CURRENT_LABELS}" | grep -qw "\${required}"; then
      LABEL_FOUND="true"
      echo "✓ Found required label: \${required}"
      break
    fi
  done

  if [ "\${LABEL_FOUND}" = "false" ]; then
    echo "::notice::Required label not found. Need one of: \${REQUIRED_LABELS}"
    jq '. += [{
      "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
      "issue_type": "validation_error",
      "severity": "error",
      "message": "Required label not found",
      "context": {"required_labels": "'\${REQUIRED_LABELS}'", "current_labels": "'\${CURRENT_LABELS}'"}
    }]' /tmp/audit/permission-issues.json > /tmp/audit/permission-issues.tmp
    mv /tmp/audit/permission-issues.tmp /tmp/audit/permission-issues.json
    echo "validation-failed=true" >> $GITHUB_OUTPUT
    exit 1
  fi
else
  echo "::warning::No issue or PR number in context, skipping label check"
fi

jq '.labels_check = true' /tmp/audit/validation-status.json > /tmp/audit/validation-status.tmp
mv /tmp/audit/validation-status.tmp /tmp/audit/validation-status.json`,
      });
    }

    // Rate limit check
    steps.push({
      name: 'Check rate limit',
      id: 'check-rate-limit',
      env: {
        GITHUB_TOKEN: '${{ steps.app-token.outputs.token }}',
      },
      run: `RATE_LIMIT_MINUTES=${rateLimitMinutes}

# Get recent workflow runs for this workflow
RECENT_RUNS=$(gh api "repos/\${{ github.repository }}/actions/runs" \\
  --jq "[.workflow_runs[] | select(.name == \\"\${{ github.workflow }}\\" and .status == \\"completed\\" and .conclusion == \\"success\\")] | .[0:5] | .[].created_at" 2>/dev/null || echo "")

if [ -n "\${RECENT_RUNS}" ]; then
  CURRENT_TIME=$(date +%s)

  for run_time in \${RECENT_RUNS}; do
    RUN_TIMESTAMP=$(date -d "\${run_time}" +%s 2>/dev/null || date -j -f "%Y-%m-%dT%H:%M:%SZ" "\${run_time}" +%s 2>/dev/null || echo "0")
    TIME_DIFF=$(( (CURRENT_TIME - RUN_TIMESTAMP) / 60 ))

    if [ "\${TIME_DIFF}" -lt "\${RATE_LIMIT_MINUTES}" ]; then
      echo "::notice::Rate limit: Agent ran \${TIME_DIFF} minutes ago. Minimum interval is \${RATE_LIMIT_MINUTES} minutes."
      echo "should-run=false" >> $GITHUB_OUTPUT
      echo "rate-limited=true" >> $GITHUB_OUTPUT
      exit 0
    fi
  done
fi
echo "✓ Rate limit check passed"

jq '.rate_limit_check = true' /tmp/audit/validation-status.json > /tmp/audit/validation-status.tmp
mv /tmp/audit/validation-status.tmp /tmp/audit/validation-status.json`,
    });

    steps.push({
      name: 'Set output',
      id: 'set-output',
      run: `echo "should-run=true" >> $GITHUB_OUTPUT
echo "✓ All validation checks passed"`,
    });

    steps.push({
      name: 'Upload validation audit data',
      if: 'always()',
      uses: 'actions/upload-artifact@v4',
      with: {
        name: 'validation-audit',
        path: '/tmp/audit/',
        'if-no-files-found': 'ignore',
      },
    });

    return steps;
  }

  /**
   * Generate Claude agent steps that use dispatch context instead of github.event.
   */
  private generateClaudeAgentStepsForDispatcher(agent: AgentDefinition): WorkflowStep[] {
    const instructions = agent.markdown.replace(/`/g, '\\`').replace(/\$/g, '\\$');

    const steps: WorkflowStep[] = [
      {
        name: 'Checkout repository',
        uses: 'actions/checkout@v4',
      },
      {
        name: 'Download dispatch context',
        uses: 'actions/download-artifact@v4',
        with: {
          name: 'dispatch-context-${{ inputs.context-run-id }}',
          path: '/tmp/dispatch-context/',
          'run-id': '${{ inputs.context-run-id }}',
          'github-token': '${{ secrets.GITHUB_TOKEN }}',
        },
      },
      {
        name: 'Setup Bun',
        uses: 'oven-sh/setup-bun@v2',
        with: {
          'bun-version': 'latest',
        },
      },
    ];

    // Create outputs directory if outputs are configured
    if (agent.outputs && Object.keys(agent.outputs).length > 0) {
      steps.push({
        name: 'Create outputs directory',
        run: 'mkdir -p /tmp/outputs /tmp/validation-errors',
      });
    }

    // Prepare context file from dispatch context
    steps.push({
      name: 'Prepare context file',
      id: 'prepare',
      run: `# Build context from dispatch context artifact
EVENT_NAME=$(jq -r '.eventName' /tmp/dispatch-context/context.json)
REPOSITORY=$(jq -r '.repository' /tmp/dispatch-context/context.json)

cat > /tmp/context.txt << CONTEXT_EOF
GitHub Event: \${EVENT_NAME}
Repository: \${REPOSITORY}
CONTEXT_EOF

# Add issue context if present
if jq -e '.issue' /tmp/dispatch-context/context.json > /dev/null 2>&1; then
  ISSUE_NUMBER=$(jq -r '.issue.number' /tmp/dispatch-context/context.json)
  ISSUE_TITLE=$(jq -r '.issue.title' /tmp/dispatch-context/context.json)
  ISSUE_AUTHOR=$(jq -r '.issue.author' /tmp/dispatch-context/context.json)
  ISSUE_BODY=$(jq -r '.issue.body' /tmp/dispatch-context/context.json)

  cat >> /tmp/context.txt << ISSUE_EOF
Issue #\${ISSUE_NUMBER}: \${ISSUE_TITLE}
Author: @\${ISSUE_AUTHOR}
Body:
\${ISSUE_BODY}
ISSUE_EOF
fi

# Add PR context if present
if jq -e '.pullRequest' /tmp/dispatch-context/context.json > /dev/null 2>&1; then
  PR_NUMBER=$(jq -r '.pullRequest.number' /tmp/dispatch-context/context.json)
  PR_TITLE=$(jq -r '.pullRequest.title' /tmp/dispatch-context/context.json)
  PR_AUTHOR=$(jq -r '.pullRequest.author' /tmp/dispatch-context/context.json)
  PR_BODY=$(jq -r '.pullRequest.body' /tmp/dispatch-context/context.json)

  cat >> /tmp/context.txt << PR_EOF
PR #\${PR_NUMBER}: \${PR_TITLE}
Author: @\${PR_AUTHOR}
Body:
\${PR_BODY}
PR_EOF
fi

# Add discussion context if present
if jq -e '.discussion' /tmp/dispatch-context/context.json > /dev/null 2>&1; then
  DISC_NUMBER=$(jq -r '.discussion.number' /tmp/dispatch-context/context.json)
  DISC_TITLE=$(jq -r '.discussion.title' /tmp/dispatch-context/context.json)
  DISC_AUTHOR=$(jq -r '.discussion.author' /tmp/dispatch-context/context.json)
  DISC_BODY=$(jq -r '.discussion.body' /tmp/dispatch-context/context.json)
  DISC_CATEGORY=$(jq -r '.discussion.category' /tmp/dispatch-context/context.json)

  cat >> /tmp/context.txt << DISC_EOF
Discussion #\${DISC_NUMBER}: \${DISC_TITLE}
Category: \${DISC_CATEGORY}
Author: @\${DISC_AUTHOR}
Body:
\${DISC_BODY}
DISC_EOF
fi`,
    });

    // Add collected inputs to context if available
    if (agent.inputs) {
      steps.push({
        name: 'Add collected inputs to context',
        if: "needs.collect-inputs.outputs.has-inputs == 'true'",
        run:
          "cat >> /tmp/context.txt << 'INPUTS_EOF'\n" +
          '\n' +
          '## Collected Inputs\n' +
          '\n' +
          'The following data has been collected from the repository:\n' +
          '\n' +
          '$' +
          '{{ needs.collect-inputs.outputs.inputs-data }}\n' +
          'INPUTS_EOF',
      });
    }

    // Add dynamic context for outputs if configured
    if (agent.outputs && Object.keys(agent.outputs).length > 0) {
      const runtime = this.createRuntimeContext(agent);

      for (const [outputType] of Object.entries(agent.outputs)) {
        try {
          const handler = getOutputHandler(outputType as Output);
          const contextScript = handler.getContextScript(runtime);

          if (contextScript) {
            steps.push({
              name: `Fetch ${outputType} context`,
              env: {
                GITHUB_TOKEN: '${{ needs.pre-flight.outputs.app-token }}',
              },
              run: contextScript.trim(),
            });
          }
        } catch {
          logger.warn(`No handler found for output type: ${outputType}`);
        }
      }
    }

    // Create Claude skills file if outputs are configured
    if (agent.outputs && Object.keys(agent.outputs).length > 0) {
      const skillsContent = this.generateSkillsFile(agent);
      const escapedSkills = skillsContent.replace(/`/g, '\\`').replace(/\$/g, '\\$');

      steps.push({
        name: 'Create Claude skills file',
        run:
          "mkdir -p .claude && cat > .claude/CLAUDE.md << 'SKILLS_EOF'\n" +
          escapedSkills +
          '\n' +
          'SKILLS_EOF',
      });
    }

    // Add instructions to context file
    steps.push({
      name: 'Add agent instructions',
      run:
        "cat >> /tmp/context.txt << 'INSTRUCTIONS_EOF'\n" +
        '\n' +
        '---\n' +
        '\n' +
        instructions +
        '\n' +
        'INSTRUCTIONS_EOF',
    });

    // Run agent with the prepared context
    const hasOutputs = !!agent.outputs && Object.keys(agent.outputs).length > 0;
    const allowedTools = hasOutputs ? 'Write(/tmp/outputs/*),Read,Glob,Grep' : 'Read,Glob,Grep';

    const provider = getProviderAdapter(agent.provider);
    steps.push(...provider.generateInstallSteps());
    steps.push(
      provider.generateRunStep(agent, {
        allowedTools,
        hasOutputs,
        environment: {
          ANTHROPIC_API_KEY: '${{ secrets.ANTHROPIC_API_KEY }}',
          CLAUDE_CODE_OAUTH_TOKEN: '${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}',
          GITHUB_TOKEN: '${{ steps.app-token.outputs.token }}',
          GH_TOKEN: '${{ steps.app-token.outputs.token }}',
        },
      })
    );

    // Add the rest of the steps (metrics extraction, output upload, etc.)
    steps.push({
      name: 'Extract execution metrics',
      id: 'extract-metrics',
      if: 'always()',
      run: `if [ -f /tmp/claude-output.json ]; then
  echo "=== Claude Execution Summary ==="

  # Extract metrics using jq
  COST=$(jq -r '.total_cost_usd // "N/A"' /tmp/claude-output.json)
  TURNS=$(jq -r '.num_turns // "N/A"' /tmp/claude-output.json)
  DURATION=$(jq -r '.duration_ms // "N/A"' /tmp/claude-output.json)
  IS_ERROR=$(jq -r '.is_error // false' /tmp/claude-output.json)

  echo "Cost: \\$\${COST}"
  echo "Turns: \${TURNS}"
  echo "Duration: \${DURATION}ms"
  echo "Error: \${IS_ERROR}"

  # Set outputs for downstream jobs
  echo "cost=\${COST}" >> $GITHUB_OUTPUT
  echo "turns=\${TURNS}" >> $GITHUB_OUTPUT
  echo "duration=\${DURATION}" >> $GITHUB_OUTPUT
  echo "is-error=\${IS_ERROR}" >> $GITHUB_OUTPUT

  if [ "\${IS_ERROR}" = "true" ]; then
    echo "claude-error=true" >> $GITHUB_OUTPUT
    echo "::warning::Claude execution completed with errors"
  fi
else
  echo "::warning::Claude output file not found"
  echo "cost=N/A" >> $GITHUB_OUTPUT
  echo "turns=N/A" >> $GITHUB_OUTPUT
  echo "duration=N/A" >> $GITHUB_OUTPUT
  echo "is-error=true" >> $GITHUB_OUTPUT
  echo "claude-error=true" >> $GITHUB_OUTPUT
fi`,
    });

    // Upload outputs if configured
    if (agent.outputs && Object.keys(agent.outputs).length > 0) {
      steps.push({
        name: 'Upload outputs',
        if: 'always()',
        uses: 'actions/upload-artifact@v4',
        with: {
          name: 'claude-outputs',
          path: '/tmp/outputs/',
          'if-no-files-found': 'ignore',
        },
      });
    }

    // Upload Claude execution data
    steps.push({
      name: 'Upload Claude execution data',
      if: 'always()',
      uses: 'actions/upload-artifact@v4',
      with: {
        name: 'claude-execution',
        path: '/tmp/claude-output.json',
        'if-no-files-found': 'ignore',
      },
    });

    return steps;
  }

  async writeWorkflow(
    agent: AgentDefinition,
    outputDir: string,
    dispatcherMode = true
  ): Promise<string> {
    const workflowName = agentNameToWorkflowName(agent.name);
    const fileName = `${workflowName}.yml`;
    const filePath = `${outputDir}/${fileName}`;

    // Always use dispatcher mode since that's the only supported mode now
    const content = dispatcherMode ? this.generateForDispatcher(agent) : this.generate(agent);
    await writeFile(filePath, content, 'utf-8');

    return filePath;
  }
}

export const workflowGenerator = new WorkflowGenerator();

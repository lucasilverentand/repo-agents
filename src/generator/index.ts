import { writeFile } from 'fs/promises';
import yaml from 'js-yaml';
import type { AgentDefinition, WorkflowStep, Output } from '../types';
import { agentNameToWorkflowName } from '../cli/utils/files';
import { getOutputHandler } from './outputs';
import type { RuntimeContext } from './outputs/base';
import { inputCollector } from './input-collector';

export class WorkflowGenerator {
  generate(agent: AgentDefinition): string {
    const workflow: any = {
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
      'should-run': '$' + '{{ steps.set-output.outputs.should-run }}',
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

  private generateTriggers(agent: AgentDefinition): any {
    const triggers: any = {};

    if (agent.on.issues) {
      triggers.issues = agent.on.issues;
    }

    if (agent.on.pull_request) {
      triggers.pull_request = agent.on.pull_request;
    }

    if (agent.on.discussion) {
      triggers.discussion = agent.on.discussion;
    }

    if (agent.on.schedule) {
      triggers.schedule = agent.on.schedule;
    }

    if (agent.on.workflow_dispatch) {
      triggers.workflow_dispatch = agent.on.workflow_dispatch;
    }

    if (agent.on.repository_dispatch) {
      triggers.repository_dispatch = agent.on.repository_dispatch;
    }

    return triggers;
  }

  private generateValidationSteps(agent: AgentDefinition): any[] {
    const allowedUsers = [...(agent.allowed_users || []), ...(agent.allowed_actors || [])];
    const allowedLabels = agent.trigger_labels || [];
    const rateLimitMinutes = agent.rate_limit_minutes ?? 5;

    const steps: any[] = [
      {
        name: 'Check secrets',
        id: 'check-secrets',
        env: {
          ANTHROPIC_API_KEY: '${{ secrets.ANTHROPIC_API_KEY }}',
          CLAUDE_CODE_OAUTH_TOKEN: '${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}',
        },
        run: `if [ -z "\${ANTHROPIC_API_KEY}" ] && [ -z "\${CLAUDE_CODE_OAUTH_TOKEN}" ]; then
  echo "::error::No Claude authentication found. Please set either ANTHROPIC_API_KEY or CLAUDE_CODE_OAUTH_TOKEN in your repository secrets."
  echo "validation-failed=true" >> $GITHUB_OUTPUT
  exit 1
fi

if [ -n "\${ANTHROPIC_API_KEY}" ]; then
  echo "✓ ANTHROPIC_API_KEY is configured"
fi
if [ -n "\${CLAUDE_CODE_OAUTH_TOKEN}" ]; then
  echo "✓ CLAUDE_CODE_OAUTH_TOKEN is configured"
fi`,
      },
      {
        name: 'Check user authorization',
        id: 'check-user',
        env: {
          GITHUB_TOKEN: '${{ secrets.GITHUB_TOKEN }}',
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
  echo "validation-failed=true" >> $GITHUB_OUTPUT
  exit 1
fi`,
      },
    ];

    // Only add label check step if labels are configured
    if (allowedLabels.length > 0) {
      steps.push({
        name: 'Check required labels',
        id: 'check-labels',
        env: {
          GITHUB_TOKEN: '${{ secrets.GITHUB_TOKEN }}',
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
    echo "validation-failed=true" >> $GITHUB_OUTPUT
    exit 1
  fi
else
  echo "::warning::No issue or PR number found, skipping label check"
fi`,
      });
    }

    steps.push({
      name: 'Check rate limit',
      id: 'check-rate-limit',
      env: {
        GITHUB_TOKEN: '${{ secrets.GITHUB_TOKEN }}',
      },
      run: `RATE_LIMIT_MINUTES=${rateLimitMinutes}

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
      echo "::warning::Rate limit: Agent ran \${TIME_DIFF} minutes ago. Minimum interval is \${RATE_LIMIT_MINUTES} minutes."
      echo "validation-failed=true" >> $GITHUB_OUTPUT
      exit 1
    fi
  done
fi
echo "✓ Rate limit check passed"`,
    });

    steps.push({
      name: 'Set output',
      id: 'set-output',
      run: `echo "should-run=true" >> $GITHUB_OUTPUT
echo "✓ All validation checks passed"`,
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
      {
        name: 'Setup Bun',
        uses: 'oven-sh/setup-bun@v2',
        with: {
          'bun-version': 'latest',
        },
      },
      {
        name: 'Install Claude Code CLI',
        run: 'bunx --bun @anthropic-ai/claude-code --version',
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
                GITHUB_TOKEN: '${{ secrets.GITHUB_TOKEN }}',
              },
              run: contextScript.trim(),
            });
          }
        } catch {
          // Handler not found - skip
          console.warn(`Warning: No handler found for output type: ${outputType}`);
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
          "mkdir -p /tmp/claude && cat > /tmp/claude/CLAUDE.md << 'SKILLS_EOF'\n" +
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

    // Run Claude with the prepared context
    const allowedTools =
      agent.outputs && Object.keys(agent.outputs).length > 0
        ? 'Write(/tmp/outputs/*),Read,Glob,Grep'
        : 'Read,Glob,Grep';

    const claudeCommand =
      agent.outputs && Object.keys(agent.outputs).length > 0
        ? `cd /tmp/claude && bunx --bun @anthropic-ai/claude-code -p "$(cat /tmp/context.txt)" --allowedTools "${allowedTools}" --permission-mode bypassPermissions`
        : `bunx --bun @anthropic-ai/claude-code -p "$(cat /tmp/context.txt)" --allowedTools "${allowedTools}"`;

    steps.push({
      name: 'Run Claude Agent',
      env: this.generateEnvironment(agent),
      run: claudeCommand,
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
        console.warn(`Warning: No handler found for output type: ${outputType}`);
      }
    }

    return skills.join('\n');
  }

  private generateCollectInputsJob(agent: AgentDefinition): any {
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
        {
          name: 'Collect repository data',
          id: 'collect',
          env: {
            GITHUB_TOKEN: '$' + '{{ secrets.GITHUB_TOKEN }}',
          },
          run: collectionScript,
        },
      ],
    };
  }

  private generateExecuteOutputsJob(agent: AgentDefinition): any {
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
            GITHUB_TOKEN: '${{ secrets.GITHUB_TOKEN }}',
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
        console.warn(`Warning: No handler found for output type: ${outputType}`);
      }
    }

    return scripts.join('\n');
  }

  private generateReportResultsJob(agent: AgentDefinition): any {
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
        {
          name: 'Report validation errors',
          env: {
            GITHUB_TOKEN: '${{ secrets.GITHUB_TOKEN }}',
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
  ISSUE_OR_PR_NUMBER="${runtime.issueNumber || runtime.prNumber}"
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

  private generateEnvironment(_agent: AgentDefinition): Record<string, string> {
    return {
      ANTHROPIC_API_KEY: '${{ secrets.ANTHROPIC_API_KEY }}',
      CLAUDE_CODE_OAUTH_TOKEN: '${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}',
      GITHUB_TOKEN: '${{ secrets.GITHUB_TOKEN }}',
    };
  }

  async writeWorkflow(agent: AgentDefinition, outputDir: string): Promise<string> {
    const workflowName = agentNameToWorkflowName(agent.name);
    const fileName = `${workflowName}.yml`;
    const filePath = `${outputDir}/${fileName}`;

    const content = this.generate(agent);
    await writeFile(filePath, content, 'utf-8');

    return filePath;
  }
}

export const workflowGenerator = new WorkflowGenerator();

import yaml from 'js-yaml';
import type {
  AgentDefinition,
  TriggerConfig,
  RoutingRule,
  WorkflowStep,
  TriggerEventType,
} from '../types';
import { agentNameToWorkflowName } from '../cli/utils/files';

interface DispatcherWorkflowJob {
  'runs-on': string;
  needs?: string | string[];
  if?: string;
  outputs?: Record<string, string>;
  strategy?: Record<string, unknown>;
  steps: WorkflowStep[];
}

interface DispatcherWorkflow {
  name: string;
  on: TriggerConfig;
  permissions: Record<string, string>;
  jobs: Record<string, DispatcherWorkflowJob>;
}

export class DispatcherGenerator {
  /**
   * Aggregate triggers from all agents into a single TriggerConfig.
   * Event types are unioned (e.g., issues: [opened, labeled] from multiple agents).
   * Schedules are collected as unique cron expressions.
   */
  aggregateTriggers(agents: AgentDefinition[]): TriggerConfig {
    const triggers: TriggerConfig = {};
    const issueTypes = new Set<string>();
    const prTypes = new Set<string>();
    const discussionTypes = new Set<string>();
    const schedules: Array<{ cron: string }> = [];
    const seenCrons = new Set<string>();
    const repoDispatchTypes = new Set<string>();

    for (const agent of agents) {
      // Issues
      if (agent.on.issues?.types) {
        agent.on.issues.types.forEach((t) => issueTypes.add(t));
      }

      // Pull requests
      if (agent.on.pull_request?.types) {
        agent.on.pull_request.types.forEach((t) => prTypes.add(t));
      }

      // Discussions
      if (agent.on.discussion?.types) {
        agent.on.discussion.types.forEach((t) => discussionTypes.add(t));
      }

      // Schedule - collect unique cron expressions
      if (agent.on.schedule) {
        for (const schedule of agent.on.schedule) {
          if (!seenCrons.has(schedule.cron)) {
            seenCrons.add(schedule.cron);
            schedules.push({ cron: schedule.cron });
          }
        }
      }

      // Repository dispatch types
      if (agent.on.repository_dispatch?.types) {
        agent.on.repository_dispatch.types.forEach((t) => repoDispatchTypes.add(t));
      }
    }

    if (issueTypes.size > 0) {
      triggers.issues = { types: Array.from(issueTypes).sort() };
    }

    if (prTypes.size > 0) {
      triggers.pull_request = { types: Array.from(prTypes).sort() };
    }

    if (discussionTypes.size > 0) {
      triggers.discussion = { types: Array.from(discussionTypes).sort() };
    }

    if (schedules.length > 0) {
      triggers.schedule = schedules;
    }

    if (repoDispatchTypes.size > 0) {
      triggers.repository_dispatch = { types: Array.from(repoDispatchTypes).sort() };
    }

    // Always add workflow_dispatch for manual runs with optional agent selection
    triggers.workflow_dispatch = {
      inputs: {
        agent: {
          description: 'Specific agent to run (leave empty to auto-route based on event)',
          required: false,
          type: 'string',
        },
      },
    };

    return triggers;
  }

  /**
   * Generate routing rules that map events to agent workflows.
   */
  generateRoutingTable(agents: AgentDefinition[]): RoutingRule[] {
    const rules: RoutingRule[] = [];

    for (const agent of agents) {
      const rule: RoutingRule = {
        agentName: agent.name,
        workflowFile: `${agentNameToWorkflowName(agent.name)}.yml`,
        triggers: [],
      };

      // Issues
      if (agent.on.issues?.types) {
        rule.triggers.push({
          eventType: 'issues' as TriggerEventType,
          eventActions: agent.on.issues.types,
        });
      }

      // Pull requests
      if (agent.on.pull_request?.types) {
        rule.triggers.push({
          eventType: 'pull_request' as TriggerEventType,
          eventActions: agent.on.pull_request.types,
        });
      }

      // Discussions
      if (agent.on.discussion?.types) {
        rule.triggers.push({
          eventType: 'discussion' as TriggerEventType,
          eventActions: agent.on.discussion.types,
        });
      }

      // Schedule - one entry per cron expression
      if (agent.on.schedule) {
        for (const schedule of agent.on.schedule) {
          rule.triggers.push({
            eventType: 'schedule' as TriggerEventType,
            schedule: schedule.cron,
          });
        }
      }

      // Repository dispatch
      if (agent.on.repository_dispatch?.types) {
        rule.triggers.push({
          eventType: 'repository_dispatch' as TriggerEventType,
          dispatchTypes: agent.on.repository_dispatch.types,
        });
      }

      // Workflow dispatch - all agents can be manually triggered
      rule.triggers.push({
        eventType: 'workflow_dispatch' as TriggerEventType,
      });

      rules.push(rule);
    }

    return rules;
  }

  /**
   * Aggregate permissions from all agents.
   */
  private aggregatePermissions(agents: AgentDefinition[]): Record<string, string> {
    const permissions: Record<string, string> = {
      actions: 'write', // Required to trigger workflows
      contents: 'read', // Default read access
      issues: 'write', // Required for self-healing issue creation
    };

    for (const agent of agents) {
      if (agent.permissions) {
        for (const [key, value] of Object.entries(agent.permissions)) {
          const kebabKey = key.replace(/_/g, '-');
          // Upgrade to write if any agent needs write
          if (value === 'write' || permissions[kebabKey] !== 'write') {
            permissions[kebabKey] = value;
          }
        }
      }
    }

    return permissions;
  }

  /**
   * Generate the dispatcher workflow YAML.
   */
  generate(agents: AgentDefinition[]): string {
    const triggers = this.aggregateTriggers(agents);
    const routingTable = this.generateRoutingTable(agents);
    const permissions = this.aggregatePermissions(agents);

    const workflow: DispatcherWorkflow = {
      name: 'Claude Agent Dispatcher',
      on: triggers,
      permissions,
      jobs: {
        'pre-flight': {
          'runs-on': 'ubuntu-latest',
          outputs: {
            'should-continue': "${{ steps.check-config.outputs.config-valid }}",
            'app-token': "${{ steps.app-token.outputs.token }}",
            'git-user': "${{ steps.app-token.outputs.git-user }}",
            'git-email': "${{ steps.app-token.outputs.git-email }}",
          },
          steps: this.generatePreFlightSteps(),
        },
        'prepare-context': {
          'runs-on': 'ubuntu-latest',
          needs: 'pre-flight',
          if: "needs.pre-flight.outputs.should-continue == 'true'",
          outputs: {
            'run-id': '${{ github.run_id }}',
          },
          steps: this.generateContextSteps(),
        },
        'route-event': {
          'runs-on': 'ubuntu-latest',
          needs: 'prepare-context',
          outputs: {
            'matching-agents': '${{ steps.route.outputs.agents }}',
          },
          steps: this.generateRoutingSteps(routingTable),
        },
        'dispatch-agents': this.generateDispatchJob(),
      },
    };

    const yamlContent = yaml.dump(workflow, {
      lineWidth: -1,
      noRefs: true,
    });

    return this.formatYaml(yamlContent);
  }

  private generatePreFlightSteps(): WorkflowStep[] {
    return [
      {
        name: 'Check configuration',
        id: 'check-config',
        env: {
          ANTHROPIC_API_KEY: '${{ secrets.ANTHROPIC_API_KEY }}',
          CLAUDE_CODE_OAUTH_TOKEN: '${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}',
          GH_TOKEN: '${{ secrets.GITHUB_TOKEN }}',
        },
        run: `ERRORS=""

# Check Claude authentication
if [ -z "\${ANTHROPIC_API_KEY}" ] && [ -z "\${CLAUDE_CODE_OAUTH_TOKEN}" ]; then
  ERRORS="\${ERRORS}- Missing Claude authentication (ANTHROPIC_API_KEY or CLAUDE_CODE_OAUTH_TOKEN)\\n"
fi

if [ -n "$ERRORS" ]; then
  echo "config-valid=false" >> $GITHUB_OUTPUT
  echo -e "$ERRORS" > /tmp/config-errors.txt
  echo "::error::Configuration errors detected. Creating issue and disabling workflow."
else
  echo "config-valid=true" >> $GITHUB_OUTPUT
  echo "✓ Configuration valid"
fi`,
      },
      {
        name: 'Self-heal on configuration error',
        if: "steps.check-config.outputs.config-valid == 'false'",
        env: {
          GH_TOKEN: '${{ secrets.GITHUB_TOKEN }}',
        },
        run: `# Check for existing configuration issue
EXISTING=$(gh issue list --state open --label "repo-agents-config" --json number -q '.[0].number' 2>/dev/null || echo "")

ERRORS=$(cat /tmp/config-errors.txt 2>/dev/null || echo "Unknown configuration error")

if [ -z "$EXISTING" ]; then
  gh issue create \\
    --title "Claude Dispatcher: Configuration Required" \\
    --body "## Configuration Error

The Claude agent dispatcher detected missing configuration and has been disabled.

### Issues Found

$ERRORS

### How to Fix

1. **Add Claude authentication:**
   \\\`\\\`\\\`bash
   repo-agents setup-token
   \\\`\\\`\\\`

2. **Re-enable the dispatcher:**
   \\\`\\\`\\\`bash
   gh workflow enable claude-dispatcher.yml
   \\\`\\\`\\\`

3. **Test the configuration:**
   \\\`\\\`\\\`bash
   gh workflow run claude-dispatcher.yml
   \\\`\\\`\\\`

---
*This issue was automatically created by the Claude agent dispatcher.*" \\
    --label "repo-agents-config"
  echo "Created configuration issue"
else
  gh issue comment "$EXISTING" --body "Configuration check failed again at $(date -u +%Y-%m-%dT%H:%M:%SZ):

$ERRORS"
  echo "Updated existing configuration issue #$EXISTING"
fi

# Disable the dispatcher workflow
gh workflow disable claude-dispatcher.yml || echo "::warning::Could not disable workflow. Please disable manually."
echo "Dispatcher workflow disabled due to configuration errors."`,
      },
      this.generateTokenGenerationStep(),
    ];
  }

  private generateTokenGenerationStep(): WorkflowStep {
    return {
      name: 'Generate GitHub token',
      id: 'app-token',
      if: "steps.check-config.outputs.config-valid == 'true'",
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

  private generateContextSteps(): WorkflowStep[] {
    // Use string concatenation to avoid TypeScript template literal parsing issues with ${{ }}
    const ghExpr = (expr: string) => '$' + `{{ ${expr} }}`;

    const contextScript = [
      'mkdir -p /tmp/dispatch-context',
      '',
      '# Build context JSON using jq to handle escaping properly',
      'jq -n \\',
      `  --arg dispatchId "${ghExpr('github.run_id')}-${ghExpr('github.run_attempt')}" \\`,
      '  --arg dispatchedAt "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \\',
      `  --arg dispatcherRunId "${ghExpr('github.run_id')}" \\`,
      `  --arg dispatcherRunUrl "${ghExpr('github.server_url')}/${ghExpr('github.repository')}/actions/runs/${ghExpr('github.run_id')}" \\`,
      `  --arg eventName "${ghExpr('github.event_name')}" \\`,
      `  --arg eventAction "${ghExpr('github.event.action')}" \\`,
      `  --arg repository "${ghExpr('github.repository')}" \\`,
      `  --arg ref "${ghExpr('github.ref')}" \\`,
      `  --arg sha "${ghExpr('github.sha')}" \\`,
      `  --arg actor "${ghExpr('github.actor')}" \\`,
      "  '{",
      '    dispatchId: $dispatchId,',
      '    dispatchedAt: $dispatchedAt,',
      '    dispatcherRunId: $dispatcherRunId,',
      '    dispatcherRunUrl: $dispatcherRunUrl,',
      '    eventName: $eventName,',
      '    eventAction: $eventAction,',
      '    repository: $repository,',
      '    ref: $ref,',
      '    sha: $sha,',
      '    actor: $actor',
      "  }' > /tmp/dispatch-context/context.json",
      '',
      '# Add event-specific data',
      `EVENT_NAME="${ghExpr('github.event_name')}"`,
      '',
      'case "$EVENT_NAME" in',
      '  issues)',
      `    jq --arg author "${ghExpr('github.event.issue.user.login')}" \\`,
      `       --arg state "${ghExpr('github.event.issue.state')}" \\`,
      `       --arg url "${ghExpr('github.event.issue.html_url')}" \\`,
      `       --argjson number ${ghExpr('github.event.issue.number')} \\`,
      `       --argjson title ${ghExpr('toJson(github.event.issue.title)')} \\`,
      `       --argjson body ${ghExpr('toJson(github.event.issue.body)')} \\`,
      `       --argjson labels ${ghExpr('toJson(github.event.issue.labels.*.name)')} \\`,
      "       '. + {issue: {number: $number, title: $title, body: $body, author: $author, labels: $labels, state: $state, url: $url}}' \\",
      '       /tmp/dispatch-context/context.json > /tmp/dispatch-context/context.tmp.json',
      '    mv /tmp/dispatch-context/context.tmp.json /tmp/dispatch-context/context.json',
      '    ;;',
      '  pull_request)',
      `    jq --arg author "${ghExpr('github.event.pull_request.user.login')}" \\`,
      `       --arg state "${ghExpr('github.event.pull_request.state')}" \\`,
      `       --arg baseBranch "${ghExpr('github.event.pull_request.base.ref')}" \\`,
      `       --arg headBranch "${ghExpr('github.event.pull_request.head.ref')}" \\`,
      `       --arg url "${ghExpr('github.event.pull_request.html_url')}" \\`,
      `       --argjson number ${ghExpr('github.event.pull_request.number')} \\`,
      `       --argjson title ${ghExpr('toJson(github.event.pull_request.title)')} \\`,
      `       --argjson body ${ghExpr('toJson(github.event.pull_request.body)')} \\`,
      `       --argjson labels ${ghExpr('toJson(github.event.pull_request.labels.*.name)')} \\`,
      "       '. + {pullRequest: {number: $number, title: $title, body: $body, author: $author, labels: $labels, baseBranch: $baseBranch, headBranch: $headBranch, state: $state, url: $url}}' \\",
      '       /tmp/dispatch-context/context.json > /tmp/dispatch-context/context.tmp.json',
      '    mv /tmp/dispatch-context/context.tmp.json /tmp/dispatch-context/context.json',
      '    ;;',
      '  discussion)',
      `    jq --arg author "${ghExpr('github.event.discussion.user.login')}" \\`,
      `       --arg category "${ghExpr('github.event.discussion.category.name')}" \\`,
      `       --arg url "${ghExpr('github.event.discussion.html_url')}" \\`,
      `       --argjson number ${ghExpr('github.event.discussion.number')} \\`,
      `       --argjson title ${ghExpr('toJson(github.event.discussion.title)')} \\`,
      `       --argjson body ${ghExpr('toJson(github.event.discussion.body)')} \\`,
      "       '. + {discussion: {number: $number, title: $title, body: $body, author: $author, category: $category, url: $url}}' \\",
      '       /tmp/dispatch-context/context.json > /tmp/dispatch-context/context.tmp.json',
      '    mv /tmp/dispatch-context/context.tmp.json /tmp/dispatch-context/context.json',
      '    ;;',
      '  schedule)',
      `    jq --arg cron "${ghExpr('github.event.schedule')}" \\`,
      "       '. + {schedule: {cron: $cron}}' \\",
      '       /tmp/dispatch-context/context.json > /tmp/dispatch-context/context.tmp.json',
      '    mv /tmp/dispatch-context/context.tmp.json /tmp/dispatch-context/context.json',
      '    ;;',
      '  repository_dispatch)',
      `    jq --arg eventType "${ghExpr('github.event.action')}" \\`,
      `       --argjson clientPayload ${ghExpr('toJson(github.event.client_payload)')} \\`,
      "       '. + {repositoryDispatch: {eventType: $eventType, clientPayload: $clientPayload}}' \\",
      '       /tmp/dispatch-context/context.json > /tmp/dispatch-context/context.tmp.json',
      '    mv /tmp/dispatch-context/context.tmp.json /tmp/dispatch-context/context.json',
      '    ;;',
      'esac',
      '',
      'echo "Context prepared:"',
      'cat /tmp/dispatch-context/context.json',
    ].join('\n');

    return [
      {
        name: 'Prepare dispatch context',
        id: 'prepare-context',
        run: contextScript,
      },
      {
        name: 'Upload context artifact',
        uses: 'actions/upload-artifact@v4',
        with: {
          name: `dispatch-context-${ghExpr('github.run_id')}`,
          path: '/tmp/dispatch-context/',
          'retention-days': '1',
        },
      },
    ];
  }

  private generateRoutingSteps(routingTable: RoutingRule[]): WorkflowStep[] {
    const routingTableJson = JSON.stringify(routingTable, null, 2);

    return [
      {
        name: 'Route event to agents',
        id: 'route',
        env: {
          WORKFLOW_DISPATCH_AGENT: '${{ github.event.inputs.agent }}',
        },
        run: `EVENT_NAME="\${{ github.event_name }}"
EVENT_ACTION="\${{ github.event.action }}"
SCHEDULE_CRON="\${{ github.event.schedule }}"

# Routing table (generated at compile time)
ROUTING_TABLE='${routingTableJson}'

echo "Event: $EVENT_NAME (action: $EVENT_ACTION)"

# Handle manual workflow_dispatch with specific agent
if [ "$EVENT_NAME" = "workflow_dispatch" ] && [ -n "$WORKFLOW_DISPATCH_AGENT" ]; then
  echo "Manual dispatch to specific agent: $WORKFLOW_DISPATCH_AGENT"
  MATCHING=$(echo "$ROUTING_TABLE" | jq -c "[.[] | select(.agentName == \\"$WORKFLOW_DISPATCH_AGENT\\")]")
  if [ "$MATCHING" = "[]" ]; then
    echo "::error::Agent '$WORKFLOW_DISPATCH_AGENT' not found"
    exit 1
  fi
  echo "agents=$MATCHING" >> $GITHUB_OUTPUT
  exit 0
fi

# Route based on event type
case "$EVENT_NAME" in
  issues|pull_request|discussion)
    # Match event type and action
    MATCHING=$(echo "$ROUTING_TABLE" | jq -c "[.[] | select(.triggers[] | .eventType == \\"$EVENT_NAME\\" and (.eventActions == null or (.eventActions | index(\\"$EVENT_ACTION\\"))))]")
    ;;
  schedule)
    # Match exact cron expression
    MATCHING=$(echo "$ROUTING_TABLE" | jq -c "[.[] | select(.triggers[] | .eventType == \\"schedule\\" and .schedule == \\"$SCHEDULE_CRON\\")]")
    ;;
  repository_dispatch)
    # Match dispatch type
    MATCHING=$(echo "$ROUTING_TABLE" | jq -c "[.[] | select(.triggers[] | .eventType == \\"repository_dispatch\\" and (.dispatchTypes == null or (.dispatchTypes | index(\\"$EVENT_ACTION\\"))))]")
    ;;
  workflow_dispatch)
    # No specific agent requested, route to all agents that have workflow_dispatch
    MATCHING=$(echo "$ROUTING_TABLE" | jq -c "[.[] | select(.triggers[] | .eventType == \\"workflow_dispatch\\")]")
    ;;
  *)
    echo "::warning::Unknown event type: $EVENT_NAME"
    MATCHING="[]"
    ;;
esac

# Deduplicate agents (in case multiple triggers match)
MATCHING=$(echo "$MATCHING" | jq -c 'unique_by(.agentName)')

echo "Matching agents: $MATCHING"
echo "agents=$MATCHING" >> $GITHUB_OUTPUT

if [ "$MATCHING" = "[]" ]; then
  echo "::notice::No agents matched this event"
fi`,
      },
    ];
  }

  private generateDispatchJob(): DispatcherWorkflowJob {
    return {
      'runs-on': 'ubuntu-latest',
      needs: ['pre-flight', 'prepare-context', 'route-event'],
      if: "needs.route-event.outputs.matching-agents != '[]'",
      strategy: {
        matrix: {
          agent: '${{ fromJson(needs.route-event.outputs.matching-agents) }}',
        },
        'fail-fast': false,
      },
      steps: [
        {
          name: 'Dispatch to ${{ matrix.agent.agentName }}',
          env: {
            GH_TOKEN: '${{ needs.pre-flight.outputs.app-token }}',
          },
          run: `echo "Triggering workflow: \${{ matrix.agent.workflowFile }}"
echo "Agent: \${{ matrix.agent.agentName }}"

gh workflow run "\${{ matrix.agent.workflowFile }}" \\
  --ref "\${{ github.ref }}" \\
  -f context-run-id="\${{ needs.prepare-context.outputs.run-id }}"

echo "✓ Dispatched to \${{ matrix.agent.agentName }}"`,
        },
      ],
    };
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
}

export const dispatcherGenerator = new DispatcherGenerator();

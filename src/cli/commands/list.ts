import { join } from 'path';
import { stat } from 'fs/promises';
import chalk from 'chalk';
import yaml from 'js-yaml';
import { logger } from '../utils/logger';
import { findMarkdownFiles, fileExists, agentNameToWorkflowName } from '../utils/files';
import { agentParser } from '../../parser';
import { AgentDefinition, OutputConfig } from '../../types';

interface ListOptions {
  format?: 'table' | 'json' | 'yaml';
  details?: boolean;
}

interface AgentInfo {
  name: string;
  file: string;
  triggers: string[];
  compiled: boolean;
  lastModified: Date;
  permissions?: string[];
  outputs?: Record<string, OutputConfig | boolean>;
}

export async function listCommand(options: ListOptions): Promise<void> {
  const cwd = process.cwd();
  const agentsDir = join(cwd, '.github', 'agents');
  const workflowsDir = join(cwd, '.github', 'workflows');

  const agentsDirExists = await fileExists(agentsDir);
  if (!agentsDirExists) {
    logger.error('Agents directory not found');
    logger.info('Run: repo-agents init');
    process.exit(1);
  }

  const files = await findMarkdownFiles(agentsDir);

  if (files.length === 0) {
    logger.warn('No agent files found');
    logger.info(`Create agent files in: ${agentsDir}`);
    return;
  }

  const agentInfos: AgentInfo[] = [];

  for (const file of files) {
    const { agent } = await agentParser.parseFile(file);
    if (agent) {
      const fileName = file.split('/').pop() || file;
      const workflowName = agentNameToWorkflowName(agent.name);
      const workflowPath = join(workflowsDir, `${workflowName}.yml`);
      const compiled = await fileExists(workflowPath);

      const fileStat = await stat(file);

      agentInfos.push({
        name: agent.name,
        file: fileName,
        triggers: getTriggers(agent),
        compiled,
        lastModified: fileStat.mtime,
        permissions: getPermissions(agent),
        outputs: agent.outputs,
      });
    }
  }

  switch (options.format) {
    case 'json':
      printJson(agentInfos);
      break;
    case 'yaml':
      printYaml(agentInfos);
      break;
    default:
      printTable(agentInfos, options.details || false);
  }
}

function getTriggers(agent: AgentDefinition): string[] {
  const triggers: string[] = [];

  if (agent.on.issues) triggers.push('issues');
  if (agent.on.pull_request) triggers.push('pull_request');
  if (agent.on.discussion) triggers.push('discussion');
  if (agent.on.schedule) triggers.push('schedule');
  if (agent.on.workflow_dispatch) triggers.push('manual');
  if (agent.on.repository_dispatch) triggers.push('repository_dispatch');

  return triggers;
}

function getPermissions(agent: AgentDefinition): string[] {
  if (!agent.permissions) return [];

  return Object.entries(agent.permissions)
    .map(([key, value]) => `${key}:${value}`)
    .sort();
}

function printTable(agents: AgentInfo[], details: boolean): void {
  if (agents.length === 0) {
    logger.warn('No agents found');
    return;
  }

  logger.info(`Found ${agents.length} agent(s):\n`);

  const nameWidth = Math.max(...agents.map((a) => a.name.length), 4);
  const fileWidth = Math.max(...agents.map((a) => a.file.length), 4);

  const header =
    chalk.bold('Name').padEnd(nameWidth + 10) +
    ' ' +
    chalk.bold('File').padEnd(fileWidth + 10) +
    ' ' +
    chalk.bold('Triggers').padEnd(20) +
    ' ' +
    chalk.bold('Status');

  logger.log(header);
  logger.log('-'.repeat(80));

  for (const agent of agents) {
    const name = chalk.cyan(agent.name.padEnd(nameWidth));
    const file = agent.file.padEnd(fileWidth);
    const triggers = agent.triggers.join(', ').padEnd(20);
    const status = agent.compiled ? chalk.green('✓ compiled') : chalk.yellow('○ not compiled');

    logger.log(`${name} ${file} ${triggers} ${status}`);

    if (details) {
      if (agent.permissions && agent.permissions.length > 0) {
        logger.log(chalk.gray(`  Permissions: ${agent.permissions.join(', ')}`));
      }
      if (agent.outputs && Object.keys(agent.outputs).length > 0) {
        const outputList = Object.entries(agent.outputs)
          .map(([key, val]) => {
            if (val === true) return key;
            if (typeof val === 'object') {
              const settings = Object.entries(val)
                .map(([k, v]) => `${k}:${v}`)
                .join(',');
              return `${key}(${settings})`;
            }
            return key;
          })
          .join(', ');
        logger.log(chalk.gray(`  Outputs: ${outputList}`));
      }
      logger.log(chalk.gray(`  Last Modified: ${agent.lastModified.toLocaleString()}`));
      logger.log('');
    }
  }
}

function printJson(agents: AgentInfo[]): void {
  console.log(JSON.stringify(agents, null, 2));
}

function printYaml(agents: AgentInfo[]): void {
  console.log(yaml.dump(agents));
}

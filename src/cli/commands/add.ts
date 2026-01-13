import { readdirSync, readFileSync, copyFileSync, existsSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';
import { logger } from '../utils/logger';
import { promptForInput } from '../utils/prompts';
import matter from 'gray-matter';

interface AddOptions {
  force?: boolean;
  all?: boolean;
}

interface AgentInfo {
  filename: string;
  name: string;
  description: string;
}

/**
 * Gets the list of available agents from the examples directory
 */
function getAvailableAgents(examplesDir: string): AgentInfo[] {
  const agents: AgentInfo[] = [];

  try {
    const files = readdirSync(examplesDir).filter((f) => f.endsWith('.md') && f !== 'README.md');

    for (const filename of files) {
      const filePath = join(examplesDir, filename);
      const content = readFileSync(filePath, 'utf-8');

      try {
        const { data } = matter(content);
        const name = data.name || filename.replace('.md', '');

        // Extract first line of markdown content as description
        const lines = content.split('\n');
        let description = '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('---') && !trimmed.startsWith('#')) {
            description = trimmed;
            break;
          }
        }

        agents.push({
          filename,
          name,
          description: description || 'No description available',
        });
      } catch {
        // Skip files that can't be parsed
        continue;
      }
    }
  } catch (error) {
    logger.error(`Failed to read examples directory: ${(error as Error).message}`);
    process.exit(1);
  }

  return agents.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Displays the agent library and prompts user to select agents
 */
async function selectAgents(agents: AgentInfo[]): Promise<string[]> {
  logger.info('═══════════════════════════════════════════════════════════════');
  logger.info('                    Claude Agent Library                       ');
  logger.info('═══════════════════════════════════════════════════════════════');
  logger.newline();

  logger.info('Available agents:');
  logger.newline();

  agents.forEach((agent, index) => {
    logger.log(`${index + 1}. ${agent.name}`);
    logger.log(`   ${agent.description}`);
    logger.newline();
  });

  logger.info('═══════════════════════════════════════════════════════════════');
  logger.newline();

  logger.info('Enter the numbers of agents you want to add (comma-separated),');
  logger.info('or type "all" to add all agents:');
  logger.newline();

  const selection = await promptForInput('Selection: ');

  if (selection.toLowerCase() === 'all') {
    return agents.map((a) => a.filename);
  }

  const selectedIndices = selection
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n) && n > 0 && n <= agents.length);

  if (selectedIndices.length === 0) {
    logger.error('No valid agents selected');
    process.exit(1);
  }

  return selectedIndices.map((i) => agents[i - 1].filename);
}

/**
 * Copies selected agents to the repository's claude-agents directory
 */
function copyAgents(
  examplesDir: string,
  targetDir: string,
  filenames: string[],
  force: boolean
): void {
  // Ensure target directory exists
  if (!existsSync(targetDir)) {
    mkdirSync(targetDir, { recursive: true });
  }

  const copied: string[] = [];
  const skipped: string[] = [];
  const overwritten: string[] = [];

  for (const filename of filenames) {
    const sourcePath = join(examplesDir, filename);
    const targetPath = join(targetDir, filename);
    const fileExisted = existsSync(targetPath);

    if (fileExisted && !force) {
      skipped.push(filename);
    } else {
      try {
        copyFileSync(sourcePath, targetPath);
        if (fileExisted) {
          overwritten.push(filename);
        } else {
          copied.push(filename);
        }
      } catch (error) {
        logger.error(`Failed to copy ${filename}: ${(error as Error).message}`);
      }
    }
  }

  logger.newline();

  if (copied.length > 0) {
    logger.success(`Added ${copied.length} agent(s):`);
    copied.forEach((f) => logger.log(`  ✓ ${f}`));
    logger.newline();
  }

  if (overwritten.length > 0) {
    logger.success(`Overwritten ${overwritten.length} agent(s):`);
    overwritten.forEach((f) => logger.log(`  ✓ ${f}`));
    logger.newline();
  }

  if (skipped.length > 0) {
    logger.warn(`Skipped ${skipped.length} existing agent(s):`);
    skipped.forEach((f) => logger.log(`  • ${f}`));
    logger.log('Use --force to overwrite existing agents');
    logger.newline();
  }
}

/**
 * Add command to install agents from the library
 */
export async function addCommand(options: AddOptions): Promise<void> {
  logger.info('Adding Claude agents from the library...');
  logger.newline();

  // Find the examples directory (package installation location)
  const examplesDir = resolve(__dirname, '../../../examples');

  if (!existsSync(examplesDir)) {
    logger.error('Examples directory not found');
    logger.error('Make sure gh-claude is properly installed');
    process.exit(1);
  }

  // Get available agents
  const agents = getAvailableAgents(examplesDir);

  if (agents.length === 0) {
    logger.warn('No agents found in the library');
    return;
  }

  // Select agents
  let selectedFilenames: string[];

  if (options.all) {
    selectedFilenames = agents.map((a) => a.filename);
    logger.info('Adding all agents from library...');
    logger.newline();
  } else {
    selectedFilenames = await selectAgents(agents);
  }

  if (selectedFilenames.length === 0) {
    logger.warn('No agents selected');
    return;
  }

  // Check if repository is initialized
  const targetDir = '.github/claude-agents';
  if (!existsSync(targetDir)) {
    logger.error('Repository not initialized with gh-claude');
    logger.error('Run: gh claude init');
    process.exit(1);
  }

  // Copy agents to target directory
  copyAgents(examplesDir, targetDir, selectedFilenames, options.force || false);

  // Next steps
  logger.success('Agents added successfully!');
  logger.newline();

  logger.info('Next steps:');
  logger.log('  1. Review and customize agents in .github/claude-agents/');
  logger.log('  2. Compile agents: gh claude compile --all');
  logger.log('  3. Commit and push the changes');
  logger.newline();
}

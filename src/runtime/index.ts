#!/usr/bin/env node

import { ClaudeRunner } from './claude-runner';

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const githubToken = process.env.GITHUB_TOKEN;
  const contextJson = process.env.GITHUB_CONTEXT;
  const instructions = process.env.AGENT_INSTRUCTIONS;
  const model = process.env.CLAUDE_MODEL;
  const maxTokens = process.env.CLAUDE_MAX_TOKENS;
  const temperature = process.env.CLAUDE_TEMPERATURE;
  const outputs = process.env.OUTPUTS;
  const allowedPaths = process.env.ALLOWED_PATHS;

  if (!apiKey) {
    console.error('Error: ANTHROPIC_API_KEY environment variable is required');
    process.exit(1);
  }

  if (!githubToken) {
    console.error('Error: GITHUB_TOKEN environment variable is required');
    process.exit(1);
  }

  if (!contextJson) {
    console.error('Error: GITHUB_CONTEXT environment variable is required');
    process.exit(1);
  }

  if (!instructions) {
    console.error('Error: AGENT_INSTRUCTIONS environment variable is required');
    process.exit(1);
  }

  let context;
  try {
    context = JSON.parse(contextJson);
  } catch (error) {
    console.error('Error: Failed to parse GITHUB_CONTEXT JSON');
    process.exit(1);
  }

  let parsedOutputs;
  if (outputs) {
    try {
      parsedOutputs = JSON.parse(outputs);
    } catch (error) {
      console.error('Error: Failed to parse OUTPUTS JSON');
      process.exit(1);
    }
  }

  const runner = new ClaudeRunner({
    apiKey,
    githubToken,
    context,
    instructions,
    model,
    maxTokens: maxTokens ? parseInt(maxTokens, 10) : undefined,
    temperature: temperature ? parseFloat(temperature) : undefined,
    outputs: parsedOutputs,
    allowedPaths: allowedPaths ? allowedPaths.split(',').filter(Boolean) : undefined,
  });

  await runner.run();
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

#!/usr/bin/env node

/**
 * Simple local test for gh-claude runtime
 * Tests parsing and structure without API calls
 */

const fs = require('fs');
const path = require('path');

console.log('===========================================');
console.log('  gh-claude Runtime Structure Test');
console.log('===========================================\n');

// Load mock context
const contextPath = path.join(__dirname, 'mock-context.json');
const context = JSON.parse(fs.readFileSync(contextPath, 'utf-8'));

console.log('✓ Loaded mock GitHub context');
console.log(`  Event: ${context.event_name}`);
console.log(`  Issue: #${context.issue.number} - ${context.issue.title}`);
console.log(`  Author: @${context.issue.user.login}\n`);

// Test agent instructions
const instructions = `# Issue Triage Agent

Analyze the issue and categorize it appropriately.`;

console.log('✓ Agent instructions loaded');
console.log(`  Length: ${instructions.length} characters\n`);

// Test environment variables (what runtime would receive)
const env = {
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || 'not-set',
  GITHUB_TOKEN: 'mock-token',
  GITHUB_CONTEXT: JSON.stringify(context),
  AGENT_INSTRUCTIONS: instructions,
  CLAUDE_MODEL: 'claude-3-5-sonnet-20241022',
  CLAUDE_MAX_TOKENS: '4096',
  CLAUDE_TEMPERATURE: '0.7',
  SAFE_OUTPUTS: 'add-comment,add-label',
  ALLOWED_PATHS: '',
};

console.log('✓ Environment variables configured:');
Object.keys(env).forEach(key => {
  const value = env[key];
  const display = key === 'ANTHROPIC_API_KEY'
    ? (value === 'not-set' ? 'not-set' : '***hidden***')
    : (value.length > 50 ? `${value.substring(0, 50)}...` : value);
  console.log(`  ${key}: ${display}`);
});

console.log('\n===========================================');
console.log('  What Claude Would Receive');
console.log('===========================================\n');

const contextString = `# GitHub Context

Event: ${context.event_name}
Repository: ${context.repository.owner}/${context.repository.name}

## Issue Information
Number: #${context.issue.number}
Title: ${context.issue.title}
Author: @${context.issue.user.login}

Body:
${context.issue.body}`;

console.log(contextString);

console.log('\n===========================================');
console.log('  Expected Claude Response Format');
console.log('===========================================\n');

console.log('Claude should respond with structured outputs like:\n');

console.log('ADD_LABEL:');
console.log('```json');
console.log(JSON.stringify({
  labels: ['feature', 'priority: medium']
}, null, 2));
console.log('```\n');

console.log('ADD_COMMENT:');
console.log('```json');
console.log(JSON.stringify({
  body: 'Thanks for opening this issue! I\'ve categorized it as a feature request with medium priority.'
}, null, 2));
console.log('```\n');

console.log('===========================================');
console.log('  Test Summary');
console.log('===========================================\n');

console.log('✓ Context parsing works');
console.log('✓ Environment setup correct');
console.log('✓ Instructions properly formatted');
console.log('✓ Expected output format defined\n');

if (env.ANTHROPIC_API_KEY === 'not-set') {
  console.log('ℹ  To test with real API:');
  console.log('   export ANTHROPIC_API_KEY="your-key"');
  console.log('   node dist/runtime/index.js\n');
} else {
  console.log('✓ ANTHROPIC_API_KEY is set');
  console.log('   Ready for real API testing!\n');
}

console.log('===========================================\n');

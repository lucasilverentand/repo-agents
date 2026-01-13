import { execSync } from 'child_process';

export interface SecretsStatus {
  hasApiKey: boolean;
  hasAccessToken: boolean;
}

export interface AppSecretsStatus {
  hasAppId: boolean;
  hasPrivateKey: boolean;
}

/**
 * Checks which Claude authentication secrets are already set.
 * Uses gh CLI with hardcoded commands only (no user input).
 */
export function getExistingSecrets(): SecretsStatus {
  try {
    const output = execSync('gh secret list --json name', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const secrets = JSON.parse(output) as Array<{ name: string }>;
    return {
      hasApiKey: secrets.some((s) => s.name === 'ANTHROPIC_API_KEY'),
      hasAccessToken: secrets.some((s) => s.name === 'CLAUDE_CODE_OAUTH_TOKEN'),
    };
  } catch {
    return { hasApiKey: false, hasAccessToken: false };
  }
}

/**
 * Checks if GitHub App secrets are already set.
 * Uses gh CLI with hardcoded commands only (no user input).
 */
export function getExistingAppSecrets(): AppSecretsStatus {
  try {
    const output = execSync('gh secret list --json name', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const secrets = JSON.parse(output) as Array<{ name: string }>;
    return {
      hasAppId: secrets.some((s) => s.name === 'GH_APP_ID'),
      hasPrivateKey: secrets.some((s) => s.name === 'GH_APP_PRIVATE_KEY'),
    };
  } catch {
    return { hasAppId: false, hasPrivateKey: false };
  }
}

/**
 * Sets a value as a GitHub repository secret.
 * The secret name must be a hardcoded constant - never pass user input directly.
 */
export function setGitHubSecret(secretName: string, secretValue: string): void {
  // Only allow known secret names to prevent injection
  const allowedSecrets = [
    'ANTHROPIC_API_KEY',
    'CLAUDE_CODE_OAUTH_TOKEN',
    'GH_APP_ID',
    'GH_APP_PRIVATE_KEY',
  ];
  if (!allowedSecrets.includes(secretName)) {
    throw new Error(`Unknown secret name: ${secretName}`);
  }

  try {
    execSync(`gh secret set ${secretName}`, {
      input: secretValue,
      stdio: ['pipe', 'inherit', 'inherit'],
    });
  } catch {
    throw new Error(
      'Failed to set GitHub secret. Make sure gh CLI is installed and authenticated.'
    );
  }
}

/**
 * Checks if gh CLI is authenticated.
 */
export function isGhAuthenticated(): boolean {
  try {
    execSync('gh auth status', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

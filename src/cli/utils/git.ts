import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

export function isGitRepository(cwd: string = process.cwd()): boolean {
  try {
    execSync('git rev-parse --git-dir', { cwd, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export function hasGitHubRemote(cwd: string = process.cwd()): boolean {
  try {
    const remoteUrl = execSync('git remote get-url origin', { cwd, encoding: 'utf-8' });
    return remoteUrl.includes('github.com');
  } catch {
    return false;
  }
}

export function getGitHubRepo(cwd: string = process.cwd()): { owner: string; repo: string } | null {
  try {
    const remoteUrl = execSync('git remote get-url origin', { cwd, encoding: 'utf-8' }).trim();
    const match = remoteUrl.match(/github\.com[:/](.+?)\/(.+?)(\.git)?$/);
    if (match) {
      return { owner: match[1], repo: match[2] };
    }
  } catch {
    return null;
  }
  return null;
}

export function hasGitHubDirectory(cwd: string = process.cwd()): boolean {
  return existsSync(join(cwd, '.github'));
}

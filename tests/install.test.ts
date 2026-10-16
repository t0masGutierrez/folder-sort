import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';

it('rejects missing arguments and a path that is not an existing vault', () => {
  expect(spawnSync('bash', ['scripts/install-to-vault.sh']).status).toBe(64);
  const root = mkdtempSync(join(tmpdir(), 'folder-sort-install-'));
  try {
    const vault = join(root, 'missing vault');
    const result = spawnSync('bash', ['scripts/install-to-vault.sh', vault], { encoding: 'utf8' });
    expect(result.status).toBe(66);
    expect(result.stderr).toContain('existing vault');
    expect(existsSync(vault)).toBe(false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
  execFileSync('bash', ['-n', 'scripts/install-to-vault.sh']);
});

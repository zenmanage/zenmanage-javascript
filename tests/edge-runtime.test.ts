import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * `next build` warns about any app that reaches `process.versions` from
 * middleware, because the Edge runtime doesn't support it. The main entry
 * is what edge code imports, so nothing it bundles may use it. The
 * filesystem cache does, and is only reachable from the `/node` entry.
 */

const SRC = join(__dirname, '..', 'src');
const NODE_ONLY = new Set(['node.ts', join('cache', 'filesystem-cache.ts')]);

function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : path.endsWith('.ts') ? [path] : [];
  });
}

describe('main entry on the Edge runtime', () => {
  it('does not touch process.versions', () => {
    const offenders = sourceFiles(SRC)
      .filter((file) => !NODE_ONLY.has(relative(SRC, file)))
      .filter((file) => /process\.versions/.test(withoutComments(readFileSync(file, 'utf8'))))
      .map((file) => relative(SRC, file));

    expect(offenders).toEqual([]);
  });
});

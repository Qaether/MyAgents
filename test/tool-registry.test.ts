import { mkdtemp, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { ToolRegistry } from '../src/tools/tool-registry';

describe('ToolRegistry', () => {
  it('executes builtin tools', async () => {
    const registry = new ToolRegistry();
    const root = await mkdtemp(join(tmpdir(), 'myagent-tools-'));
    const filePath = join(root, 'sample.txt');
    await writeFile(filePath, 'hello world', 'utf8');

    await expect(
      registry.execute({ tool: 'echo', input: { text: 'abc' } }, { rootDir: root }),
    ).resolves.toBe('abc');

    await expect(
      registry.execute(
        { tool: 'join', input: { values: 'a, b, c', separator: ' / ' } },
        { rootDir: root },
      ),
    ).resolves.toBe('a / b / c');

    await expect(
      registry.execute(
        { tool: 'read_file', input: { path: 'sample.txt', maxChars: '5' } },
        { rootDir: root },
      ),
    ).resolves.toBe('hello');
  });
});

import { mkdtemp, mkdir, readFile, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadProject } from '../src/config/project-loader';

const originalCwd = process.cwd();

afterEach(() => {
  process.chdir(originalCwd);
});

describe('loadProject', () => {
  it('loads config, agents, and workflows from the working directory', async () => {
    const root = await mkdtemp(join(tmpdir(), 'myagent-project-'));
    await mkdir(join(root, 'agents'));
    await mkdir(join(root, 'workflows'));

    await writeFile(
      join(root, 'myagent.config.json'),
      JSON.stringify({
        project: {
          name: 'Test Project',
          defaultWorkflow: 'default',
          agentsDir: 'agents',
          workflowsDir: 'workflows',
          runsDir: '.myagent/runs',
          artifactsDir: '.myagent/artifacts',
        },
        provider: {
          kind: 'openai',
          model: 'gpt-4o-mini',
          apiKeyEnv: 'OPENAI_API_KEY',
          apiKey: 'test-key',
        },
      }),
      'utf8',
    );

    await writeFile(
      join(root, 'agents', 'writer.json'),
      JSON.stringify({
        id: 'writer',
        name: 'Writer',
        role: 'draft',
        systemPrompt: 'Write things',
        allowedTools: ['echo'],
      }),
      'utf8',
    );

    await writeFile(
      join(root, 'workflows', 'default.json'),
      JSON.stringify({
        id: 'default',
        name: 'Default',
        allowedTools: ['echo'],
        stages: [
          {
            id: 'write',
            steps: [
              {
                id: 'draft',
                agentId: 'writer',
                instruction: 'Task: {{task}}',
              },
            ],
          },
        ],
        output: {
          finalStepId: 'draft',
          includeSteps: ['draft'],
        },
      }),
      'utf8',
    );

    process.chdir(root);
    const project = await loadProject();

    expect(project.config.project.name).toBe('Test Project');
    expect(project.agents).toHaveLength(1);
    expect(project.workflows).toHaveLength(1);
    expect(project.agentMap.get('writer')?.role).toBe('draft');
    expect(project.agentMap.get('writer')?.allowedTools).toEqual(['echo']);
    expect(project.workflowMap.get('default')?.stages[0].steps[0].id).toBe('draft');

    const saved = JSON.parse(await readFile(join(root, 'myagent.config.json'), 'utf8'));
    expect(saved.provider.kind).toBe('openai');
  });
});

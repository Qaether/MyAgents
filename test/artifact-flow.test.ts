import { describe, expect, it } from 'vitest';
import { AgentSpec } from '../src/domain/agent';
import { WorkflowSpec } from '../src/domain/workflow';
import { LLMProvider } from '../src/providers/base/llm-provider';
import { WorkflowExecutor } from '../src/runtime/workflow-executor';

class ArtifactProvider implements LLMProvider {
  async generate(request: { userPrompt: string; responseFormat?: 'text' | 'json' }): Promise<string> {
    if (request.userPrompt.includes('Write deliverable')) {
      return 'Draft body';
    }

    if (request.userPrompt.includes('Review draft artifact')) {
      return `Reviewed ${request.userPrompt.includes('.myagent/artifacts/') ? 'with path' : 'without path'}`;
    }

    return 'Other';
  }
}

describe('artifact references', () => {
  it('creates step artifacts and exposes them to downstream templates', async () => {
    const executor = new WorkflowExecutor(new ArtifactProvider());
    const agents = new Map<string, AgentSpec>([
      ['writer', { id: 'writer', name: 'Writer', role: 'draft', systemPrompt: 'draft' }],
      ['reviewer', { id: 'reviewer', name: 'Reviewer', role: 'review', systemPrompt: 'review' }],
    ]);

    const workflow: WorkflowSpec = {
      id: 'artifacts',
      name: 'Artifacts',
      stages: [
        {
          id: 'one',
          steps: [
            {
              id: 'draft',
              agentId: 'writer',
              instruction: 'Write deliverable',
              artifacts: [
                {
                  name: 'draft_md',
                  fileName: 'draft.md',
                  contentFrom: 'output',
                },
              ],
            },
          ],
        },
        {
          id: 'two',
          steps: [
            {
              id: 'review',
              agentId: 'reviewer',
              dependsOn: ['draft'],
              instruction:
                'Review draft artifact {{steps.draft.artifacts.draft_md.path}} with content {{steps.draft.artifacts.draft_md.content}}',
            },
          ],
        },
      ],
      output: {
        finalStepId: 'review',
        includeSteps: ['draft', 'review'],
      },
    };

    const result = await executor.execute({
      task: 'demo',
      workflow,
      agents,
    });

    expect(result.steps[0].artifacts?.[0].fileName).toBe('draft.md');
    expect(result.steps[0].artifacts?.[0].content).toBe('Draft body');
    expect(result.steps[1].prompt).toContain('.myagent/artifacts/');
    expect(result.steps[1].prompt).toContain('Draft body');
    expect(result.final).toBe('Reviewed with path');
  });
});

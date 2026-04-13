import { describe, expect, it } from 'vitest';
import { ApprovalResolver } from '../src/approvals/approval-resolver';
import { AgentSpec } from '../src/domain/agent';
import { RunResult } from '../src/domain/run';
import { WorkflowSpec } from '../src/domain/workflow';
import { LLMProvider } from '../src/providers/base/llm-provider';
import { WorkflowExecutor } from '../src/runtime/workflow-executor';

class StaticApprovalResolver implements ApprovalResolver {
  constructor(private readonly approved: Set<string>) {}

  async isApproved(key: string): Promise<boolean> {
    return this.approved.has(key);
  }
}

class MinimalProvider implements LLMProvider {
  async generate(request: { userPrompt: string; responseFormat?: 'text' | 'json' }): Promise<string> {
    if (request.responseFormat === 'json') {
      return JSON.stringify({
        objective: 'Ship',
        approach: 'Fast',
        risks: ['none'],
        successCriteria: ['done'],
      });
    }

    if (request.userPrompt.includes('Review')) {
      return 'Approved review';
    }

    return 'Draft body';
  }
}

describe('approval gates', () => {
  it('marks a step as pending approval and returns a pending run', async () => {
    const executor = new WorkflowExecutor(
      new MinimalProvider(),
      undefined,
      undefined,
      new StaticApprovalResolver(new Set()),
    );

    const agents = new Map<string, AgentSpec>([
      ['writer', { id: 'writer', name: 'Writer', role: 'draft', systemPrompt: 'draft' }],
      ['reviewer', { id: 'reviewer', name: 'Reviewer', role: 'review', systemPrompt: 'review' }],
    ]);

    const workflow: WorkflowSpec = {
      id: 'approval',
      name: 'Approval',
      stages: [
        {
          id: 'one',
          steps: [
            {
              id: 'draft',
              agentId: 'writer',
              instruction: 'Draft',
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
              approval: {
                required: true,
                key: 'approval:review',
                message: 'Need sign-off',
              },
              instruction: 'Review {{steps.draft.output}}',
            },
          ],
        },
      ],
      output: {
        finalStepId: 'draft',
        includeSteps: ['draft', 'review'],
      },
    };

    const result = await executor.execute({
      task: 'demo',
      workflow,
      agents,
    });

    expect(result.status).toBe('pending_approval');
    expect(result.final).toBe('Draft body');
    expect(result.steps[1].status).toBe('pending_approval');
    expect(result.steps[1].approvalKey).toBe('approval:review');
    expect(result.steps[1].approvalMessage).toBe('Need sign-off');
  });

  it('runs the gated step after approval is granted', async () => {
    const executor = new WorkflowExecutor(
      new MinimalProvider(),
      undefined,
      undefined,
      new StaticApprovalResolver(new Set(['approval:review'])),
    );

    const agents = new Map<string, AgentSpec>([
      ['writer', { id: 'writer', name: 'Writer', role: 'draft', systemPrompt: 'draft' }],
      ['reviewer', { id: 'reviewer', name: 'Reviewer', role: 'review', systemPrompt: 'review' }],
    ]);

    const workflow: WorkflowSpec = {
      id: 'approval',
      name: 'Approval',
      stages: [
        {
          id: 'one',
          steps: [
            {
              id: 'draft',
              agentId: 'writer',
              instruction: 'Draft',
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
              approval: {
                required: true,
                key: 'approval:review',
              },
              instruction: 'Review {{steps.draft.output}}',
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

    expect(result.status).toBe('completed');
    expect(result.final).toBe('Approved review');
    expect(result.steps[1].status).toBe('completed');
  });

  it('resumes from a pending run without re-running completed steps', async () => {
    class CountingProvider extends MinimalProvider {
      public calls: string[] = [];

      async generate(request: { userPrompt: string; responseFormat?: 'text' | 'json' }): Promise<string> {
        this.calls.push(request.userPrompt);
        return super.generate(request);
      }
    }

    const provider = new CountingProvider();
    const workflow: WorkflowSpec = {
      id: 'approval',
      name: 'Approval',
      stages: [
        {
          id: 'one',
          steps: [
            {
              id: 'draft',
              agentId: 'writer',
              instruction: 'Draft',
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
              approval: {
                required: true,
                key: 'approval:review',
              },
              instruction: 'Review {{steps.draft.output}}',
            },
          ],
        },
      ],
      output: {
        finalStepId: 'review',
        includeSteps: ['draft', 'review'],
      },
    };
    const agents = new Map<string, AgentSpec>([
      ['writer', { id: 'writer', name: 'Writer', role: 'draft', systemPrompt: 'draft' }],
      ['reviewer', { id: 'reviewer', name: 'Reviewer', role: 'review', systemPrompt: 'review' }],
    ]);

    const pendingRun: RunResult = {
      runId: 'run_pending',
      task: 'demo',
      workflowId: 'approval',
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      status: 'pending_approval',
      final: '',
      steps: [
        {
          stepId: 'draft',
          agentId: 'writer',
          status: 'completed',
          prompt: 'Draft',
          output: 'Draft body',
          attempts: 1,
        },
        {
          stepId: 'review',
          agentId: 'reviewer',
          status: 'pending_approval',
          prompt: null,
          output: '',
          approvalKey: 'approval:review',
        },
      ],
    };

    const executor = new WorkflowExecutor(
      provider,
      undefined,
      undefined,
      new StaticApprovalResolver(new Set(['approval:review'])),
    );

    const resumed = await executor.execute({
      task: pendingRun.task,
      workflow,
      agents,
      resumeFrom: pendingRun,
    });

    expect(resumed.status).toBe('completed');
    expect(resumed.resumedFromRunId).toBe('run_pending');
    expect(resumed.final).toBe('Approved review');
    expect(resumed.steps.find((step) => step.stepId === 'draft')?.output).toBe('Draft body');
    expect(provider.calls).toEqual(['Review Draft body']);
  });
});

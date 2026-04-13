import { describe, expect, it } from 'vitest';
import { AgentSpec } from '../src/domain/agent';
import { WorkflowSpec } from '../src/domain/workflow';
import { LLMProvider } from '../src/providers/base/llm-provider';
import { WorkflowExecutor } from '../src/runtime/workflow-executor';

class StubProvider implements LLMProvider {
  public prompts: string[] = [];
  public starts: string[] = [];

  async generate(request: { userPrompt: string; responseFormat?: 'text' | 'json' }): Promise<string> {
    this.starts.push(request.userPrompt);
    this.prompts.push(request.userPrompt);

    if (request.userPrompt.includes('You are selecting tool calls') || request.userPrompt.includes('Return JSON with shape')) {
      return JSON.stringify({
        calls: [
          {
            tool: 'echo',
            as: 'planned_note',
            input: {
              text: 'planned {{steps.plan.data.objective}}',
            },
          },
        ],
      });
    }

    if (request.userPrompt.includes('Create a short execution plan')) {
      return JSON.stringify({
        objective: 'Explain the system',
        approach: 'Use staged workflow',
        risks: ['Network dependency'],
        successCriteria: ['Clear summary'],
      });
    }

    if (request.userPrompt.includes('Gather facts')) {
      await new Promise((resolve) => setTimeout(resolve, 25));
      return JSON.stringify({
        facts: ['Facts collected'],
        assumptions: ['Assume OpenAI access'],
        missingInformation: ['None'],
        constraints: ['Keep it concise'],
      });
    }

    if (request.userPrompt.includes('List quality criteria')) {
      await new Promise((resolve) => setTimeout(resolve, 25));
      return JSON.stringify({
        qualityCriteria: ['Accuracy', 'Clarity'],
        failureModes: ['Vagueness'],
      });
    }

    if (request.userPrompt.includes('Write the best possible deliverable')) {
      return 'Draft without review marker';
    }

    return 'Fallback output';
  }
}

describe('WorkflowExecutor', () => {
  it('executes stage-based workflows with parallel steps and skips gated ones when conditions fail', async () => {
    const provider = new StubProvider();
    const executor = new WorkflowExecutor(provider);

    const agents = new Map<string, AgentSpec>([
      ['planner', { id: 'planner', name: 'Planner', role: 'plan', systemPrompt: 'plan' }],
      ['researcher', { id: 'researcher', name: 'Researcher', role: 'research', systemPrompt: 'research', allowedTools: ['echo'] }],
      ['writer', { id: 'writer', name: 'Writer', role: 'draft', systemPrompt: 'draft', allowedTools: ['echo'] }],
      ['reviewer', { id: 'reviewer', name: 'Reviewer', role: 'review', systemPrompt: 'review', allowedTools: ['echo'] }],
    ]);

    const workflow: WorkflowSpec = {
      id: 'branching',
      name: 'Branching',
      allowedTools: ['echo'],
      stages: [
        {
          id: 'stage_plan',
          steps: [
            {
              id: 'plan',
              agentId: 'planner',
              instruction: 'User request:\n{{task}}\n\nCreate a short execution plan',
              structuredOutput: {
                fields: {
                  objective: 'string',
                  approach: 'string',
                  risks: 'string[]',
                  successCriteria: 'string[]',
                },
              },
            },
          ],
        },
        {
          id: 'stage_parallel',
          steps: [
            {
              id: 'research',
              agentId: 'researcher',
              dependsOn: ['plan'],
              instruction: 'Gather facts using {{steps.plan.data.objective}}',
              structuredOutput: {
                fields: {
                  facts: 'string[]',
                  assumptions: 'string[]',
                  missingInformation: 'string[]',
                  constraints: 'string[]',
                },
              },
            },
            {
              id: 'review_prep',
              agentId: 'reviewer',
              dependsOn: ['plan'],
              instruction: 'List quality criteria using {{steps.plan.data.approach}}',
              structuredOutput: {
                fields: {
                  qualityCriteria: 'string[]',
                  failureModes: 'string[]',
                },
              },
            },
          ],
        },
        {
          id: 'stage_delivery',
          steps: [
            {
              id: 'draft',
              agentId: 'writer',
              dependsOn: ['research', 'review_prep'],
              tools: [
                {
                  tool: 'echo',
                  as: 'note',
                  input: {
                    text: 'tool says {{steps.plan.data.objective}}',
                  },
                },
              ],
              instruction:
                'Write the best possible deliverable using {{steps.plan.data.objective}}, {{steps.research.data.facts}}, {{steps.review_prep.data.qualityCriteria}}, and {{steps.draft.tools.note}}',
            },
          ],
        },
        {
          id: 'stage_tool_selected',
          steps: [
            {
              id: 'tool_selected',
              agentId: 'writer',
              dependsOn: ['draft'],
              toolSelection: {
                enabled: true,
                maxCalls: 1,
              },
              instruction: 'Decide if a tool is needed for {{steps.plan.data.objective}} and then summarize {{steps.tool_selected.tools.planned_note}}',
            },
          ],
        },
        {
          id: 'stage_review',
          steps: [
            {
              id: 'review',
              agentId: 'reviewer',
              dependsOn: ['draft'],
              when: {
                stepId: 'draft',
                includes: 'NEEDS_REVIEW',
              },
              instruction: 'Review {{steps.draft.output}}',
            },
          ],
        },
      ],
      output: {
        finalStepId: 'draft',
        includeSteps: ['plan', 'research', 'review_prep', 'draft', 'tool_selected', 'review'],
      },
    };

    const result = await executor.execute({
      task: 'Explain the system',
      workflow,
      agents,
    });

    expect(result.final).toBe('Draft without review marker');
    expect(result.steps).toHaveLength(6);
    expect(result.steps[0].status).toBe('completed');
    expect(result.steps[1].status).toBe('completed');
    expect(result.steps[2].status).toBe('completed');
    expect(result.steps[3].status).toBe('completed');
    expect(result.steps[4].status).toBe('completed');
    expect(result.steps[5].status).toBe('skipped');
    expect(result.steps[0].data?.objective).toBe('Explain the system');
    expect(result.steps[1].data?.facts).toEqual(['Facts collected']);
    expect(result.steps[2].data?.qualityCriteria).toEqual(['Accuracy', 'Clarity']);
    expect(result.steps[3].tools?.[0].output).toBe('tool says Explain the system');
    expect(result.steps[4].tools?.[0].alias).toBe('planned_note');
    expect(result.steps[4].tools?.[0].output).toBe('planned Explain the system');
    expect(result.steps[5].prompt).toBeNull();
    expect(result.steps[5].skippedReason).toContain('must include "NEEDS_REVIEW"');
    expect(provider.prompts).toHaveLength(6);
    expect(provider.starts[1]).toContain('Gather facts');
    expect(provider.starts[2]).toContain('List quality criteria');
    expect(result.steps[3].prompt).toContain('Explain the system');
    expect(result.steps[3].prompt).toContain('Facts collected');
    expect(result.steps[3].prompt).toContain('Accuracy, Clarity');
    expect(result.steps[3].prompt).toContain('tool says Explain the system');
    expect(result.steps[4].prompt).toContain('planned Explain the system');
  });

  it('rejects tool execution when the tool is not allowed', async () => {
    const provider = new StubProvider();
    const executor = new WorkflowExecutor(provider);

    const agents = new Map<string, AgentSpec>([
      ['writer', { id: 'writer', name: 'Writer', role: 'draft', systemPrompt: 'draft', allowedTools: ['echo'] }],
    ]);

    const workflow: WorkflowSpec = {
      id: 'denied-tools',
      name: 'Denied Tools',
      allowedTools: ['timestamp'],
      stages: [
        {
          id: 'stage_delivery',
          steps: [
            {
              id: 'draft',
              agentId: 'writer',
              tools: [
                {
                  tool: 'timestamp',
                  as: 'generatedAt',
                },
              ],
              instruction: 'Write something',
            },
          ],
        },
      ],
      output: {
        finalStepId: 'draft',
        includeSteps: ['draft'],
      },
    };

    await expect(
      executor.execute({
        task: 'Explain the system',
        workflow,
        agents,
      }),
    ).rejects.toThrow('Tool "timestamp" is not allowed');
  });

  it('rejects model-selected tools that are not allowed', async () => {
    class DeniedPlanningProvider extends StubProvider {
      async generate(request: { userPrompt: string }): Promise<string> {
        if (request.userPrompt.includes('Return JSON with shape')) {
          return JSON.stringify({
            calls: [
              {
                tool: 'timestamp',
                as: 'generatedAt',
              },
            ],
          });
        }

        return super.generate(request);
      }
    }

    const provider = new DeniedPlanningProvider();
    const executor = new WorkflowExecutor(provider);
    const agents = new Map<string, AgentSpec>([
      ['writer', { id: 'writer', name: 'Writer', role: 'draft', systemPrompt: 'draft', allowedTools: ['echo'] }],
    ]);

    const workflow: WorkflowSpec = {
      id: 'selected-denied',
      name: 'Selected Denied',
      allowedTools: ['echo'],
      stages: [
        {
          id: 'stage_delivery',
          steps: [
            {
              id: 'draft',
              agentId: 'writer',
              toolSelection: {
                enabled: true,
                maxCalls: 1,
              },
              instruction: 'Choose a tool if needed',
            },
          ],
        },
      ],
      output: {
        finalStepId: 'draft',
        includeSteps: ['draft'],
      },
    };

    await expect(
      executor.execute({
        task: 'Explain the system',
        workflow,
        agents,
      }),
    ).rejects.toThrow('Tool "timestamp" is not allowed');
  });

  it('retries model generation and succeeds on a later attempt', async () => {
    class RetryProvider extends StubProvider {
      private attemptsByPrompt = new Map<string, number>();

      async generate(request: { userPrompt: string; responseFormat?: 'text' | 'json' }): Promise<string> {
        if (request.userPrompt === 'Retry me') {
          const next = (this.attemptsByPrompt.get(request.userPrompt) ?? 0) + 1;
          this.attemptsByPrompt.set(request.userPrompt, next);
          if (next < 2) {
            throw new Error('transient failure');
          }
          return 'Recovered';
        }

        return super.generate(request);
      }
    }

    const provider = new RetryProvider();
    const executor = new WorkflowExecutor(provider);
    const agents = new Map<string, AgentSpec>([
      ['writer', { id: 'writer', name: 'Writer', role: 'draft', systemPrompt: 'draft' }],
    ]);

    const workflow: WorkflowSpec = {
      id: 'retry',
      name: 'Retry',
      stages: [
        {
          id: 'delivery',
          steps: [
            {
              id: 'draft',
              agentId: 'writer',
              instruction: 'Retry me',
              execution: {
                retryCount: 1,
              },
            },
          ],
        },
      ],
      output: {
        finalStepId: 'draft',
        includeSteps: ['draft'],
      },
    };

    const result = await executor.execute({
      task: 'Explain the system',
      workflow,
      agents,
    });

    expect(result.final).toBe('Recovered');
    expect(result.steps[0].attempts).toBe(2);
  });

  it('marks a step as failed and continues when continueOnError is enabled', async () => {
    class SlowProvider extends StubProvider {
      async generate(request: { userPrompt: string }): Promise<string> {
        if (request.userPrompt === 'This will timeout') {
          await new Promise((resolve) => setTimeout(resolve, 30));
          return 'Too late';
        }

        if (request.userPrompt.includes('Use failed output')) {
          return 'Fallback complete';
        }

        return super.generate(request);
      }
    }

    const provider = new SlowProvider();
    const executor = new WorkflowExecutor(provider);
    const agents = new Map<string, AgentSpec>([
      ['writer', { id: 'writer', name: 'Writer', role: 'draft', systemPrompt: 'draft' }],
    ]);

    const workflow: WorkflowSpec = {
      id: 'timeout-continue',
      name: 'Timeout Continue',
      stages: [
        {
          id: 'one',
          steps: [
            {
              id: 'draft',
              agentId: 'writer',
              instruction: 'This will timeout',
              execution: {
                timeoutMs: 5,
                continueOnError: true,
              },
            },
          ],
        },
        {
          id: 'two',
          steps: [
            {
              id: 'followup',
              agentId: 'writer',
              instruction: 'Use failed output {{steps.draft.output}}',
            },
          ],
        },
      ],
      output: {
        finalStepId: 'followup',
        includeSteps: ['draft', 'followup'],
      },
    };

    const result = await executor.execute({
      task: 'Explain the system',
      workflow,
      agents,
    });

    expect(result.steps[0].status).toBe('failed');
    expect(result.steps[0].error).toContain('timed out');
    expect(result.steps[1].status).toBe('completed');
    expect(result.final).toBe('Fallback complete');
  });

  it('runs dependency-ready steps in parallel regardless of stage grouping', async () => {
    const provider = new StubProvider();
    const executor = new WorkflowExecutor(provider);
    const agents = new Map<string, AgentSpec>([
      ['planner', { id: 'planner', name: 'Planner', role: 'plan', systemPrompt: 'plan' }],
      ['researcher', { id: 'researcher', name: 'Researcher', role: 'research', systemPrompt: 'research' }],
      ['reviewer', { id: 'reviewer', name: 'Reviewer', role: 'review', systemPrompt: 'review' }],
      ['writer', { id: 'writer', name: 'Writer', role: 'draft', systemPrompt: 'draft' }],
    ]);

    const workflow: WorkflowSpec = {
      id: 'dag',
      name: 'DAG',
      stages: [
        {
          id: 'a',
          steps: [
            {
              id: 'plan',
              agentId: 'planner',
              instruction: 'Create a short execution plan',
              structuredOutput: {
                fields: {
                  objective: 'string',
                  approach: 'string',
                  risks: 'string[]',
                  successCriteria: 'string[]',
                },
              },
            },
          ],
        },
        {
          id: 'b',
          steps: [
            {
              id: 'research',
              agentId: 'researcher',
              dependsOn: ['plan'],
              instruction: 'Gather facts using {{steps.plan.data.objective}}',
              structuredOutput: {
                fields: {
                  facts: 'string[]',
                  assumptions: 'string[]',
                  missingInformation: 'string[]',
                  constraints: 'string[]',
                },
              },
            },
          ],
        },
        {
          id: 'c',
          steps: [
            {
              id: 'review_prep',
              agentId: 'reviewer',
              dependsOn: ['plan'],
              instruction: 'List quality criteria using {{steps.plan.data.approach}}',
              structuredOutput: {
                fields: {
                  qualityCriteria: 'string[]',
                  failureModes: 'string[]',
                },
              },
            },
            {
              id: 'draft',
              agentId: 'writer',
              dependsOn: ['research', 'review_prep'],
              instruction:
                'Write the best possible deliverable using {{steps.plan.data.objective}}, {{steps.research.data.facts}}, and {{steps.review_prep.data.qualityCriteria}}',
            },
          ],
        },
      ],
      output: {
        finalStepId: 'draft',
        includeSteps: ['plan', 'research', 'review_prep', 'draft'],
      },
    };

    const result = await executor.execute({
      task: 'Explain the system',
      workflow,
      agents,
    });

    expect(result.final).toBe('Draft without review marker');
    expect(provider.starts[1]).toContain('Gather facts');
    expect(provider.starts[2]).toContain('List quality criteria');
    expect(result.steps[3].prompt).toContain('Facts collected');
    expect(result.steps[3].prompt).toContain('Accuracy, Clarity');
  });

  it('rejects dependency cycles', async () => {
    const provider = new StubProvider();
    const executor = new WorkflowExecutor(provider);
    const agents = new Map<string, AgentSpec>([
      ['writer', { id: 'writer', name: 'Writer', role: 'draft', systemPrompt: 'draft' }],
    ]);

    const workflow: WorkflowSpec = {
      id: 'cycle',
      name: 'Cycle',
      stages: [
        {
          id: 'loop',
          steps: [
            {
              id: 'a',
              agentId: 'writer',
              dependsOn: ['b'],
              instruction: 'A',
            },
            {
              id: 'b',
              agentId: 'writer',
              dependsOn: ['a'],
              instruction: 'B',
            },
          ],
        },
      ],
      output: {
        finalStepId: 'a',
        includeSteps: ['a', 'b'],
      },
    };

    await expect(
      executor.execute({
        task: 'Explain the system',
        workflow,
        agents,
      }),
    ).rejects.toThrow('dependency cycle');
  });
});

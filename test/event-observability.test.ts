import { describe, expect, it } from 'vitest';
import { AgentSpec } from '../src/domain/agent';
import { RuntimeEvent } from '../src/domain/event';
import { EventSink } from '../src/observability/event-sink';
import { LLMProvider } from '../src/providers/base/llm-provider';
import { WorkflowExecutor } from '../src/runtime/workflow-executor';
import { WorkflowSpec } from '../src/domain/workflow';

class MemoryEventSink implements EventSink {
  public events: RuntimeEvent[] = [];

  async emit(event: RuntimeEvent): Promise<void> {
    this.events.push(event);
  }
}

class SimpleProvider implements LLMProvider {
  async generate(request: { userPrompt: string }): Promise<string> {
    if (request.userPrompt.includes('Create plan')) {
      return '{"objective":"Ship","approach":"Fast","risks":["none"],"successCriteria":["done"]}';
    }
    return 'Final answer';
  }
}

describe('observability', () => {
  it('emits lifecycle events for runs, stages, steps, and tools', async () => {
    const sink = new MemoryEventSink();
    const executor = new WorkflowExecutor(new SimpleProvider(), undefined, sink);

    const agents = new Map<string, AgentSpec>([
      ['planner', { id: 'planner', name: 'Planner', role: 'plan', systemPrompt: 'plan', allowedTools: ['echo'] }],
      ['writer', { id: 'writer', name: 'Writer', role: 'draft', systemPrompt: 'draft', allowedTools: ['echo'] }],
    ]);

    const workflow: WorkflowSpec = {
      id: 'obs',
      name: 'Observability',
      allowedTools: ['echo'],
      stages: [
        {
          id: 'one',
          steps: [
            {
              id: 'plan',
              agentId: 'planner',
              instruction: 'Create plan',
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
          id: 'two',
          steps: [
            {
              id: 'draft',
              agentId: 'writer',
              tools: [
                {
                  tool: 'echo',
                  as: 'note',
                  input: {
                    text: 'hello',
                  },
                },
              ],
              instruction: 'Write {{steps.draft.tools.note}}',
            },
          ],
        },
      ],
      output: {
        finalStepId: 'draft',
        includeSteps: ['plan', 'draft'],
      },
    };

    await executor.execute({
      task: 'demo',
      workflow,
      agents,
    });

    const types = sink.events.map((event) => event.type);
    expect(types).toContain('run.started');
    expect(types).toContain('stage.started');
    expect(types).toContain('step.started');
    expect(types).toContain('tool.started');
    expect(types).toContain('tool.completed');
    expect(types).toContain('step.completed');
    expect(types).toContain('run.completed');
  });
});

import { AgentSpec } from '../domain/agent';
import { RuntimeEvent } from '../domain/event';
import { RunResult, StepResult } from '../domain/run';
import { ExecutionPolicy, StepCondition, StructuredOutputSpec, ToolCallSpec, WorkflowSpec } from '../domain/workflow';
import { ApprovalResolver, NoopApprovalResolver } from '../approvals/approval-resolver';
import { EventSink, NoopEventSink } from '../observability/event-sink';
import { LLMProvider } from '../providers/base/llm-provider';
import { addArtifactValues } from '../shared/artifact-values';
import { addStructuredValues, parseStructuredOutput } from '../shared/structured-output';
import { renderTemplate } from '../shared/template';
import { addToolValues } from '../shared/tool-values';
import { ToolRegistry } from '../tools/tool-registry';

interface ExecutionInput {
  task: string;
  workflow: WorkflowSpec;
  agents: Map<string, AgentSpec>;
  rootDir?: string;
  resumeFrom?: RunResult;
}

interface PreparedStep {
  stageId: string;
  stepId: string;
  agentId: string;
  userPrompt: string;
  systemPrompt: string;
  model: string;
  temperature?: number;
  structuredOutput?: StructuredOutputSpec;
  toolResults: StepResult['tools'];
  artifacts?: StepResult['artifacts'];
  execution?: ExecutionPolicy;
}

interface PlannedToolCalls {
  calls: ToolCallSpec[];
}

interface ScheduledStep {
  stageId: string;
  step: WorkflowSpec['stages'][number]['steps'][number];
  dependencies: string[];
}

export class WorkflowExecutor {
  constructor(
    private readonly provider: LLMProvider,
    private readonly tools = new ToolRegistry(),
    private readonly events: EventSink = new NoopEventSink(),
    private readonly approvals: ApprovalResolver = new NoopApprovalResolver(),
  ) {}

  private async emit(event: RuntimeEvent): Promise<void> {
    await this.events.emit(event);
  }

  private async runWithPolicy<T>(
    operation: () => Promise<T>,
    policy: ExecutionPolicy | undefined,
    label: string,
    onRetry?: (attempt: number, error: Error) => Promise<void>,
  ): Promise<{ value: T; attempts: number }> {
    const retryCount = policy?.retryCount ?? 0;
    const timeoutMs = policy?.timeoutMs;
    let attempt = 0;
    let lastError: unknown;

    const withTimeout = async (promise: Promise<T>): Promise<T> => {
      if (!timeoutMs) {
        return promise;
      }

      return await Promise.race([
        promise,
        new Promise<T>((_, reject) => {
          setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
        }),
      ]);
    };

    while (attempt <= retryCount) {
      attempt += 1;
      try {
        const value = await withTimeout(operation());
        return { value, attempts: attempt };
      } catch (error) {
        lastError = error;
        if (attempt <= retryCount && onRetry) {
          await onRetry(
            attempt,
            error instanceof Error ? error : new Error(String(error)),
          );
        }
      }
    }

    throw Object.assign(
      new Error(lastError instanceof Error ? lastError.message : `${label} failed`),
      { attempts: attempt },
    );
  }

  private resolveAllowedTools(workflow: WorkflowSpec, agent: AgentSpec): string[] | undefined {
    const workflowAllowed = workflow.allowedTools;
    const agentAllowed = agent.allowedTools;

    if (!workflowAllowed && !agentAllowed) {
      return undefined;
    }

    if (workflowAllowed && agentAllowed) {
      return workflowAllowed.filter((tool) => agentAllowed.includes(tool));
    }

    return workflowAllowed ?? agentAllowed;
  }

  private shouldExecute(condition: StepCondition | undefined, steps: StepResult[]): {
    allowed: boolean;
    reason?: string;
  } {
    if (!condition) {
      return { allowed: true };
    }

    const source = steps.find((step) => step.stepId === condition.stepId);
    if (!source) {
      throw new Error(`Condition references missing step "${condition.stepId}"`);
    }

    if (condition.exists !== undefined) {
      const exists = source.output.trim().length > 0;
      if (exists !== condition.exists) {
        return {
          allowed: false,
          reason: `Condition failed: steps.${condition.stepId}.output exists must be ${condition.exists}`,
        };
      }
    }

    if (condition.equals !== undefined && source.output.trim() !== condition.equals) {
      return {
        allowed: false,
        reason: `Condition failed: steps.${condition.stepId}.output must equal "${condition.equals}"`,
      };
    }

    if (condition.includes !== undefined && !source.output.includes(condition.includes)) {
      return {
        allowed: false,
        reason: `Condition failed: steps.${condition.stepId}.output must include "${condition.includes}"`,
      };
    }

    return { allowed: true };
  }

  private prepareStep(
    runId: string,
    stageId: string,
    step: WorkflowSpec['stages'][number]['steps'][number],
    inputWorkflow: WorkflowSpec,
    agents: Map<string, AgentSpec>,
    values: Record<string, string>,
    steps: StepResult[],
    rootDir: string,
  ): Promise<PreparedStep | StepResult> {
    const agent = agents.get(step.agentId);

    if (!agent) {
      throw new Error(`Agent not found for step "${step.id}": ${step.agentId}`);
    }

    const gate = this.shouldExecute(step.when, steps);
    if (!gate.allowed) {
      return Promise.resolve({
        stepId: step.id,
        agentId: agent.id,
        status: 'skipped',
        prompt: null,
        output: '',
        skippedReason: gate.reason,
      });
    }

    const runTools = async (): Promise<StepResult['tools']> => {
      const allowedTools = this.resolveAllowedTools(inputWorkflow, agent);
      const selectedTools = step.toolSelection?.enabled
        ? await this.planToolCalls(step, agent, values, allowedTools)
        : [];
      const declaredTools = step.tools ?? [];
      const toolCalls = [...declaredTools, ...selectedTools];

      if (toolCalls.length === 0) {
        return [];
      }

      const results = await Promise.all(
        toolCalls.map(async (toolCall) => {
          const renderedInput = Object.fromEntries(
            Object.entries(toolCall.input ?? {}).map(([key, value]) => [key, renderTemplate(value, values)]),
          );
          await this.emit({
            runId,
            timestamp: new Date().toISOString(),
            type: 'tool.started',
            workflowId: inputWorkflow.id,
            stageId,
            stepId: step.id,
            tool: toolCall.tool,
          });
          const { value: output, attempts } = await this.runWithPolicy(
            () =>
              this.tools.execute(
                {
                  tool: toolCall.tool,
                  input: renderedInput,
                },
                {
                  rootDir,
                  allowedTools,
                },
              ),
            step.execution,
            `Tool ${toolCall.tool} for step ${step.id}`,
            async (attempt, error) => {
              await this.emit({
                runId,
                timestamp: new Date().toISOString(),
                type: 'retry',
                workflowId: inputWorkflow.id,
                stageId,
                stepId: step.id,
                tool: toolCall.tool,
                attempt,
                message: error.message,
              });
            },
          );

          await this.emit({
            runId,
            timestamp: new Date().toISOString(),
            type: 'tool.completed',
            workflowId: inputWorkflow.id,
            stageId,
            stepId: step.id,
            tool: toolCall.tool,
            attempt: attempts,
          });

          return {
            tool: toolCall.tool,
            alias: toolCall.as,
            input: renderedInput,
            output,
            attempts,
          };
        }),
      );

      return results;
    };

    if (step.approval?.required) {
      const approvalKey = step.approval.key ?? `${inputWorkflow.id}:${step.id}`;
      return this.approvals.isApproved(approvalKey).then((approved) => {
        if (!approved) {
          return {
            stepId: step.id,
            agentId: agent.id,
            status: 'pending_approval' as const,
            prompt: null,
            output: '',
            approvalKey,
            approvalMessage: step.approval.message ?? `Approval required for ${step.id}`,
          };
        }

        return runTools().then((toolResults) => {
          const toolValues = { ...values };
          addToolValues(toolValues, step.id, toolResults);

          return {
            stageId,
            stepId: step.id,
            agentId: agent.id,
            userPrompt: renderTemplate(step.instruction, toolValues),
            systemPrompt: agent.systemPrompt,
            model: agent.model ?? 'gpt-4o-mini',
            temperature: agent.temperature,
            structuredOutput: step.structuredOutput,
            toolResults,
            artifacts: [],
            execution: step.execution,
          };
        });
      });
    }

    return runTools().then((toolResults) => {
      const toolValues = { ...values };
      addToolValues(toolValues, step.id, toolResults);

      return {
        stageId,
        stepId: step.id,
        agentId: agent.id,
        userPrompt: renderTemplate(step.instruction, toolValues),
        systemPrompt: agent.systemPrompt,
        model: agent.model ?? 'gpt-4o-mini',
        temperature: agent.temperature,
        structuredOutput: step.structuredOutput,
        toolResults,
        artifacts: [],
        execution: step.execution,
      };
    });
  }

  private buildArtifacts(
    runId: string,
    step: WorkflowSpec['stages'][number]['steps'][number],
    values: Record<string, string>,
    output: string,
  ): StepResult['artifacts'] {
    const specs = step.artifacts ?? [];
    if (specs.length === 0) {
      return [];
    }

    return specs.map((artifact) => {
      const content =
        artifact.template !== undefined
          ? renderTemplate(artifact.template, values)
          : artifact.contentFrom === 'output' || artifact.contentFrom === undefined
            ? output
            : output;

      return {
        name: artifact.name,
        fileName: artifact.fileName,
        path: `.myagent/artifacts/${runId}/${step.id}-${artifact.fileName}`,
        content,
      };
    });
  }

  private buildSchedule(workflow: WorkflowSpec): ScheduledStep[] {
    const scheduled: ScheduledStep[] = [];
    const priorStageSteps: string[] = [];

    for (const stage of workflow.stages) {
      for (const step of stage.steps) {
        const explicit = step.dependsOn ?? [];
        const dependencies = explicit.length > 0 ? explicit : [...priorStageSteps];
        scheduled.push({
          stageId: stage.id,
          step,
          dependencies,
        });
      }

      priorStageSteps.push(...stage.steps.map((step) => step.id));
    }

    return scheduled;
  }

  private validateAcyclicSchedule(workflow: WorkflowSpec, scheduled: ScheduledStep[]): void {
    const dependencyMap = new Map(scheduled.map((item) => [item.step.id, item.dependencies]));
    const visiting = new Set<string>();
    const visited = new Set<string>();

    const visit = (stepId: string): void => {
      if (visited.has(stepId)) {
        return;
      }
      if (visiting.has(stepId)) {
        throw new Error(`Workflow "${workflow.id}" contains a dependency cycle at step "${stepId}"`);
      }

      visiting.add(stepId);
      for (const dep of dependencyMap.get(stepId) ?? []) {
        visit(dep);
      }
      visiting.delete(stepId);
      visited.add(stepId);
    };

    for (const stepId of dependencyMap.keys()) {
      visit(stepId);
    }
  }

  private async planToolCalls(
    step: WorkflowSpec['stages'][number]['steps'][number],
    agent: AgentSpec,
    values: Record<string, string>,
    allowedTools: string[] | undefined,
  ): Promise<ToolCallSpec[]> {
    const availableTools = this.tools.listAllowed(allowedTools);
    if (availableTools.length === 0) {
      return [];
    }

    const planningPrompt = [
      `Task context: ${values.task ?? ''}`,
      '',
      `Step instruction: ${renderTemplate(step.instruction, values)}`,
      '',
      'Available tools:',
      ...availableTools.map((tool) => `- ${tool.name}: ${tool.description}`),
      '',
      `Select at most ${step.toolSelection?.maxCalls ?? 1} tools.`,
      'Return JSON with shape: {"calls":[{"tool":"name","as":"alias","input":{"key":"value"}}]}',
      'Use only listed tools. Return {"calls":[]} if no tool is needed.',
    ].join('\n');

    const raw = await this.provider.generate({
      model: agent.model ?? 'gpt-4o-mini',
      systemPrompt: `${agent.systemPrompt}\nYou are selecting tool calls for a workflow step.`,
      userPrompt: planningPrompt,
      temperature: 0,
      responseFormat: 'json',
    });

    let parsed: PlannedToolCalls;
    try {
      parsed = JSON.parse(raw) as PlannedToolCalls;
    } catch {
      throw new Error(`Tool planner for step "${step.id}" returned invalid JSON`);
    }

    const calls = Array.isArray(parsed?.calls) ? parsed.calls : [];
    const maxCalls = step.toolSelection?.maxCalls ?? 1;

    return calls.slice(0, maxCalls).map((call, index) => ({
      tool: String(call.tool),
      as: call.as ? String(call.as) : `tool_${index + 1}`,
      input: Object.fromEntries(
        Object.entries(call.input ?? {}).map(([key, value]) => [key, String(value)]),
      ),
    }));
  }

  async execute(input: ExecutionInput): Promise<RunResult> {
    const startedAt = new Date().toISOString();
    const runId = `run_${Date.now()}`;
    const values: Record<string, string> = {
      task: input.task,
    };
    const resumedSteps = (input.resumeFrom?.steps ?? []).filter((step) => step.status !== 'pending_approval');
    const steps: StepResult[] = [...resumedSteps];
    const scheduled = this.buildSchedule(input.workflow);
    this.validateAcyclicSchedule(input.workflow, scheduled);
    const pending = new Map(
      scheduled
        .filter((item) => !resumedSteps.some((step) => step.stepId === item.step.id))
        .map((item) => [item.step.id, item]),
    );
    const activeStages = new Set<string>();

    for (const step of resumedSteps) {
      values[`steps.${step.stepId}.output`] = step.output;
      addStructuredValues(values, step.stepId, step.data);
      addToolValues(values, step.stepId, step.tools);
      addArtifactValues(values, step.stepId, step.artifacts);
    }

    await this.emit({
      runId,
      timestamp: startedAt,
      type: 'run.started',
      workflowId: input.workflow.id,
      data: {
        task: input.task,
      },
    });

    if (input.resumeFrom) {
      await this.emit({
        runId,
        timestamp: startedAt,
        type: 'run.resumed',
        workflowId: input.workflow.id,
        data: {
          resumedFromRunId: input.resumeFrom.runId,
        },
      });

      for (const step of resumedSteps) {
        await this.emit({
          runId,
          timestamp: startedAt,
          type: 'step.reused',
          workflowId: input.workflow.id,
          stepId: step.stepId,
          data: {
            priorStatus: step.status,
          },
        });
      }
    }

    while (pending.size > 0) {
      const ready = Array.from(pending.values()).filter((item) =>
        item.dependencies.every((dependency) =>
          steps.some((step) => step.stepId === dependency && step.status !== 'pending_approval'),
        ),
      );

      if (ready.length === 0) {
        const pendingApprovals = steps.filter((step) => step.status === 'pending_approval');
        if (pendingApprovals.length > 0) {
          break;
        }
        throw new Error(`Workflow "${input.workflow.id}" has unresolved step dependencies`);
      }

      for (const item of ready) {
        if (!activeStages.has(item.stageId)) {
          activeStages.add(item.stageId);
          await this.emit({
            runId,
            timestamp: new Date().toISOString(),
            type: 'stage.started',
            workflowId: input.workflow.id,
            stageId: item.stageId,
          });
        }
      }

      const prepared = await Promise.all(
        ready.map((item) =>
          this.prepareStep(
            runId,
            item.stageId,
            item.step,
            input.workflow,
            input.agents,
            values,
            steps,
            input.rootDir ?? process.cwd(),
          ),
        ),
      );

      const completed = await Promise.all(
        prepared.map(async (item) => {
          if ('status' in item) {
            const eventType =
              item.status === 'pending_approval'
                ? 'step.failed'
                : 'step.skipped';
            await this.emit({
              runId,
              timestamp: new Date().toISOString(),
              type: eventType,
              workflowId: input.workflow.id,
              stageId: ready.find((readyItem) => readyItem.step.id === item.stepId)?.stageId,
              stepId: item.stepId,
              message: item.status === 'pending_approval' ? item.approvalMessage : item.skippedReason,
            });
            return item;
          }

          await this.emit({
            runId,
            timestamp: new Date().toISOString(),
            type: 'step.started',
            workflowId: input.workflow.id,
            stageId: item.stageId,
            stepId: item.stepId,
          });

          try {
            const { value: output, attempts } = await this.runWithPolicy(
              () =>
                this.provider.generate({
                  model: item.model,
                  systemPrompt: item.systemPrompt,
                  userPrompt: item.userPrompt,
                  temperature: item.temperature,
                  responseFormat: item.structuredOutput ? 'json' : 'text',
                }),
              item.execution,
              `Model generation for step ${item.stepId}`,
              async (attempt, error) => {
                await this.emit({
                  runId,
                  timestamp: new Date().toISOString(),
                  type: 'retry',
                  workflowId: input.workflow.id,
                  stageId: item.stageId,
                  stepId: item.stepId,
                  attempt,
                  message: error.message,
                });
              },
            );

            const data = item.structuredOutput
              ? parseStructuredOutput(output, item.structuredOutput)
              : undefined;

            const result: StepResult = {
              stepId: item.stepId,
              agentId: item.agentId,
              status: 'completed',
              prompt: item.userPrompt,
              output,
              data,
              tools: item.toolResults,
              artifacts: this.buildArtifacts(runId, ready.find((entry) => entry.step.id === item.stepId)!.step, {
                ...values,
                [`steps.${item.stepId}.output`]: output,
              }, output),
              attempts,
            };

            await this.emit({
              runId,
              timestamp: new Date().toISOString(),
              type: 'step.completed',
              workflowId: input.workflow.id,
              stageId: item.stageId,
              stepId: item.stepId,
              attempt: attempts,
            });

            return result;
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            const attempts = typeof (error as { attempts?: unknown })?.attempts === 'number'
              ? ((error as { attempts: number }).attempts)
              : undefined;
            const failed: StepResult = {
              stepId: item.stepId,
              agentId: item.agentId,
              status: 'failed',
              prompt: item.userPrompt,
              output: '',
              tools: item.toolResults,
              error: message,
              attempts,
            };

            await this.emit({
              runId,
              timestamp: new Date().toISOString(),
              type: 'step.failed',
              workflowId: input.workflow.id,
              stageId: item.stageId,
              stepId: item.stepId,
              attempt: attempts,
              message: message,
            });

            if (item.execution?.continueOnError) {
              return failed;
            }

            throw error;
          }
        }),
      );

      for (const result of completed) {
        steps.push(result);
        values[`steps.${result.stepId}.output`] = result.output;
        addStructuredValues(values, result.stepId, result.data);
        addToolValues(values, result.stepId, result.tools);
        addArtifactValues(values, result.stepId, result.artifacts);
        pending.delete(result.stepId);
      }

      for (const stageId of Array.from(activeStages)) {
        const remainingInStage = Array.from(pending.values()).some((item) => item.stageId === stageId);
        if (!remainingInStage) {
          activeStages.delete(stageId);
          await this.emit({
            runId,
            timestamp: new Date().toISOString(),
            type: 'stage.completed',
            workflowId: input.workflow.id,
            stageId,
          });
        }
      }
    }

    const finalStep = steps.find(
      (step) => step.stepId === input.workflow.output.finalStepId && step.status === 'completed',
    );
    const hasPendingApproval = steps.some((step) => step.status === 'pending_approval');
    if (!finalStep && !hasPendingApproval) {
      throw new Error(`Final step not found: ${input.workflow.output.finalStepId}`);
    }

    const runResult = {
      runId,
      resumedFromRunId: input.resumeFrom?.runId,
      task: input.task,
      workflowId: input.workflow.id,
      startedAt,
      completedAt: new Date().toISOString(),
      status: hasPendingApproval ? 'pending_approval' as const : 'completed' as const,
      final: finalStep?.output ?? '',
      steps: steps.filter((step) => input.workflow.output.includeSteps.includes(step.stepId)),
    };

    await this.emit({
      runId,
      timestamp: runResult.completedAt,
      type: 'run.completed',
      workflowId: input.workflow.id,
      data: {
        finalStepId: input.workflow.output.finalStepId,
      },
    });

    return runResult;
  }
}

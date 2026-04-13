"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkflowExecutor = void 0;
const approval_resolver_1 = require("../approvals/approval-resolver");
const event_sink_1 = require("../observability/event-sink");
const artifact_values_1 = require("../shared/artifact-values");
const structured_output_1 = require("../shared/structured-output");
const template_1 = require("../shared/template");
const tool_values_1 = require("../shared/tool-values");
const tool_registry_1 = require("../tools/tool-registry");
class WorkflowExecutor {
    provider;
    tools;
    events;
    approvals;
    constructor(provider, tools = new tool_registry_1.ToolRegistry(), events = new event_sink_1.NoopEventSink(), approvals = new approval_resolver_1.NoopApprovalResolver()) {
        this.provider = provider;
        this.tools = tools;
        this.events = events;
        this.approvals = approvals;
    }
    async emit(event) {
        await this.events.emit(event);
    }
    async runWithPolicy(operation, policy, label, onRetry) {
        const retryCount = policy?.retryCount ?? 0;
        const timeoutMs = policy?.timeoutMs;
        let attempt = 0;
        let lastError;
        const withTimeout = async (promise) => {
            if (!timeoutMs) {
                return promise;
            }
            return await Promise.race([
                promise,
                new Promise((_, reject) => {
                    setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
                }),
            ]);
        };
        while (attempt <= retryCount) {
            attempt += 1;
            try {
                const value = await withTimeout(operation());
                return { value, attempts: attempt };
            }
            catch (error) {
                lastError = error;
                if (attempt <= retryCount && onRetry) {
                    await onRetry(attempt, error instanceof Error ? error : new Error(String(error)));
                }
            }
        }
        throw Object.assign(new Error(lastError instanceof Error ? lastError.message : `${label} failed`), { attempts: attempt });
    }
    resolveAllowedTools(workflow, agent) {
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
    shouldExecute(condition, steps) {
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
    prepareStep(runId, stageId, step, inputWorkflow, agents, values, steps, rootDir) {
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
        const runTools = async () => {
            const allowedTools = this.resolveAllowedTools(inputWorkflow, agent);
            const selectedTools = step.toolSelection?.enabled
                ? await this.planToolCalls(step, agent, values, allowedTools)
                : [];
            const declaredTools = step.tools ?? [];
            const toolCalls = [...declaredTools, ...selectedTools];
            if (toolCalls.length === 0) {
                return [];
            }
            const results = await Promise.all(toolCalls.map(async (toolCall) => {
                const renderedInput = Object.fromEntries(Object.entries(toolCall.input ?? {}).map(([key, value]) => [key, (0, template_1.renderTemplate)(value, values)]));
                await this.emit({
                    runId,
                    timestamp: new Date().toISOString(),
                    type: 'tool.started',
                    workflowId: inputWorkflow.id,
                    stageId,
                    stepId: step.id,
                    tool: toolCall.tool,
                });
                const { value: output, attempts } = await this.runWithPolicy(() => this.tools.execute({
                    tool: toolCall.tool,
                    input: renderedInput,
                }, {
                    rootDir,
                    allowedTools,
                }), step.execution, `Tool ${toolCall.tool} for step ${step.id}`, async (attempt, error) => {
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
                });
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
            }));
            return results;
        };
        if (step.approval?.required) {
            const approvalKey = step.approval.key ?? `${inputWorkflow.id}:${step.id}`;
            return this.approvals.isApproved(approvalKey).then((approved) => {
                if (!approved) {
                    return {
                        stepId: step.id,
                        agentId: agent.id,
                        status: 'pending_approval',
                        prompt: null,
                        output: '',
                        approvalKey,
                        approvalMessage: step.approval.message ?? `Approval required for ${step.id}`,
                    };
                }
                return runTools().then((toolResults) => {
                    const toolValues = { ...values };
                    (0, tool_values_1.addToolValues)(toolValues, step.id, toolResults);
                    return {
                        stageId,
                        stepId: step.id,
                        agentId: agent.id,
                        userPrompt: (0, template_1.renderTemplate)(step.instruction, toolValues),
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
            (0, tool_values_1.addToolValues)(toolValues, step.id, toolResults);
            return {
                stageId,
                stepId: step.id,
                agentId: agent.id,
                userPrompt: (0, template_1.renderTemplate)(step.instruction, toolValues),
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
    buildArtifacts(runId, step, values, output) {
        const specs = step.artifacts ?? [];
        if (specs.length === 0) {
            return [];
        }
        return specs.map((artifact) => {
            const content = artifact.template !== undefined
                ? (0, template_1.renderTemplate)(artifact.template, values)
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
    buildSchedule(workflow) {
        const scheduled = [];
        const priorStageSteps = [];
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
    validateAcyclicSchedule(workflow, scheduled) {
        const dependencyMap = new Map(scheduled.map((item) => [item.step.id, item.dependencies]));
        const visiting = new Set();
        const visited = new Set();
        const visit = (stepId) => {
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
    async planToolCalls(step, agent, values, allowedTools) {
        const availableTools = this.tools.listAllowed(allowedTools);
        if (availableTools.length === 0) {
            return [];
        }
        const planningPrompt = [
            `Task context: ${values.task ?? ''}`,
            '',
            `Step instruction: ${(0, template_1.renderTemplate)(step.instruction, values)}`,
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
        let parsed;
        try {
            parsed = JSON.parse(raw);
        }
        catch {
            throw new Error(`Tool planner for step "${step.id}" returned invalid JSON`);
        }
        const calls = Array.isArray(parsed?.calls) ? parsed.calls : [];
        const maxCalls = step.toolSelection?.maxCalls ?? 1;
        return calls.slice(0, maxCalls).map((call, index) => ({
            tool: String(call.tool),
            as: call.as ? String(call.as) : `tool_${index + 1}`,
            input: Object.fromEntries(Object.entries(call.input ?? {}).map(([key, value]) => [key, String(value)])),
        }));
    }
    async execute(input) {
        const startedAt = new Date().toISOString();
        const runId = `run_${Date.now()}`;
        const values = {
            task: input.task,
        };
        const resumedSteps = (input.resumeFrom?.steps ?? []).filter((step) => step.status !== 'pending_approval');
        const steps = [...resumedSteps];
        const scheduled = this.buildSchedule(input.workflow);
        this.validateAcyclicSchedule(input.workflow, scheduled);
        const pending = new Map(scheduled
            .filter((item) => !resumedSteps.some((step) => step.stepId === item.step.id))
            .map((item) => [item.step.id, item]));
        const activeStages = new Set();
        for (const step of resumedSteps) {
            values[`steps.${step.stepId}.output`] = step.output;
            (0, structured_output_1.addStructuredValues)(values, step.stepId, step.data);
            (0, tool_values_1.addToolValues)(values, step.stepId, step.tools);
            (0, artifact_values_1.addArtifactValues)(values, step.stepId, step.artifacts);
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
            const ready = Array.from(pending.values()).filter((item) => item.dependencies.every((dependency) => steps.some((step) => step.stepId === dependency && step.status !== 'pending_approval')));
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
            const prepared = await Promise.all(ready.map((item) => this.prepareStep(runId, item.stageId, item.step, input.workflow, input.agents, values, steps, input.rootDir ?? process.cwd())));
            const completed = await Promise.all(prepared.map(async (item) => {
                if ('status' in item) {
                    const eventType = item.status === 'pending_approval'
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
                    const { value: output, attempts } = await this.runWithPolicy(() => this.provider.generate({
                        model: item.model,
                        systemPrompt: item.systemPrompt,
                        userPrompt: item.userPrompt,
                        temperature: item.temperature,
                        responseFormat: item.structuredOutput ? 'json' : 'text',
                    }), item.execution, `Model generation for step ${item.stepId}`, async (attempt, error) => {
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
                    });
                    const data = item.structuredOutput
                        ? (0, structured_output_1.parseStructuredOutput)(output, item.structuredOutput)
                        : undefined;
                    const result = {
                        stepId: item.stepId,
                        agentId: item.agentId,
                        status: 'completed',
                        prompt: item.userPrompt,
                        output,
                        data,
                        tools: item.toolResults,
                        artifacts: this.buildArtifacts(runId, ready.find((entry) => entry.step.id === item.stepId).step, {
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
                }
                catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    const attempts = typeof error?.attempts === 'number'
                        ? (error.attempts)
                        : undefined;
                    const failed = {
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
            }));
            for (const result of completed) {
                steps.push(result);
                values[`steps.${result.stepId}.output`] = result.output;
                (0, structured_output_1.addStructuredValues)(values, result.stepId, result.data);
                (0, tool_values_1.addToolValues)(values, result.stepId, result.tools);
                (0, artifact_values_1.addArtifactValues)(values, result.stepId, result.artifacts);
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
        const finalStep = steps.find((step) => step.stepId === input.workflow.output.finalStepId && step.status === 'completed');
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
            status: hasPendingApproval ? 'pending_approval' : 'completed',
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
exports.WorkflowExecutor = WorkflowExecutor;

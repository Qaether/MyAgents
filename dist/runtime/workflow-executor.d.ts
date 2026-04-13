import { AgentSpec } from '../domain/agent';
import { RunResult } from '../domain/run';
import { WorkflowSpec } from '../domain/workflow';
import { ApprovalResolver } from '../approvals/approval-resolver';
import { EventSink } from '../observability/event-sink';
import { LLMProvider } from '../providers/base/llm-provider';
import { ToolRegistry } from '../tools/tool-registry';
interface ExecutionInput {
    task: string;
    workflow: WorkflowSpec;
    agents: Map<string, AgentSpec>;
    rootDir?: string;
    resumeFrom?: RunResult;
}
export declare class WorkflowExecutor {
    private readonly provider;
    private readonly tools;
    private readonly events;
    private readonly approvals;
    constructor(provider: LLMProvider, tools?: ToolRegistry, events?: EventSink, approvals?: ApprovalResolver);
    private emit;
    private runWithPolicy;
    private resolveAllowedTools;
    private shouldExecute;
    private prepareStep;
    private buildArtifacts;
    private buildSchedule;
    private validateAcyclicSchedule;
    private planToolCalls;
    execute(input: ExecutionInput): Promise<RunResult>;
}
export {};

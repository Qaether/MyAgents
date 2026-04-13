import { WorkflowSpec } from './workflow';
export type StepStatus = 'completed' | 'skipped' | 'failed' | 'pending_approval';
export interface ToolExecutionResult {
    tool: string;
    alias: string;
    input: Record<string, string>;
    output: string;
    attempts?: number;
    error?: string;
}
export interface ArtifactResult {
    name: string;
    fileName: string;
    path: string;
    content: string;
}
export interface StepResult {
    stepId: string;
    agentId: string;
    status: StepStatus;
    prompt: string | null;
    output: string;
    data?: Record<string, unknown>;
    tools?: ToolExecutionResult[];
    artifacts?: ArtifactResult[];
    skippedReason?: string;
    error?: string;
    attempts?: number;
    approvalKey?: string;
    approvalMessage?: string;
}
export interface RunResult {
    runId: string;
    resumedFromRunId?: string;
    task: string;
    workflowId: WorkflowSpec['id'];
    startedAt: string;
    completedAt: string;
    status: 'completed' | 'pending_approval';
    final: string;
    steps: StepResult[];
}
export interface RunSummary {
    runId: string;
    resumedFromRunId?: string;
    workflowId: string;
    status: RunResult['status'];
    taskPreview: string;
    startedAt: string;
    completedAt: string;
}

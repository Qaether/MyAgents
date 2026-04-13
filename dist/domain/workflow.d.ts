export interface StepCondition {
    stepId: string;
    exists?: boolean;
    equals?: string;
    includes?: string;
}
export type StructuredFieldType = 'string' | 'string[]' | 'number' | 'boolean';
export interface StructuredOutputSpec {
    fields: Record<string, StructuredFieldType>;
}
export interface ToolCallSpec {
    tool: string;
    as: string;
    input?: Record<string, string>;
}
export interface ToolSelectionSpec {
    enabled: boolean;
    maxCalls?: number;
}
export interface ExecutionPolicy {
    retryCount?: number;
    timeoutMs?: number;
    continueOnError?: boolean;
}
export interface ApprovalGate {
    required: boolean;
    key?: string;
    message?: string;
}
export interface ArtifactSpec {
    name: string;
    fileName: string;
    contentFrom?: 'output';
    template?: string;
}
export interface WorkflowStep {
    id: string;
    agentId: string;
    instruction: string;
    dependsOn?: string[];
    when?: StepCondition;
    structuredOutput?: StructuredOutputSpec;
    tools?: ToolCallSpec[];
    toolSelection?: ToolSelectionSpec;
    execution?: ExecutionPolicy;
    approval?: ApprovalGate;
    artifacts?: ArtifactSpec[];
}
export interface WorkflowStage {
    id: string;
    name?: string;
    steps: WorkflowStep[];
}
export interface WorkflowOutputSpec {
    finalStepId: string;
    includeSteps: string[];
}
export interface WorkflowSpec {
    id: string;
    name: string;
    description?: string;
    allowedTools?: string[];
    stages: WorkflowStage[];
    output: WorkflowOutputSpec;
}

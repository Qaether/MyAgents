"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkflowSpecSchema = exports.WorkflowStageSchema = exports.WorkflowStepSchema = exports.ArtifactSchema = exports.ApprovalGateSchema = exports.ExecutionPolicySchema = exports.ToolSelectionSchema = exports.ToolCallSchema = exports.StructuredOutputSchema = exports.StructuredFieldTypeSchema = exports.StepConditionSchema = exports.AgentSpecSchema = exports.ProjectConfigSchema = void 0;
const zod_1 = require("zod");
exports.ProjectConfigSchema = zod_1.z.object({
    project: zod_1.z.object({
        name: zod_1.z.string(),
        defaultWorkflow: zod_1.z.string(),
        agentsDir: zod_1.z.string(),
        workflowsDir: zod_1.z.string(),
        runsDir: zod_1.z.string().default('.myagent/runs'),
        artifactsDir: zod_1.z.string().default('.myagent/artifacts'),
        eventsDir: zod_1.z.string().default('.myagent/events'),
        approvalsFile: zod_1.z.string().default('.myagent/approvals.json'),
    }),
    provider: zod_1.z.object({
        kind: zod_1.z.literal('openai'),
        model: zod_1.z.string(),
        apiKeyEnv: zod_1.z.string().default('OPENAI_API_KEY'),
        apiKey: zod_1.z.string().optional(),
    }),
});
exports.AgentSpecSchema = zod_1.z.object({
    id: zod_1.z.string(),
    name: zod_1.z.string(),
    role: zod_1.z.string(),
    systemPrompt: zod_1.z.string(),
    model: zod_1.z.string().optional(),
    temperature: zod_1.z.number().min(0).max(2).optional(),
    allowedTools: zod_1.z.array(zod_1.z.string()).optional(),
});
exports.StepConditionSchema = zod_1.z.object({
    stepId: zod_1.z.string(),
    exists: zod_1.z.boolean().optional(),
    equals: zod_1.z.string().optional(),
    includes: zod_1.z.string().optional(),
});
exports.StructuredFieldTypeSchema = zod_1.z.enum(['string', 'string[]', 'number', 'boolean']);
exports.StructuredOutputSchema = zod_1.z.object({
    fields: zod_1.z.record(exports.StructuredFieldTypeSchema),
});
exports.ToolCallSchema = zod_1.z.object({
    tool: zod_1.z.string(),
    as: zod_1.z.string(),
    input: zod_1.z.record(zod_1.z.string()).optional(),
});
exports.ToolSelectionSchema = zod_1.z.object({
    enabled: zod_1.z.boolean(),
    maxCalls: zod_1.z.number().int().min(1).max(10).optional(),
});
exports.ExecutionPolicySchema = zod_1.z.object({
    retryCount: zod_1.z.number().int().min(0).max(5).optional(),
    timeoutMs: zod_1.z.number().int().min(1).max(300000).optional(),
    continueOnError: zod_1.z.boolean().optional(),
});
exports.ApprovalGateSchema = zod_1.z.object({
    required: zod_1.z.boolean(),
    key: zod_1.z.string().optional(),
    message: zod_1.z.string().optional(),
});
exports.ArtifactSchema = zod_1.z.object({
    name: zod_1.z.string(),
    fileName: zod_1.z.string(),
    contentFrom: zod_1.z.enum(['output']).optional(),
    template: zod_1.z.string().optional(),
});
exports.WorkflowStepSchema = zod_1.z.object({
    id: zod_1.z.string(),
    agentId: zod_1.z.string(),
    instruction: zod_1.z.string(),
    dependsOn: zod_1.z.array(zod_1.z.string()).optional(),
    when: exports.StepConditionSchema.optional(),
    structuredOutput: exports.StructuredOutputSchema.optional(),
    tools: zod_1.z.array(exports.ToolCallSchema).optional(),
    toolSelection: exports.ToolSelectionSchema.optional(),
    execution: exports.ExecutionPolicySchema.optional(),
    approval: exports.ApprovalGateSchema.optional(),
    artifacts: zod_1.z.array(exports.ArtifactSchema).optional(),
});
exports.WorkflowStageSchema = zod_1.z.object({
    id: zod_1.z.string(),
    name: zod_1.z.string().optional(),
    steps: zod_1.z.array(exports.WorkflowStepSchema).min(1),
});
exports.WorkflowSpecSchema = zod_1.z.object({
    id: zod_1.z.string(),
    name: zod_1.z.string(),
    description: zod_1.z.string().optional(),
    allowedTools: zod_1.z.array(zod_1.z.string()).optional(),
    stages: zod_1.z.array(exports.WorkflowStageSchema).min(1),
    output: zod_1.z.object({
        finalStepId: zod_1.z.string(),
        includeSteps: zod_1.z.array(zod_1.z.string()).min(1),
    }),
});

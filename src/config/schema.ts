import { z } from 'zod';

export const ProjectConfigSchema = z.object({
  project: z.object({
    name: z.string(),
    defaultWorkflow: z.string(),
    agentsDir: z.string(),
    workflowsDir: z.string(),
    runsDir: z.string().default('.myagent/runs'),
    artifactsDir: z.string().default('.myagent/artifacts'),
    eventsDir: z.string().default('.myagent/events'),
    approvalsFile: z.string().default('.myagent/approvals.json'),
  }),
  provider: z.object({
    kind: z.literal('openai'),
    model: z.string(),
    apiKeyEnv: z.string().default('OPENAI_API_KEY'),
    apiKey: z.string().optional(),
  }),
});

export const AgentSpecSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string(),
  systemPrompt: z.string(),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  allowedTools: z.array(z.string()).optional(),
});

export const StepConditionSchema = z.object({
  stepId: z.string(),
  exists: z.boolean().optional(),
  equals: z.string().optional(),
  includes: z.string().optional(),
});

export const StructuredFieldTypeSchema = z.enum(['string', 'string[]', 'number', 'boolean']);

export const StructuredOutputSchema = z.object({
  fields: z.record(StructuredFieldTypeSchema),
});

export const ToolCallSchema = z.object({
  tool: z.string(),
  as: z.string(),
  input: z.record(z.string()).optional(),
});

export const ToolSelectionSchema = z.object({
  enabled: z.boolean(),
  maxCalls: z.number().int().min(1).max(10).optional(),
});

export const ExecutionPolicySchema = z.object({
  retryCount: z.number().int().min(0).max(5).optional(),
  timeoutMs: z.number().int().min(1).max(300000).optional(),
  continueOnError: z.boolean().optional(),
});

export const ApprovalGateSchema = z.object({
  required: z.boolean(),
  key: z.string().optional(),
  message: z.string().optional(),
});

export const ArtifactSchema = z.object({
  name: z.string(),
  fileName: z.string(),
  contentFrom: z.enum(['output']).optional(),
  template: z.string().optional(),
});

export const WorkflowStepSchema = z.object({
  id: z.string(),
  agentId: z.string(),
  instruction: z.string(),
  dependsOn: z.array(z.string()).optional(),
  when: StepConditionSchema.optional(),
  structuredOutput: StructuredOutputSchema.optional(),
  tools: z.array(ToolCallSchema).optional(),
  toolSelection: ToolSelectionSchema.optional(),
  execution: ExecutionPolicySchema.optional(),
  approval: ApprovalGateSchema.optional(),
  artifacts: z.array(ArtifactSchema).optional(),
});

export const WorkflowStageSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  steps: z.array(WorkflowStepSchema).min(1),
});

export const WorkflowSpecSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  allowedTools: z.array(z.string()).optional(),
  stages: z.array(WorkflowStageSchema).min(1),
  output: z.object({
    finalStepId: z.string(),
    includeSteps: z.array(z.string()).min(1),
  }),
});

export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;
export type OpenAIProviderConfig = ProjectConfig['provider'];
export interface ResolvedOpenAIProviderConfig extends OpenAIProviderConfig {
  apiKey: string;
}
export type AgentFile = z.infer<typeof AgentSpecSchema>;
export type WorkflowFile = z.infer<typeof WorkflowSpecSchema>;

import { promises as fs } from 'fs';
import { resolve } from 'path';
import { AgentSpec } from '../domain/agent';
import { WorkflowSpec } from '../domain/workflow';
import {
  AgentSpecSchema,
  ProjectConfig,
  ProjectConfigSchema,
  WorkflowSpecSchema,
} from './schema';

export interface LoadedProject {
  rootDir: string;
  config: ProjectConfig;
  agents: AgentSpec[];
  workflows: WorkflowSpec[];
  agentMap: Map<string, AgentSpec>;
  workflowMap: Map<string, WorkflowSpec>;
}

async function readJson<T>(filePath: string): Promise<T> {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw) as T;
}

async function readJsonFiles(dirPath: string): Promise<string[]> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => resolve(dirPath, entry.name))
    .sort();
}

export async function loadProject(configPath = 'myagent.config.json'): Promise<LoadedProject> {
  const rootDir = process.cwd();
  const resolvedConfigPath = resolve(rootDir, configPath);
  const config = ProjectConfigSchema.parse(await readJson<ProjectConfig>(resolvedConfigPath));

  const agentsDir = resolve(rootDir, config.project.agentsDir);
  const workflowsDir = resolve(rootDir, config.project.workflowsDir);

  const [agentFiles, workflowFiles] = await Promise.all([
    readJsonFiles(agentsDir),
    readJsonFiles(workflowsDir),
  ]);

  const agents = await Promise.all(
    agentFiles.map(async (filePath) => AgentSpecSchema.parse(await readJson(filePath)) as AgentSpec),
  );
  const workflows = await Promise.all(
    workflowFiles.map(async (filePath) => WorkflowSpecSchema.parse(await readJson(filePath)) as WorkflowSpec),
  );

  const agentMap = new Map(agents.map((agent) => [agent.id, agent]));
  const workflowMap = new Map(workflows.map((workflow) => [workflow.id, workflow]));

  for (const workflow of workflows) {
    const allStepIds = new Set<string>();

    for (const stage of workflow.stages) {
      for (const step of stage.steps) {
        if (!agentMap.has(step.agentId)) {
          throw new Error(`Workflow "${workflow.id}" references unknown agent "${step.agentId}"`);
        }
        if (allStepIds.has(step.id)) {
          throw new Error(`Workflow "${workflow.id}" contains duplicate step id "${step.id}"`);
        }
        allStepIds.add(step.id);
      }
    }

    for (const stage of workflow.stages) {
      for (const step of stage.steps) {
        for (const dependency of step.dependsOn ?? []) {
          if (!allStepIds.has(dependency)) {
            throw new Error(`Workflow "${workflow.id}" step "${step.id}" depends on unknown step "${dependency}"`);
          }
          if (dependency === step.id) {
            throw new Error(`Workflow "${workflow.id}" step "${step.id}" cannot depend on itself`);
          }
        }
      }
    }

    const hasFinalStep = workflow.stages.some((stage) =>
      stage.steps.some((step) => step.id === workflow.output.finalStepId),
    );
    if (!hasFinalStep) {
      throw new Error(`Workflow "${workflow.id}" references missing final step "${workflow.output.finalStepId}"`);
    }
  }

  return {
    rootDir,
    config,
    agents,
    workflows,
    agentMap,
    workflowMap,
  };
}

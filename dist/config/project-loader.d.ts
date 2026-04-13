import { AgentSpec } from '../domain/agent';
import { WorkflowSpec } from '../domain/workflow';
import { ProjectConfig } from './schema';
export interface LoadedProject {
    rootDir: string;
    config: ProjectConfig;
    agents: AgentSpec[];
    workflows: WorkflowSpec[];
    agentMap: Map<string, AgentSpec>;
    workflowMap: Map<string, WorkflowSpec>;
}
export declare function loadProject(configPath?: string): Promise<LoadedProject>;

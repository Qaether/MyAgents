"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadProject = loadProject;
const fs_1 = require("fs");
const path_1 = require("path");
const schema_1 = require("./schema");
async function readJson(filePath) {
    const raw = await fs_1.promises.readFile(filePath, 'utf8');
    return JSON.parse(raw);
}
async function readJsonFiles(dirPath) {
    const entries = await fs_1.promises.readdir(dirPath, { withFileTypes: true });
    return entries
        .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
        .map((entry) => (0, path_1.resolve)(dirPath, entry.name))
        .sort();
}
async function loadProject(configPath = 'myagent.config.json') {
    const rootDir = process.cwd();
    const resolvedConfigPath = (0, path_1.resolve)(rootDir, configPath);
    const config = schema_1.ProjectConfigSchema.parse(await readJson(resolvedConfigPath));
    const agentsDir = (0, path_1.resolve)(rootDir, config.project.agentsDir);
    const workflowsDir = (0, path_1.resolve)(rootDir, config.project.workflowsDir);
    const [agentFiles, workflowFiles] = await Promise.all([
        readJsonFiles(agentsDir),
        readJsonFiles(workflowsDir),
    ]);
    const agents = await Promise.all(agentFiles.map(async (filePath) => schema_1.AgentSpecSchema.parse(await readJson(filePath))));
    const workflows = await Promise.all(workflowFiles.map(async (filePath) => schema_1.WorkflowSpecSchema.parse(await readJson(filePath))));
    const agentMap = new Map(agents.map((agent) => [agent.id, agent]));
    const workflowMap = new Map(workflows.map((workflow) => [workflow.id, workflow]));
    for (const workflow of workflows) {
        const allStepIds = new Set();
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
        const hasFinalStep = workflow.stages.some((stage) => stage.steps.some((step) => step.id === workflow.output.finalStepId));
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

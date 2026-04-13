"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runCli = runCli;
const commander_1 = require("commander");
const approval_store_1 = require("../approvals/approval-store");
const provider_config_1 = require("../config/provider-config");
const project_loader_1 = require("../config/project-loader");
const event_store_1 = require("../persistence/event-store");
const run_store_1 = require("../persistence/run-store");
const provider_factory_1 = require("../providers/provider-factory");
const repl_1 = require("./repl");
const workflow_executor_1 = require("../runtime/workflow-executor");
function printJson(value) {
    console.log(JSON.stringify(value, null, 2));
}
async function runCli(argv = process.argv) {
    const program = new commander_1.Command();
    program
        .name('myagent')
        .description('Workflow-oriented multi-agent runtime')
        .version('1.0.0');
    program
        .command('repl')
        .description('Start an interactive REPL session')
        .action(async () => {
        await (0, repl_1.startRepl)();
    });
    program
        .command('validate')
        .description('Validate project configuration, agents, and workflows')
        .action(async () => {
        const project = await (0, project_loader_1.loadProject)();
        console.log(`Project: ${project.config.project.name}`);
        console.log(`Provider: ${project.config.provider.kind}`);
        console.log(`Agents: ${project.agents.length}`);
        console.log(`Workflows: ${project.workflows.length}`);
        console.log('Validation passed.');
    });
    program
        .command('inspect')
        .description('Print the loaded project structure')
        .action(async () => {
        const project = await (0, project_loader_1.loadProject)();
        printJson({
            project: project.config.project,
            provider: {
                kind: project.config.provider.kind,
                model: project.config.provider.model,
                apiKeyConfigured: Boolean(process.env[project.config.provider.apiKeyEnv] || project.config.provider.apiKey),
                apiKeySource: process.env[project.config.provider.apiKeyEnv] ? 'env' : 'config',
            },
            agents: project.agents.map((agent) => ({
                id: agent.id,
                role: agent.role,
                model: agent.model,
            })),
            workflows: project.workflows.map((workflow) => ({
                id: workflow.id,
                stages: workflow.stages.map((stage) => ({
                    id: stage.id,
                    steps: stage.steps.map((step) => ({
                        id: step.id,
                        agentId: step.agentId,
                    })),
                })),
            })),
        });
    });
    program
        .command('run <task>')
        .description('Execute the default workflow for a task')
        .option('-w, --workflow <id>', 'workflow id override')
        .action(async (task, options) => {
        const project = await (0, project_loader_1.loadProject)();
        const provider = (0, provider_factory_1.createProvider)((0, provider_config_1.resolveOpenAIConfig)(project.config));
        const eventStore = new event_store_1.EventStore(project);
        const approvalStore = new approval_store_1.ApprovalStore(project);
        const executor = new workflow_executor_1.WorkflowExecutor(provider, undefined, eventStore, approvalStore);
        const runStore = new run_store_1.RunStore(project);
        const workflowId = options.workflow ?? project.config.project.defaultWorkflow;
        const workflow = project.workflowMap.get(workflowId);
        if (!workflow) {
            throw new Error(`Workflow not found: ${workflowId}`);
        }
        const result = await executor.execute({
            task,
            workflow,
            agents: project.agentMap,
            rootDir: project.rootDir,
        });
        await runStore.save(result);
        printJson(result);
    });
    program
        .command('runs')
        .description('List persisted workflow runs')
        .action(async () => {
        const project = await (0, project_loader_1.loadProject)();
        const runStore = new run_store_1.RunStore(project);
        printJson(await runStore.list());
    });
    program
        .command('run:get <runId>')
        .description('Load a persisted run by id')
        .action(async (runId) => {
        const project = await (0, project_loader_1.loadProject)();
        const runStore = new run_store_1.RunStore(project);
        const run = await runStore.get(runId);
        if (!run) {
            throw new Error(`Run not found: ${runId}`);
        }
        printJson(run);
    });
    program
        .command('run:resume <runId>')
        .description('Resume a pending run from its saved state')
        .action(async (runId) => {
        const project = await (0, project_loader_1.loadProject)();
        const runStore = new run_store_1.RunStore(project);
        const priorRun = await runStore.get(runId);
        if (!priorRun) {
            throw new Error(`Run not found: ${runId}`);
        }
        if (priorRun.status !== 'pending_approval') {
            throw new Error(`Run is not pending approval: ${runId}`);
        }
        const workflow = project.workflowMap.get(priorRun.workflowId);
        if (!workflow) {
            throw new Error(`Workflow not found: ${priorRun.workflowId}`);
        }
        const provider = (0, provider_factory_1.createProvider)((0, provider_config_1.resolveOpenAIConfig)(project.config));
        const eventStore = new event_store_1.EventStore(project);
        const approvalStore = new approval_store_1.ApprovalStore(project);
        const executor = new workflow_executor_1.WorkflowExecutor(provider, undefined, eventStore, approvalStore);
        const result = await executor.execute({
            task: priorRun.task,
            workflow,
            agents: project.agentMap,
            rootDir: project.rootDir,
            resumeFrom: priorRun,
        });
        await runStore.save(result);
        printJson(result);
    });
    program
        .command('events')
        .description('List persisted runtime events')
        .option('-r, --run <runId>', 'filter by run id')
        .action(async (options) => {
        const project = await (0, project_loader_1.loadProject)();
        const eventStore = new event_store_1.EventStore(project);
        printJson(await eventStore.list(options.run));
    });
    program
        .command('approvals')
        .description('List approved gate keys')
        .action(async () => {
        const project = await (0, project_loader_1.loadProject)();
        const approvalStore = new approval_store_1.ApprovalStore(project);
        printJson(await approvalStore.list());
    });
    program
        .command('approve <key>')
        .description('Approve a gate key')
        .action(async (key) => {
        const project = await (0, project_loader_1.loadProject)();
        const approvalStore = new approval_store_1.ApprovalStore(project);
        await approvalStore.approve(key);
        console.log(`Approved ${key}`);
    });
    program
        .command('approve:revoke <key>')
        .description('Revoke a gate key')
        .action(async (key) => {
        const project = await (0, project_loader_1.loadProject)();
        const approvalStore = new approval_store_1.ApprovalStore(project);
        await approvalStore.revoke(key);
        console.log(`Revoked ${key}`);
    });
    await program.parseAsync(argv);
}

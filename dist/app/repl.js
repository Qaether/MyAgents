"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.startRepl = startRepl;
const readline = __importStar(require("readline"));
const fs_1 = require("fs");
const path_1 = require("path");
const child_process_1 = require("child_process");
const approval_store_1 = require("../approvals/approval-store");
const provider_config_1 = require("../config/provider-config");
const project_loader_1 = require("../config/project-loader");
const project_context_1 = require("./project-context");
const session_state_1 = require("./session-state");
const event_store_1 = require("../persistence/event-store");
const run_store_1 = require("../persistence/run-store");
const provider_factory_1 = require("../providers/provider-factory");
const workflow_executor_1 = require("../runtime/workflow-executor");
function printJson(value) {
    console.log(JSON.stringify(value, null, 2));
}
function truncate(text, maxChars) {
    return text.length > maxChars ? `${text.slice(0, maxChars)}\n...` : text;
}
function showSuggestions(items) {
    if (items.length === 0) {
        return;
    }
    console.log('Suggested next commands:');
    for (const item of items) {
        console.log(`- ${item}`);
    }
}
function recommendWorkflowId(task, availableWorkflowIds) {
    const normalized = task.toLowerCase();
    const fairyTaleSignals = [
        '동화',
        '전래',
        '햇님',
        '달님',
        'fairy tale',
        'folktale',
        'storybook',
    ];
    if (fairyTaleSignals.some((signal) => normalized.includes(signal)) &&
        availableWorkflowIds.has('fairy_tale')) {
        return 'fairy_tale';
    }
    return undefined;
}
function extractSearchPattern(clause, filePath) {
    return clause
        .replace(/검색해줘|검색해|검색|찾아줘|찾아|search/gi, '')
        .replace(filePath ?? '', '')
        .trim();
}
function parseNaturalLanguageAction(clause) {
    const trimmed = clause.trim();
    if (!trimmed) {
        return undefined;
    }
    const normalized = trimmed.toLowerCase();
    const fileMatch = trimmed.match(/([A-Za-z0-9_./-]+\.(ts|tsx|js|jsx|json|md|txt|yml|yaml))/);
    if (fileMatch &&
        (normalized.includes('읽어') || normalized.includes('열어') || normalized.includes('read'))) {
        return {
            type: 'read',
            value: fileMatch[1],
        };
    }
    if (normalized.includes('workflow') && (normalized.includes('목록') || normalized.includes('list'))) {
        return { type: 'list_workflows' };
    }
    if (normalized.includes('agent') && (normalized.includes('목록') || normalized.includes('list'))) {
        return { type: 'list_agents' };
    }
    if ((normalized.includes('파일') || normalized.includes('files')) && (normalized.includes('목록') || normalized.includes('list'))) {
        return { type: 'list_files', value: '.' };
    }
    if ((normalized.includes('찾아') || normalized.includes('검색') || normalized.includes('search')) &&
        !normalized.startsWith('/')) {
        const pattern = extractSearchPattern(trimmed, fileMatch?.[1]);
        if (pattern) {
            return {
                type: 'search',
                value: pattern,
            };
        }
    }
    if ((normalized.includes('이어') || normalized.includes('resume')) &&
        (normalized.includes('run') || normalized.includes('실행'))) {
        return { type: 'resume_last' };
    }
    if (normalized.includes('만들어') ||
        normalized.includes('작성') ||
        normalized.includes('써') ||
        normalized.includes('생성') ||
        normalized.includes('정리') ||
        normalized.includes('분석') ||
        normalized.includes('조사') ||
        normalized.includes('write') ||
        normalized.includes('draft') ||
        normalized.includes('create')) {
        return {
            type: 'run_task',
            value: trimmed,
        };
    }
    return undefined;
}
function buildActionPlan(input) {
    const clauses = input
        .split(/\s*(?:그리고|그 다음|다음에|후에|하고|and then|then|and)\s*/i)
        .map((item) => item.trim())
        .filter(Boolean);
    const actions = clauses
        .map((clause) => parseNaturalLanguageAction(clause))
        .filter((action) => action !== undefined);
    if (actions.length > 0) {
        return actions;
    }
    const fallback = parseNaturalLanguageAction(input);
    return fallback ? [fallback] : [];
}
function applyTemplateVariables(text, variables) {
    if (!text) {
        return text;
    }
    return text.replace(/\{\{([a-zA-Z0-9_-]+)\}\}/g, (_match, key) => {
        return variables[key] ?? `{{${key}}}`;
    });
}
function instantiatePlanTemplate(plan, variables) {
    return {
        source: applyTemplateVariables(plan.source, variables),
        actions: plan.actions.map((action) => ({
            ...action,
            value: applyTemplateVariables(action.value, variables),
            workflowId: applyTemplateVariables(action.workflowId, variables),
        })),
    };
}
function collectTemplateVariables(plan) {
    const values = [
        plan.source,
        ...plan.actions.flatMap((action) => [action.value, action.workflowId]),
    ];
    const keys = new Set();
    for (const value of values) {
        if (!value) {
            continue;
        }
        for (const match of value.matchAll(/\{\{([a-zA-Z0-9_-]+)\}\}/g)) {
            if (match[1]) {
                keys.add(match[1]);
            }
        }
    }
    return [...keys];
}
async function captureMultilineInput(rl, header) {
    console.log(header);
    console.log('Finish input with a single line containing `.end`');
    const lines = [];
    return await new Promise((resolvePromise) => {
        const collect = () => {
            rl.question('', (line) => {
                if (line === '.end') {
                    resolvePromise(lines.join('\n'));
                    return;
                }
                lines.push(line);
                collect();
            });
        };
        collect();
    });
}
async function promptSingleLine(rl, prompt) {
    return await new Promise((resolvePromise) => {
        rl.question(prompt, (answer) => {
            resolvePromise(answer.trim());
        });
    });
}
async function runCommand(cwd, command, args) {
    return await new Promise((resolvePromise) => {
        const child = (0, child_process_1.spawn)(command, args, {
            cwd,
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        let stdout = '';
        let stderr = '';
        child.stdout.on('data', (chunk) => {
            stdout += String(chunk);
        });
        child.stderr.on('data', (chunk) => {
            stderr += String(chunk);
        });
        child.on('close', (code) => {
            resolvePromise({
                code,
                stdout,
                stderr,
            });
        });
    });
}
async function startRepl() {
    const project = await (0, project_loader_1.loadProject)();
    let context = await (0, project_context_1.loadProjectContext)(project);
    const session = (0, session_state_1.createSessionState)();
    let pendingPlan = [];
    let pendingPlanSource;
    const pendingPlanPath = (0, path_1.resolve)(project.rootDir, '.myagent', 'repl-plan.json');
    const pendingPlanHistoryPath = (0, path_1.resolve)(project.rootDir, '.myagent', 'repl-plan-history.json');
    const namedPlansPath = (0, path_1.resolve)(project.rootDir, '.myagent', 'repl-named-plans.json');
    const planTemplatesPath = (0, path_1.resolve)(project.rootDir, '.myagent', 'repl-plan-templates.json');
    let pendingPlanHistory = [];
    let namedPlans = {};
    let planTemplates = {};
    const provider = (0, provider_factory_1.createProvider)((0, provider_config_1.resolveOpenAIConfig)(project.config));
    const eventStore = new event_store_1.EventStore(project);
    const approvalStore = new approval_store_1.ApprovalStore(project);
    const runStore = new run_store_1.RunStore(project);
    const executor = new workflow_executor_1.WorkflowExecutor(provider, undefined, eventStore, approvalStore);
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    const showContext = (summary) => {
        console.log(`Root: ${summary.rootDir}`);
        console.log(`Root files: ${summary.rootFiles.join(', ')}`);
        console.log(`Key source files: ${summary.sourceFiles.join(', ')}`);
        console.log('Cached summary:');
        for (const line of summary.cachedSummary) {
            console.log(`- ${line}`);
        }
        console.log('Workspace role hints:');
        for (const item of summary.fileRoles.slice(0, 12)) {
            console.log(`- ${item.path}: ${item.role}`);
        }
        console.log('Key file previews:');
        for (const file of summary.keyFiles) {
            console.log(`- ${file.path}: ${file.preview}`);
        }
    };
    const persistPendingPlan = async () => {
        if (pendingPlan.length === 0) {
            try {
                await fs_1.promises.unlink(pendingPlanPath);
            }
            catch {
                return;
            }
            return;
        }
        await fs_1.promises.mkdir((0, path_1.resolve)(project.rootDir, '.myagent'), { recursive: true });
        const payload = {
            source: pendingPlanSource,
            actions: pendingPlan,
        };
        await fs_1.promises.writeFile(pendingPlanPath, JSON.stringify(payload, null, 2), 'utf8');
    };
    const persistPendingPlanHistory = async () => {
        await fs_1.promises.mkdir((0, path_1.resolve)(project.rootDir, '.myagent'), { recursive: true });
        const payload = {
            entries: pendingPlanHistory,
        };
        await fs_1.promises.writeFile(pendingPlanHistoryPath, JSON.stringify(payload, null, 2), 'utf8');
    };
    const persistNamedPlans = async () => {
        await fs_1.promises.mkdir((0, path_1.resolve)(project.rootDir, '.myagent'), { recursive: true });
        const payload = {
            plans: namedPlans,
        };
        await fs_1.promises.writeFile(namedPlansPath, JSON.stringify(payload, null, 2), 'utf8');
    };
    const persistPlanTemplates = async () => {
        await fs_1.promises.mkdir((0, path_1.resolve)(project.rootDir, '.myagent'), { recursive: true });
        const payload = {
            templates: planTemplates,
        };
        await fs_1.promises.writeFile(planTemplatesPath, JSON.stringify(payload, null, 2), 'utf8');
    };
    const pushPendingPlanHistory = async (state) => {
        if (state.actions.length === 0) {
            return;
        }
        pendingPlanHistory = [
            {
                savedAt: new Date().toISOString(),
                source: state.source,
                actions: state.actions,
            },
            ...pendingPlanHistory,
        ].slice(0, 10);
        await persistPendingPlanHistory();
    };
    const loadPendingPlan = async () => {
        try {
            const raw = await fs_1.promises.readFile(pendingPlanPath, 'utf8');
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed.actions) || parsed.actions.length === 0) {
                return;
            }
            pendingPlan = parsed.actions;
            pendingPlanSource = parsed.source;
        }
        catch {
            return;
        }
    };
    const loadPendingPlanHistory = async () => {
        try {
            const raw = await fs_1.promises.readFile(pendingPlanHistoryPath, 'utf8');
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed.entries)) {
                return;
            }
            pendingPlanHistory = parsed.entries.filter((entry) => Array.isArray(entry.actions) && entry.actions.length > 0);
        }
        catch {
            return;
        }
    };
    const loadNamedPlans = async () => {
        try {
            const raw = await fs_1.promises.readFile(namedPlansPath, 'utf8');
            const parsed = JSON.parse(raw);
            if (!parsed.plans || typeof parsed.plans !== 'object') {
                return;
            }
            namedPlans = Object.fromEntries(Object.entries(parsed.plans).filter(([, plan]) => Array.isArray(plan.actions) && plan.actions.length > 0));
        }
        catch {
            return;
        }
    };
    const loadPlanTemplates = async () => {
        try {
            const raw = await fs_1.promises.readFile(planTemplatesPath, 'utf8');
            const parsed = JSON.parse(raw);
            if (!parsed.templates || typeof parsed.templates !== 'object') {
                return;
            }
            planTemplates = Object.fromEntries(Object.entries(parsed.templates).filter(([, plan]) => Array.isArray(plan.actions) && plan.actions.length > 0));
        }
        catch {
            return;
        }
    };
    await loadPendingPlanHistory();
    await loadNamedPlans();
    await loadPlanTemplates();
    await loadPendingPlan();
    console.log('MyAgent REPL');
    console.log(`Project: ${project.config.project.name}`);
    console.log(`Agents: ${project.agents.length}`);
    console.log(`Workflows: ${project.workflows.length}`);
    console.log(`Default workflow: ${project.config.project.defaultWorkflow}`);
    showContext(context);
    if (pendingPlan.length > 0) {
        console.log(`Restored pending plan with ${pendingPlan.length} step(s).`);
        console.log('Use /plan to inspect it, /confirm to execute it, or /cancel to discard it.');
    }
    console.log('Type natural language to run the default workflow.');
    console.log('Use /help for commands.');
    console.log('');
    const showHelp = () => {
        console.log('Commands:');
        console.log('/help                  Show this help');
        console.log('/inspect               Show loaded project structure');
        console.log('/context               Show loaded project context summary');
        console.log('/refresh               Reload project context summary');
        console.log('/plan                  Show the currently pending action plan');
        console.log('/plan:history          Show recent saved plans');
        console.log('/plan:restore <index>  Restore one plan from history');
        console.log('/plan:names            List named saved plans');
        console.log('/plan:save <name>      Save the current pending plan by name');
        console.log('/plan:load <name>      Load a named saved plan');
        console.log('/plan:export <path>    Export named plans to a JSON file');
        console.log('/plan:import <path>    Import named plans from a JSON file');
        console.log('/plan:templates        List saved plan templates');
        console.log('/plan:template:show <name> Show template variables and steps');
        console.log('/plan:template:save <name> Save the current pending plan as a template with optional defaults');
        console.log('/plan:template:load <name> [key=value ...] Load a template using args, defaults, then prompts');
        console.log('/plan:template:update <name> Update template defaults interactively');
        console.log('/plan:template:rename <from> <to> Rename a saved template');
        console.log('/plan:template:delete <name> Delete a saved template');
        console.log('/plan:template:export <path> Export all templates to a JSON file');
        console.log('/plan:template:import <path> Import templates from a JSON file');
        console.log('/plan:drop <index>     Remove one step from the pending plan');
        console.log('/plan:move <from> <to> Reorder one step in the pending plan');
        console.log('/plan:run <index>      Execute one step from the pending plan');
        console.log('/plan:clear            Clear the pending plan');
        console.log('/confirm               Execute the currently pending action plan');
        console.log('/cancel                Discard the currently pending action plan');
        console.log('/session               Show current REPL session memory');
        console.log('/clear-session         Clear in-memory session state');
        console.log('/files [dir]           List files under the project or a subdirectory');
        console.log('/read <path>           Read a file from the project');
        console.log('/search <text>         Search text in project files');
        console.log('/write <path>          Write or replace a file from multiline input');
        console.log('/patch <path>          Replace one text block in a file using multiline input');
        console.log('/run-tests             Run npm test');
        console.log('/run-build             Run npm run build');
        console.log('/agents                List agents');
        console.log('/workflows             List workflows');
        console.log('/runs                  List saved runs');
        console.log('/run <task>            Run the default workflow');
        console.log('/run <workflow> :: <task>  Run a specific workflow');
        console.log('/resume <runId>        Resume a pending run');
        console.log('/approvals             List approved keys');
        console.log('/approve <key>         Approve a gate key');
        console.log('/events [runId]        Show events');
        console.log('/exit                  Quit');
    };
    const describeAction = (action) => {
        if (action.type === 'run_task' && action.value) {
            const workflowHint = action.workflowId ? ` [workflow=${action.workflowId}]` : '';
            return `${action.type}${workflowHint} -> ${action.value}`;
        }
        return action.value ? `${action.type} -> ${action.value}` : action.type;
    };
    const showPendingPlan = () => {
        if (pendingPlan.length === 0) {
            console.log('No pending plan.');
            return;
        }
        console.log('Pending plan:');
        if (pendingPlanSource) {
            console.log(`Source: ${pendingPlanSource}`);
        }
        pendingPlan.forEach((action, index) => {
            console.log(`${index + 1}. ${describeAction(action)}`);
        });
        console.log('Use /confirm to execute or /cancel to discard it.');
    };
    const showPendingPlanHistory = () => {
        if (pendingPlanHistory.length === 0) {
            console.log('No plan history.');
            return;
        }
        console.log('Plan history:');
        pendingPlanHistory.forEach((entry, index) => {
            const source = entry.source ? ` | ${entry.source}` : '';
            console.log(`${index + 1}. ${entry.savedAt} | ${entry.actions.length} step(s)${source}`);
        });
    };
    const showNamedPlans = () => {
        const entries = Object.entries(namedPlans).sort(([left], [right]) => left.localeCompare(right));
        if (entries.length === 0) {
            console.log('No named plans.');
            return;
        }
        console.log('Named plans:');
        entries.forEach(([name, plan]) => {
            const source = plan.source ? ` | ${plan.source}` : '';
            console.log(`- ${name}: ${plan.actions.length} step(s)${source}`);
        });
    };
    const showPlanTemplates = () => {
        const entries = Object.entries(planTemplates).sort(([left], [right]) => left.localeCompare(right));
        if (entries.length === 0) {
            console.log('No plan templates.');
            return;
        }
        console.log('Plan templates:');
        entries.forEach(([name, plan]) => {
            const source = plan.source ? ` | ${plan.source}` : '';
            console.log(`- ${name}: ${plan.actions.length} step(s)${source}`);
        });
    };
    const showPlanTemplate = (name) => {
        const template = planTemplates[name];
        if (!template) {
            console.error(`Plan template not found: ${name}`);
            return;
        }
        const variables = collectTemplateVariables(template);
        console.log(`Template: ${name}`);
        if (template.source) {
            console.log(`Source: ${template.source}`);
        }
        console.log(`Variables: ${variables.length > 0 ? variables.join(', ') : '(none)'}`);
        if (template.defaults && Object.keys(template.defaults).length > 0) {
            console.log(`Defaults: ${JSON.stringify(template.defaults)}`);
        }
        console.log('Steps:');
        template.actions.forEach((action, index) => {
            console.log(`${index + 1}. ${describeAction(action)}`);
        });
    };
    const showPlanAwareSuggestions = (items = []) => {
        if (pendingPlan.length === 0) {
            showSuggestions(items);
            return;
        }
        const merged = ['/plan', '/confirm', '/cancel', ...items];
        const unique = merged.filter((item, index) => merged.indexOf(item) === index);
        showSuggestions(unique);
    };
    const executePlannedAction = async (action) => {
        if (action.type === 'read' && action.value) {
            session.lastFilePath = action.value;
            await readFile(action.value);
            return;
        }
        if (action.type === 'search' && action.value) {
            await searchText(action.value);
            return;
        }
        if (action.type === 'list_files') {
            await listFiles(action.value ?? '.');
            return;
        }
        if (action.type === 'list_workflows') {
            printJson(project.workflows.map((workflow) => ({
                id: workflow.id,
                name: workflow.name,
            })));
            return;
        }
        if (action.type === 'list_agents') {
            printJson(project.agents.map((agent) => ({
                id: agent.id,
                role: agent.role,
            })));
            return;
        }
        if (action.type === 'resume_last') {
            if (!session.lastRunId) {
                console.error('No last run is recorded in session memory.');
                return;
            }
            await resumeRun(session.lastRunId);
            return;
        }
        if (action.type === 'run_task' && action.value) {
            await executeWorkflow(action.value, action.workflowId);
        }
    };
    const executePendingPlan = async () => {
        if (pendingPlan.length === 0) {
            return false;
        }
        await pushPendingPlanHistory({
            source: pendingPlanSource,
            actions: [...pendingPlan],
        });
        const actions = [...pendingPlan];
        pendingPlan = [];
        pendingPlanSource = undefined;
        await persistPendingPlan();
        console.log('Executing pending plan...');
        for (const action of actions) {
            await executePlannedAction(action);
        }
        return true;
    };
    const cancelPendingPlan = async () => {
        if (pendingPlan.length === 0) {
            return false;
        }
        pendingPlan = [];
        pendingPlanSource = undefined;
        await persistPendingPlan();
        console.log('Pending plan discarded.');
        return true;
    };
    const listFiles = async (relativeDir = '.') => {
        const targetDir = (0, path_1.resolve)(project.rootDir, relativeDir);
        try {
            const entries = await fs_1.promises.readdir(targetDir, { withFileTypes: true });
            const items = entries
                .map((entry) => ({
                name: entry.name,
                type: entry.isDirectory() ? 'dir' : 'file',
            }))
                .sort((a, b) => a.name.localeCompare(b.name));
            printJson(items);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error(`Failed to list files: ${message}`);
        }
    };
    const readFile = async (relativePath) => {
        const targetPath = (0, path_1.resolve)(project.rootDir, relativePath);
        try {
            const role = context.fileRoles.find((item) => item.path === relativePath)?.role;
            if (role) {
                console.log(`Role: ${role}`);
            }
            const raw = await fs_1.promises.readFile(targetPath, 'utf8');
            console.log(truncate(raw, 8000));
            const suggestions = [
                `/search ${relativePath.split('/').pop() ?? ''}`,
                `/patch ${relativePath}`,
            ];
            if (relativePath.endsWith('.ts') || relativePath.endsWith('.json')) {
                suggestions.push('/run-build');
            }
            showPlanAwareSuggestions(suggestions);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error(`Failed to read file: ${message}`);
        }
    };
    const searchText = async (pattern) => {
        const results = [];
        const walk = async (dir) => {
            const entries = await fs_1.promises.readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') {
                    continue;
                }
                const fullPath = (0, path_1.resolve)(dir, entry.name);
                if (entry.isDirectory()) {
                    await walk(fullPath);
                    continue;
                }
                if (!entry.isFile()) {
                    continue;
                }
                try {
                    const raw = await fs_1.promises.readFile(fullPath, 'utf8');
                    const lines = raw.split('\n');
                    lines.forEach((line, index) => {
                        if (line.includes(pattern)) {
                            results.push({
                                path: fullPath.replace(`${project.rootDir}/`, ''),
                                line: index + 1,
                                text: line.trim(),
                            });
                        }
                    });
                }
                catch {
                    continue;
                }
            }
        };
        await walk(project.rootDir);
        printJson(results.slice(0, 100));
        showPlanAwareSuggestions([
            '/read <path-from-result>',
            '/patch <path-from-result>',
        ]);
    };
    const writeFileFromPrompt = async (relativePath) => {
        const targetPath = (0, path_1.resolve)(project.rootDir, relativePath);
        const content = await captureMultilineInput(rl, `Writing ${relativePath}`);
        await fs_1.promises.writeFile(targetPath, content, 'utf8');
        console.log(`Wrote ${relativePath}`);
        showPlanAwareSuggestions([
            `/read ${relativePath}`,
            '/run-build',
            '/run-tests',
        ]);
    };
    const patchFileFromPrompt = async (relativePath) => {
        const targetPath = (0, path_1.resolve)(project.rootDir, relativePath);
        const original = await fs_1.promises.readFile(targetPath, 'utf8');
        const oldText = await captureMultilineInput(rl, `Patch ${relativePath}: enter the exact text to replace`);
        const newText = await captureMultilineInput(rl, `Patch ${relativePath}: enter the replacement text`);
        if (!oldText) {
            console.error('Patch aborted: old text cannot be empty.');
            return;
        }
        const occurrences = original.split(oldText).length - 1;
        if (occurrences === 0) {
            console.error('Patch failed: target text not found.');
            return;
        }
        if (occurrences > 1) {
            console.error('Patch failed: target text appears multiple times. Use a more specific block.');
            return;
        }
        const next = original.replace(oldText, newText);
        await fs_1.promises.writeFile(targetPath, next, 'utf8');
        console.log(`Patched ${relativePath}`);
        showPlanAwareSuggestions([
            `/read ${relativePath}`,
            '/run-build',
            '/run-tests',
        ]);
    };
    const runProjectCommand = async (label, command, args) => {
        console.log(`${label}...`);
        const result = await runCommand(project.rootDir, command, args);
        if (result.stdout.trim()) {
            console.log(truncate(result.stdout, 12000));
        }
        if (result.stderr.trim()) {
            console.error(truncate(result.stderr, 12000));
        }
        console.log(`Exit code: ${result.code ?? 'unknown'}`);
        showPlanAwareSuggestions([
            '/read <path>',
            '/runs',
            '/events',
        ]);
    };
    const handleSessionAwareInput = async (trimmed) => {
        const normalized = trimmed.toLowerCase();
        if ((normalized.includes('마지막 run') || normalized.includes('last run')) &&
            (normalized.includes('이어') || normalized.includes('resume'))) {
            if (!session.lastRunId) {
                console.error('No last run is recorded in session memory.');
                return true;
            }
            await resumeRun(session.lastRunId);
            return true;
        }
        if ((normalized.includes('방금') || normalized.includes('다시') || normalized.includes('again') || normalized.includes('rerun')) &&
            (normalized.includes('workflow') || normalized.includes('작업') || normalized.includes('실행'))) {
            if (!session.lastTask) {
                console.error('No last task is recorded in session memory.');
                return true;
            }
            await executeWorkflow(session.lastTask, session.lastWorkflowId);
            return true;
        }
        if ((normalized.includes('아까 파일') || normalized.includes('last file') || normalized.includes('that file')) &&
            (normalized.includes('열') || normalized.includes('read') || normalized.includes('show'))) {
            if (!session.lastFilePath) {
                console.error('No file is recorded in session memory.');
                return true;
            }
            await readFile(session.lastFilePath);
            return true;
        }
        if ((normalized.includes('아까 파일') || normalized.includes('last file') || normalized.includes('that file')) &&
            (normalized.includes('패치') || normalized.includes('수정') || normalized.includes('patch') || normalized.includes('edit'))) {
            if (!session.lastFilePath) {
                console.error('No file is recorded in session memory.');
                return true;
            }
            await patchFileFromPrompt(session.lastFilePath);
            context = await (0, project_context_1.loadProjectContext)(project);
            (0, session_state_1.pushSessionEntry)(session, {
                kind: 'file',
                value: `patch ${session.lastFilePath}`,
            });
            return true;
        }
        return false;
    };
    const handleNaturalLanguageIntent = async (trimmed) => {
        const normalized = trimmed.toLowerCase();
        const plannedActions = buildActionPlan(trimmed);
        if (pendingPlan.length > 0 &&
            (normalized === 'confirm' ||
                normalized === '확인' ||
                normalized === '실행해' ||
                normalized === '진행해' ||
                normalized === '계속해' ||
                normalized === 'run it' ||
                normalized === 'go ahead')) {
            await executePendingPlan();
            return true;
        }
        if (pendingPlan.length > 0 &&
            (normalized === 'cancel' ||
                normalized === '취소' ||
                normalized === '그만' ||
                normalized === '중단')) {
            await cancelPendingPlan();
            return true;
        }
        if (plannedActions.length > 1) {
            pendingPlan = plannedActions;
            pendingPlanSource = trimmed;
            await pushPendingPlanHistory({
                source: pendingPlanSource,
                actions: [...pendingPlan],
            });
            await persistPendingPlan();
            console.log('Planned actions:');
            plannedActions.forEach((action, index) => {
                console.log(`${index + 1}. ${describeAction(action)}`);
            });
            console.log('Plan saved. Use /confirm to execute or /cancel to discard it.');
            showPlanAwareSuggestions();
            return true;
        }
        if (plannedActions.length === 1 && plannedActions[0].type !== 'run_task') {
            await executePlannedAction(plannedActions[0]);
            return true;
        }
        if ((normalized.includes('찾아') || normalized.includes('검색') || normalized.includes('search')) &&
            !normalized.startsWith('/')) {
            const pattern = trimmed
                .replace(/검색해줘|검색|찾아줘|찾아|search/gi, '')
                .trim();
            if (pattern) {
                await searchText(pattern);
                return true;
            }
        }
        if ((normalized.includes('읽어') || normalized.includes('열어') || normalized.includes('read')) &&
            !normalized.startsWith('/')) {
            const fileMatch = trimmed.match(/([A-Za-z0-9_./-]+\.(ts|tsx|js|jsx|json|md|txt|yml|yaml))/);
            if (fileMatch) {
                const pathArg = fileMatch[1];
                session.lastFilePath = pathArg;
                await readFile(pathArg);
                return true;
            }
        }
        if ((normalized.includes('목록') || normalized.includes('list') || normalized.includes('files')) &&
            (normalized.includes('파일') || normalized.includes('workflows') || normalized.includes('agents'))) {
            if (normalized.includes('workflow')) {
                printJson(project.workflows.map((workflow) => ({
                    id: workflow.id,
                    name: workflow.name,
                })));
                return true;
            }
            if (normalized.includes('agent')) {
                printJson(project.agents.map((agent) => ({
                    id: agent.id,
                    role: agent.role,
                })));
                return true;
            }
            await listFiles('.');
            return true;
        }
        if ((normalized.includes('이어') || normalized.includes('resume')) &&
            (normalized.includes('run') || normalized.includes('실행'))) {
            if (!session.lastRunId) {
                console.error('No last run is recorded in session memory.');
                return true;
            }
            await resumeRun(session.lastRunId);
            return true;
        }
        return false;
    };
    const executeWorkflow = async (task, workflowId) => {
        const recommendedWorkflowId = workflowId
            ? undefined
            : recommendWorkflowId(task, new Set(project.workflowMap.keys()));
        const targetWorkflowId = workflowId ?? recommendedWorkflowId ?? project.config.project.defaultWorkflow;
        const workflow = project.workflowMap.get(targetWorkflowId);
        if (!workflow) {
            console.error(`Workflow not found: ${targetWorkflowId}`);
            return;
        }
        try {
            if (recommendedWorkflowId && !workflowId) {
                console.log(`Workflow auto-selected: ${recommendedWorkflowId}`);
            }
            const result = await executor.execute({
                task,
                workflow,
                agents: project.agentMap,
                rootDir: project.rootDir,
            });
            await runStore.save(result);
            session.lastWorkflowId = targetWorkflowId;
            session.lastRunId = result.runId;
            session.lastTask = task;
            (0, session_state_1.pushSessionEntry)(session, {
                kind: 'run',
                value: `${targetWorkflowId} -> ${result.runId} (${result.status})`,
            });
            printJson(result);
            if (result.status === 'pending_approval') {
                const pending = result.steps.find((step) => step.status === 'pending_approval');
                showPlanAwareSuggestions([
                    '/approvals',
                    pending?.approvalKey ? `/approve ${pending.approvalKey}` : '/approve <approval-key>',
                    `/resume ${result.runId}`,
                ]);
            }
            else {
                showPlanAwareSuggestions([
                    '/runs',
                    `/events ${result.runId}`,
                    '/session',
                ]);
            }
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error(`Run failed: ${message}`);
        }
    };
    const resumeRun = async (runId) => {
        const priorRun = await runStore.get(runId);
        if (!priorRun) {
            console.error(`Run not found: ${runId}`);
            return;
        }
        if (priorRun.status !== 'pending_approval') {
            console.error(`Run is not pending approval: ${runId}`);
            return;
        }
        const workflow = project.workflowMap.get(priorRun.workflowId);
        if (!workflow) {
            console.error(`Workflow not found: ${priorRun.workflowId}`);
            return;
        }
        try {
            const result = await executor.execute({
                task: priorRun.task,
                workflow,
                agents: project.agentMap,
                rootDir: project.rootDir,
                resumeFrom: priorRun,
            });
            await runStore.save(result);
            session.lastWorkflowId = priorRun.workflowId;
            session.lastRunId = result.runId;
            session.lastTask = priorRun.task;
            (0, session_state_1.pushSessionEntry)(session, {
                kind: 'run',
                value: `resume ${runId} -> ${result.runId} (${result.status})`,
            });
            printJson(result);
            showPlanAwareSuggestions([
                '/runs',
                `/events ${result.runId}`,
                '/session',
            ]);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error(`Resume failed: ${message}`);
        }
    };
    const handleCommand = async (input) => {
        const trimmed = input.trim();
        if (!trimmed) {
            return true;
        }
        (0, session_state_1.pushSessionEntry)(session, {
            kind: trimmed.startsWith('/') ? 'command' : 'task',
            value: trimmed,
        });
        if (pendingPlan.length > 0 &&
            trimmed.startsWith('/') &&
            !['/plan', '/confirm', '/cancel', '/exit', '/quit', '/help'].includes(trimmed)) {
            console.log('A pending plan is waiting. Use /confirm to execute it or /cancel to discard it.');
            showPlanAwareSuggestions();
        }
        if (!trimmed.startsWith('/')) {
            const handledBySession = await handleSessionAwareInput(trimmed);
            if (handledBySession) {
                return true;
            }
            const handledByIntent = await handleNaturalLanguageIntent(trimmed);
            if (handledByIntent) {
                return true;
            }
            await executeWorkflow(trimmed);
            return true;
        }
        const commandBody = trimmed.slice(1).trim();
        if (commandBody === 'exit' || commandBody === 'quit') {
            return false;
        }
        if (commandBody === 'help') {
            showHelp();
            return true;
        }
        if (commandBody === 'inspect') {
            printJson({
                project: project.config.project,
                provider: {
                    kind: project.config.provider.kind,
                    model: project.config.provider.model,
                },
                agents: project.agents.map((agent) => ({
                    id: agent.id,
                    role: agent.role,
                    model: agent.model,
                })),
                workflows: project.workflows.map((workflow) => workflow.id),
            });
            return true;
        }
        if (commandBody === 'context') {
            showContext(context);
            return true;
        }
        if (commandBody === 'plan') {
            showPendingPlan();
            return true;
        }
        if (commandBody === 'plan:history') {
            showPendingPlanHistory();
            return true;
        }
        if (commandBody === 'plan:names') {
            showNamedPlans();
            return true;
        }
        if (commandBody === 'plan:templates') {
            showPlanTemplates();
            return true;
        }
        if (commandBody.startsWith('plan:template:show ')) {
            const name = commandBody.slice('plan:template:show '.length).trim();
            if (!name) {
                console.error('Usage: /plan:template:show <name>');
                return true;
            }
            showPlanTemplate(name);
            return true;
        }
        if (commandBody.startsWith('plan:template:update ')) {
            const name = commandBody.slice('plan:template:update '.length).trim();
            if (!name) {
                console.error('Usage: /plan:template:update <name>');
                return true;
            }
            const template = planTemplates[name];
            if (!template) {
                console.error(`Plan template not found: ${name}`);
                return true;
            }
            const nextDefaults = {};
            for (const key of collectTemplateVariables(template)) {
                const currentValue = template.defaults?.[key] ?? '';
                const prompt = currentValue
                    ? `Default value for ${key} [${currentValue}] (empty to keep, '-' to clear): `
                    : `Default value for ${key} (optional): `;
                const answer = await promptSingleLine(rl, prompt);
                if (!answer) {
                    if (currentValue) {
                        nextDefaults[key] = currentValue;
                    }
                    continue;
                }
                if (answer === '-') {
                    continue;
                }
                nextDefaults[key] = answer;
            }
            planTemplates[name] = {
                ...template,
                defaults: nextDefaults,
            };
            await persistPlanTemplates();
            console.log(`Updated template defaults for "${name}".`);
            showPlanTemplate(name);
            return true;
        }
        if (commandBody.startsWith('plan:template:rename ')) {
            const args = commandBody
                .slice('plan:template:rename '.length)
                .trim()
                .split(/\s+/)
                .filter(Boolean);
            if (args.length !== 2) {
                console.error('Usage: /plan:template:rename <from> <to>');
                return true;
            }
            const [from, to] = args;
            if (!planTemplates[from]) {
                console.error(`Plan template not found: ${from}`);
                return true;
            }
            if (planTemplates[to]) {
                console.error(`Plan template already exists: ${to}`);
                return true;
            }
            planTemplates[to] = planTemplates[from];
            delete planTemplates[from];
            await persistPlanTemplates();
            console.log(`Renamed template "${from}" to "${to}".`);
            return true;
        }
        if (commandBody.startsWith('plan:template:delete ')) {
            const name = commandBody.slice('plan:template:delete '.length).trim();
            if (!name) {
                console.error('Usage: /plan:template:delete <name>');
                return true;
            }
            if (!planTemplates[name]) {
                console.error(`Plan template not found: ${name}`);
                return true;
            }
            delete planTemplates[name];
            await persistPlanTemplates();
            console.log(`Deleted template "${name}".`);
            return true;
        }
        if (commandBody.startsWith('plan:template:export ')) {
            const relativePath = commandBody.slice('plan:template:export '.length).trim();
            if (!relativePath) {
                console.error('Usage: /plan:template:export <path>');
                return true;
            }
            const targetPath = (0, path_1.resolve)(project.rootDir, relativePath);
            const payload = {
                templates: planTemplates,
            };
            await fs_1.promises.writeFile(targetPath, JSON.stringify(payload, null, 2), 'utf8');
            console.log(`Exported templates to ${relativePath}.`);
            return true;
        }
        if (commandBody.startsWith('plan:template:import ')) {
            const relativePath = commandBody.slice('plan:template:import '.length).trim();
            if (!relativePath) {
                console.error('Usage: /plan:template:import <path>');
                return true;
            }
            const targetPath = (0, path_1.resolve)(project.rootDir, relativePath);
            try {
                const raw = await fs_1.promises.readFile(targetPath, 'utf8');
                const parsed = JSON.parse(raw);
                if (!parsed.templates || typeof parsed.templates !== 'object') {
                    console.error('Import failed: invalid template file.');
                    return true;
                }
                const importedTemplates = Object.fromEntries(Object.entries(parsed.templates).filter(([, plan]) => Array.isArray(plan.actions) && plan.actions.length > 0));
                planTemplates = {
                    ...planTemplates,
                    ...importedTemplates,
                };
                await persistPlanTemplates();
                console.log(`Imported ${Object.keys(importedTemplates).length} template(s) from ${relativePath}.`);
            }
            catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                console.error(`Import failed: ${message}`);
            }
            return true;
        }
        if (commandBody.startsWith('plan:restore ')) {
            const rawIndex = commandBody.slice('plan:restore '.length).trim();
            const index = Number.parseInt(rawIndex, 10);
            if (!Number.isInteger(index) || index < 1 || index > pendingPlanHistory.length) {
                console.error('Usage: /plan:restore <index>');
                return true;
            }
            const selected = pendingPlanHistory[index - 1];
            pendingPlan = [...selected.actions];
            pendingPlanSource = selected.source;
            await persistPendingPlan();
            console.log(`Restored plan ${index} from ${selected.savedAt}.`);
            showPendingPlan();
            return true;
        }
        if (commandBody.startsWith('plan:save ')) {
            if (pendingPlan.length === 0) {
                console.log('No pending plan.');
                return true;
            }
            const name = commandBody.slice('plan:save '.length).trim();
            if (!name) {
                console.error('Usage: /plan:save <name>');
                return true;
            }
            namedPlans[name] = {
                source: pendingPlanSource,
                actions: [...pendingPlan],
            };
            await persistNamedPlans();
            console.log(`Saved pending plan as "${name}".`);
            return true;
        }
        if (commandBody.startsWith('plan:export ')) {
            const relativePath = commandBody.slice('plan:export '.length).trim();
            if (!relativePath) {
                console.error('Usage: /plan:export <path>');
                return true;
            }
            const targetPath = (0, path_1.resolve)(project.rootDir, relativePath);
            const payload = {
                plans: namedPlans,
            };
            await fs_1.promises.writeFile(targetPath, JSON.stringify(payload, null, 2), 'utf8');
            console.log(`Exported named plans to ${relativePath}.`);
            return true;
        }
        if (commandBody.startsWith('plan:import ')) {
            const relativePath = commandBody.slice('plan:import '.length).trim();
            if (!relativePath) {
                console.error('Usage: /plan:import <path>');
                return true;
            }
            const targetPath = (0, path_1.resolve)(project.rootDir, relativePath);
            try {
                const raw = await fs_1.promises.readFile(targetPath, 'utf8');
                const parsed = JSON.parse(raw);
                if (!parsed.plans || typeof parsed.plans !== 'object') {
                    console.error('Import failed: invalid named plan file.');
                    return true;
                }
                const importedPlans = Object.fromEntries(Object.entries(parsed.plans).filter(([, plan]) => Array.isArray(plan.actions) && plan.actions.length > 0));
                namedPlans = {
                    ...namedPlans,
                    ...importedPlans,
                };
                await persistNamedPlans();
                console.log(`Imported ${Object.keys(importedPlans).length} named plan(s) from ${relativePath}.`);
            }
            catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                console.error(`Import failed: ${message}`);
            }
            return true;
        }
        if (commandBody.startsWith('plan:template:save ')) {
            if (pendingPlan.length === 0) {
                console.log('No pending plan.');
                return true;
            }
            const name = commandBody.slice('plan:template:save '.length).trim();
            if (!name) {
                console.error('Usage: /plan:template:save <name>');
                return true;
            }
            const defaults = {};
            for (const key of collectTemplateVariables({
                source: pendingPlanSource,
                actions: pendingPlan,
            })) {
                const value = await promptSingleLine(rl, `Default value for ${key} (optional): `);
                if (value) {
                    defaults[key] = value;
                }
            }
            planTemplates[name] = {
                source: pendingPlanSource,
                actions: [...pendingPlan],
                defaults,
            };
            await persistPlanTemplates();
            console.log(`Saved pending plan template as "${name}".`);
            return true;
        }
        if (commandBody.startsWith('plan:load ')) {
            const name = commandBody.slice('plan:load '.length).trim();
            if (!name) {
                console.error('Usage: /plan:load <name>');
                return true;
            }
            const savedPlan = namedPlans[name];
            if (!savedPlan) {
                console.error(`Named plan not found: ${name}`);
                return true;
            }
            pendingPlan = [...savedPlan.actions];
            pendingPlanSource = savedPlan.source ?? `named:${name}`;
            await persistPendingPlan();
            console.log(`Loaded named plan "${name}".`);
            showPendingPlan();
            return true;
        }
        if (commandBody.startsWith('plan:template:load ')) {
            const args = commandBody
                .slice('plan:template:load '.length)
                .trim()
                .split(/\s+/)
                .filter(Boolean);
            if (args.length === 0) {
                console.error('Usage: /plan:template:load <name> key=value ...');
                return true;
            }
            const [name, ...rawVariables] = args;
            const template = planTemplates[name];
            if (!template) {
                console.error(`Plan template not found: ${name}`);
                return true;
            }
            const variables = {
                ...(template.defaults ?? {}),
            };
            for (const item of rawVariables) {
                const separatorIndex = item.indexOf('=');
                if (separatorIndex <= 0) {
                    console.error('Usage: /plan:template:load <name> key=value ...');
                    return true;
                }
                const key = item.slice(0, separatorIndex);
                const value = item.slice(separatorIndex + 1);
                variables[key] = value;
            }
            const missingVariables = collectTemplateVariables(template).filter((key) => variables[key] === undefined);
            for (const key of missingVariables) {
                const value = await promptSingleLine(rl, `Value for ${key}: `);
                if (!value) {
                    console.error(`Missing value for template variable: ${key}`);
                    return true;
                }
                variables[key] = value;
            }
            const instantiated = instantiatePlanTemplate(template, variables);
            pendingPlan = [...instantiated.actions];
            pendingPlanSource = instantiated.source ?? `template:${name}`;
            await persistPendingPlan();
            console.log(`Loaded plan template "${name}".`);
            showPendingPlan();
            return true;
        }
        if (commandBody === 'plan:clear') {
            if (!(await cancelPendingPlan())) {
                console.log('No pending plan.');
            }
            return true;
        }
        if (commandBody.startsWith('plan:drop ')) {
            if (pendingPlan.length === 0) {
                console.log('No pending plan.');
                return true;
            }
            const rawIndex = commandBody.slice('plan:drop '.length).trim();
            const index = Number.parseInt(rawIndex, 10);
            if (!Number.isInteger(index) || index < 1 || index > pendingPlan.length) {
                console.error('Usage: /plan:drop <index>');
                return true;
            }
            const [removed] = pendingPlan.splice(index - 1, 1);
            await persistPendingPlan();
            console.log(`Removed step ${index}: ${describeAction(removed)}`);
            if (pendingPlan.length === 0) {
                pendingPlanSource = undefined;
                await persistPendingPlan();
                console.log('Pending plan is now empty.');
            }
            else {
                showPendingPlan();
            }
            return true;
        }
        if (commandBody.startsWith('plan:move ')) {
            if (pendingPlan.length === 0) {
                console.log('No pending plan.');
                return true;
            }
            const args = commandBody
                .slice('plan:move '.length)
                .trim()
                .split(/\s+/)
                .filter(Boolean);
            if (args.length !== 2) {
                console.error('Usage: /plan:move <from> <to>');
                return true;
            }
            const fromIndex = Number.parseInt(args[0], 10);
            const toIndex = Number.parseInt(args[1], 10);
            if (!Number.isInteger(fromIndex) ||
                !Number.isInteger(toIndex) ||
                fromIndex < 1 ||
                toIndex < 1 ||
                fromIndex > pendingPlan.length ||
                toIndex > pendingPlan.length) {
                console.error('Usage: /plan:move <from> <to>');
                return true;
            }
            const [moved] = pendingPlan.splice(fromIndex - 1, 1);
            pendingPlan.splice(toIndex - 1, 0, moved);
            await persistPendingPlan();
            console.log(`Moved step ${fromIndex} to ${toIndex}: ${describeAction(moved)}`);
            showPendingPlan();
            return true;
        }
        if (commandBody.startsWith('plan:run ')) {
            if (pendingPlan.length === 0) {
                console.log('No pending plan.');
                return true;
            }
            const rawIndex = commandBody.slice('plan:run '.length).trim();
            const index = Number.parseInt(rawIndex, 10);
            if (!Number.isInteger(index) || index < 1 || index > pendingPlan.length) {
                console.error('Usage: /plan:run <index>');
                return true;
            }
            const [action] = pendingPlan.splice(index - 1, 1);
            await persistPendingPlan();
            console.log(`Executing planned step ${index}: ${describeAction(action)}`);
            await executePlannedAction(action);
            if (pendingPlan.length === 0) {
                pendingPlanSource = undefined;
                await persistPendingPlan();
                console.log('Pending plan is now empty.');
            }
            else {
                showPendingPlan();
            }
            return true;
        }
        if (commandBody === 'confirm') {
            if (pendingPlan.length === 0) {
                console.log('No pending plan.');
                return true;
            }
            await executePendingPlan();
            return true;
        }
        if (commandBody === 'cancel') {
            if (!(await cancelPendingPlan())) {
                console.log('No pending plan.');
            }
            return true;
        }
        if (commandBody === 'refresh') {
            context = await (0, project_context_1.loadProjectContext)(project);
            showContext(context);
            return true;
        }
        if (commandBody === 'session') {
            printJson(session);
            return true;
        }
        if (commandBody === 'clear-session') {
            (0, session_state_1.clearSessionState)(session);
            console.log('Session memory cleared.');
            return true;
        }
        if (commandBody.startsWith('files')) {
            const target = commandBody.slice('files'.length).trim() || '.';
            await listFiles(target);
            return true;
        }
        if (commandBody.startsWith('read ')) {
            const pathArg = commandBody.slice('read '.length).trim();
            if (!pathArg) {
                console.error('Usage: /read <path>');
                return true;
            }
            session.lastFilePath = pathArg;
            await readFile(pathArg);
            return true;
        }
        if (commandBody.startsWith('write ')) {
            const pathArg = commandBody.slice('write '.length).trim();
            if (!pathArg) {
                console.error('Usage: /write <path>');
                return true;
            }
            await writeFileFromPrompt(pathArg);
            context = await (0, project_context_1.loadProjectContext)(project);
            session.lastFilePath = pathArg;
            (0, session_state_1.pushSessionEntry)(session, {
                kind: 'file',
                value: `write ${pathArg}`,
            });
            return true;
        }
        if (commandBody.startsWith('patch ')) {
            const pathArg = commandBody.slice('patch '.length).trim();
            if (!pathArg) {
                console.error('Usage: /patch <path>');
                return true;
            }
            await patchFileFromPrompt(pathArg);
            context = await (0, project_context_1.loadProjectContext)(project);
            session.lastFilePath = pathArg;
            (0, session_state_1.pushSessionEntry)(session, {
                kind: 'file',
                value: `patch ${pathArg}`,
            });
            return true;
        }
        if (commandBody.startsWith('search ')) {
            const pattern = commandBody.slice('search '.length).trim();
            if (!pattern) {
                console.error('Usage: /search <text>');
                return true;
            }
            await searchText(pattern);
            return true;
        }
        if (commandBody === 'run-tests') {
            await runProjectCommand('Running tests', 'npm', ['test']);
            return true;
        }
        if (commandBody === 'run-build') {
            await runProjectCommand('Running build', 'npm', ['run', 'build']);
            return true;
        }
        if (commandBody === 'agents') {
            printJson(project.agents);
            return true;
        }
        if (commandBody === 'workflows') {
            printJson(project.workflows.map((workflow) => ({
                id: workflow.id,
                name: workflow.name,
            })));
            return true;
        }
        if (commandBody === 'runs') {
            printJson(await runStore.list());
            return true;
        }
        if (commandBody === 'approvals') {
            printJson(await approvalStore.list());
            return true;
        }
        if (commandBody.startsWith('approve ')) {
            const key = commandBody.slice('approve '.length).trim();
            if (!key) {
                console.error('Usage: /approve <key>');
                return true;
            }
            await approvalStore.approve(key);
            console.log(`Approved ${key}`);
            return true;
        }
        if (commandBody.startsWith('resume ')) {
            const runId = commandBody.slice('resume '.length).trim();
            if (!runId) {
                console.error('Usage: /resume <runId>');
                return true;
            }
            await resumeRun(runId);
            return true;
        }
        if (commandBody.startsWith('events')) {
            const parts = commandBody.split(/\s+/);
            const runId = parts[1];
            printJson(await eventStore.list(runId));
            return true;
        }
        if (commandBody.startsWith('run ')) {
            const payload = commandBody.slice('run '.length).trim();
            if (!payload) {
                console.error('Usage: /run <task> or /run <workflow> :: <task>');
                return true;
            }
            const workflowSeparator = '::';
            if (payload.includes(workflowSeparator)) {
                const [workflowIdRaw, taskRaw] = payload.split(workflowSeparator);
                const workflowId = workflowIdRaw.trim();
                const task = taskRaw.trim();
                if (!workflowId || !task) {
                    console.error('Usage: /run <workflow> :: <task>');
                    return true;
                }
                await executeWorkflow(task, workflowId);
                return true;
            }
            await executeWorkflow(payload);
            return true;
        }
        console.error(`Unknown command: ${trimmed}`);
        return true;
    };
    const promptLoop = () => {
        rl.question('myagent> ', async (answer) => {
            try {
                const shouldContinue = await handleCommand(answer);
                if (!shouldContinue) {
                    rl.close();
                    return;
                }
            }
            catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                console.error(message);
            }
            console.log('');
            promptLoop();
        });
    };
    promptLoop();
}

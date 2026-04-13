"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RunStore = void 0;
const fs_1 = require("fs");
const path_1 = require("path");
function buildRunFilePath(project, runId) {
    return (0, path_1.resolve)(project.rootDir, project.config.project.runsDir, `${runId}.json`);
}
function buildArtifactDir(project, runId) {
    return (0, path_1.resolve)(project.rootDir, project.config.project.artifactsDir, runId);
}
class RunStore {
    project;
    constructor(project) {
        this.project = project;
    }
    async save(run) {
        const runFilePath = buildRunFilePath(this.project, run.runId);
        const artifactDir = buildArtifactDir(this.project, run.runId);
        await fs_1.promises.mkdir((0, path_1.resolve)(this.project.rootDir, this.project.config.project.runsDir), { recursive: true });
        await fs_1.promises.mkdir(artifactDir, { recursive: true });
        const artifactWrites = run.steps.flatMap((step) => (step.artifacts ?? []).map((artifact) => fs_1.promises.writeFile((0, path_1.resolve)(this.project.rootDir, artifact.path), artifact.content, 'utf8')));
        await Promise.all([
            fs_1.promises.writeFile(runFilePath, JSON.stringify(run, null, 2), 'utf8'),
            fs_1.promises.writeFile((0, path_1.resolve)(artifactDir, 'final.md'), run.final, 'utf8'),
            fs_1.promises.writeFile((0, path_1.resolve)(artifactDir, 'steps.json'), JSON.stringify(run.steps, null, 2), 'utf8'),
            ...artifactWrites,
        ]);
    }
    async list() {
        const runsDir = (0, path_1.resolve)(this.project.rootDir, this.project.config.project.runsDir);
        try {
            const entries = await fs_1.promises.readdir(runsDir);
            const runs = await Promise.all(entries
                .filter((entry) => entry.endsWith('.json'))
                .sort()
                .reverse()
                .map(async (entry) => {
                const raw = await fs_1.promises.readFile((0, path_1.resolve)(runsDir, entry), 'utf8');
                const run = JSON.parse(raw);
                return {
                    runId: run.runId,
                    resumedFromRunId: run.resumedFromRunId,
                    workflowId: run.workflowId,
                    status: run.status,
                    taskPreview: run.task.slice(0, 80),
                    startedAt: run.startedAt,
                    completedAt: run.completedAt,
                };
            }));
            return runs;
        }
        catch (error) {
            if (error?.code === 'ENOENT') {
                return [];
            }
            throw error;
        }
    }
    async get(runId) {
        const runFilePath = buildRunFilePath(this.project, runId);
        try {
            const raw = await fs_1.promises.readFile(runFilePath, 'utf8');
            return JSON.parse(raw);
        }
        catch (error) {
            if (error?.code === 'ENOENT') {
                return null;
            }
            throw error;
        }
    }
}
exports.RunStore = RunStore;

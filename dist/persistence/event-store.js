"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventStore = void 0;
const fs_1 = require("fs");
const path_1 = require("path");
function buildEventFilePath(project, runId) {
    return (0, path_1.resolve)(project.rootDir, project.config.project.eventsDir, `${runId}.jsonl`);
}
class EventStore {
    project;
    constructor(project) {
        this.project = project;
    }
    async emit(event) {
        const filePath = buildEventFilePath(this.project, event.runId);
        await fs_1.promises.mkdir((0, path_1.resolve)(this.project.rootDir, this.project.config.project.eventsDir), { recursive: true });
        await fs_1.promises.appendFile(filePath, `${JSON.stringify(event)}\n`, 'utf8');
    }
    async list(runId) {
        const eventsDir = (0, path_1.resolve)(this.project.rootDir, this.project.config.project.eventsDir);
        try {
            const entries = await fs_1.promises.readdir(eventsDir);
            const files = runId ? [`${runId}.jsonl`] : entries.filter((entry) => entry.endsWith('.jsonl')).sort().reverse();
            const chunks = await Promise.all(files.map(async (entry) => {
                try {
                    const raw = await fs_1.promises.readFile((0, path_1.resolve)(eventsDir, entry), 'utf8');
                    return raw
                        .split('\n')
                        .filter(Boolean)
                        .map((line) => JSON.parse(line));
                }
                catch (error) {
                    if (error?.code === 'ENOENT') {
                        return [];
                    }
                    throw error;
                }
            }));
            return chunks.flat();
        }
        catch (error) {
            if (error?.code === 'ENOENT') {
                return [];
            }
            throw error;
        }
    }
}
exports.EventStore = EventStore;

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApprovalStore = void 0;
const fs_1 = require("fs");
const path_1 = require("path");
class ApprovalStore {
    project;
    constructor(project) {
        this.project = project;
    }
    get filePath() {
        return (0, path_1.resolve)(this.project.rootDir, this.project.config.project.approvalsFile);
    }
    async list() {
        try {
            const raw = await fs_1.promises.readFile(this.filePath, 'utf8');
            const parsed = JSON.parse(raw);
            return [...new Set(parsed.approvedKeys ?? [])].sort();
        }
        catch (error) {
            if (error?.code === 'ENOENT') {
                return [];
            }
            throw error;
        }
    }
    async isApproved(key) {
        const keys = await this.list();
        return keys.includes(key);
    }
    async approve(key) {
        const keys = new Set(await this.list());
        keys.add(key);
        await fs_1.promises.mkdir((0, path_1.dirname)(this.filePath), { recursive: true });
        await fs_1.promises.writeFile(this.filePath, JSON.stringify({ approvedKeys: [...keys].sort() }, null, 2), 'utf8');
    }
    async revoke(key) {
        const keys = new Set(await this.list());
        keys.delete(key);
        await fs_1.promises.mkdir((0, path_1.dirname)(this.filePath), { recursive: true });
        await fs_1.promises.writeFile(this.filePath, JSON.stringify({ approvedKeys: [...keys].sort() }, null, 2), 'utf8');
    }
}
exports.ApprovalStore = ApprovalStore;

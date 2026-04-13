"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolRegistry = void 0;
const fs_1 = require("fs");
const path_1 = require("path");
class EchoTool {
    name = 'echo';
    description = 'Returns the provided text input unchanged.';
    async run(input) {
        return input.text ?? '';
    }
}
class JoinTool {
    name = 'join';
    description = 'Joins comma-separated values using an optional separator.';
    async run(input) {
        const values = (input.values ?? '')
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean);
        const separator = input.separator ?? ', ';
        return values.join(separator);
    }
}
class TimestampTool {
    name = 'timestamp';
    description = 'Returns the current ISO timestamp.';
    async run() {
        return new Date().toISOString();
    }
}
class ReadFileTool {
    name = 'read_file';
    description = 'Reads a UTF-8 file relative to the project root, optionally truncated by maxChars.';
    async run(input, context) {
        const relativePath = input.path;
        if (!relativePath) {
            throw new Error('read_file requires "path"');
        }
        const filePath = (0, path_1.resolve)(context.rootDir, relativePath);
        const content = await fs_1.promises.readFile(filePath, 'utf8');
        const maxChars = input.maxChars ? Number(input.maxChars) : undefined;
        if (maxChars && Number.isFinite(maxChars) && maxChars > 0) {
            return content.slice(0, maxChars);
        }
        return content;
    }
}
class ToolRegistry {
    tools = new Map();
    constructor() {
        const builtins = [
            new EchoTool(),
            new JoinTool(),
            new TimestampTool(),
            new ReadFileTool(),
        ];
        for (const tool of builtins) {
            this.tools.set(tool.name, tool);
        }
    }
    listAllowed(allowedTools) {
        return Array.from(this.tools.values())
            .filter((tool) => !allowedTools || allowedTools.includes(tool.name))
            .map((tool) => ({
            name: tool.name,
            description: tool.description,
        }));
    }
    async execute(request, context) {
        if (context.allowedTools && !context.allowedTools.includes(request.tool)) {
            throw new Error(`Tool "${request.tool}" is not allowed in this execution context`);
        }
        const tool = this.tools.get(request.tool);
        if (!tool) {
            throw new Error(`Unknown tool: ${request.tool}`);
        }
        return tool.run(request.input, context);
    }
}
exports.ToolRegistry = ToolRegistry;

import { promises as fs } from 'fs';
import { resolve } from 'path';

export interface ToolExecutionRequest {
  tool: string;
  input: Record<string, string>;
}

export interface ToolExecutionContext {
  rootDir: string;
  allowedTools?: string[];
}

export interface RuntimeTool {
  name: string;
  description: string;
  run(input: Record<string, string>, context: ToolExecutionContext): Promise<string>;
}

class EchoTool implements RuntimeTool {
  name = 'echo';
  description = 'Returns the provided text input unchanged.';

  async run(input: Record<string, string>): Promise<string> {
    return input.text ?? '';
  }
}

class JoinTool implements RuntimeTool {
  name = 'join';
  description = 'Joins comma-separated values using an optional separator.';

  async run(input: Record<string, string>): Promise<string> {
    const values = (input.values ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    const separator = input.separator ?? ', ';
    return values.join(separator);
  }
}

class TimestampTool implements RuntimeTool {
  name = 'timestamp';
  description = 'Returns the current ISO timestamp.';

  async run(): Promise<string> {
    return new Date().toISOString();
  }
}

class ReadFileTool implements RuntimeTool {
  name = 'read_file';
  description = 'Reads a UTF-8 file relative to the project root, optionally truncated by maxChars.';

  async run(input: Record<string, string>, context: ToolExecutionContext): Promise<string> {
    const relativePath = input.path;
    if (!relativePath) {
      throw new Error('read_file requires "path"');
    }

    const filePath = resolve(context.rootDir, relativePath);
    const content = await fs.readFile(filePath, 'utf8');
    const maxChars = input.maxChars ? Number(input.maxChars) : undefined;

    if (maxChars && Number.isFinite(maxChars) && maxChars > 0) {
      return content.slice(0, maxChars);
    }

    return content;
  }
}

export class ToolRegistry {
  private readonly tools = new Map<string, RuntimeTool>();

  constructor() {
    const builtins: RuntimeTool[] = [
      new EchoTool(),
      new JoinTool(),
      new TimestampTool(),
      new ReadFileTool(),
    ];

    for (const tool of builtins) {
      this.tools.set(tool.name, tool);
    }
  }

  listAllowed(allowedTools?: string[]): Array<{ name: string; description: string }> {
    return Array.from(this.tools.values())
      .filter((tool) => !allowedTools || allowedTools.includes(tool.name))
      .map((tool) => ({
        name: tool.name,
        description: tool.description,
      }));
  }

  async execute(
    request: ToolExecutionRequest,
    context: ToolExecutionContext,
  ): Promise<string> {
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

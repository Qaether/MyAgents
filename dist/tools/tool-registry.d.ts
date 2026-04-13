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
export declare class ToolRegistry {
    private readonly tools;
    constructor();
    listAllowed(allowedTools?: string[]): Array<{
        name: string;
        description: string;
    }>;
    execute(request: ToolExecutionRequest, context: ToolExecutionContext): Promise<string>;
}

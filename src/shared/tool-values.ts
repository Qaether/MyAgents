import { ToolExecutionResult } from '../domain/run';

export function addToolValues(
  values: Record<string, string>,
  stepId: string,
  tools: ToolExecutionResult[] | undefined,
): void {
  if (!tools) {
    return;
  }

  for (const tool of tools) {
    values[`steps.${stepId}.tools.${tool.alias}`] = tool.output;
  }
}

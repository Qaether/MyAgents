export interface AgentSpec {
  id: string;
  name: string;
  role: string;
  systemPrompt: string;
  model?: string;
  temperature?: number;
  allowedTools?: string[];
}

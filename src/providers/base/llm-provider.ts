export interface GenerationRequest {
  model: string;
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  responseFormat?: 'text' | 'json';
}

export interface LLMProvider {
  generate(request: GenerationRequest): Promise<string>;
}

import { ResolvedOpenAIProviderConfig } from '../config/schema';
import { LLMProvider } from './base/llm-provider';
import { OpenAIProvider } from './openai/openai-provider';

export function createProvider(config: ResolvedOpenAIProviderConfig): LLMProvider {
  return new OpenAIProvider(config);
}

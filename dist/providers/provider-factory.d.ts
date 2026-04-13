import { ResolvedOpenAIProviderConfig } from '../config/schema';
import { LLMProvider } from './base/llm-provider';
export declare function createProvider(config: ResolvedOpenAIProviderConfig): LLMProvider;

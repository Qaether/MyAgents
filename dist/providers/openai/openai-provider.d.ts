import { ResolvedOpenAIProviderConfig } from '../../config/schema';
import { GenerationRequest, LLMProvider } from '../base/llm-provider';
export declare class OpenAIProvider implements LLMProvider {
    private readonly client;
    private readonly fallbackModel;
    constructor(config: ResolvedOpenAIProviderConfig);
    generate(request: GenerationRequest): Promise<string>;
}

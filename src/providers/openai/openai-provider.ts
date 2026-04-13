import OpenAI from 'openai';
import { ResolvedOpenAIProviderConfig } from '../../config/schema';
import { GenerationRequest, LLMProvider } from '../base/llm-provider';

export class OpenAIProvider implements LLMProvider {
  private readonly client: OpenAI;
  private readonly fallbackModel: string;

  constructor(config: ResolvedOpenAIProviderConfig) {
    this.client = new OpenAI({ apiKey: config.apiKey });
    this.fallbackModel = config.model;
  }

  async generate(request: GenerationRequest): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: request.model || this.fallbackModel,
      temperature: request.temperature ?? 0.2,
      messages: [
        { role: 'system', content: request.systemPrompt },
        {
          role: 'user',
          content:
            request.responseFormat === 'json'
              ? `${request.userPrompt}\n\nReturn only valid JSON. Do not wrap it in markdown fences.`
              : request.userPrompt,
        },
      ],
    });

    return response.choices[0]?.message?.content?.trim() ?? '';
  }
}

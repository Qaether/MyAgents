import { ProjectConfig, ResolvedOpenAIProviderConfig } from './schema';

export function resolveOpenAIConfig(config: ProjectConfig): ResolvedOpenAIProviderConfig {
  const apiKey = process.env[config.provider.apiKeyEnv] || config.provider.apiKey;

  if (!apiKey) {
    throw new Error(
      `OpenAI API key is required. Set ${config.provider.apiKeyEnv} or provide provider.apiKey in myagent.config.json`,
    );
  }

  return {
    ...config.provider,
    apiKey,
  };
}

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveOpenAIConfig = resolveOpenAIConfig;
function resolveOpenAIConfig(config) {
    const apiKey = process.env[config.provider.apiKeyEnv] || config.provider.apiKey;
    if (!apiKey) {
        throw new Error(`OpenAI API key is required. Set ${config.provider.apiKeyEnv} or provide provider.apiKey in myagent.config.json`);
    }
    return {
        ...config.provider,
        apiKey,
    };
}

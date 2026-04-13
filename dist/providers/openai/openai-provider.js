"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAIProvider = void 0;
const openai_1 = __importDefault(require("openai"));
class OpenAIProvider {
    client;
    fallbackModel;
    constructor(config) {
        this.client = new openai_1.default({ apiKey: config.apiKey });
        this.fallbackModel = config.model;
    }
    async generate(request) {
        const response = await this.client.chat.completions.create({
            model: request.model || this.fallbackModel,
            temperature: request.temperature ?? 0.2,
            messages: [
                { role: 'system', content: request.systemPrompt },
                {
                    role: 'user',
                    content: request.responseFormat === 'json'
                        ? `${request.userPrompt}\n\nReturn only valid JSON. Do not wrap it in markdown fences.`
                        : request.userPrompt,
                },
            ],
        });
        return response.choices[0]?.message?.content?.trim() ?? '';
    }
}
exports.OpenAIProvider = OpenAIProvider;

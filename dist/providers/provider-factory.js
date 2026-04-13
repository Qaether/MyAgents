"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createProvider = createProvider;
const openai_provider_1 = require("./openai/openai-provider");
function createProvider(config) {
    return new openai_provider_1.OpenAIProvider(config);
}

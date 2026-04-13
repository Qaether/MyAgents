"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addToolValues = addToolValues;
function addToolValues(values, stepId, tools) {
    if (!tools) {
        return;
    }
    for (const tool of tools) {
        values[`steps.${stepId}.tools.${tool.alias}`] = tool.output;
    }
}

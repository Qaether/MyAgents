"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderTemplate = renderTemplate;
function renderTemplate(template, values) {
    return template.replace(/{{\s*([^}]+)\s*}}/g, (_, rawKey) => {
        const key = rawKey.trim();
        return values[key] ?? '';
    });
}

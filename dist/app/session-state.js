"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSessionState = createSessionState;
exports.pushSessionEntry = pushSessionEntry;
exports.clearSessionState = clearSessionState;
const MAX_ENTRIES = 20;
function createSessionState() {
    return {
        startedAt: new Date().toISOString(),
        recentEntries: [],
    };
}
function pushSessionEntry(state, entry) {
    state.recentEntries.push({
        ...entry,
        timestamp: new Date().toISOString(),
    });
    if (state.recentEntries.length > MAX_ENTRIES) {
        state.recentEntries.splice(0, state.recentEntries.length - MAX_ENTRIES);
    }
}
function clearSessionState(state) {
    state.lastWorkflowId = undefined;
    state.lastRunId = undefined;
    state.lastTask = undefined;
    state.lastFilePath = undefined;
    state.recentEntries = [];
}

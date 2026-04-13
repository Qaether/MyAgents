export interface SessionEntry {
    timestamp: string;
    kind: 'command' | 'task' | 'run' | 'file' | 'note';
    value: string;
}
export interface SessionState {
    startedAt: string;
    lastWorkflowId?: string;
    lastRunId?: string;
    lastTask?: string;
    lastFilePath?: string;
    recentEntries: SessionEntry[];
}
export declare function createSessionState(): SessionState;
export declare function pushSessionEntry(state: SessionState, entry: Omit<SessionEntry, 'timestamp'>): void;
export declare function clearSessionState(state: SessionState): void;

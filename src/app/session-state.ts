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

const MAX_ENTRIES = 20;

export function createSessionState(): SessionState {
  return {
    startedAt: new Date().toISOString(),
    recentEntries: [],
  };
}

export function pushSessionEntry(
  state: SessionState,
  entry: Omit<SessionEntry, 'timestamp'>,
): void {
  state.recentEntries.push({
    ...entry,
    timestamp: new Date().toISOString(),
  });

  if (state.recentEntries.length > MAX_ENTRIES) {
    state.recentEntries.splice(0, state.recentEntries.length - MAX_ENTRIES);
  }
}

export function clearSessionState(state: SessionState): void {
  state.lastWorkflowId = undefined;
  state.lastRunId = undefined;
  state.lastTask = undefined;
  state.lastFilePath = undefined;
  state.recentEntries = [];
}

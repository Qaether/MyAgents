export type RuntimeEventType =
  | 'run.started'
  | 'run.resumed'
  | 'run.completed'
  | 'stage.started'
  | 'stage.completed'
  | 'step.started'
  | 'step.completed'
  | 'step.reused'
  | 'step.skipped'
  | 'step.failed'
  | 'tool.started'
  | 'tool.completed'
  | 'tool.failed'
  | 'retry';

export interface RuntimeEvent {
  runId: string;
  timestamp: string;
  type: RuntimeEventType;
  workflowId: string;
  stageId?: string;
  stepId?: string;
  tool?: string;
  attempt?: number;
  message?: string;
  data?: Record<string, unknown>;
}

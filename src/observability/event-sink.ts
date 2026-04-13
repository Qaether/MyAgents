import { RuntimeEvent } from '../domain/event';

export interface EventSink {
  emit(event: RuntimeEvent): Promise<void>;
}

export class NoopEventSink implements EventSink {
  async emit(): Promise<void> {}
}

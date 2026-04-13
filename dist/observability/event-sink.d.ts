import { RuntimeEvent } from '../domain/event';
export interface EventSink {
    emit(event: RuntimeEvent): Promise<void>;
}
export declare class NoopEventSink implements EventSink {
    emit(): Promise<void>;
}

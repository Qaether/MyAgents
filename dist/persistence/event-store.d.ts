import { LoadedProject } from '../config/project-loader';
import { RuntimeEvent } from '../domain/event';
import { EventSink } from '../observability/event-sink';
export declare class EventStore implements EventSink {
    private readonly project;
    constructor(project: LoadedProject);
    emit(event: RuntimeEvent): Promise<void>;
    list(runId?: string): Promise<RuntimeEvent[]>;
}

import { LoadedProject } from '../config/project-loader';
import { RunResult, RunSummary } from '../domain/run';
export declare class RunStore {
    private readonly project;
    constructor(project: LoadedProject);
    save(run: RunResult): Promise<void>;
    list(): Promise<RunSummary[]>;
    get(runId: string): Promise<RunResult | null>;
}

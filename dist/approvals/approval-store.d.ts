import { LoadedProject } from '../config/project-loader';
export declare class ApprovalStore {
    private readonly project;
    constructor(project: LoadedProject);
    private get filePath();
    list(): Promise<string[]>;
    isApproved(key: string): Promise<boolean>;
    approve(key: string): Promise<void>;
    revoke(key: string): Promise<void>;
}

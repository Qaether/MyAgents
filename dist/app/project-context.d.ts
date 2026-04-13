import { LoadedProject } from '../config/project-loader';
export interface ProjectContextSummary {
    rootDir: string;
    rootFiles: string[];
    sourceFiles: string[];
    fileRoles: Array<{
        path: string;
        role: string;
    }>;
    keyFiles: Array<{
        path: string;
        preview: string;
    }>;
    cachedSummary: string[];
}
export declare function loadProjectContext(project: LoadedProject): Promise<ProjectContextSummary>;

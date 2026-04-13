import { promises as fs } from 'fs';
import { resolve } from 'path';
import { LoadedProject } from '../config/project-loader';
import { RunResult, RunSummary } from '../domain/run';

function buildRunFilePath(project: LoadedProject, runId: string): string {
  return resolve(project.rootDir, project.config.project.runsDir, `${runId}.json`);
}

function buildArtifactDir(project: LoadedProject, runId: string): string {
  return resolve(project.rootDir, project.config.project.artifactsDir, runId);
}

export class RunStore {
  constructor(private readonly project: LoadedProject) {}

  async save(run: RunResult): Promise<void> {
    const runFilePath = buildRunFilePath(this.project, run.runId);
    const artifactDir = buildArtifactDir(this.project, run.runId);

    await fs.mkdir(resolve(this.project.rootDir, this.project.config.project.runsDir), { recursive: true });
    await fs.mkdir(artifactDir, { recursive: true });

    const artifactWrites = run.steps.flatMap((step) =>
      (step.artifacts ?? []).map((artifact) =>
        fs.writeFile(resolve(this.project.rootDir, artifact.path), artifact.content, 'utf8'),
      ),
    );

    await Promise.all([
      fs.writeFile(runFilePath, JSON.stringify(run, null, 2), 'utf8'),
      fs.writeFile(resolve(artifactDir, 'final.md'), run.final, 'utf8'),
      fs.writeFile(
        resolve(artifactDir, 'steps.json'),
        JSON.stringify(run.steps, null, 2),
        'utf8',
      ),
      ...artifactWrites,
    ]);
  }

  async list(): Promise<RunSummary[]> {
    const runsDir = resolve(this.project.rootDir, this.project.config.project.runsDir);

    try {
      const entries = await fs.readdir(runsDir);
      const runs = await Promise.all(
        entries
          .filter((entry) => entry.endsWith('.json'))
          .sort()
          .reverse()
          .map(async (entry) => {
            const raw = await fs.readFile(resolve(runsDir, entry), 'utf8');
            const run = JSON.parse(raw) as RunResult;
            return {
              runId: run.runId,
              resumedFromRunId: run.resumedFromRunId,
              workflowId: run.workflowId,
              status: run.status,
              taskPreview: run.task.slice(0, 80),
              startedAt: run.startedAt,
              completedAt: run.completedAt,
            } satisfies RunSummary;
          }),
      );

      return runs;
    } catch (error: any) {
      if (error?.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  async get(runId: string): Promise<RunResult | null> {
    const runFilePath = buildRunFilePath(this.project, runId);

    try {
      const raw = await fs.readFile(runFilePath, 'utf8');
      return JSON.parse(raw) as RunResult;
    } catch (error: any) {
      if (error?.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }
}

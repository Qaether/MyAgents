import { promises as fs } from 'fs';
import { resolve } from 'path';
import { LoadedProject } from '../config/project-loader';
import { RuntimeEvent } from '../domain/event';
import { EventSink } from '../observability/event-sink';

function buildEventFilePath(project: LoadedProject, runId: string): string {
  return resolve(project.rootDir, project.config.project.eventsDir, `${runId}.jsonl`);
}

export class EventStore implements EventSink {
  constructor(private readonly project: LoadedProject) {}

  async emit(event: RuntimeEvent): Promise<void> {
    const filePath = buildEventFilePath(this.project, event.runId);
    await fs.mkdir(resolve(this.project.rootDir, this.project.config.project.eventsDir), { recursive: true });
    await fs.appendFile(filePath, `${JSON.stringify(event)}\n`, 'utf8');
  }

  async list(runId?: string): Promise<RuntimeEvent[]> {
    const eventsDir = resolve(this.project.rootDir, this.project.config.project.eventsDir);

    try {
      const entries = await fs.readdir(eventsDir);
      const files = runId ? [`${runId}.jsonl`] : entries.filter((entry) => entry.endsWith('.jsonl')).sort().reverse();
      const chunks = await Promise.all(
        files.map(async (entry) => {
          try {
            const raw = await fs.readFile(resolve(eventsDir, entry), 'utf8');
            return raw
              .split('\n')
              .filter(Boolean)
              .map((line) => JSON.parse(line) as RuntimeEvent);
          } catch (error: any) {
            if (error?.code === 'ENOENT') {
              return [];
            }
            throw error;
          }
        }),
      );

      return chunks.flat();
    } catch (error: any) {
      if (error?.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }
}

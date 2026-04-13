import { promises as fs } from 'fs';
import { dirname, resolve } from 'path';
import { LoadedProject } from '../config/project-loader';

interface ApprovalFile {
  approvedKeys: string[];
}

export class ApprovalStore {
  constructor(private readonly project: LoadedProject) {}

  private get filePath(): string {
    return resolve(this.project.rootDir, this.project.config.project.approvalsFile);
  }

  async list(): Promise<string[]> {
    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as ApprovalFile;
      return [...new Set(parsed.approvedKeys ?? [])].sort();
    } catch (error: any) {
      if (error?.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  async isApproved(key: string): Promise<boolean> {
    const keys = await this.list();
    return keys.includes(key);
  }

  async approve(key: string): Promise<void> {
    const keys = new Set(await this.list());
    keys.add(key);
    await fs.mkdir(dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify({ approvedKeys: [...keys].sort() }, null, 2), 'utf8');
  }

  async revoke(key: string): Promise<void> {
    const keys = new Set(await this.list());
    keys.delete(key);
    await fs.mkdir(dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify({ approvedKeys: [...keys].sort() }, null, 2), 'utf8');
  }
}

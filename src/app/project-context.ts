import { promises as fs } from 'fs';
import { resolve } from 'path';
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

function inferFileRole(path: string): string {
  if (path === 'package.json') return 'Project manifest and script entrypoints';
  if (path === 'README.md') return 'Top-level project overview';
  if (path === 'CONSOLE_GUIDE.md') return 'Detailed operator guide for CLI and REPL usage';
  if (path === 'myagent.config.json') return 'Global runtime configuration';
  if (path.includes('src/app/cli.ts')) return 'Main CLI command entrypoint';
  if (path.includes('src/app/repl.ts')) return 'Interactive REPL loop and command router';
  if (path.includes('src/app/project-context.ts')) return 'Workspace context loading and summary building';
  if (path.includes('src/app/session-state.ts')) return 'In-memory REPL session memory';
  if (path.includes('src/runtime/workflow-executor.ts')) return 'Core workflow execution engine';
  if (path.includes('src/config/schema.ts')) return 'Runtime configuration and workflow schemas';
  if (path.includes('src/config/project-loader.ts')) return 'Loads and validates project definitions';
  if (path.includes('src/persistence/run-store.ts')) return 'Persists run metadata and artifacts';
  if (path.includes('src/persistence/event-store.ts')) return 'Persists runtime events';
  if (path.includes('src/tools/tool-registry.ts')) return 'Builtin tool registry and execution';
  if (path.includes('src/domain/')) return 'Domain model definitions';
  if (path.startsWith('agents/')) return 'Agent definition';
  if (path.startsWith('workflows/')) return 'Workflow definition';
  return 'Project file';
}

async function safeReadPreview(filePath: string, maxChars = 280): Promise<string> {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return raw.slice(0, maxChars).replace(/\s+/g, ' ').trim();
  } catch {
    return '';
  }
}

export async function loadProjectContext(project: LoadedProject): Promise<ProjectContextSummary> {
  const entries = await fs.readdir(project.rootDir, { withFileTypes: true });
  const rootFiles = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort();

  const candidateFiles = [
    'package.json',
    'README.md',
    'CONSOLE_GUIDE.md',
    'myagent.config.json',
  ];

  const sourceDirs = ['src/app', 'src/runtime', 'src/domain'];
  const sourceFiles: string[] = [];

  for (const relativeDir of sourceDirs) {
    const fullDir = resolve(project.rootDir, relativeDir);
    try {
      const entries = await fs.readdir(fullDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile()) {
          sourceFiles.push(`${relativeDir}/${entry.name}`);
        }
      }
    } catch {
      continue;
    }
  }

  const keyFiles = await Promise.all(
    candidateFiles.map(async (relativePath) => ({
      path: relativePath,
      preview: await safeReadPreview(resolve(project.rootDir, relativePath)),
    })),
  );

  return {
    rootDir: project.rootDir,
    rootFiles,
    sourceFiles: sourceFiles.sort(),
    fileRoles: [...candidateFiles, ...sourceFiles.sort()].map((path) => ({
      path,
      role: inferFileRole(path),
    })),
    keyFiles: keyFiles.filter((file) => file.preview.length > 0),
    cachedSummary: [
      `Root file count: ${rootFiles.length}`,
      `Agent count: ${project.agents.length}`,
      `Workflow count: ${project.workflows.length}`,
      `Key source files: ${sourceFiles.sort().join(', ')}`,
    ],
  };
}

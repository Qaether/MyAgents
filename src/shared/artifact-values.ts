import { ArtifactResult } from '../domain/run';

export function addArtifactValues(
  values: Record<string, string>,
  stepId: string,
  artifacts: ArtifactResult[] | undefined,
): void {
  if (!artifacts) {
    return;
  }

  for (const artifact of artifacts) {
    values[`steps.${stepId}.artifacts.${artifact.name}.path`] = artifact.path;
    values[`steps.${stepId}.artifacts.${artifact.name}.content`] = artifact.content;
  }
}

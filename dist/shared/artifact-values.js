"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addArtifactValues = addArtifactValues;
function addArtifactValues(values, stepId, artifacts) {
    if (!artifacts) {
        return;
    }
    for (const artifact of artifacts) {
        values[`steps.${stepId}.artifacts.${artifact.name}.path`] = artifact.path;
        values[`steps.${stepId}.artifacts.${artifact.name}.content`] = artifact.content;
    }
}

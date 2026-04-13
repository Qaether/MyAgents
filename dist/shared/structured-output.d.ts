import { StructuredOutputSpec } from '../domain/workflow';
export declare function parseStructuredOutput(raw: string, spec: StructuredOutputSpec): Record<string, unknown>;
export declare function addStructuredValues(values: Record<string, string>, stepId: string, data: Record<string, unknown> | undefined): void;

import { StructuredOutputSpec } from '../domain/workflow';

function matchesType(value: unknown, type: StructuredOutputSpec['fields'][string]): boolean {
  switch (type) {
    case 'string':
      return typeof value === 'string';
    case 'string[]':
      return Array.isArray(value) && value.every((item) => typeof item === 'string');
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'boolean':
      return typeof value === 'boolean';
    default:
      return false;
  }
}

export function parseStructuredOutput(
  raw: string,
  spec: StructuredOutputSpec,
): Record<string, unknown> {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Structured output must be valid JSON');
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Structured output must be a JSON object');
  }

  const record = parsed as Record<string, unknown>;

  for (const [field, type] of Object.entries(spec.fields)) {
    if (!(field in record)) {
      throw new Error(`Structured output is missing required field "${field}"`);
    }

    if (!matchesType(record[field], type)) {
      throw new Error(`Structured output field "${field}" must be of type ${type}`);
    }
  }

  return record;
}

export function addStructuredValues(
  values: Record<string, string>,
  stepId: string,
  data: Record<string, unknown> | undefined,
): void {
  if (!data) {
    return;
  }

  for (const [key, value] of Object.entries(data)) {
    const fullKey = `steps.${stepId}.data.${key}`;

    if (Array.isArray(value)) {
      values[fullKey] = value.join(', ');
      continue;
    }

    if (typeof value === 'object' && value !== null) {
      values[fullKey] = JSON.stringify(value);
      continue;
    }

    values[fullKey] = String(value);
  }
}

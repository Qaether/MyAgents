import { describe, expect, it } from 'vitest';
import { addStructuredValues, parseStructuredOutput } from '../src/shared/structured-output';

describe('structured output helpers', () => {
  it('parses and validates structured JSON output', () => {
    const result = parseStructuredOutput('{"name":"planner","tags":["a","b"],"active":true,"count":3}', {
      fields: {
        name: 'string',
        tags: 'string[]',
        active: 'boolean',
        count: 'number',
      },
    });

    expect(result).toEqual({
      name: 'planner',
      tags: ['a', 'b'],
      active: true,
      count: 3,
    });
  });

  it('projects structured values into template variables', () => {
    const values: Record<string, string> = {};
    addStructuredValues(values, 'plan', {
      objective: 'Ship it',
      risks: ['time', 'scope'],
    });

    expect(values['steps.plan.data.objective']).toBe('Ship it');
    expect(values['steps.plan.data.risks']).toBe('time, scope');
  });
});

import { describe, expect, it } from 'vitest';
import { renderTemplate } from '../src/shared/template';

describe('renderTemplate', () => {
  it('renders known placeholders and blanks missing ones', () => {
    const result = renderTemplate('Task: {{ task }} / Draft: {{steps.draft.output}} / X: {{missing}}', {
      task: 'Ship it',
      'steps.draft.output': 'Done',
    });

    expect(result).toBe('Task: Ship it / Draft: Done / X: ');
  });
});

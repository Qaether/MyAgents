export function renderTemplate(
  template: string,
  values: Record<string, string>,
): string {
  return template.replace(/{{\s*([^}]+)\s*}}/g, (_, rawKey: string) => {
    const key = rawKey.trim();
    return values[key] ?? '';
  });
}

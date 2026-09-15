export function safeNewsPath(value: string | null): string {
  return value && /^\/news\/detail\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) ? value : '/';
}

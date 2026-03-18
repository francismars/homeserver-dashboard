export function isAllowedPublicHostname(domain: string): boolean {
  if (!domain || domain.length > 253) return false;
  if (domain.startsWith('localhost') || domain.endsWith('.localhost')) return false;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(domain)) return false;
  if (domain.includes(':')) return false;
  if (!domain.includes('.')) return false;
  return true;
}

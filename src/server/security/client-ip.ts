/** Best-effort client IP behind a proxy (first X-Forwarded-For hop, then X-Real-IP). Used only as a throttling key. */
export function clientIp(h: Headers): string {
  const fwd = h.get('x-forwarded-for')?.split(',')[0]?.trim();
  return fwd || h.get('x-real-ip')?.trim() || 'unknown';
}

// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { GET } from './route';

describe('health route', () => {
  it('returns 200 with ok:true and no downstream dependencies', async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toEqual({ ok: true });
  });
});

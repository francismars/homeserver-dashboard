import { describe, expect, it } from 'vitest';
import { restartAppSentence } from './restart-copy';

describe('restartAppSentence', () => {
  it('umbrel mentions Umbrel', () => {
    expect(restartAppSentence('umbrel')).toContain('from Umbrel');
  });
  it('standalone is generic, no Umbrel', () => {
    const s = restartAppSentence('standalone');
    expect(s.toLowerCase()).toContain('restart your homeserver');
    expect(s).not.toContain('Umbrel');
  });
});

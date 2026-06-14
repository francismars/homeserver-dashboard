import { afterEach, describe, expect, it } from 'vitest';
import { getPlatform } from './platform';

describe('getPlatform', () => {
  afterEach(() => {
    delete process.env.PLATFORM;
  });
  it('umbrel only when PLATFORM=umbrel', () => {
    process.env.PLATFORM = 'umbrel';
    expect(getPlatform()).toBe('umbrel');
  });
  it('standalone when unset', () => {
    delete process.env.PLATFORM;
    expect(getPlatform()).toBe('standalone');
  });
  it('standalone for any other value (fail safe to generic)', () => {
    process.env.PLATFORM = 'docker';
    expect(getPlatform()).toBe('standalone');
  });
});

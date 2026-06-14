import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PlatformProvider, usePlatform } from './PlatformProvider';

function Probe() {
  return <span data-testid="p">{usePlatform()}</span>;
}

describe('PlatformProvider', () => {
  it('exposes the platform value', () => {
    render(
      <PlatformProvider platform="standalone">
        <Probe />
      </PlatformProvider>,
    );
    expect(screen.getByTestId('p').textContent).toBe('standalone');
  });
  it('defaults to umbrel when no provider (back-compat for untouched trees)', () => {
    render(<Probe />);
    expect(screen.getByTestId('p').textContent).toBe('umbrel');
  });
});

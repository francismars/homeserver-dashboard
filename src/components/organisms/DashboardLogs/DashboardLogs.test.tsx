import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { DashboardLogs } from './DashboardLogs';

const sampleLogs = {
  items: [{ ts: '2026-06-12T10:00:00.000Z', level: 'info', msg: 'started' }],
  partial: false,
};

function mockFetch({
  downloadStatus = 200,
  downloadBody = sampleLogs as unknown,
}: Partial<Record<string, unknown>> = {}) {
  return vi.spyOn(global, 'fetch').mockImplementation(async (input) => {
    const url = String(input);
    const isDownload = url.includes('lines=5000');
    const status = isDownload ? (downloadStatus as number) : 200;
    const body = isDownload ? downloadBody : sampleLogs;
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  });
}

function downloadCalls(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.map((c) => String(c[0])).filter((u) => u.includes('lines=5000'));
}

describe('DashboardLogs download', () => {
  beforeAll(() => {
    // jsdom lacks these; Radix Select and the blob download path need them.
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    window.HTMLElement.prototype.hasPointerCapture = vi.fn();
    window.HTMLElement.prototype.setPointerCapture = vi.fn();
    window.HTMLElement.prototype.releasePointerCapture = vi.fn();
    URL.createObjectURL = vi.fn(() => 'blob:mock');
    URL.revokeObjectURL = vi.fn();
    // jsdom has no PointerEvent; Radix checks event.button/ctrlKey on it.
    class MockPointerEvent extends Event {
      button: number;
      ctrlKey: boolean;
      pointerType: string;
      constructor(type: string, props: PointerEventInit = {}) {
        super(type, props);
        this.button = props.button ?? 0;
        this.ctrlKey = props.ctrlKey ?? false;
        this.pointerType = props.pointerType ?? 'mouse';
      }
    }
    window.PointerEvent = MockPointerEvent as unknown as typeof PointerEvent;
  });
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('surfaces a failed download as an inline error instead of silently doing nothing', async () => {
    mockFetch({ downloadStatus: 500, downloadBody: { error: 'log file unreadable' } });
    render(<DashboardLogs />);
    await waitFor(() => expect(screen.getByTestId('logs-row')).toBeTruthy());

    fireEvent.click(screen.getByTestId('logs-download'));
    await waitFor(() => expect(screen.getByTestId('logs-download-error')).toBeTruthy());
    expect(screen.getByTestId('logs-download-error').textContent).toContain('log file unreadable');
  });

  it('a network failure during download is caught and surfaced', async () => {
    vi.spyOn(global, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('lines=5000')) throw new Error('offline');
      return new Response(JSON.stringify(sampleLogs), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    render(<DashboardLogs />);
    await waitFor(() => expect(screen.getByTestId('logs-row')).toBeTruthy());

    fireEvent.click(screen.getByTestId('logs-download'));
    await waitFor(() => expect(screen.getByTestId('logs-download-error')).toBeTruthy());
    expect(screen.getByTestId('logs-download-error').textContent).toContain('offline');
  });

  it('downloads without a level param while the filter is "All levels"', async () => {
    const fetchMock = mockFetch();
    render(<DashboardLogs />);
    await waitFor(() => expect(screen.getByTestId('logs-row')).toBeTruthy());

    fireEvent.click(screen.getByTestId('logs-download'));
    await waitFor(() => expect(downloadCalls(fetchMock)).toHaveLength(1));
    expect(downloadCalls(fetchMock)[0]).not.toContain('level=');
    expect(screen.queryByTestId('logs-download-error')).toBeNull();
  });

  it('download respects the active level filter', async () => {
    const fetchMock = mockFetch();
    render(<DashboardLogs />);
    await waitFor(() => expect(screen.getByTestId('logs-row')).toBeTruthy());

    fireEvent.pointerDown(screen.getByTestId('logs-level-select'), { button: 0, ctrlKey: false });
    const warnOption = await screen.findByTestId('logs-level-warn');
    fireEvent.pointerUp(warnOption);
    fireEvent.click(warnOption);
    // The view re-fetches with the filter once the selection lands.
    await waitFor(() =>
      expect(fetchMock.mock.calls.map((c) => String(c[0])).some((u) => u.includes('level=warn'))).toBe(true),
    );

    fireEvent.click(screen.getByTestId('logs-download'));
    await waitFor(() => expect(downloadCalls(fetchMock)).toHaveLength(1));
    expect(downloadCalls(fetchMock)[0]).toContain('level=warn');
  });
});

describe('DashboardLogs copy', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows the startup-warnings triage note', async () => {
    mockFetch();
    render(<DashboardLogs />);
    await waitFor(() => expect(screen.getByTestId('logs-triage-note')).toBeTruthy());
    expect(screen.getByTestId('logs-triage-note').textContent).toBe('Warnings during startup are normal.');
  });

  it('explains a rotated tail in plain language', async () => {
    vi.spyOn(global, 'fetch').mockImplementation(
      async () =>
        new Response(JSON.stringify({ ...sampleLogs, partial: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    );
    render(<DashboardLogs />);
    await waitFor(() => expect(screen.getByText(/Showing the most recent log lines/)).toBeTruthy());
    expect(screen.queryByText(/bytes we could consistently capture/)).toBeNull();
  });
});

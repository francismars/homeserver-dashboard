import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PkarrRecordViewer, formatPacketAge } from './PkarrRecordViewer';
import type { PkarrHealthResponse } from './DashboardOverview.types';

const base: PkarrHealthResponse = {
  verdict: 'verified',
  gates: { address: 'match', domain: 'match' },
  published: { address: '1.2.3.4:6287', domain: 'pubky.example.com' },
  expected: { address: '1.2.3.4:6287', domain: 'pubky.example.com:443' },
  timestamp_ms: Date.now() - 60_000,
  packet_age_ms: 60_000,
  records: [{ name: '@', type: 'A', value: '1.2.3.4', ttl: 3600 }],
};

describe('formatPacketAge', () => {
  it('renders informational, never-alarming relative ages across every boundary', () => {
    expect(formatPacketAge(30_000)).toBe('less than a minute ago');
    expect(formatPacketAge(60_000)).toBe('1 minute ago');
    expect(formatPacketAge(5 * 60_000)).toBe('5 minutes ago');
    expect(formatPacketAge(60 * 60_000)).toBe('1 hour ago');
    expect(formatPacketAge(3 * 60 * 60_000)).toBe('3 hours ago');
    expect(formatPacketAge(47 * 60 * 60_000)).toBe('47 hours ago');
    expect(formatPacketAge(48 * 60 * 60_000)).toBe('2 days ago');
    expect(formatPacketAge(30 * 24 * 60 * 60_000)).toBe('30 days ago');
  });
});

describe('PkarrRecordViewer', () => {
  it('verified: records table, age line, pkdns link, no mismatch box', () => {
    render(<PkarrRecordViewer open onOpenChange={() => {}} result={base} pubkey="abc123" />);
    expect(screen.getByTestId('pkarr-viewer-records').textContent).toContain('1.2.3.4');
    expect(screen.getByTestId('pkarr-viewer-age').textContent).toContain('1 minute ago');
    expect(screen.queryByTestId('pkarr-viewer-mismatch')).toBeNull();
    expect(screen.getByTestId('pkarr-viewer-pkdns-link').getAttribute('href')).toBe('https://pkdns.net/?id=abc123');
  });

  it('mismatch: shows configured-vs-published for the failing gate only', () => {
    render(
      <PkarrRecordViewer
        open
        onOpenChange={() => {}}
        result={{
          ...base,
          verdict: 'mismatch',
          gates: { address: 'match', domain: 'mismatch' },
          published: { address: '1.2.3.4:6287', domain: 'old.example.org' },
        }}
        pubkey="abc123"
      />,
    );
    const box = screen.getByTestId('pkarr-viewer-mismatch');
    expect(box.textContent).toContain('Domain');
    expect(box.textContent).toContain('pubky.example.com:443'); // configured
    expect(box.textContent).toContain('old.example.org'); // published
    expect(box.textContent).not.toContain('Address'); // address gate matched, omitted
  });

  it('not_found: no records line, age omitted', () => {
    render(
      <PkarrRecordViewer
        open
        onOpenChange={() => {}}
        result={{
          ...base,
          verdict: 'not_found',
          published: { address: null, domain: null },
          timestamp_ms: null,
          packet_age_ms: null,
          records: [],
        }}
        pubkey="abc123"
      />,
    );
    expect(screen.getByTestId('pkarr-viewer-no-records')).toBeTruthy();
    expect(screen.queryByTestId('pkarr-viewer-age')).toBeNull();
  });
});

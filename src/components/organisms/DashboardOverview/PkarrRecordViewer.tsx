'use client';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ExternalLink, AlertCircle, CircleCheckBig } from 'lucide-react';
import type { PkarrHealthResponse } from './DashboardOverview.types';

/** "published 23 minutes ago" - deliberately informational in tone: the
 * homeserver republishes hourly but relays may serve an older cached copy,
 * and an old-but-correct record is fine (user decision: age never alarms). */
export function formatPacketAge(ageMs: number): string {
  const minutes = Math.floor(ageMs / 60_000);
  if (minutes < 1) return 'less than a minute ago';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} days ago`;
}

const VERDICT_SUMMARY: Record<PkarrHealthResponse['verdict'], string> = {
  verified: 'This record is signed by your homeserver and matches its configuration.',
  mismatch: 'This record is validly signed but does not match what your homeserver is configured to publish.',
  invalid: 'The record found on the relays failed signature verification. This should not happen.',
  not_found: 'No record was found on the Pubky relays for this key.',
  unavailable: 'The Pubky relays could not be reached, so the record could not be fetched.',
};

/**
 * The "View" dialog for the Overview's Pubky-network row: the parsed PKARR
 * record as published (type/name/value/TTL), its age, the expected-vs-
 * published comparison when something differs, and the pkdns.net explorer
 * link as an independent second opinion.
 */
export function PkarrRecordViewer({
  open,
  onOpenChange,
  result,
  pubkey,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: PkarrHealthResponse;
  pubkey: string;
}) {
  const mismatches = (
    [
      ['Address', 'address'],
      ['Domain', 'domain'],
    ] as const
  ).filter(([, gate]) => result.gates[gate] === 'mismatch');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-xl" data-testid="pkarr-record-viewer">
        <DialogHeader>
          <DialogTitle className="text-base">PKARR record</DialogTitle>
          <DialogDescription className="text-xs">
            What this homeserver has published to the Pubky network (Mainline DHT) under its public key.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-xs">
          <p
            className={
              result.verdict === 'verified' || result.verdict === 'unavailable'
                ? 'text-muted-foreground'
                : 'text-amber-400'
            }
            data-testid="pkarr-viewer-summary"
          >
            {result.verdict === 'verified' ? (
              <CircleCheckBig className="mr-1 inline h-3 w-3 align-[-2px] text-brand" />
            ) : (
              <AlertCircle className="mr-1 inline h-3 w-3 align-[-2px]" />
            )}
            {VERDICT_SUMMARY[result.verdict]}
            {result.packet_age_ms !== null && (
              <span data-testid="pkarr-viewer-age"> Published {formatPacketAge(result.packet_age_ms)}.</span>
            )}
          </p>

          {mismatches.length > 0 && (
            <div className="rounded-md border border-amber-400/40 p-2" data-testid="pkarr-viewer-mismatch">
              <p className="mb-1 font-medium text-amber-400">Configured vs published</p>
              <table className="w-full text-left" aria-label="Configured versus published">
                <tbody>
                  {mismatches.map(([label, gate]) => (
                    <tr key={gate}>
                      <td className="pr-2 align-top text-muted-foreground">{label}</td>
                      <td className="pr-2 align-top font-mono break-all">{result.expected[gate] ?? '—'}</td>
                      <td className="align-top font-mono break-all text-amber-400">
                        {result.published[gate] ?? 'not published'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-1 text-muted-foreground">
                The record updates when the homeserver republishes (hourly and at every restart).
              </p>
            </div>
          )}

          {result.records.length > 0 ? (
            <div className="overflow-x-auto">
              <table
                className="w-full text-left"
                aria-label="Published PKARR records"
                data-testid="pkarr-viewer-records"
              >
                <thead>
                  <tr className="text-muted-foreground">
                    <th className="pr-3 font-medium">Type</th>
                    <th className="pr-3 font-medium">Name</th>
                    <th className="pr-3 font-medium">Value</th>
                    <th className="font-medium">TTL</th>
                  </tr>
                </thead>
                <tbody>
                  {result.records.map((rec, i) => (
                    <tr key={i} className="border-t border-border/40">
                      <td className="py-1 pr-3 align-top font-mono">{rec.type}</td>
                      <td className="py-1 pr-3 align-top font-mono break-all">{rec.name}</td>
                      <td className="py-1 pr-3 align-top font-mono break-all">{rec.value}</td>
                      <td className="py-1 align-top font-mono">{rec.ttl}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-muted-foreground" data-testid="pkarr-viewer-no-records">
              No records to show.
            </p>
          )}

          <a
            href={`https://pkdns.net/?id=${encodeURIComponent(pubkey)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground hover:underline"
            data-testid="pkarr-viewer-pkdns-link"
          >
            <ExternalLink className="h-3 w-3" />
            Verify independently on pkdns.net
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}

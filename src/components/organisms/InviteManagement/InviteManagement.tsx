'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Info, Copy, Check, QrCode, X } from 'lucide-react';
import { copyToClipboard } from '@/libs/utils';
import { QRCodeSVG } from 'qrcode.react';

const MOCK_USERS_BY_INVITE = [
  { inviteCode: 'INV-2024-001', userCount: 3 },
  { inviteCode: 'INV-2024-002', userCount: 2 },
  { inviteCode: 'INV-2024-003', userCount: 2 },
  { inviteCode: 'INV-2024-004', userCount: 1 },
] as const;

export interface InviteManagementProps {
  invites: string[];
  onGenerate: () => Promise<void>;
  isGenerating?: boolean;
  signupCodesTotal?: number;
  signupCodesUnused?: number;
  isStatsLoading?: boolean;
  homeserverPubkey?: string;
}

export function InviteManagement({
  invites,
  onGenerate,
  isGenerating,
  signupCodesTotal,
  signupCodesUnused,
  isStatsLoading,
  homeserverPubkey,
}: InviteManagementProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedUrlIndex, setCopiedUrlIndex] = useState<number | null>(null);
  const [expandedInviteIndex, setExpandedInviteIndex] = useState<number | null>(null);

  const hasStats = typeof signupCodesTotal === 'number' && typeof signupCodesUnused === 'number';
  const totalGenerated = hasStats ? signupCodesTotal : undefined;
  const totalUnused = hasStats ? signupCodesUnused : undefined;
  const totalUsed = hasStats ? Math.max(0, signupCodesTotal - signupCodesUnused) : undefined;

  const handleCopy = async (invite: string, index: number) => {
    try {
      await copyToClipboard({ text: invite });
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch {
      // Handle copy error silently
    }
  };

  const generateSignupUrl = (inviteCode: string): string | null => {
    if (!homeserverPubkey) return null;
    return `pubkyauth://signup?hs=${encodeURIComponent(homeserverPubkey)}&st=${encodeURIComponent(inviteCode)}`;
  };

  const handleCopyUrl = async (inviteCode: string, index: number) => {
    const url = generateSignupUrl(inviteCode);
    if (!url) return;
    try {
      await copyToClipboard({ text: url });
      setCopiedUrlIndex(index);
      setTimeout(() => setCopiedUrlIndex(null), 2000);
    } catch {
      // Handle copy error silently
    }
  };

  const handleGenerate = async () => {
    await onGenerate();
  };

  return (
    <div className="space-y-4">
      {/* Generated Invites */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-sm sm:text-base">Generated Invites</CardTitle>
              <CardDescription className="text-xs sm:text-sm">Recently generated signup tokens</CardDescription>
            </div>
            <Button onClick={handleGenerate} disabled={isGenerating} size="sm" className="w-full sm:w-auto">
              {isGenerating ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  <span className="hidden sm:inline">Generating...</span>
                  <span className="sm:hidden">...</span>
                </>
              ) : (
                'Generate'
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {invites.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No invite codes generated yet. Click &quot;Generate&quot; to create one.
            </p>
          ) : (
            <div className="space-y-3">
              {invites.map((invite, index) => {
                const signupUrl = generateSignupUrl(invite);
                const isExpanded = expandedInviteIndex === index;
                return (
                  <div key={index} className="rounded-md border bg-muted/50 p-3">
                    {/* Invite Code Row */}
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <code className="flex-1 font-mono text-xs break-all sm:text-sm sm:break-normal">
                        {invite}
                      </code>
                      <div className="flex shrink-0 gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleCopy(invite, index)}
                          className="h-8 w-8"
                          title={copiedIndex === index ? 'Copied!' : 'Copy Code'}
                        >
                          {copiedIndex === index ? (
                            <Check className="h-4 w-4" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                        {signupUrl && (
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => setExpandedInviteIndex(isExpanded ? null : index)}
                            className="h-8 w-8"
                            title={isExpanded ? 'Hide QR Code' : 'Show QR Code'}
                          >
                            {isExpanded ? (
                              <X className="h-4 w-4" />
                            ) : (
                              <QrCode className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Expanded QR Code Section */}
                    {isExpanded && signupUrl && (
                      <div className="mt-4 space-y-3 border-t border-muted-foreground/20 pt-4">
                        <div className="text-xs font-medium text-muted-foreground">Signup URL:</div>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                          {/* QR Code */}
                          <div className="flex flex-col items-center gap-2">
                            <div className="rounded-lg border-2 border-border bg-white p-3">
                              <QRCodeSVG value={signupUrl} size={160} level="M" />
                            </div>
                            <p className="text-xs text-muted-foreground">Scan with Pubky Ring app</p>
                          </div>

                          {/* URL and Actions */}
                          <div className="flex-1 space-y-2">
                            <div className="rounded-md bg-background p-2">
                              <code className="block break-all text-xs text-muted-foreground">{signupUrl}</code>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleCopyUrl(invite, index)}
                                className="text-xs"
                              >
                                {copiedUrlIndex === index ? (
                                  <>URL Copied</>
                                ) : (
                                  <>Copy URL</>
                                )}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleCopy(invite, index)}
                                className="text-xs"
                              >
                                Copy Code Only
                              </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Share this QR code or URL with new users. They can scan it with the Pubky Ring app
                              to sign up.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invite Statistics */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">Invite Statistics</CardTitle>
            {!hasStats && (
              <Badge variant="outline" className="border-dashed text-xs font-normal">
                <Info className="mr-1 h-3 w-3" />
                Unavailable
              </Badge>
            )}
          </div>
          <CardDescription className="text-xs text-muted-foreground/70">
            Counts are provided by the homeserver. Per-invite usage breakdown requires additional backend endpoints.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold">
                {isStatsLoading ? <Skeleton className="mx-auto h-7 w-12" /> : (totalGenerated ?? '—')}
              </div>
              <div className="mt-1 text-xs text-muted-foreground/70">Total Generated</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">
                {isStatsLoading ? <Skeleton className="mx-auto h-7 w-12" /> : (totalUsed ?? '—')}
              </div>
              <div className="mt-1 text-xs text-muted-foreground/70">Used</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">
                {isStatsLoading ? <Skeleton className="mx-auto h-7 w-12" /> : (totalUnused ?? '—')}
              </div>
              <div className="mt-1 text-xs text-muted-foreground/70">Unused</div>
            </div>
          </div>
          <div className="mt-4 border-t border-muted-foreground/20 pt-4">
            <div className="mb-2 flex items-center gap-2">
              <div className="text-xs font-medium text-muted-foreground/70">Users by Invite:</div>
              <Badge variant="outline" className="border-dashed text-xs font-normal">
                <Info className="mr-1 h-3 w-3" />
                Soon
              </Badge>
            </div>
            <div className="space-y-1">
              {MOCK_USERS_BY_INVITE.map((item) => (
                <div key={item.inviteCode} className="flex justify-between text-xs text-muted-foreground/70 italic">
                  <span className="font-mono">{item.inviteCode}:</span>
                  <span>{item.userCount} users</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
